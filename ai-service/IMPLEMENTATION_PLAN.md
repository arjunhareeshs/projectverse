# ProjectVerse — FULL AI Service Implementation Plan

This is the complete, code-level build plan for everything under `ai-service/`. It is written so a
developer can implement file-by-file without re-deciding architecture. The Node `server/` and React
`client/` are yours; §12 gives the exact contracts they must satisfy. Nothing here is built yet — the
current `ai-service/app` is a FastAPI skeleton whose `LlmProviderService.generate()` returns placeholder
text.

Legend: 🟢 = AI-service work (this plan) · 🔵 = your Node/React work · ⭐ = build first.

---

# PART A — Product intent → engineering principles

ProjectVerse is a **project-management + student-productivity platform** that enforces *discipline in
product development*. The AI is not a chatbot bolted on; it is an **operating agent** with nine standing
traits. Each trait becomes a concrete behavior in prompts + graph nodes:

| Trait | Concrete engineering behavior |
|---|---|
| PRD-driven | every project has a living PRD doc in RAG; agent references/updates it |
| Project selection — unique position & value | Feature 1: shortlist + uniqueness thesis (approach/method/value) |
| Self-learning agent | memory reflection: consolidates episodes → semantic facts, decay of stale facts |
| Manager | delegates/assigns tasks, tracks who-owns-what |
| Indicator | flags risk/overdue/silent tasks, raises signals |
| Consolidator | weekly report: rolls activity into a single narrative |
| Delegator | `assign_task` / `create_task` tools, workload balancing |
| Evaluator | scores progress vs peers, strengths/weaknesses |
| Monitor of project progress | milestone/turnaround/velocity monitoring loop |

**Five hard engineering rules** enforced everywhere:
1. **No fabricated facts.** Any factual claim about a user/team/DB must come from a tool call, RAG hit, or
   vault read — otherwise the agent says "I don't have that."
2. **Availability is law.** Problem statements that are `claimed`/`taken`/unavailable never surface.
3. **Role scoping.** Admin = chat/read/analyze only (no write/nav/delegate/post tools). Student/Captain =
   full toolset. Enforced at the `ToolRegistry` layer, not by prompt alone.
4. **Every capability is a tool.** No hidden side effects; the model acts only through registered tools.
5. **Writes go through Node.** The AI service never writes Postgres directly; it calls Node `/internal/*`
   so authz/validation/audit/sockets stay centralized.

---

# PART B — Tech stack, exact models & versions

| Layer | Choice | Exact id / package |
|---|---|---|
| LLM (default) | Groq | **`meta-llama/llama-4-scout-17b-16e-instruct`** — chosen default (Maverick deprecated 2026-02-20) |
| LLM SDK | `langchain-groq` `ChatGroq` | streaming, tool-calling |
| Fallback LLM | Groq | `openai/gpt-oss-120b` |
| Agent | LangGraph | `StateGraph`, `SqliteSaver` checkpointer, `interrupt()` |
| RAG | LlamaIndex | ingestion + retrievers + query engines |
| Embedding | HuggingFace | `sentence-transformers/all-MiniLM-L6-v2` (384-dim, cosine) |
| Parsing | Docling | layout-aware PDF/DOCX/PPTX/image → structured doc |
| Vector DB | **Qdrant** (rec.) | dense + sparse (hybrid), payload metadata filtering |
| Sparse | BM25 | `llama-index-retrievers-bm25` or Qdrant sparse vectors |
| Reranker | cross-encoder | `BAAI/bge-reranker-v2-m3` |
| Web search | DDGS | `duckduckgo-search` text + images |
| Browser | Playwright | headless chromium |
| Vault graph | NetworkX | graph over MD files + `[[wikilinks]]` |
| Frontmatter | `python-frontmatter` | YAML metadata on MD files |
| Transport | FastAPI + `sse-starlette` | SSE streaming for chat |

