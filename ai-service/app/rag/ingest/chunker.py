from llama_index.core.schema import TextNode

from app.schemas.rag import Block, ChunkMetadata, StructuredDoc


def _split_text(text: str, max_chars: int) -> list[str]:
    """Splits on paragraph boundaries only, so a piece never breaks mid-sentence-block."""
    if len(text) <= max_chars:
        return [text]
    paragraphs = text.split('\n\n')
    pieces: list[str] = []
    current = ''
    for paragraph in paragraphs:
        candidate = f'{current}\n\n{paragraph}' if current else paragraph
        if len(candidate) > max_chars and current:
            pieces.append(current)
            current = paragraph
        else:
            current = candidate
    if current:
        pieces.append(current)
    return pieces


def _metadata(
    doc: StructuredDoc,
    namespace: str,
    owner_type: str,
    owner_id: str,
    section_path: list[str],
    page: int | None,
    block_type: str,
    domain: str | None,
    core: str | None,
    sector: str | None,
    doc_type: str | None,
) -> dict:
    return ChunkMetadata(
        doc_id=doc.doc_id,
        title=doc.title,
        namespace=namespace,
        owner_type=owner_type,
        owner_id=owner_id,
        section_path=section_path,
        heading=section_path[-1] if section_path else None,
        page=page,
        block_type=block_type,
        row=None,
        col=None,
        domain=domain,
        core=core,
        sector=sector,
        type=doc_type,
    ).model_dump()


def chunk_document(
    doc: StructuredDoc,
    namespace: str,
    owner_type: str,
    owner_id: str,
    *,
    domain: str | None = None,
    core: str | None = None,
    sector: str | None = None,
    doc_type: str | None = None,
    max_chars: int = 1800,
) -> list[TextNode]:
    """`StructuredDoc` → heading/table-aware `TextNode`s.

    A node's content is grouped strictly by `section_path` identity — since every block already
    carries the exact heading stack it appeared under (Stage 3's `loader.py`), grouping by that
    equality guarantees a node can never span two different headings, at any level, without any
    separate heading-level bookkeeping here. Tables get one whole-table node plus one summary
    node; long sections split further on paragraph boundaries only (never mid-table, never
    mid-sentence-block).
    """
    nodes: list[TextNode] = []
    buffer: list[Block] = []

    def flush() -> None:
        if not buffer:
            return
        text = '\n\n'.join(b.text for b in buffer if b.text.strip())
        if text.strip():
            section_path = buffer[0].section_path
            page = buffer[0].page
            for piece in _split_text(text, max_chars):
                nodes.append(
                    TextNode(
                        text=piece,
                        metadata=_metadata(
                            doc, namespace, owner_type, owner_id, section_path, page,
                            'paragraph', domain, core, sector, doc_type,
                        ),
                    )
                )
        buffer.clear()

    for block in doc.blocks:
        if block.type == 'heading':
            flush()
            continue

        if block.type == 'table':
            flush()
            rows = block.table_cells or []
            nodes.append(
                TextNode(
                    text=block.text,
                    metadata=_metadata(
                        doc, namespace, owner_type, owner_id, block.section_path, block.page,
                        'table', domain, core, sector, doc_type,
                    ),
                )
            )
            heading = block.section_path[-1] if block.section_path else doc.title
            cols = len(rows[0]) if rows else 0
            summary = f'Table under "{heading}": {len(rows)} rows x {cols} cols.'
            if rows:
                summary += ' Header row: ' + ' | '.join(rows[0])
            nodes.append(
                TextNode(
                    text=summary,
                    metadata=_metadata(
                        doc, namespace, owner_type, owner_id, block.section_path, block.page,
                        'table', domain, core, sector, doc_type,
                    ),
                )
            )
            continue

        if block.type == 'figure':
            flush()
            if block.text.strip():
                nodes.append(
                    TextNode(
                        text=block.text,
                        metadata=_metadata(
                            doc, namespace, owner_type, owner_id, block.section_path, block.page,
                            'figure', domain, core, sector, doc_type,
                        ),
                    )
                )
            continue

        # paragraph / list — accumulate, but a change in section_path forces a flush too
        if buffer and buffer[0].section_path != block.section_path:
            flush()
        buffer.append(block)

    flush()
    return nodes
