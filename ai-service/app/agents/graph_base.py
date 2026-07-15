import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable

from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from app.agents.nodes.act_node import act_node
from app.agents.nodes.context_node import context_node
from app.agents.nodes.plan_node import route_after_plan
from app.agents.state import AgentState
from app.core.identity import RequestIdentity
from app.integrations.events import current_event_sink

logger = logging.getLogger(__name__)

Node = Callable[[AgentState], Awaitable[dict]]


def assemble_graph(plan_node: Node, post_plan_nodes: list[tuple[str, Node]]) -> StateGraph:
    """The shared shape every role graph reuses:

        START -> context -> plan -> act ⇄ (loop back to plan) -> post_plan_nodes... -> END

    `post_plan_nodes` is the ordered chain that runs once the model stops requesting tools —
    e.g. [('reflect', reflect_node), ('respond', respond_node)] for student/captain, or
    [('panel', panel_node), ('respond', respond_node)] for admin (no vault write).
    """
    graph = StateGraph(AgentState)
    graph.add_node('context', context_node)
    graph.add_node('plan', plan_node)
    graph.add_node('act', act_node)
    for name, fn in post_plan_nodes:
        graph.add_node(name, fn)

    graph.add_edge(START, 'context')
    graph.add_edge('context', 'plan')
    graph.add_conditional_edges('plan', route_after_plan, {'act': 'act', 'done': post_plan_nodes[0][0]})
    graph.add_edge('act', 'plan')
    for (name, _), (next_name, _) in zip(post_plan_nodes, post_plan_nodes[1:]):
        graph.add_edge(name, next_name)
    graph.add_edge(post_plan_nodes[-1][0], END)
    return graph


def _safe_jsonable(value: object) -> object:
    try:
        json.dumps(value, default=str)
        return value
    except TypeError:
        return str(value)


async def stream_graph(graph, initial_state: dict, config: dict) -> AsyncIterator[dict]:
    """Converts LangGraph's native event stream into the one SSE frame vocabulary every streaming
    route (`/chat`, `/admin/chat`, and Stage 9's problem-selection endpoint) uses:
    `text.delta`, `tool.call`, `tool.result`, `panel.*`, `nav.*`, `interrupt`, `error`, `done`.
    No route should hand-roll its own SSE framing — they all call this.
    """
    event_sink: list[dict] = []
    token = current_event_sink.set(event_sink)
    try:
        async for event in graph.astream_events(initial_state, config, version='v2'):
            kind = event['event']
            if kind == 'on_chat_model_stream':
                node_name = event.get('metadata', {}).get('langgraph_node')
                if node_name == 'plan':
                    chunk = event['data']['chunk']
                    text = chunk.content if isinstance(chunk.content, str) else ''
                    if text:
                        yield {'event': 'text.delta', 'data': json.dumps({'text': text})}
            elif kind == 'on_tool_start':
                yield {
                    'event': 'tool.call',
                    'data': json.dumps({'tool': event['name'], 'args': _safe_jsonable(event['data'].get('input'))}),
                }
            elif kind == 'on_tool_end':
                yield {
                    'event': 'tool.result',
                    'data': json.dumps({'tool': event['name'], 'result': _safe_jsonable(event['data'].get('output'))}),
                }

            while event_sink:
                ui_event = event_sink.pop(0)
                yield {'event': ui_event['event'], 'data': json.dumps(_safe_jsonable(ui_event['data']))}

        state_snapshot = await graph.aget_state(config)
        if state_snapshot.next:
            yield {'event': 'interrupt', 'data': json.dumps({'next': list(state_snapshot.next)})}
        else:
            yield {'event': 'done', 'data': json.dumps({})}
    except Exception as exc:
        logger.exception('graph stream failed')
        yield {'event': 'error', 'data': json.dumps({'detail': str(exc)})}
    finally:
        current_event_sink.reset(token)


async def run_chat_turn(
    graph, session_id: str, prompt: str, identity: RequestIdentity
) -> AsyncIterator[dict]:
    """Shared by `/chat` and `/admin/chat`: resumes a pending `interrupt()` if this session has
    one, otherwise starts a fresh turn — then streams it through `stream_graph`."""
    config = {'configurable': {'thread_id': session_id}}
    snapshot = await graph.aget_state(config)
    if snapshot.next:
        graph_input = Command(resume=prompt)
    else:
        graph_input = {
            'messages': [HumanMessage(content=prompt)],
            'identity': identity.model_dump(),
            'intent': None,
            'memory_digest': '',
            'rag_context': [],
            'tool_results': [],
            'panel_events': [],
            'ui_events': [],
            'scratch': {},
        }
    async for frame in stream_graph(graph, graph_input, config):
        yield frame
