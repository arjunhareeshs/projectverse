from fastapi import APIRouter, Depends

from app.core.identity import RequestIdentity
from app.core.security import verify_internal_token
from app.rag.query import get_rag_query
from app.schemas.rag import IngestRequest, IngestResponse, RagQueryRequest, RagQueryResponse

router = APIRouter(prefix='/rag', tags=['rag'])


@router.post('/ingest', response_model=IngestResponse)
def ingest(payload: IngestRequest, identity: RequestIdentity = Depends(verify_internal_token)) -> IngestResponse:
    """Runs Stage 3's parse_and_chunk then this stage's embed+upsert, synchronously.

    Job-queue wrapping (so a large upload doesn't block the request) is Stage 10.
    """
    rag = get_rag_query()
    node_count = rag.ingest_file(
        payload.file_path,
        payload.namespace,
        payload.owner_type,
        payload.owner_id,
        domain=payload.domain,
        core=payload.core,
        sector=payload.sector,
        doc_type=payload.type,
    )
    return IngestResponse(doc_id=payload.file_path, namespace=payload.namespace, node_count=node_count)


@router.post('/query', response_model=RagQueryResponse)
def query(payload: RagQueryRequest, identity: RequestIdentity = Depends(verify_internal_token)) -> RagQueryResponse:
    """Thin wrapper over RagQuery.search — useful for manual testing before Stage 7 wires it as a tool."""
    rag = get_rag_query()
    results = rag.search(payload.query, payload.namespace, payload.filters, payload.k, payload.rerank)
    return RagQueryResponse(results=results)
