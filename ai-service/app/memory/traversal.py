import math
from dataclasses import dataclass, field

from app.llm.embeddings import get_embedding_model
from app.memory.graph import build_graph


@dataclass
class ContextEntry:
    node_id: str
    file: str | None
    heading: str | None
    text: str
    hop_distance: int
    weight: float


@dataclass
class ContextBundle:
    entries: list[ContextEntry] = field(default_factory=list)

    def to_digest(self, max_chars: int = 4000) -> str:
        """Renders the bundle as the `memory_digest` string injected into `system/core_system.md`."""
        if not self.entries:
            return '(no relevant memory found)'
        blocks: list[str] = []
        used = 0
        for entry in self.entries:
            label = entry.file or entry.node_id
            if entry.heading:
                label += f' > {entry.heading}'
            block = f'[{label}] (hop {entry.hop_distance})\n{entry.text.strip()}'
            if used + len(block) > max_chars and blocks:
                break
            blocks.append(block)
            used += len(block)
        return '\n\n'.join(blocks)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _is_informative(text: str) -> bool:
    """A node is worth surfacing only if it holds a real fact, not just the scaffold placeholder.
    Short, near-identical placeholder text ("_No data yet._") embeds unpredictably close to
    unrelated queries with dense sentence encoders — excluding it keeps seed matching honest."""
    return any(line.strip().startswith('- ') for line in text.splitlines())


def traverse(
    user_id: str,
    query: str,
    token_budget: int = 800,
    hop_decay: float = 0.6,
    seed_top_k: int = 2,
) -> ContextBundle:
    """seed match (embedding similarity against every node's text) -> BFS with hop-decay ->
    budget-limited context bundle. Each hop away from a seed multiplies relevance weight by
    `hop_decay`, so directly-linked facts dominate but second-order context (e.g. a teammate's
    strengths, reached via the team file) still surfaces when there's budget left."""
    graph = build_graph(user_id)
    node_ids = [n for n, data in graph.nodes(data=True) if _is_informative(data.get('text', ''))]
    if not node_ids:
        return ContextBundle()

    embedder = get_embedding_model()
    query_vector = embedder.embed_query(query)
    node_vectors = embedder.embed_texts([graph.nodes[n]['text'] for n in node_ids])
    scored = sorted(
        ((node_id, _cosine(query_vector, vec)) for node_id, vec in zip(node_ids, node_vectors)),
        key=lambda pair: pair[1],
        reverse=True,
    )
    seeds = [node_id for node_id, score in scored[:seed_top_k] if score > 0] or [scored[0][0]]

    best_weight: dict[str, float] = {seed: 1.0 for seed in seeds}
    best_hop: dict[str, int] = {seed: 0 for seed in seeds}
    queue: list[tuple[str, float, int]] = [(seed, 1.0, 0) for seed in seeds]

    while queue:
        node, weight, hop = queue.pop(0)
        for neighbor in graph.neighbors(node):
            edge_weight = graph.edges[node, neighbor].get('weight', 1.0)
            new_weight = weight * hop_decay * edge_weight
            if new_weight < 0.01:  # negligible — stop expanding this branch
                continue
            if new_weight > best_weight.get(neighbor, 0.0):
                best_weight[neighbor] = new_weight
                best_hop[neighbor] = hop + 1
                queue.append((neighbor, new_weight, hop + 1))

    ranked = sorted(best_weight.items(), key=lambda kv: kv[1], reverse=True)
    budget_chars = token_budget * 4  # rough token ≈ 4 chars estimate

    bundle = ContextBundle()
    used_chars = 0
    for node_id, weight in ranked:
        data = graph.nodes[node_id]
        text = data.get('text', '')
        if not _is_informative(text):
            continue
        if used_chars + len(text) > budget_chars and bundle.entries:
            continue
        bundle.entries.append(
            ContextEntry(
                node_id=node_id, file=data.get('filename'), heading=data.get('heading'),
                text=text, hop_distance=best_hop[node_id], weight=weight,
            )
        )
        used_chars += len(text)
        if used_chars >= budget_chars:
            break

    return bundle
