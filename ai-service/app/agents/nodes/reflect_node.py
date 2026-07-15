from collections.abc import Awaitable, Callable

from langchain_core.messages import AIMessage, HumanMessage

from app.agents.state import AgentState
from app.llm.provider import LLMProvider
from app.memory.writer import extract_and_write
from app.schemas.memory import ConversationTurn


def _last_text(messages: list, message_type: type) -> str:
    for message in reversed(messages):
        if isinstance(message, message_type) and isinstance(message.content, str):
            return message.content
    return ''


def make_reflect_node(llm_provider: LLMProvider) -> Callable[[AgentState], Awaitable[dict]]:
    """Writes durable facts from this turn into the caller's vault (Stage 5). Admin has no
    self-vault write behavior — analyzing a student isn't a fact about the admin — so this node
    is only wired into the student/captain graphs, never the admin graph."""

    async def reflect_node(state: AgentState) -> dict:
        identity = state['identity']
        user_message = _last_text(state['messages'], HumanMessage)
        assistant_message = _last_text(state['messages'], AIMessage)
        if not user_message:
            return {}
        turn = ConversationTurn(user_message=user_message, assistant_message=assistant_message or None)
        touched = await extract_and_write(identity['user_id'], turn, llm_provider)
        return {'scratch': {**state.get('scratch', {}), 'memory_touched': touched}}

    return reflect_node
