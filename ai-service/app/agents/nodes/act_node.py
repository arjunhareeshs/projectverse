import json

from langchain_core.messages import ToolMessage

from app.agents.state import AgentState
from app.core.identity import RequestIdentity, current_identity
from app.tools.registry import get_tool_registry


async def act_node(state: AgentState) -> dict:
    """Executes every tool call the model just requested, then loops back to `plan` (see the
    `act` -> `plan` edge in each role graph) until the model stops asking for tools.

    Tools are looked up fresh from `ToolRegistry.for_role` rather than trusting whatever name the
    model produced — belt-and-braces alongside `bind_tools` only exposing the role's allowed set
    in the first place: if a model ever hallucinates a call to an unlisted tool, this returns a
    structured "no such capability" result instead of crashing the graph.
    """
    identity_dict = state['identity']
    role = identity_dict['role'].upper()
    tools_by_name = {t.name: t for t in get_tool_registry().for_role(role, state.get('intent'))}

    last_ai = state['messages'][-1]
    tool_calls = getattr(last_ai, 'tool_calls', None) or []

    # Tools resolve "who's calling" via the `current_identity` contextvar (app/core/identity.py),
    # not a tool argument. LangGraph's own node scheduling isn't guaranteed to preserve whatever
    # contextvar was set at the original HTTP request, so this node re-binds it explicitly from
    # the (checkpointed, authoritative) state before any tool runs.
    token = current_identity.set(RequestIdentity(**identity_dict))
    try:
        tool_messages: list[ToolMessage] = []
        tool_results: list[dict] = []
        for call in tool_calls:
            tool = tools_by_name.get(call['name'])
            if tool is None:
                result = {
                    'error': 'ToolNotFound',
                    'detail': f'No tool named "{call["name"]}" is available to this session/role.',
                }
            else:
                result = await tool.ainvoke(call['args'])
            tool_results.append({'tool': call['name'], 'args': call['args'], 'result': result})
            tool_messages.append(ToolMessage(content=json.dumps(result, default=str), tool_call_id=call['id']))
    finally:
        current_identity.reset(token)

    return {'messages': tool_messages, 'tool_results': state.get('tool_results', []) + tool_results}
