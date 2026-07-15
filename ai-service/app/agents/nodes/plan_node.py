from collections.abc import Awaitable, Callable

from langchain_core.messages import SystemMessage

from app.agents.state import AgentState
from app.llm.provider import LLMProvider
from app.prompts import get_prompt_library
from app.tools.registry import get_tool_registry

_ROLE_SYSTEM_PROMPT = {
    'STUDENT': 'system/student_copilot',
    'CAPTAIN': 'system/captain_advisor',
    'ADMIN': 'system/admin_analyst',
}


def make_plan_node(llm_provider: LLMProvider) -> Callable[[AgentState], Awaitable[dict]]:
    """Closes over the shared `LLMProvider` (built once at app startup) rather than storing it in
    state — state gets checkpointed to SQLite every step, and an `LLMProvider` isn't JSON-safe."""

    async def plan_node(state: AgentState) -> dict:
        identity = state['identity']
        role = identity['role'].upper()
        tools = get_tool_registry().for_role(role, state.get('intent'))

        system_prompt = get_prompt_library().render(
            _ROLE_SYSTEM_PROMPT.get(role, 'system/student_copilot'),
            role=role,
            user={
                'fullName': identity['user_id'],
                'team': identity.get('team_id') or '(none)',
                'core': '(unknown)',
            },
            memory_digest=state.get('memory_digest') or '(none)',
        )

        messages = [SystemMessage(content=system_prompt), *state['messages']]
        ai_message = await llm_provider.chat(messages, tools=tools)
        return {'messages': [ai_message]}

    return plan_node


def route_after_plan(state: AgentState) -> str:
    """Conditional edge out of `plan`: another round of tools, or done planning."""
    last = state['messages'][-1]
    if getattr(last, 'tool_calls', None):
        return 'act'
    return 'done'
