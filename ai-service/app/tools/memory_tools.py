import asyncio

from app.core.config import get_settings
from app.core.identity import get_current_identity
from app.llm.provider import LLMProvider
from app.memory.traversal import traverse
from app.memory.vault import Vault
from app.memory.writer import extract_and_write
from app.schemas.memory import ConversationTurn
from app.tools.base import audited_tool


@audited_tool
async def memory_read(filename: str) -> dict:
    """Read one file from the caller's own memory vault, e.g. 'strengths.md', 'preferences.md'."""
    vault = Vault(get_current_identity().user_id)
    if not vault.exists(filename):
        return {'error': 'not_found', 'detail': f'{filename} does not exist in this vault yet.'}
    vfile = vault.read(filename)
    return {'filename': filename, 'body': vfile.body, 'frontmatter': vfile.frontmatter.model_dump()}


@audited_tool
async def memory_write(user_message: str, assistant_message: str = '') -> dict:
    """Extract durable facts from a conversation turn and write them into the caller's own memory
    vault (deduped). Returns which files were touched — empty if nothing was worth remembering."""
    identity = get_current_identity()
    provider = LLMProvider(get_settings())
    turn = ConversationTurn(user_message=user_message, assistant_message=assistant_message or None)
    touched = await extract_and_write(identity.user_id, turn, provider)
    return {'touched_files': touched}


@audited_tool
async def memory_traverse(user_id: str, query: str, token_budget: int = 800) -> dict:
    """(Admin) Read-only graph traversal of a specific student/captain's memory vault — `user_id`
    is the person being analyzed, not the caller. Returns a ranked context bundle, not one file."""
    bundle = await asyncio.to_thread(traverse, user_id, query, token_budget)
    return {
        'digest': bundle.to_digest(),
        'entries': [
            {'file': e.file, 'heading': e.heading, 'text': e.text, 'hop_distance': e.hop_distance, 'weight': e.weight}
            for e in bundle.entries
        ],
    }
