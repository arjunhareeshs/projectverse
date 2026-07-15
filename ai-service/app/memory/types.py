from enum import Enum


class MemoryKind(str, Enum):
    """Where each of the four memory types actually lives — see plan/05-memory-vault.md."""

    SHORT_TERM = 'short_term'  # this session's working context — NOT in the vault; LangGraph
    # state + SQLite checkpoint (Stage 8) owns this.
    SEMANTIC = 'semantic'  # durable facts about the user — this stage, `.vault/*.md`
    EPISODIC = 'episodic'  # dated event log — this stage, `.vault/episodes/YYYY-MM-DD.md`
    PROCEDURAL = 'procedural'  # how this user likes work done — this stage, `.vault/procedures/*.md`


# Maps a `skills/memory_extract.md` fact "type" to the canonical vault file it belongs in.
# "episodic" is handled separately (routed to episodes/<date>.md, not a fixed filename).
FACT_TYPE_TO_FILE: dict[str, str] = {
    'preference': 'preferences.md',
    'interest': 'interests.md',
    'strength': 'strengths.md',
    'weakness': 'weaknesses.md',
    'project': 'project.md',
    'commitment': 'plans.md',
}
