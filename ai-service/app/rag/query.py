from pathlib import Path

from app.llm.embeddings import get_embedding_model
from app.llm.reranker import get_reranker
from app.rag.index.hybrid_retriever import search as hybrid_search
from app.rag.index.vector_store import get_qdrant_client, upsert_nodes
from app.rag.ingest.pipeline import parse_and_chunk
from app.schemas.rag import RetrievedNode


class RagQuery:
    """The only entry point Stage 7's `rag_search` tool and Stage 9's shortlist logic may call —
    nothing outside `app/rag/` should import `hybrid_retriever` or `vector_store` directly."""

    def search(
        self,
        query: str,
        namespace: str,
        filters: dict[str, str] | None = None,
        k: int = 5,
        rerank: bool = True,
    ) -> list[RetrievedNode]:
        client = get_qdrant_client()
        embedder = get_embedding_model()
        reranker = get_reranker() if rerank else None
        return hybrid_search(client, embedder, reranker, query, namespace, filters, k)

    def ingest_file(
        self,
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
    ) -> int:
        nodes = parse_and_chunk(
            file_path, namespace, owner_type, owner_id,
            doc_id=doc_id, domain=domain, core=core, sector=sector, doc_type=doc_type,
        )
        if not nodes:
            return 0
        embedder = get_embedding_model()
        dense_vectors = embedder.embed_texts([node.text for node in nodes])
        client = get_qdrant_client()
        upsert_nodes(client, nodes, dense_vectors)
        return len(nodes)


_rag_query = RagQuery()


def get_rag_query() -> RagQuery:
    return _rag_query
