from pathlib import Path

from llama_index.core.schema import TextNode

from app.rag.ingest.chunker import chunk_document
from app.rag.ingest.loader import parse_document


def parse_and_chunk(
    file_path: str | Path,
    namespace: str,
    owner_type: str,
    owner_id: str,
    *,
    doc_id: str | None = None,
    domain: str | None = None,
    core: str | None = None,
    sector: str | None = None,
    doc_type: str | None = None,
) -> list[TextNode]:
    """parse → chunk. Deliberately stops before embedding — Stage 4 owns embed+upsert."""
    structured = parse_document(file_path, doc_id=doc_id)
    return chunk_document(
        structured,
        namespace=namespace,
        owner_type=owner_type,
        owner_id=owner_id,
        domain=domain,
        core=core,
        sector=sector,
        doc_type=doc_type,
    )
