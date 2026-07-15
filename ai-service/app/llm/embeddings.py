from functools import lru_cache

from app.core.config import get_settings
from app.core.hf_env import disable_hf_symlinks

disable_hf_symlinks()  # must run before the first Hugging Face model download

from llama_index.embeddings.huggingface import HuggingFaceEmbedding  # noqa: E402


class EmbeddingModel:
    """Wraps LlamaIndex's `HuggingFaceEmbedding` — loaded once at lifespan startup, not per-request."""

    def __init__(self, model_name: str) -> None:
        self._model = HuggingFaceEmbedding(model_name=model_name)
        self.dim = len(self._model.get_text_embedding('warmup'))

    def embed_text(self, text: str) -> list[float]:
        return self._model.get_text_embedding(text)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return self._model.get_text_embedding_batch(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._model.get_query_embedding(text)


@lru_cache
def get_embedding_model() -> EmbeddingModel:
    return EmbeddingModel(get_settings().embed_model)
