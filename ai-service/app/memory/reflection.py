import uuid

from llama_index.core.schema import TextNode

from app.llm.embeddings import get_embedding_model
from app.llm.provider import LLMProvider
from app.memory.vault import Vault
from app.memory.writer import parse_facts
from app.memory.types import FACT_TYPE_TO_FILE
from app.prompts import get_prompt_library
from app.rag.index.vector_store import get_qdrant_client, upsert_nodes
from app.schemas.memory import VaultFile
from app.schemas.rag import ChunkMetadata
from langchain_core.messages import HumanMessage


def _reembed_vault_file(user_id: str, filename: str, vfile: VaultFile) -> None:
    """Keeps `vault:<userId>` RAG search current — every reflection write re-indexes that file."""
    if not vfile.body.strip():
        return
    doc_id = f'vault:{user_id}:{filename}'
    metadata = ChunkMetadata(
        doc_id=doc_id,
        title=filename,
        namespace=f'vault:{user_id}',
        owner_type='user',
        owner_id=user_id,
        section_path=[filename],
        heading=filename,
        page=None,
        block_type='paragraph',
        type=vfile.frontmatter.type,
    ).model_dump()
    node = TextNode(text=vfile.body, metadata=metadata)
    embedder = get_embedding_model()
    vector = embedder.embed_text(vfile.body)
    # Deterministic id: one vault file = one point, so repeated reflection cycles update it in
    # place instead of accumulating stale duplicate vectors for the same file.
    point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, doc_id))
    upsert_nodes(get_qdrant_client(), [node], [vector], point_ids=[point_id])


async def consolidate(user_id: str, llm: LLMProvider, days: int | None = None) -> list[str]:
    """Reads recent `episodes/*.md` entries and folds recurring patterns into the relevant
    semantic file as one coherent note, instead of leaving them scattered across daily logs.

    Uses the `memory_extract` skill (Stage 5) rather than `memory_reflect` (Stage 2) for the
    actual routing: `memory_reflect`'s richer contract (`reinforced_fact_ids`/`decayed_fact_ids`)
    assumes individually-addressable fact records, but this vault stores facts as plain bullet
    lines with no per-fact id — that's a real gap, not hidden here, and a natural follow-up if
    per-fact reinforcement is needed later. Feeding every episode from the window into one
    `memory_extract` call still satisfies the actual goal: the LLM sees the whole pattern at once
    and synthesizes ONE fact, rather than writer.py's turn-by-turn appends producing near-duplicates.
    """
    vault = Vault(user_id)
    vault.ensure_scaffold()

    episode_files = [f for f in vault.list_files() if f.startswith('episodes/')]
    if days is not None:
        episode_files = sorted(episode_files)[-days:]
    if not episode_files:
        return []

    combined = '\n\n'.join(vault.read(f).body.strip() for f in episode_files)
    skill_prompt = get_prompt_library().render(
        'skills/memory_extract',
        turn=f'Recurring pattern across {len(episode_files)} days of episodic notes:\n{combined}',
    )
    response = await llm.chat([HumanMessage(content=skill_prompt)])
    facts = parse_facts(response.content if isinstance(response.content, str) else '')

    touched: list[str] = []
    for fact in facts:
        filename = FACT_TYPE_TO_FILE.get(fact.type)
        if filename is None or fact.type == 'episodic':
            continue
        if vault.merge_fact(filename, fact.text):
            touched.append(filename)
            _reembed_vault_file(user_id, filename, vault.read(filename))
    return touched


def decay(
    user_id: str,
    referenced_files: set[str] | None = None,
    recency_factor: float = 0.97,
    reinforcement_boost: float = 1.15,
) -> dict[str, float]:
    """One decay tick over every vault file's frontmatter `decay` field. Files in
    `referenced_files` (e.g. ones `traverse()` just surfaced) are reinforced instead — pushed
    back toward 1.0 rather than allowed to drift down. Returns {filename: new_decay_value}."""
    vault = Vault(user_id)
    referenced_files = referenced_files or set()
    results: dict[str, float] = {}
    for filename in vault.list_files():
        vfile = vault.read(filename)
        current = vfile.frontmatter.decay
        new_decay = min(1.0, current * reinforcement_boost) if filename in referenced_files else current * recency_factor
        vault.write(
            filename,
            vfile.body,
            {**vfile.frontmatter.model_dump(exclude={'last_updated', 'decay'}), 'decay': round(new_decay, 6)},
        )
        results[filename] = new_decay
    return results
