from qdrant_client import QdrantClient, models

from app.llm.embeddings import EmbeddingModel
from app.llm.reranker import Reranker
from app.rag.index.sparse import sparse_vector
from app.rag.index.vector_store import COLLECTION_NAME, DENSE_VECTOR_NAME, SPARSE_VECTOR_NAME
from app.schemas.rag import RetrievedNode


def _build_filter(namespace: str, filters: dict[str, str] | None) -> models.Filter:
    must = [models.FieldCondition(key='namespace', match=models.MatchValue(value=namespace))]
    for key, value in (filters or {}).items():
        must.append(models.FieldCondition(key=key, match=models.MatchValue(value=value)))
    return models.Filter(must=must)


def search(
    client: QdrantClient,
    embedder: EmbeddingModel,
    reranker: Reranker | None,
    query: str,
    namespace: str,
    filters: dict[str, str] | None = None,
    k: int = 5,
) -> list[RetrievedNode]:
    """dense + sparse search -> server-side RRF fusion -> optional cross-encoder rerank.

    Fetches `k*4` fused candidates before reranking so the reranker has real material to reorder,
    not just the same top-k it would've gotten from fusion alone.
    """
    if not client.collection_exists(COLLECTION_NAME):
        return []

    query_filter = _build_filter(namespace, filters)
    fetch_limit = max(k * 4, k)

    response = client.query_points(
        collection_name=COLLECTION_NAME,
        prefetch=[
            models.Prefetch(
                query=embedder.embed_query(query),
                using=DENSE_VECTOR_NAME,
                filter=query_filter,
                limit=fetch_limit,
            ),
            models.Prefetch(
                query=sparse_vector(query),
                using=SPARSE_VECTOR_NAME,
                filter=query_filter,
                limit=fetch_limit,
            ),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        query_filter=query_filter,
        limit=fetch_limit,
        with_payload=True,
    )
    fused = response.points

    if reranker is None or not fused:
        top = fused[:k]
        return [
            RetrievedNode(id=str(p.id), text=p.payload.get('text', ''), score=p.score, metadata=p.payload)
            for p in top
        ]

    reranked = reranker.rerank(query, fused, top_n=k, text_of=lambda p: p.payload.get('text', ''))
    return [
        RetrievedNode(id=str(p.id), text=p.payload.get('text', ''), score=score, metadata=p.payload)
        for p, score in reranked
    ]
