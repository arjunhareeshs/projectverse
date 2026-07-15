from functools import lru_cache
from pathlib import Path

from app.core.hf_env import disable_hf_symlinks

disable_hf_symlinks()  # must run before docling's first Hugging Face model download

import docling_core.types.doc as dc  # noqa: E402
from docling.document_converter import DocumentConverter  # noqa: E402

from app.schemas.rag import Block, StructuredDoc  # noqa: E402


@lru_cache
def _get_converter() -> DocumentConverter:
    # Model loading (layout + OCR) is expensive — build once per process.
    return DocumentConverter()


def _heading_level(item: dc.NodeItem) -> int:
    if isinstance(item, dc.SectionHeaderItem):
        return max(1, item.level)
    return 1  # TitleItem is the document's top-level heading


def _page_of(item: dc.NodeItem) -> int:
    prov = getattr(item, 'prov', None)
    return prov[0].page_no if prov else 1


def _table_grid(item: dc.TableItem) -> list[list[str]]:
    rows, cols = item.data.num_rows, item.data.num_cols
    grid = [['' for _ in range(cols)] for _ in range(rows)]
    for cell in item.data.table_cells:
        r, c = cell.start_row_offset_idx, cell.start_col_offset_idx
        if 0 <= r < rows and 0 <= c < cols:
            grid[r][c] = cell.text
    return grid


def parse_document(file_path: str | Path, doc_id: str | None = None) -> StructuredDoc:
    """Docling `DocumentConverter` → ordered `Block`s, preserving heading nesting and table shape.

    OCR runs automatically for image-only pages/inputs (Docling's default `PdfPipelineOptions`);
    the recognized text surfaces here as ordinary paragraph blocks.
    """
    path = Path(file_path)
    result = _get_converter().convert(path)
    doc = result.document

    blocks: list[Block] = []
    section_stack: list[tuple[int, str]] = []
    title = path.stem

    for item, _depth in doc.iterate_items():
        page = _page_of(item)
        current_path = [heading for _, heading in section_stack]

        if isinstance(item, (dc.TitleItem, dc.SectionHeaderItem)):
            level = _heading_level(item)
            section_stack = [entry for entry in section_stack if entry[0] < level]
            section_stack.append((level, item.text))
            if isinstance(item, dc.TitleItem):
                title = item.text
            blocks.append(
                Block(
                    type='heading',
                    level=level,
                    text=item.text,
                    page=page,
                    section_path=[heading for _, heading in section_stack],
                )
            )
        elif isinstance(item, dc.TableItem):
            grid = _table_grid(item)
            table_text = '\n'.join(' | '.join(row) for row in grid)
            blocks.append(
                Block(
                    type='table',
                    level=None,
                    text=table_text,
                    page=page,
                    section_path=current_path,
                    table_cells=grid,
                )
            )
        elif isinstance(item, dc.PictureItem):
            caption = item.caption_text(doc) if item.captions else ''
            blocks.append(
                Block(type='figure', level=None, text=caption, page=page, section_path=current_path)
            )
        elif isinstance(item, dc.ListItem):
            text = item.text.strip()
            if text:
                blocks.append(
                    Block(type='list', level=None, text=text, page=page, section_path=current_path)
                )
        elif isinstance(item, dc.TextItem):
            text = item.text.strip()
            if text:
                blocks.append(
                    Block(type='paragraph', level=None, text=text, page=page, section_path=current_path)
                )

    return StructuredDoc(doc_id=doc_id or path.stem, title=title, blocks=blocks)
