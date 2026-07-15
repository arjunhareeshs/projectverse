# Stage 10 — Feature 2 (Student Copilot), Feature 3 (Admin Analyst), Jobs & Hardening

> Ref: master plan Parts L, M, P, Q (Phases 5–7), R. The last stage — everything it needs already exists;
> this is composition, background-job infrastructure, and production readiness.

## Goal

Finish the two remaining product features on top of the `student_agent` and `admin_agent` graphs (scaffolded
in Stage 8), build the background job runner those features need (weekly reports, scheduled reflection),
and close out the plan with the hardening items required before this is production-facing.

## Why this comes last

Both features are compositions of subsystems that already exist by Stage 9 — no new subsystem is invented
here, which is exactly why it's safe to build last and can absorb whatever polish is left over from earlier
stages (e.g. if Stage 7's tool audit logging needs tightening, it surfaces here under load).

## Dependencies

Everything — Stages 1 through 9.

---

## Part 1 — Feature 2: Student Productivity Copilot (`student_agent`)

### Files to create
```
app/jobs/runner.py               # asyncio job runner + Job table (status/result) in jobs.sqlite
app/jobs/weekly_report_job.py    # per-student weekly job using skills/weekly_report.md
app/schemas/jobs.py              # JobStatus, JobResult
```
(`student_agent.py` itself was built in Stage 8 — this part wires its remaining capabilities and the
weekly-report job that runs alongside it.)

### Key design details
- **Write & post chat content** → already-registered `post_team_message`, `create_document` tools (Stage 7);
  no new code, just confirm the student graph actually reaches for them on relevant prompts.
- **Read notifications → converse → build a plan** → `read_notifications` tool result flows into
  `skills/plan_from_notifications.md` (Stage 2) → the plan becomes real `create_task` /
  `create_schedule_event` tool calls, not just descriptive text.
- **Weekly report with improvements + to-dos** → `weekly_report_job.py` runs on a schedule per student:
  pulls the week's activity via `list_tasks`/task history, renders `skills/weekly_report.md`, produces a
  2–3 sentence summary + up to 3 improvements + up to 3 to-dos (same structured pattern already proven by
  the existing `team_coordination_insights` endpoint), and stores it as a `Report`/`Document` via the
  `create_document` tool so it's visible in-product, not just returned from a one-off API call.
- **Drive the UI** → `navigate_to(section, subsection)` and `move_kanban_card` tools (Stage 7) mean the
  copilot can be asked "open my kanban board and move task X to done" and it actually emits the `nav.to` +
  `tool.call` events the frontend needs to follow.
- **Memory-aware** → already true by construction (`context_node`/`reflect_node` from Stage 8 run on every
  turn) — this part just needs an end-to-end test that a preference stated once is honored in a later
  session.

### `jobs/runner.py`
```python
class JobRunner:
    async def submit(self, job_type: str, payload: dict) -> str: ...   # returns job_id
    async def status(self, job_id: str) -> JobStatus: ...
```
`asyncio`-based, backed by a `Job` table in `jobs.sqlite` (`{id, type, status, result, created_at}`). This
is deliberately the simplest thing that works — the explicit upgrade path to Celery/Redis (noted in the
master plan) only gets taken if load actually requires it; don't build that infrastructure speculatively.

### Acceptance criteria (Feature 2)
- "Plan my week from my notifications" results in real `create_task`/`create_schedule_event` calls
  (visible in the Stage 7 audit log) matching the notifications' content, not a text-only plan.
- A triggered `weekly_report_job` for a student with a week of real task activity produces a report whose
  improvements/to-dos are specific to that student's actual overdue/completed tasks — not generic advice.
- "Move [task] to done" from chat results in a real kanban status change confirmed by re-fetching the task.
- A preference stated in one session ("I prefer short answers") is reflected in the *next* session's
  response style without being restated — proves the Stage 5/6 memory loop closes in practice.

---

## Part 2 — Feature 3: Admin Analytics Chat + Context Panel (`admin_agent`)

### Files to create
```
app/tools/backend/analytics_tools.py   # (if not finished in Stage 7) db_query aggregation tool
app/api/admin.py                       # finalize POST /admin/chat with full panel event wiring
```

### Key design details
- **Chat-only, read-only.** Confirmed structurally by Stage 7's `ToolRegistry.for_role("ADMIN")` — this
  stage is about making the *output* (insight + narrative) good, not about further restricting capability.
- **Two data paths merged:** structured ("top 5 students in AI Core by score") → `db_query` tool → a Node
  `/internal/analytics/query` aggregation endpoint (🔵, read-only, reuses Prisma). Semantic ("who's strong
  at vector search," "how can I help improve them") → `rag_search` + `memory_traverse`. `plan_node` decides
  which (or both) a given admin question needs, and `respond_node` merges them into one narrative via
  `skills/insight_narration.md`.
- **Context-panel SSE protocol** (`panel_node` from Stage 8, finalized here):
  ```json
  { "type": "panel.open", "title": "Top teams · AI Core",
    "items": [ {"id":"t1","kind":"team","title":"Team Pulse 2","subtitle":"Vector search over departmental docs",
                "metrics":{"score":66,"progress":44,"status":"At Risk"}} ] }
  { "type": "panel.close" }
  { "type": "context.pull", "entity": { "kind":"team","id":"t1", ...full card... } }
  ```
  🔵 Frontend rules this protocol must satisfy: panel hidden by default, opens only on panel-worthy results
  (or manual open), admin can close it, left sidebar collapses to icons when open, tapping an item injects
  the entity's full card into the inner chat and pulls it into conversation context for the next turn.
- History persists to the existing `AdminChatHistory` Prisma model — no new table needed, just start writing
  to it from this endpoint.

### Acceptance criteria (Feature 3)
- "Bring me the top 5 students in AI Core" triggers `db_query` + `rag_search`, streams a narrative, and
  emits a `panel.open` event with 5 real student cards pulled from the live database — not fabricated names.
- Tapping a panel item (simulated by sending the resulting `context.pull` entity id back as the next
  message's context) produces a follow-up answer ("his strengths/weaknesses") grounded specifically in that
  student's vault + KB — verify the answer changes appropriately when tested against two different students.
- Attempting to get the admin agent to perform a write ("create a task for this student") is refused, citing
  its restricted tool set — not silently ignored, not fabricated as done.
- `AdminChatHistory` rows are created for each turn with `prompt`/`response` populated correctly.

---

## Part 3 — Hardening (closes out the master plan's Phase 7)

- **Evaluation harness:** a small offline test set (10–20 representative prompts per feature) with expected
  tool-call patterns and grounding checks, run before any prompt or model change ships.
- **Rate limiting:** per-user request caps on `/chat`, `/admin/chat`, `/problem-selection/*` to prevent
  runaway tool-loop costs.
- **Observability:** the Stage 7 audit log + job status table (this stage) feed a simple dashboard or at
  minimum structured logs greppable by `session_id`/`user_id`/`tool_name`.
- **Job queue upgrade path:** confirm `JobRunner` is swappable for Celery/Redis without changing any caller
  (`submit`/`status` signatures stay the same) — don't actually migrate unless load demands it.
- **Groq model watch:** since the default model (`llama-4-scout-17b-16e-instruct`) sits on a provider with a
  documented deprecation history (Maverick was deprecated 2026-02-20), add a startup log line stating the
  active model and fallback so a future deprecation is immediately visible in logs rather than discovered
  via silent 400s.

## Final acceptance criteria (whole AI service)

- All three features (captain problem selection, student copilot, admin analyst) work end-to-end against a
  real Node backend and real Postgres data — not stubs.
- Every write the AI performs is visible in Node's normal audit/activity log, indistinguishable in the DB
  from a human performing the same action through the UI.
- Killing and restarting the AI service mid-conversation resumes a captain's `interrupt()`-paused flow
  correctly from the SQLite checkpoint.
- The service degrades gracefully (fallback model, clear error surfaces) rather than hard-failing when Groq
  rejects the primary model id.
