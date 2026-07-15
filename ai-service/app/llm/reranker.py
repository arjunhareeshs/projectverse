from functools import lru_cache
from typing import Any

from app.core.config import get_settings
from app.core.hf_env import disable_hf_symlinks

disable_hf_symlinks()  # must run before the first Hugging Face model download

from sentence_transformers import CrossEncoder  # noqa: E402


class Reranker:
    """Cross-encoder reranker — loaded once at lifespan startup, not per-request."""

    def __init__(self, model_name: str) -> None:
        self._model = CrossEncoder(model_name)

    def rerank(self, query: str, candidates: list[Any], top_n: int, text_of=lambda c: c.text) -> list[tuple[Any, float]]:
        """Returns `(candidate, score)` pairs, highest score first. `text_of` extracts the text
        to score from each candidate, since candidates may be raw strings or richer objects."""
        if not candidates:
            return []
        pairs = [(query, text_of(c)) for c in candidates]
        scores = self._model.predict(pairs)
        ranked = sorted(zip(candidates, scores), key=lambda pair: pair[1], reverse=True)
        return [(c, float(s)) for c, s in ranked[:top_n]]


@lru_cache
def get_reranker() -> Reranker:
    return Reranker(get_settings().rerank_model)
