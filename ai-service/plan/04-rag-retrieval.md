# Stage 4 — RAG Retrieval: Qdrant Hybrid Index + Reranking

> Ref: master plan Part G.2–G.4. Completes the RAG subsystem started in Stage 3.

## Goal

Embed and index the nodes produced by Stage 3 into Qdrant, and build the retrieval path: hybrid
(dense+sparse) search → metadata filtering → cross-encoder reranking → a clean `RagQuery` API that every
later stage (tools, agents, Feature 1's shortlist) calls without knowing any Qdrant internals.

## Why this comes fourth

Ingestion without retrieval is inert. This stage is what makes "search qualitu search... hybrid search
(keyword + semantic)" actually work, and it's a hard prerequisite for Feature 1 (Stage 9), which needs to
semantically shortlist problem statements.

## Dependencies

Stage 1 (config, singleton loading pattern), Stage 3 (nodes to index).

## Files to create

```
app/llm/embeddings.py            # EmbeddingModel singleton (all-MiniLM-L6-v2), loaded once at lifespan
app/llm/reranker.py              # Reranker singleton (bge-reranker-v2-m3)
app/rag/index/vector_store.py    # Qdrant client, collection/payload schema, dense+sparse upsert
app/rag/index/hybrid_retriever.py# dense+sparse search → RRF fusion → filter → rerank
app/rag/query.py                 # RagQuery.search(...) — the public API
app/api/rag.py                   # POST /rag/ingest (wires Stage 3 pipeline + this stage's upsert), /rag/query
```

## Key design details

### `embeddings.py` / `reranker.py`
Both loaded **once** at FastAPI `lifespan` startup (not per-request — these are the models that make
`/health`'s `models_warm` flip to `true`, per Stage 1). `EmbeddingModel.embed(text) -> list[float]` (384-d).
`Reranker.rerank(query, candidates, top_n) -> list[(candidate, score)]` using a `CrossEncoder`.

### `vector_store.py`
One Qdrant collection per `namespace` (or a shared collection filtered by a `namespace` payload field —
pick one and be consistent; shared collection is simpler operationally and is the default here). Payload
indexes created on `namespace, owner_type, owner_id, domain, core, sector, type, status` so filtered queries
stay fast as data grows. Both a dense vector (cosine, 384-d) and a sparse vector (BM25-style term weights)
are stored per point — this is what makes hybrid search possible without a second database.

### `hybrid_retriever.py` — the core algorithm
```python
def search(query: str, filters: dict, k: int) -> list[RetrievedNode]:
    dense_hits  = qdrant.search(embed(query), filter=filters, limit=k*4)
    sparse_hits = qdrant.search(sparse_vec(query), filter=filters, limit=k*4)
    fused       = reciprocal_rank_fusion(dense_hits, sparse_hits)
    reranked    = reranker.rerank(query, fused, top_n=k)
    return reranked   # each result carries its full metadata, including section_path
```
Because every node kept its `section_path` from Stage 3, a caller can also do **traversal-style**
follow-ups: re-run `search` with a filter pinning `section_path` to a prefix, effectively "go deeper into
this heading" — satisfying the "traversal with metadata... which section which heading" requirement without
needing a separate graph database for documents (the vault gets an actual graph in Stage 6; documents don't
need one because `section_path` prefix filtering achieves the same locality).

### `query.py` — public API
```python
class RagQuery:
    def search(self, query: str, namespace: str, filters: dict | None = None, k: int = 5) -> list[RetrievedNode]: ...
```
This is the only entry point Stage 7's `rag_search` tool and Stage 9's problem-shortlist logic are allowed
to call — nothing outside `app/rag/` should import `hybrid_retriever` or `vector_store` directly.

### `/rag/ingest`, `/rag/query`
`/rag/ingest {namespace, owner, file}` runs Stage 3's `parse_and_chunk` then this stage's embed+upsert,
synchronously for now (job-queue wrapping is Stage 10). `/rag/query {query, namespace, filters, k}` is a
thin wrapper over `RagQuery.search` — useful for manual testing before Stage 7 wires it as a tool.

## What NOT to build yet

No tool wrapper (`rag_search` tool is Stage 7). No agent integration (Stage 8). No vault namespace ingestion
(`vault:<userId>` — that's populated by Stage 6's reflection job, though the *collection* it writes into is
this stage's responsibility to support).

## Acceptance criteria

- Ingest a real multi-section PDF via `/rag/ingest`, then `/rag/query` for a phrase that appears verbatim in
  one section — top hit should be that section's node, not a semantically-similar-but-wrong one (proves
  sparse/keyword fusion is contributing, not just dense similarity).
- Query with a `filters={"domain":"AI"}` payload and confirm zero results from other domains leak through.
- Query for a concept using synonyms not present in the text (e.g. "ML" when the doc says "machine
  learning") and confirm dense retrieval still surfaces it — proves the semantic half is contributing.
- Time a query with reranking on vs. off — confirm reranking meaningfully reorders the top-k (i.e. it isn't
  a no-op wrapper).
