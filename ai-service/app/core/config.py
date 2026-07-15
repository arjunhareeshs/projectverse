from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # Service
    ai_service_port: int = 8000

    # LLM (Groq) — required, service must not boot without these
    groq_api_key: str = Field(...)
    ai_model: str = 'meta-llama/llama-4-scout-17b-16e-instruct'
    ai_fallback_model: str = 'openai/gpt-oss-120b'
    ai_temperature: float = 0.3

    # Internal request signing (shared secret with Node)
    internal_token_secret: str = Field(...)
    internal_token_max_skew_seconds: int = 60
    node_internal_url: str = 'http://localhost:4000/api/internal'

    # RAG / vector store (wired up starting Stage 3/4)
    qdrant_url: str = 'http://localhost:6333'
    embed_model: str = 'sentence-transformers/all-MiniLM-L6-v2'
    rerank_model: str = 'BAAI/bge-reranker-v2-m3'

    # Memory vault (wired up starting Stage 5)
    vault_root: str = './data/vaults'
    jobs_db: str = './data/jobs.sqlite'

    # Web/browser tools (wired up starting Stage 7)
    ddgs_region: str = 'wt-wt'
    playwright_allowed_domains: str = 'github.com,arxiv.org'

    # Legacy Phase-1 placeholder endpoints (app/api/inference.py) — kept until superseded
    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    default_provider: str = 'openai'


@lru_cache
def get_settings() -> Settings:
    return Settings()
