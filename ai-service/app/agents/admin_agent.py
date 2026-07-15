from app.agents.graph_base import assemble_graph
from app.agents.nodes.panel_node import panel_node
from app.agents.nodes.plan_node import make_plan_node
from app.agents.nodes.respond_node import respond_node
from app.llm.provider import LLMProvider


def build_admin_graph(llm_provider: LLMProvider, checkpointer):
    """Base shape with the restricted tool set (Stage 7) and `panel_node` wired in place of
    `reflect_node` — `act_node` here can never touch a write tool because none exist in
    `ToolRegistry.for_role('ADMIN')`, not because of a runtime check."""
    graph = assemble_graph(make_plan_node(llm_provider), [('panel', panel_node), ('respond', respond_node)])
    return graph.compile(checkpointer=checkpointer)
