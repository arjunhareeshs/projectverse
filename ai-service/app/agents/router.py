from app.core.identity import RequestIdentity

_CAPTAIN_INTENT_KEYWORDS = (
    'register a project', 'register my project', 'pick a problem', 'choose a problem',
    'problem statement', 'problem statements', 'project statement', 'project statements',
    'choose a project', 'select a project', 'claim a problem', 'claim a project',
)


def is_captain_problem_intent(message: str) -> bool:
    lowered = message.lower()
    return any(keyword in lowered for keyword in _CAPTAIN_INTENT_KEYWORDS)


def route(identity: RequestIdentity, message: str) -> str:
    """Returns which compiled graph to use: 'admin' | 'captain' | 'student'. Keyword-based intent
    classification for the captain problem-selection flow — a lightweight heuristic rather than
    an extra LLM call; Stage 9 owns the real subgraph this routes into."""
    role = identity.role.upper()
    if role == 'ADMIN':
        return 'admin'
    if role == 'CAPTAIN' and is_captain_problem_intent(message):
        return 'captain'
    return 'student'
