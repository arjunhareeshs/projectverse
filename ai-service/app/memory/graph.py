import re

import networkx as nx

from app.memory.vault import Vault

_WIKILINK_RE = re.compile(r'\[\[([^\]]+)\]\]')
_HEADING_RE = re.compile(r'^(#{1,6})\s+(.*)$')


def _normalize_link_target(raw: str) -> str:
    return raw.strip()


def _split_sections(body: str) -> list[tuple[int, str, str]]:
    """Splits body into (level, heading_text, section_text) chunks, in order. Content before the
    first heading is returned as a level-0 section with an empty heading (the "preamble")."""
    sections: list[tuple[int, str, list[str]]] = []
    current: tuple[int, str, list[str]] = (0, '', [])
    for line in body.splitlines():
        match = _HEADING_RE.match(line)
        if match:
            sections.append(current)
            current = (len(match.group(1)), match.group(2).strip(), [])
        else:
            current[2].append(line)
    sections.append(current)
    return [(level, heading, '\n'.join(lines).strip()) for level, heading, lines in sections]


def build_graph(user_id: str) -> nx.Graph:
    """Nodes = one per vault file, plus one per heading within it (finer-grained addressing).
    Edges = `[[wikilink]]` (direct, weight 1.0), heading->file structure (weight 1.0), shared
    frontmatter tags (weak, weight 0.3). Cheap to rebuild — a few dozen small files per user, not
    a distributed graph DB; callers should rebuild after any `Vault.write`/`append_episode`.
    """
    vault = Vault(user_id)
    graph = nx.Graph()
    tag_index: dict[str, list[str]] = {}

    for filename in vault.list_files():
        vfile = vault.read(filename)
        file_node = filename[:-3] if filename.endswith('.md') else filename
        # File nodes are structural hubs, not content — their text is '' so seed matching and the
        # final bundle surface the (finer-grained) heading nodes instead of duplicating content.
        graph.add_node(
            file_node, kind='file', filename=filename, heading=None, text='',
            tags=vfile.frontmatter.tags, decay=vfile.frontmatter.decay, type=vfile.frontmatter.type,
        )

        for tag in vfile.frontmatter.tags:
            tag_index.setdefault(tag, []).append(file_node)

        for level, heading, section_text in _split_sections(vfile.body):
            source_node = file_node
            if heading:
                heading_node = f'{file_node}#{heading}'
                graph.add_node(heading_node, kind='heading', filename=filename, heading=heading, text=section_text)
                graph.add_edge(file_node, heading_node, kind='structure', weight=1.0)
                source_node = heading_node

            for target in _WIKILINK_RE.findall(section_text):
                target_node = _normalize_link_target(target)
                if not graph.has_node(target_node):
                    graph.add_node(target_node, kind='external_ref', filename=None, heading=None, text='')
                if not graph.has_edge(source_node, target_node):
                    graph.add_edge(source_node, target_node, kind='wikilink', weight=1.0)

    for tag, files in tag_index.items():
        for i in range(len(files)):
            for j in range(i + 1, len(files)):
                a, b = files[i], files[j]
                if not graph.has_edge(a, b):
                    graph.add_edge(a, b, kind='shared_tag', weight=0.3, tag=tag)

    return graph
