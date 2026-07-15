import uuid
from functools import lru_cache
from pathlib import Path

from llama_index.core.schema import TextNode
from qdrant_client import QdrantClient, models

from app.core.config import get_settings
from app.rag.index.sparse import sparse_vector

# One shared collection filtered by the `namespace` payload field, rather than one collection
# per namespace — simpler operationally, and namespaces are cheap to add without a schema change.
COLLECTION_NAME = 'projectverse_kb'
DENSE_VECTOR_NAME = 'dense'
SPARSE_VECTOR_NAME = 'sparse'

PAYLOAD_INDEX_FIELDS = ['namespace', 'owner_type', 'owner_id', 'domain', 'core', 'sector', 'type', 'status']


@lru_cache
def get_qdrant_client() -> QdrantClient:
    qdrant_url = get_settings().qdrant_url
    if qdrant_url.startswith(('http://', 'https://')):
        return QdrantClient(url=qdrant_url)
    # Not a URL — treat as a local embedded-storage path (dev/test; no server required).
    Path(qdrant_url).mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=qdrant_url)


def ensure_collection(client: QdrantClient, embed_dim: int) -> None:
    if client.collection_exists(COLLECTION_NAME):
        return
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config={
            DENSE_VECTOR_NAME: models.VectorParams(size=embed_dim, distance=models.Distance.COSINE),
        },
        sparse_vectors_config={SPARSE_VECTOR_NAME: models.SparseVectorParams()},
    )
    for field in PAYLOAD_INDEX_FIELDS:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name=field,
            field_schema=models.PayloadSchemaType.KEYWORD,
        )


def upsert_nodes(
    client: QdrantClient,
    nodes: list[TextNode],
    dense_vectors: list[list[float]],
    point_ids: list[str] | None = None,
) -> None:
    """`point_ids` defaults to a fresh random id per node (Stage 3/4 ingestion: many chunks can
    share a `doc_id`, so there's no natural per-chunk id to reuse — re-ingesting a document adds
    new points rather than replacing old ones). Callers with a natural 1:1 id — e.g. Stage 6
    re-embedding one vault file per `doc_id` — should pass a deterministic id so repeated upserts
    update the same point instead of accumulating stale duplicates."""
    if not nodes:
        return
    ensure_collection(client, embed_dim=len(dense_vectors[0]))
    ids = point_ids or [str(uuid.uuid4()) for _ in nodes]
    points = [
        models.PointStruct(
            id=point_id,
            vector={
                DENSE_VECTOR_NAME: dense,
                SPARSE_VECTOR_NAME: sparse_vector(node.text),
            },
            payload={**node.metadata, 'text': node.text},
        )
        for node, dense, point_id in zip(nodes, dense_vectors, ids)
    ]
    client.upsert(collection_name=COLLECTION_NAME, points=points)
