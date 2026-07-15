from app.agents.graph_base import assemble_graph
from app.agents.nodes.plan_node import make_plan_node
from app.agents.nodes.reflect_node import make_reflect_node
from app.agents.nodes.respond_node import respond_node
from app.llm.provider import LLMProvider


def build_student_graph(llm_provider: LLMProvider, checkpointer):
    """The full base shape, full student/captain tool set. Also used for role=CAPTAIN turns that
    the router (Stage 8) doesn't classify as a problem-selection intent — the flagship captain
    subgraph (Stage 9) only takes over for that specific conversation."""
    graph = assemble_graph(
        make_plan_node(llm_provider),
        [('reflect', make_reflect_node(llm_provider)), ('respond', respond_node)],
    )
    return graph.compile(checkpointer=checkpointer)
