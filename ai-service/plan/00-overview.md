# Stage 0 — Overview: What Is Being Built

> Companion to `ai-service/IMPLEMENTATION_PLAN.md` (the master reference — unchanged). This folder breaks
> that plan into 10 buildable stages. Read this file first; it explains **what** the AI service is and
> **why** it's shaped the way it is, before any stage tells you **how** to build a piece of it.

---

## 1. What ProjectVerse's AI service is

ProjectVerse is a project-management + student-productivity platform whose mission is to enforce
**discipline in product development** — PRD-driven thinking, unique project positioning, and honest
tracking of progress. The AI service (`ai-service/`, a standalone FastAPI app) is the **operating agent**
for that mission. It is not a chatbot bolted onto the product; it is given the same tools a human
project-manager/mentor would use, and it is expected to act like one:

- a **manager** who delegates and tracks ownership,
- an **indicator** who flags risk before it becomes a crisis,
- a **consolidator** who turns a week of scattered activity into one report,
- an **evaluator** who scores progress honestly, against peers,
- a **strategist** who helps a team find a unique angle on a problem before they commit to it,
- and a **self-learning** system that remembers each person it works with and gets more useful over time.

Three concrete features sit on top of this agent, in build priority order:

1. **Captain problem-statement selection** (build first — flagship feature). When a team registers a new
   project, the AI reads the team's composition and skills, semantically shortlists the top 5 available
   problem statements from the DB, converses with the captain to refine the choice, proposes a *unique*
   approach/method/value angle, then atomically claims and registers the problem so no other team can take it.
2. **Student productivity copilot.** Every student gets a conversational agent that can read notifications,
   write and post chat content, create/move tasks, generate weekly reports with improvements and to-dos,
   and drive any visible frontend action — all through backend tool calls, never by pretending.
3. **Admin analytics chat.** A single chat surface (no navigation, no writes) with full hybrid-search access
   to the vector knowledge base and the structured database, surfacing insight + narrative on students and
   teams, with a context panel that opens only when there's data worth showing.

## 2. What is genuinely novel here, and why each piece exists

| Requirement (yours) | What we build | Why it's a distinct piece |
|---|---|---|
| "Every backend action is a tool" | A `ToolRegistry` wrapping every Node service call | The LLM can only *do* what has been registered — no hidden side effects, no hallucinated actions. |
| "Availability check before selecting a problem" | Atomic claim/lock on the Node side, `status`-filtered fetch on the AI side | Two captains racing for the same problem must never both win. |
| High-quality web + image search | DDGS + reranking, site-scoped (github/linkedin/youtube/arxiv) | Generic web search is noisy; scoping + reranking makes results usable inside an agent loop. |
| LangGraph agents | Stateful graphs with `interrupt()` | The captain conversation is not one-shot — it must pause, wait for human input, and resume mid-reasoning. |
| LlamaIndex RAG with heading/table-aware parsing | Docling → section-aware chunker → Qdrant hybrid → rerank | Generic "split by 500 tokens" chunking destroys tables and loses which heading a fact belongs to. |
| Four memory types + Obsidian-style vault | Per-user `.vault/` of Markdown, graph-traversed | Plain vector search over user history loses structure (which fact belongs to which relationship); a
  linked graph of Markdown files preserves that structure and is auditable by a human. |
| Admin sees the *entire* platform, safely | Read-only tool set, no write/nav/delegate tools | The most powerful role gets the narrowest tool surface — it can look at everything but can't do anything. |

## 3. High-level architecture (see master plan Part B1/B2 for full diagrams)

```
React client  ⇄  Node server (auth, all writes, /internal/* actions)  ⇄  AI service (FastAPI)
                                                                              │
                                                          ┌───────────────────┼───────────────────┐
                                                     LangGraph            LlamaIndex           .vault/
                                                   (3 agents:          (Docling → Qdrant     (per-user MD
                                                student/captain/          hybrid+rerank)      graph memory)
                                                    admin)
```

The AI service **never writes Postgres directly** — every write-side action goes through a new Node
`/api/internal/*` router that reuses your existing `*.service.ts` files, so authorization, validation,
sockets, and audit logging all stay in one place. The AI service owns three things exclusively: the LLM
reasoning loop, the vector index (Qdrant), and the per-user memory vault (`data/vaults/`).

## 4. Tech stack (locked decisions — see master plan Part B/R)

- **LLM:** Groq, default model `meta-llama/llama-4-scout-17b-16e-instruct` (Maverick was requested but
  Groq deprecated it 2026-02-20; Scout is the active Llama-4 replacement), fallback `openai/gpt-oss-120b`.
- **Agent framework:** LangGraph (stateful graphs, `interrupt()`, SQLite checkpointing).
- **RAG framework:** LlamaIndex, parsing via Docling, embeddings via `all-MiniLM-L6-v2`, reranking via
  `bge-reranker-v2-m3`.
- **Vector DB:** Qdrant (hybrid dense+sparse, metadata payload filtering).
- **Web search:** DDGS (DuckDuckGo), no API key, text + image search with reranking.
- **Browser automation:** Playwright (Python), domain allow-listed.
- **Memory:** per-user `.vault/` of Markdown files with YAML frontmatter, traversed as a graph via NetworkX.
- **Transport:** FastAPI + SSE streaming for all chat surfaces.

## 5. The 10 build stages (this folder)

| Stage | File | Delivers |
|---|---|---|
| 1 | `01-foundations.md` | Config, security, logging, the Groq `LLMProvider`, first real streamed response |
| 2 | `02-prompts-library.md` | System prompts + skills library (the agent's identity and know-how) |
| 3 | `03-rag-ingestion.md` | Docling parsing + heading/table-aware chunking with metadata |
| 4 | `04-rag-retrieval.md` | Qdrant hybrid index + reranking + the `RagQuery` API |
| 5 | `05-memory-vault.md` | Per-user `.vault/` — files, frontmatter, templates, the writer |
| 6 | `06-memory-graph-reflection.md` | Graph traversal over the vault + reflection/decay job |
| 7 | `07-tools-subsystem.md` | Every backend action as a tool + Node `/internal/*` contract + web/image/playwright tools |
| 8 | `08-agents-langgraph.md` | The 3 LangGraph agents (student/captain/admin) and shared graph nodes |
| 9 | `09-feature-captain-problem-selection.md` | Flagship Feature 1, end to end |
| 10 | `10-feature-student-admin-hardening.md` | Feature 2 (student copilot), Feature 3 (admin analyst + panel), jobs, hardening |

Each stage file states: **goal, why it comes at this point, dependencies on earlier stages, files to
create, key design detail, and acceptance criteria** — so a developer can pick up any single stage file and
implement it without re-reading the whole master plan.

## 6. What "done" means for the AI service as a whole

By the end of Stage 10:
- A captain can register a project through a real conversation with the agent, ending in an atomically
  locked, uniquely-positioned problem statement — no two teams can collide.
- Any student can ask the copilot to plan their week from their notifications, and it actually creates the
  tasks and schedule events (via Node), not just describes them.
- An admin can ask "bring me the top 5 students in AI Core", see a context panel of real cards pulled from
  the live database and the vector KB, tap one, and get a grounded strengths/weaknesses narrative — never a
  fabricated fact.
- Every one of those actions is auditable: which tool was called, with what arguments, against which Node
  endpoint, and what the LLM was told to do it (via the prompts library) and what it remembered about the
  user (via the vault) when it decided to do it.
