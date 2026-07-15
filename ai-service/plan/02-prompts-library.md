# Stage 2 — Prompts Library: System Prompts + Skills

> Ref: master plan Part F. **Important distinction, corrected in the master plan and repeated here:**
> `app/prompts/` contains only **system prompts** (agent identity per role) and **skills** (reusable
> task-capability instructions). It contains **no user data**. The **`.vault/`** built in Stage 5 is the
> separate system that holds per-user memory Markdown files. Do not merge these two folders or concepts.

## Goal

Give the agent its identity (the nine traits from Stage 0 §2), its operating rules, and a library of
reusable "skills" — focused instructions for specific tasks (shortlisting problems, writing a weekly
report, narrating an insight) — all as versioned, template-rendered Markdown, not hard-coded Python strings.

## Why this comes second

Stage 1 proved raw LLM calls work. Before building RAG/memory/tools (which the agent will *use*), the
agent needs to know **what it is** and **how it's allowed to behave** — otherwise every later stage has to
improvise prompt text inline, which drifts and can't be reviewed as a single artifact.

## Dependencies

Stage 1 (`LLMProvider` renders these prompts into `chat()`/`stream()` calls).

## Files to create

```
app/prompts/__init__.py            # PromptLibrary: load, cache, Jinja2 render, @v2 versioning
app/prompts/system/core_system.md  # master identity: 9 traits + 5 hard rules (see below)
app/prompts/system/captain_advisor.md
app/prompts/system/student_copilot.md
app/prompts/system/admin_analyst.md
app/prompts/skills/problem_shortlist.md
app/prompts/skills/problem_uniqueness.md
app/prompts/skills/weekly_report.md
app/prompts/skills/plan_from_notifications.md
app/prompts/skills/insight_narration.md
app/prompts/skills/memory_extract.md
app/prompts/skills/memory_reflect.md
app/prompts/fragments/output_format.md
app/prompts/fragments/tool_use_policy.md
app/prompts/fragments/safety.md
```

## Key design details

### `PromptLibrary` (`__init__.py`)
```python
class PromptLibrary:
    def render(self, name: str, **ctx) -> str: ...   # e.g. render("system/core_system", role="STUDENT", ...)
```
Loads `.md` files as Jinja2 templates once, caches by name, supports a `fragment(name)` Jinja helper so
system prompts can `{{ fragment("tool_use_policy") }}` instead of duplicating text. Version bump = new file
`core_system@v2.md`; callers pin a version explicitly so a prompt change never silently changes behavior
mid-session.

### `system/core_system.md` — the master identity
Encodes the mission (discipline in product development) and the nine traits as **operating instructions**,
not adjectives — each trait maps to a rule an evaluator could check:

- PRD-driven → "reference or offer to update the project's PRD document when discussing scope"
- Unique positioning & value provider → "when proposing a solution/approach, always name what makes it
  different from the obvious approach"
- Self-learning → "treat memory as authoritative context, and flag when you're updating a belief about a user"
- Manager / Delegator → "prefer assigning a concrete owner and due date over vague suggestions"
- Indicator → "surface risk signals proactively, don't wait to be asked"
- Consolidator → "compress multiple tool results into one coherent narrative, don't dump raw data"
- Evaluator → "score/compare only using retrieved evidence, cite what grounded the score"
- Monitor → "track progress against milestones, note drift from schedule"

Plus the **five hard rules** (verbatim from the master plan, Part A): no fabricated facts, availability is
law, role-scoped tool use, every capability is a tool, writes go through Node. These are non-negotiable
lines near the top of `core_system.md` — every role-specific system prompt inherits them by composing this
file first.

### Role system prompts (`captain_advisor.md`, `student_copilot.md`, `admin_analyst.md`)
Each is short: `{{ include("system/core_system") }}` + a role-specific paragraph. `admin_analyst.md` adds an
explicit line: "You have no navigation, write, post, or delegation tools this session — analysis and
conversation only," which is a prompt-level reinforcement of the tool-registry-level restriction built in
Stage 7 (defense in depth, not the only enforcement).

### Skills (`skills/*.md`)
Each skill is a focused instruction rendered with **runtime data** injected via `**ctx` (tool results, RAG
hits) — never with hard-coded examples pretending to be real users. E.g. `skills/problem_shortlist.md`
takes `{team_profile, candidates}` and must instruct the model to return strict JSON with 5 ranked entries
and per-candidate fit reasoning (schema defined in Stage 9). `skills/weekly_report.md` takes
`{tasks, comments, completions}` and must instruct: 2–3 sentence summary, up to 3 improvements, up to 3
to-dos — mirroring the structured-output pattern already proven in the existing
`team_coordination_insights` endpoint (`app/api/inference.py`), which is the one piece of prompt work
already in the codebase worth reusing as a style reference.

## What NOT to build yet

No tool binding, no memory injection logic (memory *digest* rendering into `{{ memory_digest }}` is wired in
Stage 6, but the placeholder variable exists now). No RAG context injection logic (Stage 4). This stage is
purely the prompt text + the loader/renderer.

## Acceptance criteria

- `PromptLibrary().render("system/student_copilot", role="STUDENT", user=..., memory_digest="(none yet)")`
  returns a fully composed string with no unrendered `{{ }}` placeholders.
- Swapping `/chat` (from Stage 1) to render `system/student_copilot` instead of a raw prompt still streams
  correctly — proves the library integrates with `LLMProvider`.
- A prompt-only "dry run" test: call `skills/weekly_report` with a hand-built fake tool-result payload and
  confirm the model's output follows the exact structured format the skill demands (summary/improvements/todos).
- Editing `fragments/safety.md` and re-rendering any system prompt reflects the change without touching the
  system prompt file itself — proves composition works, not copy-paste.
