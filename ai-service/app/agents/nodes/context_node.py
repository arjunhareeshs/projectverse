import asyncio

from langchain_core.messages import HumanMessage

from app.agents.state import AgentState
from app.memory.traversal import traverse


def _last_human_text(messages: list) -> str:
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            return message.content if isinstance(message.content, str) else ''
    return ''


async def context_node(state: AgentState) -> dict:
    """Loads the caller's own memory digest via Stage 6 graph traversal. Admin has no
    self-vault worth digesting here — its equivalent is the `memory_traverse` *tool*, invoked
    explicitly during planning against whichever student/team is actually being discussed, not an
    automatic per-turn digest of "the admin's own vault" (which isn't a meaningful concept)."""
    identity = state['identity']
    if identity.get('role', '').upper() == 'ADMIN':
        return {'memory_digest': '(not applicable — admin uses the memory_traverse tool per subject)'}

    query = _last_human_text(state['messages'])
    bundle = await asyncio.to_thread(traverse, identity['user_id'], query, 800)
    return {'memory_digest': bundle.to_digest()}
