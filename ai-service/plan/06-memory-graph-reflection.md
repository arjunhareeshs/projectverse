# Stage 6 — Memory: Graph Traversal, Reflection & Decay

> Ref: master plan Part H.3–H.4. Completes the memory subsystem started in Stage 5.

## Goal

Turn the flat collection of vault Markdown files (Stage 5) into a traversable graph so retrieval can follow
`[[wikilinks]]` between related facts — the "Obsidian tools, edges and nodes with meaning, graph traversal"
requirement — and build the background process that keeps the vault accurate over time: consolidating
episodic events into semantic facts, rewriting stale content, and applying a decay factor to unreferenced
facts.

## Why this comes sixth

Stage 5 can store and retrieve *one file at a time*, but a real question ("how can I help this student
improve?") needs *linked* context — their weaknesses file, which links to their project file, which links
to their team file. Without graph traversal, memory retrieval degrades to "read one file and hope it's the
right one." This stage also gives the whole memory system its self-learning property (Stage 0 trait):
without reflection/decay, the vault only grows and never improves.

## Dependencies

Stage 5 (the vault + `[[wikilink]]` convention it establishes).

## Files to create

```
app/memory/graph.py         # build NetworkX graph from vault files: nodes = files+headings, edges = links/tags
app/memory/traversal.py     # seed match → BFS/weighted traversal with hop-decay → context bundle
app/memory/reflection.py    # consolidate episodes → semantic facts; rewrite; apply decay factor
app/jobs/reflection_job.py  # scheduled/triggerable wrapper around reflection.py (job scaffolding only)
```

## Key design details

### `graph.py`
```python
def build_graph(user_id: str) -> nx.Graph:
    # nodes: one per file, plus one per heading within a file (finer-grained addressing)
    # edges: [[wikilink]] → direct edge; shared tags → weaker edge; parent/child heading → structural edge
```
Rebuilt on demand (cheap — it's a few dozen small Markdown files per user, not a distributed graph DB).
Cache with an invalidation trigger on any `Vault.write`/`append_episode` call from Stage 5.

### `traversal.py` — the retrieval algorithm
```python
def traverse(user_id: str, query: str, token_budget: int) -> ContextBundle:
    seed = match(query, graph)              # embedding or keyword match against frontmatter+headings
    bundle = bfs_with_decay(graph, seed, hop_decay=0.6, budget=token_budget)
    return bundle   # ordered list of (file, heading, text, hop_distance)
```
Each hop away from the seed multiplies relevance weight by `hop_decay`, so directly-linked facts dominate
but second-order context (a teammate's strengths, reached via the team file) still surfaces when relevant
and there's budget left. This is what produces the `memory_digest` string injected into
`system/core_system.md` (Stage 2) at the start of every conversation.

### `reflection.py` — the self-learning loop
Three operations, run periodically per user (weekly cadence is a reasonable default, configurable):
1. **Consolidate:** read the week's `episodes/*.md` entries, use `skills/memory_reflect.md` (Stage 2) to
   summarize recurring patterns into updates to the relevant semantic file (e.g. three episodes of missed
   deadlines → a note added to `weaknesses.md`, not left buried in daily logs).
2. **Rewrite:** if a semantic file has grown verbose or self-contradictory across many small writer
   (Stage 5) appends, rewrite it into a concise, current statement — same file, same frontmatter contract,
   tighter body.
3. **Decay:** update each file's `decay` frontmatter field as `decay = decay * recency_factor *
   access_frequency_factor`. Facts that keep getting surfaced by `traversal.py` and referenced in
   conversation get reinforced (`decay` pushed back toward 1.0); facts nobody has touched in a long time
   drift down. When `decay` drops below a threshold **and** the fact is unreferenced by any recent episode,
   it's a candidate for pruning (soft — flag it, don't silently delete without a re-confirmation path).
Every write from `reflect()` re-triggers re-embedding of that file into the `vault:<userId>` RAG namespace
(Stage 4's vector store) so semantic search over memory stays current, not stale.

### `reflection_job.py`
Thin wrapper registering this as a callable job (the actual job **runner** infrastructure — the
`Job` table, `asyncio` scheduling — is built in Stage 10; this file just defines *what* runs, matching the
pattern other jobs will follow).

## What NOT to build yet

No job runner/scheduler infrastructure (Stage 10) — `reflection_job.py` here is a plain callable function,
not wired to a cron-like scheduler yet. No `memory_traverse` **tool** wrapper for agents (Stage 7).

## Acceptance criteria

- Build a graph for a vault with at least 3 cross-linked files (e.g. `strengths.md` → `[[project]]` →
  `[[team]]`) and confirm `nx.Graph` has the expected edges via `build_graph`.
- Run `traverse(user_id, "how is this student doing on the project")` and confirm the returned bundle
  includes content from at least two hops away (proves multi-hop traversal, not just direct seed match).
- Manually seed a vault with 5 days of episodic entries describing the same recurring issue, run
  `reflection.consolidate`, and confirm the relevant semantic file gets a new, coherent note — not five
  duplicated near-identical lines.
- Run `reflection.decay` twice with no intervening activity and confirm `decay` values monotonically
  decrease; reference a fact via `traverse` in between and confirm its decay increases relative to untouched
  facts.
