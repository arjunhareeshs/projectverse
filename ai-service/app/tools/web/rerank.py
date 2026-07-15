from app.llm.reranker import get_reranker


def rerank_hits(query: str, hits: list[dict], top_n: int, text_key: str = 'body') -> list[dict]:
    """Reranks DDGS-shaped hit dicts with the Stage 4 cross-encoder. Returns the top_n hits, each
    with a `rerank_score` attached, highest first."""
    reranker = get_reranker()
    ranked = reranker.rerank(
        query, hits, top_n, text_of=lambda h: f"{h.get('title', '')} {h.get(text_key, '')}"
    )
    return [{**hit, 'rerank_score': score} for hit, score in ranked]