**⚠ Groq deprecation.** Groq deprecated `meta-llama/llama-4-maverick-17b-128e-instruct` on 2026-02-20
(https://console.groq.com/docs/deprecations). Today is 2026-07-14, so it may already 400. Mitigation: the
`LLMProvider` reads `AI_MODEL` + `AI_FALLBACK_MODEL` from env; the very first implementation task is a live
smoke call. If Maverick 400s, flip `AI_MODEL` to the fallback — zero code change.

---

# PART B1 — Frameworks architecture diagram

Which framework owns which layer, and how they stack. Every box is a real dependency from Part B.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ TRANSPORT / API           FastAPI  +  sse-starlette            (streaming chat, REST)  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ORCHESTRATION (agents)    LangGraph                                                    │
│                           StateGraph · SqliteSaver checkpoint (short-term mem) · interrupt() │
│                           ├── student_agent    ├── captain_agent    └── admin_agent    │
├───────────────┬───────────────────┬────────────────────┬──────────────────────────────┤
│ REASONING     │ RETRIEVAL (RAG)   │ MEMORY (.vault)    │ TOOLS (every capability)      │
│               │                   │                    │                               │
│ Groq LLM      │ LlamaIndex        │ NetworkX graph     │ backend/  → Node /internal/*  │
│ llama-4-scout │  ingest+retrieve  │  over md files     │ web/      → DDGS + bge rerank │
│ (fallback     │ Docling  (parse)  │ python-frontmatter │ image/    → DDGS images       │
│  gpt-oss-120b)│ all-MiniLM-L6-v2  │  (yaml metadata)   │ rag_search→ RAG column        │
│ via           │  (384-d embed)    │ [[wikilinks]] =    │ memory_*  → MEMORY column     │
│ langchain-groq│ Qdrant (dense+    │  graph edges       │ playwright→ headless chromium │
│ (tool-calling,│  sparse/BM25)     │ reflection + decay │ navigate/panel → SSE UI events│
│  streaming)   │ bge-reranker-v2-m3│                    │                               │
├───────────────┴───────────────────┴────────────────────┴──────────────────────────────┤
│ STORAGE       Qdrant (vectors)  ·  data/vaults/<userId>/ (md)  ·  jobs.sqlite  ·  Postgres (via Node) │
└──────────────────────────────────────────────────────────────────────────────────────┘

Cross-cutting: PromptLibrary (system prompts + skills, Jinja2) feeds REASONING · Jobs runner (asyncio)
drives ingest / weekly-report / reflection · core.security (HMAC) gates every request from Node.
```

---

# PART B2 — System design (components + request lifecycle)

## B2.1 Component / data-flow diagram
```
   React client                     Node server (Express)                 AI SERVICE (FastAPI)                 Data stores
 ┌───────────────┐   HTTPS/SSE   ┌────────────────────────┐   SSE+HMAC   ┌──────────────────────────┐
 │ ChatDock      │──────────────▶│ /api/ai/*  (proxy)     │─────────────▶│ api/  (chat/admin/problem)│
 │ AdminChat     │◀── stream ────│  authGuard → sign token │◀── stream ───│        │                  │
 │ Captain flow  │               │                        │              │        ▼                  │
 │ Context panel │               │ /api/internal/*        │◀─ tool calls─│ agents/ (LangGraph)       │
 └───────────────┘               │  (HMAC-guarded actions)│──── data ───▶│   router→student/captain/ │
        ▲                        │  reuse *.service.ts    │              │          admin graph      │
        │ nav.* / panel.*        │  analytics read svc    │              │   ├─ context ─┐           │
        │ SSE UI events          └───────────┬────────────┘              │   ├─ plan     │           │
        │                                    │ Prisma                    │   ├─ act(tools)│          │
        │                                    ▼                           │   ├─ reflect  │           │
        │                             ┌────────────┐                     │   └─ respond  │           │
        │                             │ Postgres   │                     │        │      │           │
        │                             └────────────┘                     │        ▼      ▼           │
        │                                                                │  rag/ ── Qdrant ◀── ingest│──▶ Qdrant
        │                                                                │  memory/ ── .vault md ────│──▶ data/vaults
        └────────────────────────────────────────────────────────────────  (SSE frames to client)   │──▶ jobs.sqlite
                                                                          └──────────────────────────┘
```

## B2.2 Request lifecycle (student/captain chat turn)
1. Client `POST /api/ai/chat {sessionId, message}` (browser JWT cookie).
2. Node `authGuard` verifies JWT → builds identity `{userId, role, teamId, orgId}` → signs `X-Internal-Token`
   (HMAC) → proxies to AI `POST /chat`, streaming SSE straight back to the browser.
3. AI `core.security` verifies the token → `router` picks the graph by role/intent.
4. **context node:** `memory.traversal` loads the vault digest (+ `RagQuery.search` if docs needed).
5. **plan node:** LLM (Groq, tools bound by `ToolRegistry.for_role`) decides tool calls.
6. **act node:** tools run — backend tools hit Node `/internal/*` (which uses `*.service.ts` + Prisma);
   web/rag/memory/playwright tools run in-service. Loop until no tool calls.
7. **reflect node:** `memory.writer` appends new facts to the vault.
8. **respond node:** final answer streams as `text.delta` frames; `nav.*`/`panel.*` events interleaved.
9. Node passes every SSE frame through to the client, which renders tokens + UI events live.

## B2.3 Admin lifecycle delta
Same pipeline, but `admin_agent` has a **read-only** tool set (`rag_search`, `memory_traverse`, `db_query`,
`web/image_search`, `open_panel`), and its `panel_node` emits `panel.open`/`context.pull` frames that drive
the right-hand context panel (Part M).

## B2.4 Feature-1 lifecycle delta
`captain_agent` inserts a problem-selection subgraph and calls `interrupt()` after presenting the top-5 so the
captain converses before `finalize` performs the atomic Node `claim → register` (Part K).

---

# PART C — Complete folder structure (every file + responsibility)

```
ai-service/
  app/
    main.py                         # app factory; lifespan: warm embed+rerank models, open Qdrant, mount routers
    core/
      config.py                     # pydantic-settings; all env in one typed object
      logging.py                    # structured JSON logs + request id
      security.py                   # verify X-Internal-Token (HMAC) from Node; extract identity
      errors.py                     # AppError → HTTP mapping; tool errors
      identity.py                   # RequestIdentity {userId, role, teamId, orgId}
    llm/
      provider.py                   # LLMProvider: chat(), stream(), with_tools(); retries; fallback
      embeddings.py                 # EmbeddingModel singleton (all-MiniLM-L6-v2)
      reranker.py                   # Reranker singleton (bge-reranker-v2-m3)
    prompts/                        # ⚠ SYSTEM PROMPTS + SKILLS ONLY. No memory .md here — that lives in .vault (Part H)
      __init__.py                   # PromptLibrary.render(name, **ctx) — Jinja2, versioned, cached
      system/                       # the SYSTEM PROMPTS (agent identity per role)
        core_system.md              #   master system prompt: identity + 9 traits + hard rules
        captain_advisor.md          #   role system prompt (composes core_system)
        student_copilot.md
        admin_analyst.md
      skills/                       # the SKILLS = reusable task-capability instructions the agent invokes
        problem_shortlist.md
        problem_uniqueness.md
        weekly_report.md
        plan_from_notifications.md
        insight_narration.md
        memory_extract.md
        memory_reflect.md
      fragments/                    # shared prompt blocks composed into the above
        output_format.md
        tool_use_policy.md
        safety.md
    schemas/
      chat.py  agent.py  rag.py  memory.py  tool.py  problem.py  admin.py  jobs.py
    api/
      health.py                     # GET /health (+ model-warm status)
      chat.py                       # POST /chat (SSE) — student & captain copilot
      problem_selection.py          # POST /problem-selection/{shortlist,chat,finalize}
      admin.py                      # POST /admin/chat (SSE + panel events)
      rag.py                        # POST /rag/ingest, /rag/query
      memory.py                     # POST /memory/reflect, GET /memory/{userId}/digest
      internal.py                   # AI-only warmups/callbacks
    agents/
      state.py                      # AgentState TypedDict + reducers
      graph_base.py                 # build_graph(), checkpointer, stream adapter → SSE
      router.py                     # choose graph by role; intent classify for students
      nodes/
        context_node.py             # load memory digest + RAG context
        plan_node.py                # produce plan / decide tool calls
        act_node.py                 # tool-execution loop
        reflect_node.py             # write memory, self-critique
        respond_node.py             # final streamed answer
        panel_node.py               # (admin) emit panel events
      student_agent.py              # assembles student graph
      captain_agent.py              # problem-selection graph w/ interrupt()
      admin_agent.py                # analytics graph (restricted tools)
    tools/
      registry.py                   # ToolRegistry.for_role(role) → [tools]
      base.py                       # tool decorator, args schema, error wrap, audit
      backend/
        node_client.py              # httpx client → Node /internal/*
        tasks_tools.py              # create/update/assign/move-kanban/list
        teams_tools.py
        projects_tools.py
        notifications_tools.py
        schedule_tools.py
        documents_tools.py
        posting_tools.py            # post team message / draft doc
        navigation_tools.py         # emit UI navigation events
        analytics_tools.py          # (admin) db_query read aggregations
      web/
        search_tools.py             # DDGS text, site-scoped, metadata filter
        image_tools.py              # DDGS images, rank, store
        rerank.py                   # rerank web hits w/ bge
      rag_tools.py                  # rag_search tool (hybrid + filter)
      memory_tools.py               # memory_read / memory_traverse / memory_write
      playwright_tools.py           # browse(url), act(steps), screenshot
    rag/
      ingest/loader.py              # Docling parse → StructuredDoc
      ingest/chunker.py             # heading/table/section-aware nodes + metadata
      ingest/pipeline.py            # parse→chunk→embed→upsert (job)
      index/vector_store.py         # Qdrant collections, payload schema, sparse+dense
      index/hybrid_retriever.py     # dense+sparse fusion → filter → rerank
      query.py                      # RagQuery.search(...) high-level API
    memory/
      vault.py                      # Vault(userId): paths, read/write MD + frontmatter
      templates.py                  # MD templates for each file type
      graph.py                      # build NetworkX graph from files + [[links]] + tags
      traversal.py                  # seed → BFS w/ hop-decay → context bundle
      types.py                      # ShortTerm/LongTerm/Episodic/Semantic/Procedural mapping
      writer.py                     # extract facts from turn → append to right MD
      reflection.py                 # consolidate episodes, rewrite, decay factor
    jobs/
      runner.py                     # asyncio job runner + Job table (status/result)
      ingest_job.py  weekly_report_job.py  reflection_job.py
    integrations/
      events.py                     # UI event envelope (navigation, panel)
  data/
    vaults/<userId>/                # per-user .vault (gitignored)
    qdrant/                         # embedded storage (dev) or external
    jobs.sqlite                     # job + checkpointer store (dev)
  tests/
  requirements.txt  .env  .env.example  IMPLEMENTATION_PLAN.md
```

---

# PART D — Config & environment

`app/core/config.py` (pydantic-settings), env keys:

```
AI_SERVICE_PORT=8000
GROQ_API_KEY=...
AI_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
AI_FALLBACK_MODEL=openai/gpt-oss-120b
AI_TEMPERATURE=0.3
INTERNAL_TOKEN_SECRET=...            # shared HMAC secret with Node
NODE_INTERNAL_URL=http://localhost:4000/api/internal
QDRANT_URL=http://localhost:6333    # or path for embedded
EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2
RERANK_MODEL=BAAI/bge-reranker-v2-m3
VAULT_ROOT=./data/vaults
JOBS_DB=./data/jobs.sqlite
DDGS_REGION=wt-wt
PLAYWRIGHT_ALLOWED_DOMAINS=github.com,arxiv.org
```

---

# PART E — LLM layer

`app/llm/provider.py`:

```python
class LLMProvider:
    def __init__(self, settings):
        self.model = settings.AI_MODEL
        self.fallback = settings.AI_FALLBACK_MODEL
        self._client = ChatGroq(model=self.model, temperature=settings.AI_TEMPERATURE,
                                api_key=settings.GROQ_API_KEY, streaming=True)

    async def stream(self, messages, tools=None) -> AsyncIterator[Chunk]: ...   # yields text/tool deltas
    async def chat(self, messages, tools=None) -> AIMessage: ...               # non-streamed
    def bind_tools(self, tools) -> Runnable: ...                                # LangGraph tool-calling
    # @retry(tenacity): on model-not-found/deprecation → swap to self.fallback once, log loudly
```

`embeddings.py` → `EmbeddingModel` (LlamaIndex `HuggingFaceEmbedding`, loaded once in lifespan).
`reranker.py` → `Reranker.rerank(query, docs, top_n)` (sentence-transformers CrossEncoder).

---

# PART F — Prompts library (`app/prompts/`)

> **Prompts vs Vault — the boundary (important).**
> `app/prompts/` holds **only two kinds of `.md`**: (1) **system prompts** — the agent's identity/instructions
> per role, and (2) **skills** — reusable task-capability instructions the agent invokes. It holds **no user
> data**. The **`.vault/`** (Part H, under `data/vaults/<userId>/`) holds the **memory `.md` files** — user
> behaviour, preferences, strengths, project, episodes, etc. These are separate systems: prompts are authored
> by us and shipped with the code; vault files are generated per user at runtime and traversed as memory.

`PromptLibrary` loads the `.md` templates under `prompts/system/` + `prompts/skills/`, renders with Jinja2,
caches, and supports `@v2` suffix versioning. System prompts **compose** `fragments/`. A **skill** is a
focused instruction block (e.g. `skills/problem_shortlist.md`) rendered with tool/RAG results at call time.
Sketch of `system/core_system.md`:

```
You are the ProjectVerse agent — an operating agent for a project-management and student-productivity
platform that enforces discipline in product development.

STANDING TRAITS (act as all of these): PRD-driven · unique positioning & value provider · self-learning ·
manager · indicator · consolidator · delegator · evaluator · project-progress monitor · strategist.

HARD RULES:
- Never state a fact about a user/team/project/DB unless it came from a tool result, retrieved document,
  or the user's memory vault. If you lack it, say so and offer to fetch it.
- Only act through tools you were given this turn. Never claim you performed an action you didn't call.
- Respect problem-statement availability locks absolutely.
{{ fragment("tool_use_policy") }}
{{ fragment("safety") }}

USER CONTEXT:
Role: {{ role }} · Name: {{ user.fullName }} · Team: {{ user.team }} · Dept/Core: {{ user.core }}
MEMORY DIGEST:
{{ memory_digest }}
```

Skills (`skills/*.md`) are focused instructions rendered with tool/RAG results — e.g.
`skills/problem_shortlist.md` receives the team-capability profile + candidate statements and must output
ranked-5 JSON with per-candidate fit reasoning; `skills/problem_uniqueness.md` outputs the
approach/method/value thesis; `skills/insight_narration.md` turns metrics+RAG evidence into an
insight+narrative for admin. Skills are what the agent "knows how to do"; system prompts are "who the agent
is". Neither ever contains user memory — that is read from the vault (Part H) and injected as context.

---

# PART G — RAG subsystem (LlamaIndex + Qdrant)

## G.1 Ingestion — `rag/ingest/`
`loader.py`: Docling `DocumentConverter` parses PDF/DOCX/PPTX/image (OCR for images) into a
`StructuredDoc`: ordered blocks with `{type: heading|paragraph|table|list|figure, level, text, page,
section_path}`. Tables preserved as row/col cells.

`chunker.py`: converts blocks into LlamaIndex `TextNode`s, **section/heading aware** — a node never
crosses an H1/H2 boundary; tables become one node per table (with row/col text) plus a summary node.
Metadata attached to every node (this is the "metadata storage to retrieve" requirement):

```python
node.metadata = {
  "doc_id", "title", "namespace",          # kb_problems | kb_students | kb_teams | kb_global | vault:<userId>
  "owner_type", "owner_id",                # student|team|admin|global + id
  "section_path": ["H1","H2"], "heading", "page",
  "block_type": "text|table|list|figure",
  "row": int|None, "col": int|None,        # for table cells
  "domain", "core", "sector", "type",      # hardware|software|hardware+software (problem statements)
  "created_at",
}
```

`pipeline.py`: `parse → chunk → embed(all-MiniLM) → build sparse(BM25) → Qdrant upsert`. Runs as a job.

## G.2 Vector store — `rag/index/vector_store.py`
Qdrant, one collection per namespace (or shared with `namespace` payload). Each point stores **dense**
(384-d cosine) + **sparse** vectors + full metadata payload with **payload indexes** on
`namespace, owner_type, owner_id, domain, core, sector, type, status` for fast filtering.

## G.3 Hybrid retriever — `rag/index/hybrid_retriever.py`
```
search(query, filters, k):
  dense_hits  = qdrant.search(dense_vec, filter=filters, limit=k*4)
  sparse_hits = qdrant.search(sparse_vec, filter=filters, limit=k*4)   # keyword
  fused       = reciprocal_rank_fusion(dense_hits, sparse_hits)
  reranked    = bge_reranker.rerank(query, fused, top_n=k)
  return reranked   # each carries section_path → enables "traverse deeper into this heading"
```
Traversal: because nodes keep `section_path`, a follow-up ("go deeper on section X") re-queries filtered
to that `section_path` prefix — meaning-aware section traversal, as requested.

## G.4 Public API — `rag/query.py`
`RagQuery.search(query, namespace, filters, k) -> list[RetrievedNode]` used by `rag_tools.rag_search`
and directly by agents (Feature 1 shortlist, admin evidence).

---

# PART H — Memory subsystem (per-user `.vault`, 4 memory types)

## H.1 Four memory types → storage (`memory/types.py`)
| Memory type | Definition | Where |
|---|---|---|
| Short-term | current session working set | LangGraph `AgentState` + `SqliteSaver` checkpoint (thread=session) |
| Long-term (persistent, semantic) | durable facts about the user | `.vault/*.md` (source of truth) + embedded into `vault:<userId>` namespace |
| Episodic | "what happened when" | `.vault/episodes/YYYY-MM-DD.md` append log |
| Procedural | how the user likes work done | `.vault/procedures/*.md` |

## H.2 Vault layout — `data/vaults/<userId>/`
```
profile.md         preferences.md   interests.md    project.md
team.md            strengths.md     weaknesses.md   improvements.md
plans.md           backlogs.md      schedule.md     db_snapshot.md
episodes/2026-07-14.md ...          procedures/standup.md ...
```
Every file has frontmatter; body is prose + `[[wikilinks]]`. Example `strengths.md`:
```markdown
---
type: semantic
tags: [skills, ranking]
links: ["[[profile]]", "[[project]]", "[[weaknesses]]"]
last_updated: 2026-07-14
decay: 0.98
confidence: 0.9
---
Strong in **vector search** and Python. UserSkill rank 88/285 in "AI Core".
Led embedding pipeline in [[project]]. Pairs well with [[user:mia_k]] on retrieval.
```
This satisfies the requested contents: behaviour, preference, interest, hobby, timings, schedules, plans,
improvements, backlogs, team members, project, strengths, weaknesses, improvement, db details.

## H.3 Graph build + traversal (`memory/graph.py`, `traversal.py`)
Build a **NetworkX** graph: nodes = files *and* headings within files; edges = `[[wikilinks]]`, shared
tags, and parent/child heading edges. Retrieval:
```
seed = match(query) over frontmatter+headings (embed + keyword)
context = BFS/PPR from seed, weight *= hop_decay each hop, budget by token limit
return ordered context bundle (with source file + heading)
```
This is the "obsidian tools, edges and nodes with meaning, graph traversal on md files, data linkage"
requirement. Admin traverses the **public subset** of a student's vault the same way.

## H.4 Writer + reflection + decay (`memory/writer.py`, `reflection.py`)
- **Writer** (after each turn): `memory_extract.md` prompt pulls durable facts from the exchange → append
  to the correct MD file (dedup by content hash), touch `last_updated`.
- **Reflection job** (periodic): `memory_reflect.md` consolidates episodic entries → semantic facts;
  **rewrites** verbose files into concise current state; applies **decay**: `decay *= f(recency,
  access_freq)`; when `decay < threshold` and unreferenced → prune. Reinforced facts get `decay→1.0`.
  Re-embeds changed files into `vault:<userId>` namespace so RAG stays fresh.

---

# PART I — Tools subsystem ("every functionality is a tool")

## I.1 Base + registry
`tools/base.py`: a `@tool` wrapper giving each tool a pydantic args schema, docstring (the LLM reads it),
error capture, and an audit hook. `registry.py`:
```python
class ToolRegistry:
    def for_role(self, role, intent=None) -> list[Tool]:
        if role == "ADMIN":  return [rag_search, memory_traverse, db_query, web_search, image_search, open_panel]
        # STUDENT / captain:
        base = [rag_search, memory_read, memory_write, web_search, image_search, playwright_browse,
                create_task, update_task, assign_task, move_kanban_card, list_tasks,
                read_notifications, mark_notification_read, create_schedule_event,
                post_team_message, create_document, navigate_to, list_team_members]
        return filter_by_intent(base, intent)   # keep tool list small per turn
```
Admin explicitly has **no** write/nav/post/delegate tools — matches "in admin its only feature is chat".

## I.2 Backend-action tools (`tools/backend/`) — each wraps a Node `/internal/*` call
| Tool | Node endpoint (🔵) | Reuses service |
|---|---|---|
| `create_task(project,title,...)` | `POST /internal/tasks` | task.service |
| `update_task(id,fields)` / `move_kanban_card(id,status)` | `PATCH /internal/tasks/:id` | task.service |
| `assign_task(id,userId)` | `PATCH /internal/tasks/:id/assign` | task.service |
| `list_tasks(filter)` | `GET /internal/tasks` | task.service |
| `list_team_members(teamId)` | `GET /internal/teams/:id/members` | team.service |
| `post_team_message(teamId,body)` | `POST /internal/teams/:id/messages` | team.service |
| `read_notifications(userId)` / `mark_notification_read(id)` | notifications | notification.service |
| `create_schedule_event(...)` | `POST /internal/schedule` | schedule.service |
| `create_document(...)` | `POST /internal/documents` | document.service |
| `db_query(entity, aggregation, filters)` (admin read) | `POST /internal/analytics/query` | new read svc |
| `navigate_to(section, sub)` | *(no HTTP)* emits a UI event over SSE | client handles |
| `claim_problem_statement` / `register_project` | Feature 1, §K | new svc |

`navigate_to` and `open_panel` don't call Node — they push a UI event on the SSE stream the client acts on.

## I.3 Web + image tools (`tools/web/`)
- `web_search(query, sites=[github|linkedin|youtube|arxiv|study|web], k, freshness)` → DDGS text with
  `site:` scoping → metadata filter → **bge rerank** → return {title,url,snippet,source,score}.
- `image_search(query, k)` → DDGS images → rank by resolution/source quality → download to image store →
  return refs. (This is the "bring images from search, high-rank quality, ddgs" requirement.)

## I.4 Playwright (`tools/playwright_tools.py`)
`browse(url)`, `act(steps)`, `screenshot()` — headless chromium, domain allow-list, step budget, returns
text + screenshots as artifacts. For live pages the API can't reach.

---

# PART J — Agents (LangGraph)

## J.1 State (`agents/state.py`)
```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]   # short-term memory
    identity: RequestIdentity
    role: str
    intent: str | None
    memory_digest: str                        # from vault traversal
    rag_context: list                          # retrieved nodes
    tool_results: list
    panel_events: list                         # admin UI events
    ui_events: list                            # navigation events
    scratch: dict
```

## J.2 Shared graph shape (`graph_base.py`)
```
START → context → plan → act ⇄ (tool loop) → reflect → respond → END
                                   ↑ interrupt() for captain finalize
```
`SqliteSaver` checkpointer keyed by `session_id` gives short-term memory + resumable interrupts.
`graph_base.stream()` adapts LangGraph events → SSE frames (`text.delta`, `tool.call`, `panel.*`,
`nav.*`, `done`).

## J.3 Nodes (`agents/nodes/`)
- `context_node`: vault `traversal` → `memory_digest`; if query needs docs → `RagQuery.search` → `rag_context`.
- `plan_node`: LLM with role tools bound → decides tool calls or direct answer.
- `act_node`: executes tool calls, appends `tool_results`; loops back to plan until no tool calls.
- `reflect_node`: `writer` captures facts to vault; optional self-critique.
- `respond_node`: streams final answer grounded in tool_results + rag_context.
- `panel_node` (admin only): converts result rows → `panel.open` / `context.pull` events.

## J.4 Three graphs
- `student_agent`: full shape, all student tools, intent-scoped.
- `captain_agent`: adds problem-selection subgraph + `interrupt()` before finalize (§K).
- `admin_agent`: restricted tools; `panel_node` wired; no write/nav.

`router.py`: `ADMIN → admin_agent`; `captain intent → captain_agent`; else `student_agent`. Student intent
classified (small LLM call or keyword) into {plan, task-mgmt, report, general} to trim the tool list.

---

# PART K — ⭐ FEATURE 1: Captain problem-statement selection & registration

## K.1 Data prerequisite (🔵 your backend)
New Prisma model (source = the Final Groups/Project Registration data):
```prisma
model ProblemStatement {
  id            String  @id @default(cuid())
  code          String  @unique
  title         String
  description   String
  domain        String        // e.g. "AI"
  core          String        // e.g. "AI Core"
  sector        String
  type          String        // "hardware" | "software" | "hardware+software"
  difficulty    String?
  requiredSkills String[]     @default([])
  sourceOrg     String?
  status        String  @default("available")  // available | claimed | taken
  claimedByTeamId String?
  claimedAt     DateTime?
  lockExpiresAt DateTime?      // TTL soft-lock while captain deliberates
  uniquenessNotes String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```
🔵 Node endpoints (transactional):
- `GET  /internal/problems?status=available&domain=&core=&sector=&type=` — candidate pool.
- `POST /internal/problems/:id/claim {teamId}` — atomic `available→claimed` in a transaction with a TTL
  `lockExpiresAt`; returns 409 if already claimed/taken. A sweeper releases expired soft-locks.
- `POST /internal/problems/:id/register {teamId, thesis}` — `claimed→taken`, creates the Project.

## K.2 AI-service endpoints (🟢 `api/problem_selection.py`)
```
POST /problem-selection/shortlist  {teamId} → { candidates:[{id,title,fit,why,...}] x5 }
POST /problem-selection/chat       {sessionId,teamId,message} → SSE (interrupt-driven refine)
POST /problem-selection/finalize   {teamId,problemId,thesis}  → { ok, projectId } | { conflict, reshortlist }
```

## K.3 captain_agent flow (LangGraph, node by node)
1. **assemble_team_profile**: `list_team_members(teamId)` + each member's `UserSkill` (ranks) + roles
   (captain / vice-captain / strategist / members) + team `domain` + each member `ssgDomain`
   (Hardware/Software) + interests from each member's vault. Produce a **team-capability profile**.
2. **fetch_candidates**: `GET /internal/problems?status=available` filtered by team `type` lean
   (hw/sw/hw+sw), `domain`, `core`, `sector`. **Hard rule:** only `available` — never fetch
   claimed/taken. If a candidate flips mid-flow, drop and pull the next.
3. **semantic_shortlist**: embed the capability profile → RAG hybrid search over `kb_problems`
   (filtered) → rerank → `problem_shortlist.md` prompt scores fit → **top 5 high-profile**.
4. **converse (interrupt)**: `respond` presents the 5 with per-candidate "why this fits your team";
   `interrupt()` waits for captain's reaction/follow-ups; loops (may re-shortlist).
5. **uniqueness_pass**: for the leaning candidate, `problem_uniqueness.md` → **unique approach + unique
   method + unique value** thesis (the "unique position & value provider" trait).
6. **finalize**: `claim_problem_statement(teamId,id)`.
   - 200 → `register_project(teamId,id,thesis)`; problem → `taken`; write decision to team + captain
     vaults + `kb_teams`. Emit `nav.to("project")`.
   - 409 → tell captain "taken by another team", loop back to step 3 excluding it.

## K.4 Concurrency guarantee
Availability + uniqueness of ownership is enforced **only** at the Node claim endpoint (DB transaction).
The AI treats a 409 as truth and re-shortlists — no double-claim possible even with two captains at once.
A taken problem disappears from every other team's shortlist (filtered by `status=available`) **and** from
the personal AI (candidate fetch always filters availability).

---

# PART L — FEATURE 2: Student productivity copilot (`student_agent`)

All via tools, streamed. Capabilities mapped to your bullets:
- **Write & post chat content** → `post_team_message`, `create_document`.
- **Read notifications → converse → create plan** → `read_notifications` → `plan_from_notifications.md`
  → `create_task` / `create_schedule_event`.
- **Manage activity + report + weekly report + improvements + to-dos** → `weekly_report_job` runs the
  consolidator/evaluator: pulls the week's tasks/comments/commits via `list_tasks` etc., renders
  `weekly_report.md` → narrative + improvements + to-dos; stored as a `Report`/`Document`.
- **Access all frontend-visible actions via backend scripts (write/trigger/read/post)** → the full
  backend tool set in §I.2, incl. `move_kanban_card`, `navigate_to(section, subsection)`, board review.
- **Memory-aware**: `context_node` loads vault digest before acting; `reflect_node` writes back.

Intent router keeps each turn's tool list small (plan vs task-mgmt vs report vs general).

---

# PART M — FEATURE 3: Admin analytics chat + context panel (`admin_agent`)

## M.1 Behavior
Chat-only. **No** navigation/write/post/delegation tools. Full power over **vector base + structured DB**
via hybrid-search RAG with metadata filtering (`rag_search`), vault traversal (`memory_traverse`), and
`db_query` for structured aggregations. Output = **insight + narrative** (per your "insights and then text"),
grounded in evidence. History persisted to existing `AdminChatHistory`.

Data path split: **structured** ("top 5 students in AI Core by score") → `db_query` aggregation on Node;
**semantic** ("who is strong at vector search / how to improve X") → `rag_search` + `memory_traverse`.
The agent merges both.

## M.2 Context-panel protocol (matches the screenshot) — SSE event contract
Alongside `text.delta` frames, the admin graph emits:
```json
{ "type":"panel.open", "title":"Top teams · AI Core",
  "items":[ {"id":"t1","kind":"team","title":"Team Pulse 2",
             "subtitle":"Vector search over departmental docs",
             "metrics":{"score":66,"progress":44,"status":"At Risk"}} ] }
{ "type":"panel.close" }
{ "type":"context.pull", "entity":{ "kind":"team","id":"t1", ...full card: members, achievements,
                                    progress-vs-peers, score... } }
```
Frontend rules (🔵, from your spec): panel **hidden by default**; opens only when the agent produces
"bringable" data (or admin opens it manually); admin can close it; when open, the **left sidebar collapses
to icons** (like the student UI); tapping a panel item injects that entity's card **into the inner chat**
and pulls it into conversation context (→ next `db_query`/`rag_search` scoped to it). Example end-to-end:
"bring me top 5 students in AI Core" → `db_query`(rank) + `rag_search`(evidence) → `panel.open` w/ 5
student cards → admin taps one → `context.pull` → follow-up Q&A ("his strengths/weaknesses, how can I help
improve him") grounded in that student's vault + KB, returned as insight + narrative.

## M.3 Endpoint
`POST /admin/chat {sessionId, message}` → SSE interleaving `text.delta` + `panel.*` + `context.*`.

---

# PART N — API surface (all endpoints + SSE frame types)

| Endpoint | Method | Body | Response | Stream |
|---|---|---|---|---|
| `/health` | GET | — | `{status, models_warm}` | no |
| `/chat` | POST | `{sessionId,message}` (+identity from token) | SSE | yes |
| `/problem-selection/shortlist` | POST | `{teamId}` | `{candidates[5]}` | no |
| `/problem-selection/chat` | POST | `{sessionId,teamId,message}` | SSE | yes |
| `/problem-selection/finalize` | POST | `{teamId,problemId,thesis}` | `{ok,projectId}`/`{conflict}` | no |
| `/admin/chat` | POST | `{sessionId,message}` | SSE (+panel) | yes |
| `/rag/ingest` | POST | `{namespace,owner,file}` | `{jobId}` | no |
| `/rag/query` | POST | `{query,namespace,filters,k}` | `{nodes[]}` | no |
| `/memory/{userId}/digest` | GET | — | `{digest}` | no |
| `/memory/reflect` | POST | `{userId}` | `{jobId}` | no |

**SSE frame types (all chat endpoints):** `text.delta` · `tool.call` · `tool.result` · `panel.open` ·
`panel.close` · `context.pull` · `nav.to` · `interrupt` (captain) · `error` · `done`.

---

# PART O — Node ↔ AI integration (🔵 your side, exact)

1. **Client → AI (proxy).** Replace stub `ai.controller.ts`. On `/api/ai/chat`, `/api/ai/admin/chat`,
   `/api/ai/problem-selection/*`: `authGuard` authenticates → attach `{userId,role,teamId,orgId}` → sign
   `X-Internal-Token` (HMAC of identity+ts) → proxy to AI service, **pass SSE through** to the browser.
2. **AI → Node (internal API).** New `/api/internal/*` router guarded by the same HMAC (not user JWT),
   exposing the §I.2 + §K.1 actions by reusing existing `*.service.ts`. This keeps authz/validation/audit/
   socket emits centralized and means the AI never writes Postgres directly.
3. **Streaming.** SSE end-to-end so `ChatDock`/`AdminChat` render token-by-token + panel/nav events.

---

# PART P — Background jobs (`app/jobs/`)
`runner.py`: asyncio-based runner + a `Job` row (`{id,type,status,result}` in `jobs.sqlite`) so `/rag/ingest`
and `/memory/reflect` return a `jobId` and the client can poll. Jobs: `ingest_job`, `weekly_report_job`
(scheduled per student, weekly), `reflection_job` (scheduled per vault). Upgrade path: swap runner for
Celery/Redis without touching callers.

---

# PART Q — Build sequence (phases, deliverable + acceptance each)

**Phase 0 — Foundations.** requirements; `config/security/logging/errors/identity`; `LLMProvider` (Groq
stream + fallback) + live smoke; `PromptLibrary` + `core_system.md`; `/health` + `/chat` echoing real
Groq stream through SSE. *Accept:* real streamed tokens from Groq to a curl SSE client.

**Phase 1 — RAG.** Qdrant up; embeddings + reranker singletons; Docling `loader`; heading/table `chunker`;
`vector_store` + `hybrid_retriever`; `RagQuery`; `rag_search` tool; `/rag/ingest` + `/rag/query`.
*Accept:* ingest a PDF, hybrid query returns cited, metadata-filtered, reranked nodes.

**Phase 2 — Memory.** `vault` + `templates` + `writer`; `graph` + `traversal`; `reflection`+decay job;
`memory_*` tools; `/memory/*`. *Accept:* a user's vault populates from a chat; graph traversal returns
linked context; reflection rewrites + decays.

**Phase 3 — Tools + Node internal API (🔵 parallel).** `node_client`; backend tools; `registry.for_role`;
web+image tools; playwright. *Accept:* agent creates a task and moves a kanban card end-to-end via Node.

**Phase 4 — ⭐ Feature 1.** ProblemStatement model + claim/register (🔵); `captain_agent` with interrupts;
shortlist/chat/finalize. *Accept:* captain gets top-5 available-only, converses, finalizes; problem locks
and disappears for others; 409 → re-shortlist.

**Phase 5 — Feature 2.** student graph + intent router + `weekly_report_job` + navigation tools.
*Accept:* student plans from notifications, gets a weekly report with improvements/to-dos, drives the UI.

**Phase 6 — Feature 3.** admin graph + `db_query` + `panel_node` + panel/context SSE. *Accept:* "top 5
students in AI Core" opens the context panel, tap-to-inject works, per-student insight+narrative grounded
in vault+KB.

**Phase 7 — Hardening.** eval harness, rate limits, observability, Celery/Redis if load needs it.

---

# PART R — Decisions
**Locked:**
1. **Vector DB → Qdrant.** Hybrid dense+sparse + payload metadata filtering.
2. **Admin structured reads → Node read endpoints** (`/api/internal/analytics/*`). Node stays sole DB owner.
3. **Default LLM → `meta-llama/llama-4-scout-17b-16e-instruct`** on Groq (Maverick deprecated); fallback
   `openai/gpt-oss-120b`.

**Still open (don't block Phase 0):**
4. **Playwright reach:** internal only vs external allow-list (which domains).
5. **Prod hosting:** vault storage + Qdrant location beyond local dev disk.
