from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

BlockType = Literal['heading', 'paragraph', 'table', 'list', 'figure']


class Block(BaseModel):
    """One structural unit of a parsed document, in document order."""

    type: BlockType
    level: int | None = None  # heading level, H1=1..H4=4; None for non-heading blocks
    text: str
    page: int
    section_path: list[str] = Field(default_factory=list)  # e.g. ["Problem Statements", "AI Core"]
    table_cells: list[list[str]] | None = None  # rows x cols, only for type == "table"


class StructuredDoc(BaseModel):
    doc_id: str
    title: str
    blocks: list[Block]


class ChunkMetadata(BaseModel):
    """Payload attached to every chunk node — the contract Stage 4's retriever filters on."""

    doc_id: str
    title: str
    namespace: str  # kb_problems | kb_students | kb_teams | kb_global | vault:<userId>
    owner_type: str
    owner_id: str
    section_path: list[str] = Field(default_factory=list)
    heading: str | None = None
    page: int | None = None
    block_type: BlockType
    row: int | None = None
    col: int | None = None
    domain: str | None = None
    core: str | None = None
    sector: str | None = None
    type: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class IngestRequest(BaseModel):
    file_path: str
    namespace: str
    owner_type: str
    owner_id: str
    domain: str | None = None
    core: str | None = None
    sector: str | None = None
    type: str | None = None


class IngestResponse(BaseModel):
    doc_id: str
    namespace: str
    node_count: int


class RetrievedNode(BaseModel):
    """A single hit — carries its full metadata (including `section_path`) so callers can do
    traversal-style follow-ups without a separate document graph."""

    id: str
    text: str
    score: float
    metadata: dict


class RagQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    namespace: str
    filters: dict[str, str] | None = None
    k: int = Field(default=5, ge=1, le=50)
    rerank: bool = True


class RagQueryResponse(BaseModel):
    results: list[RetrievedNode]
