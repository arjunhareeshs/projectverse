# Stage 5 — Memory: The Per-User `.vault/` (Markdown Files)

> Ref: master plan Part H.1–H.2. **Boundary reminder (corrected earlier in the master plan):** this vault
> is entirely separate from `app/prompts/` (Stage 2). Prompts are authored-by-us system instructions and
> skills, shipped with the code. The vault is per-user runtime memory, generated and rewritten as people
> use the platform. Never write vault content into `app/prompts/`, and never treat a prompt file as memory.

## Goal

Build the storage layer for long-term/semantic/persistent memory: one `.vault/` directory per user
containing Markdown files with YAML frontmatter, structured the way you'd structure an Obsidian vault —
readable by a human, traversable by a graph (Stage 6), and safe to rewrite over time.

## Why this comes fifth

RAG (Stages 3–4) handles documents; it does not naturally hold "this student prefers async standups" or
"this team's captain is Mia K." Memory is a distinct system with different write patterns (small, frequent,
per-user updates) and different retrieval needs (structural links between facts, not just similarity).
Building the storage/write layer before the graph/traversal layer (Stage 6) keeps each testable in isolation.

## Dependencies

Stage 1 (config for `VAULT_ROOT`). Does not depend on RAG or prompts.

## Files to create

```
app/memory/vault.py          # Vault(userId): path management, read/write MD + frontmatter
app/memory/templates.py      # canonical MD templates for each file type
app/memory/writer.py         # extract facts from a turn/event → append to the right MD file
app/memory/types.py          # ShortTerm/LongTerm/Episodic/Semantic/Procedural → storage mapping
app/schemas/memory.py        # VaultFile, FrontMatter, WriteRequest pydantic models
```

## Key design details

### The four memory types → where each actually lives (`types.py`)
This mapping is the one piece of the whole plan most likely to be misread, so state it plainly:

| Type | What it means here | Storage |
|---|---|---|
| Short-term | this session's working context | **not** in the vault — lives in LangGraph state + SQLite checkpoint (Stage 8) |
| Long-term / semantic / persistent | durable facts about the user | **this stage** — `.vault/*.md` |
| Episodic | dated event log | **this stage** — `.vault/episodes/YYYY-MM-DD.md` |
| Procedural | how this user likes work done | **this stage** — `.vault/procedures/*.md` |

### Vault layout (`data/vaults/<userId>/`)
```
profile.md   preferences.md   interests.md   project.md   team.md
strengths.md weaknesses.md    improvements.md plans.md    backlogs.md
schedule.md  db_snapshot.md
episodes/2026-07-14.md ...
procedures/standup.md ...
```
`templates.py` defines the canonical frontmatter + section skeleton for each file so the writer (below)
always produces consistent, parseable output rather than free-form prose that drifts file to file.

### Frontmatter contract (`vault.py`)
Every file uses `python-frontmatter`:
```yaml
---
type: semantic          # semantic | episodic | procedural
tags: [skills, ranking]
links: ["[[profile]]", "[[project]]"]
last_updated: 2026-07-14
decay: 0.98              # written here, consumed/updated by Stage 6's reflection job
confidence: 0.9
---
Strong in **vector search** and Python. UserSkill rank 88/285 in "AI Core".
Led embedding pipeline in [[project]]. Pairs well with [[user:mia_k]] on retrieval.
```
`[[wikilink]]` syntax in the body is what Stage 6's graph builder parses into edges — write the linking
convention correctly here even though nothing consumes it until the next stage.

### `Vault` class
```python
class Vault:
    def __init__(self, user_id: str): ...
    def read(self, filename: str) -> VaultFile: ...
    def write(self, filename: str, body: str, frontmatter: dict) -> None: ...   # full overwrite
    def append_episode(self, date: str, entry: str) -> None: ...                # episodic log growth
    def list_files(self) -> list[str]: ...
    def ensure_scaffold(self) -> None: ...   # create empty templated files on first use
```
`ensure_scaffold()` is called the first time a user's vault is touched (e.g. their first chat turn) so
every user has the full canonical file set from day one, even if mostly empty.

### `writer.py` — populating the vault from real interactions
```python
def extract_and_write(user_id: str, turn: ConversationTurn, llm: LLMProvider) -> list[str]: ...  # returns touched files
```
Uses the `skills/memory_extract.md` skill (Stage 2) to pull durable facts out of a conversation turn or a
tool result, decide which file each fact belongs in, and append/merge it (dedup by content hash so repeated
facts don't bloat the file). This is what turns "the agent had a conversation" into "the agent remembers."

## What NOT to build yet

No graph construction, no traversal, no reflection/decay logic (Stage 6). No `memory_read`/`memory_write`
**tool** wrappers for the agent to call (Stage 7) — this stage only builds the underlying storage class.

## Acceptance criteria

- `Vault("test-user").ensure_scaffold()` creates every canonical file with valid, parseable frontmatter and
  no body content that isn't the template placeholder.
- Calling `writer.extract_and_write` with a hand-built fake conversation turn that mentions a preference
  ("I prefer async standups") results in `preferences.md` being updated with that fact and `last_updated`
  bumped — verify by re-reading the file.
- Calling `extract_and_write` twice with the same fact does not duplicate it in the file (dedup works).
- Manually inspect a populated `strengths.md` and confirm a human could read it standalone and understand
  the student's situation — this is the bar ("readable md files"), not just machine-parseable data.
