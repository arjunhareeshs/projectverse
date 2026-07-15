# Stage 3 — RAG Ingestion: Layout-Aware Parsing + Section-Aware Chunking

> Ref: master plan Part G.1. This stage produces **nodes with metadata**; Stage 4 embeds/indexes/retrieves
> them. Splitting ingestion from retrieval keeps each stage independently testable.

## Goal

Turn raw documents (problem-statement PDFs, PRDs, study material, uploaded team docs, images) into
LlamaIndex `TextNode`s that respect the document's real structure — headings, sections, tables — and carry
rich metadata so later retrieval can filter and traverse by meaning, not just similarity.

## Why this comes third

Stage 2 gave the agent an identity; now it needs something to *know*. RAG is the biggest engineering
surface in the plan (requested explicitly: "parsing must be strong with docling layout-aware extraction").
Ingestion must exist before indexing (Stage 4) has anything to index.

## Dependencies

Stage 1 (config/logging only — no LLM calls needed for parsing/chunking itself).

## Files to create

```
app/rag/ingest/loader.py     # Docling DocumentConverter → StructuredDoc
app/rag/ingest/chunker.py    # StructuredDoc → heading/table-aware TextNode list + metadata
app/rag/ingest/pipeline.py   # orchestrates parse → chunk (embed/upsert deferred to Stage 4)
app/schemas/rag.py           # IngestRequest, StructuredDoc, ChunkMetadata pydantic models
```

## Key design details

### `loader.py`
Uses **Docling**'s `DocumentConverter` to parse PDF/DOCX/PPTX/image inputs (OCR kicks in automatically for
image-only pages) into an ordered list of blocks:
```python
class Block(BaseModel):
    type: Literal["heading","paragraph","table","list","figure"]
    level: int | None          # heading level, H1=1..H4=4
    text: str
    page: int
    section_path: list[str]    # e.g. ["Problem Statements", "AI Core", "Vector Search"]
    table_cells: list[list[str]] | None   # rows x cols, only for type == "table"
```
This is the "docking layout aware extraction" requirement — Docling is the one library in the stack
purpose-built for this (it understands PDF layout, not just raw text extraction).

### `chunker.py` — the core design decision of this stage
A chunk **never crosses a heading boundary** (H1/H2 split points configurable). Tables become **one node
per table** (with the full row/col text serialized) plus a one-line summary node, so a table can be
retrieved whole or found by its gist. Every node gets the metadata block specified in the master plan
(Part G.1):
```python
node.metadata = {
  "doc_id", "title", "namespace",          # kb_problems | kb_students | kb_teams | kb_global | vault:<userId>
  "owner_type", "owner_id",
  "section_path": [...], "heading", "page",
  "block_type": "text|table|list|figure",
  "row": int | None, "col": int | None,
  "domain", "core", "sector", "type",      # only populated for problem-statement docs
  "created_at",
}
```
`namespace` and `owner_type/owner_id` are what let Stage 4's retriever scope a search to "only this team's
docs" or "only problem statements" — get this metadata contract right here or every downstream filter breaks.

### `pipeline.py`
`parse_and_chunk(file_path, namespace, owner) -> list[TextNode]`. Deliberately stops before embedding —
Stage 4 owns the embed+upsert half so this stage can be tested with zero dependency on Qdrant or the
embedding model being loaded.

## What NOT to build yet

No embedding, no Qdrant writes, no retrieval, no reranking — those are Stage 4. No ingestion **job**
queueing (background job wiring is Stage 10) — a synchronous function call is enough to test this stage.

## Acceptance criteria

- Feed a real problem-statement PDF (or a representative sample doc) through `parse_and_chunk` and print the
  resulting nodes: verify no node's text crosses a heading boundary, and every table produces a distinct
  node with its rows/cols intact (not flattened into unreadable prose).
- Every node's `metadata` dict has all required keys populated (or explicitly `None` where not applicable)
  — no `KeyError` risk downstream.
- Feed an image-only page (e.g. a scanned document) through the loader and confirm OCR text comes back
  non-empty.
- Feed a DOCX with nested headings (H1 > H2 > H3) and confirm `section_path` reflects the full nesting, not
  just the immediate parent.
