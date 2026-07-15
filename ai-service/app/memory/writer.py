import json
import re
from datetime import datetime, timezone

from langchain_core.messages import HumanMessage

from app.llm.provider import LLMProvider
from app.memory.types import FACT_TYPE_TO_FILE
from app.memory.vault import Vault
from app.prompts import get_prompt_library
from app.schemas.memory import ConversationTurn, ExtractedFact


def parse_facts(raw: str) -> list[ExtractedFact]:
    text = raw.strip()
    if text.startswith('```'):
        text = text.strip('`')
        text = text.split('\n', 1)[1] if '\n' in text else text
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    facts: list[ExtractedFact] = []
    for item in data.get('facts', []):
        try:
            facts.append(ExtractedFact(**item))
        except (TypeError, ValueError):
            continue
    return facts


async def extract_and_write(user_id: str, turn: ConversationTurn, llm: LLMProvider) -> list[str]:
    """Runs the `memory_extract` skill over a conversation turn and writes any durable facts into
    the right vault file(s), deduped. Returns the list of files actually touched (empty if the
    turn had nothing worth remembering — the common case)."""
    vault = Vault(user_id)
    vault.ensure_scaffold()

    turn_text = f'User: {turn.user_message}'
    if turn.assistant_message:
        turn_text += f'\nAssistant: {turn.assistant_message}'

    skill_prompt = get_prompt_library().render('skills/memory_extract', turn=turn_text)
    response = await llm.chat([HumanMessage(content=skill_prompt)])
    facts = parse_facts(response.content if isinstance(response.content, str) else '')

    touched: list[str] = []
    for fact in facts:
        if fact.type == 'episodic':
            date = datetime.now(timezone.utc).date().isoformat()
            if vault.append_episode(date, fact.text):
                touched.append(f'episodes/{date}.md')
            continue
        filename = FACT_TYPE_TO_FILE.get(fact.type)
        if filename is not None and vault.merge_fact(filename, fact.text):
            touched.append(filename)

    # Automatically extract entities/concepts from wikilinks (e.g. [[LLM]]) and scaffold new node files in the vault.
    wikilink_re = re.compile(r'\[\[([^\]#|]+)\]\]')
    entities = set()
    for fact in facts:
        for match in wikilink_re.findall(fact.text):
            entity_name = match.strip()
            if entity_name:
                entities.add(entity_name)

    for entity in entities:
        # Normalize name to prevent directory traversal
        safe_entity = re.sub(r'[^a-zA-Z0-9_\-\s]', '', entity).strip()
        if not safe_entity:
            continue
        filename = f'{safe_entity}.md'
        if not vault.exists(filename):
            vault.write(
                filename,
                f'# {safe_entity}\n\n## Facts\n- [[Concept]] introduced in conversation.\n',
                {'type': 'semantic', 'tags': ['entity', safe_entity.lower()], 'links': [], 'decay': 1.0, 'confidence': 1.0}
            )
            touched.append(filename)

    # Real-time RAG re-embedding: Keep Qdrant vector index current with all changes to the vault.
    from app.memory.reflection import _reembed_vault_file
    for filename in touched:
        try:
            vfile = vault.read(filename)
            _reembed_vault_file(user_id, filename, vfile)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to re-embed vault file {filename}: {e}")

    return touched
