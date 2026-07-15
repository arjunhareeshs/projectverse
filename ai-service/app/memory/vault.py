import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

import frontmatter

from app.core.config import get_settings
from app.memory.templates import CANONICAL_FILES, EVENTS_HEADING, FACTS_HEADING, scaffold_body
from app.schemas.memory import FrontMatter, VaultFile


def _fact_hash(text: str) -> str:
    normalized = re.sub(r'\s+', ' ', text.strip().lower())
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


class Vault:
    """A user's `.vault/` — Markdown files with YAML frontmatter, structured Obsidian-style."""

    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        self.root = Path(get_settings().vault_root) / user_id
        self.episodes_dir = self.root / 'episodes'
        self.procedures_dir = self.root / 'procedures'

    def ensure_scaffold(self) -> None:
        """Creates the full canonical file set on first use, even if mostly empty."""
        self.root.mkdir(parents=True, exist_ok=True)
        self.episodes_dir.mkdir(exist_ok=True)
        self.procedures_dir.mkdir(exist_ok=True)
        for filename, spec in CANONICAL_FILES.items():
            if not self.exists(filename):
                self.write(
                    filename,
                    scaffold_body(filename),
                    {'type': spec['type'], 'tags': list(spec['tags']), 'links': [], 'decay': 1.0, 'confidence': 1.0},
                )

    def _path(self, filename: str) -> Path:
        return self.root / filename

    def exists(self, filename: str) -> bool:
        return self._path(filename).exists()

    def read(self, filename: str) -> VaultFile:
        post = frontmatter.load(self._path(filename))
        return VaultFile(filename=filename, frontmatter=FrontMatter(**post.metadata), body=post.content)

    def write(self, filename: str, body: str, frontmatter_fields: dict) -> None:
        """Full overwrite — callers wanting to add a fact without clobbering others use `merge_fact`."""
        path = self._path(filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        meta = {**frontmatter_fields, 'last_updated': datetime.now(timezone.utc).date().isoformat()}
        post = frontmatter.Post(body, **meta)
        path.write_bytes(frontmatter.dumps(post).encode('utf-8'))

    def list_files(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted(str(p.relative_to(self.root)).replace('\\', '/') for p in self.root.rglob('*.md'))

    def merge_fact(
        self,
        filename: str,
        fact_text: str,
        default_frontmatter: dict | None = None,
        heading: str = FACTS_HEADING,
    ) -> bool:
        """Appends `fact_text` as a bullet under `heading`, deduped by normalized-content hash.

        Returns True if the fact was newly added, False if an equivalent fact was already there
        (repeated extraction of the same fact must not bloat the file).
        """
        if self.exists(filename):
            vfile = self.read(filename)
            body = vfile.body
            fm = vfile.frontmatter.model_dump(exclude={'last_updated'})
        else:
            body = f'{heading}\n'
            fm = default_frontmatter or {'type': 'semantic', 'tags': [], 'links': [], 'decay': 1.0, 'confidence': 1.0}

        pre_lines: list[str] = []
        facts: list[str] = []
        hashes: set[str] = set()
        in_section = False
        for line in body.splitlines():
            if line.strip() == heading:
                in_section = True
                continue
            if not in_section:
                pre_lines.append(line)
                continue
            stripped = line.strip()
            if stripped.startswith('- '):
                text = stripped[2:]
                facts.append(text)
                hashes.add(_fact_hash(text))

        if _fact_hash(fact_text) in hashes:
            return False

        facts.append(fact_text)
        new_body = '\n'.join(pre_lines).rstrip() + f'\n\n{heading}\n' + '\n'.join(f'- {t}' for t in facts) + '\n'
        self.write(filename, new_body, fm)
        return True

    def append_episode(self, date: str, entry: str) -> bool:
        return self.merge_fact(
            f'episodes/{date}.md',
            entry,
            default_frontmatter={'type': 'episodic', 'tags': ['episode'], 'links': [], 'decay': 1.0, 'confidence': 1.0},
            heading=EVENTS_HEADING,
        )
