from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import groq
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import Runnable
from langchain_groq import ChatGroq
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import Settings

logger = logging.getLogger(__name__)

# Raised by Groq when a model id is unknown or has been decommissioned — swap to fallback.
_MODEL_UNAVAILABLE_ERRORS = (groq.NotFoundError, groq.BadRequestError)

# Transient failures worth a short automatic retry with backoff.
_TRANSIENT_ERRORS = (
    groq.APIConnectionError,
    groq.APITimeoutError,
    groq.RateLimitError,
    groq.InternalServerError,
)


@dataclass
class Chunk:
    """One streamed delta from the model."""

    text: str = ''
    tool_call_chunks: list[dict[str, Any]] = field(default_factory=list)


class LLMProvider:
    """Wraps `ChatGroq` with retry-on-transient-error and swap-to-fallback-on-deprecation."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self.model = settings.ai_model
        self.fallback_model = settings.ai_fallback_model
        self._fell_back = False
        self._client = self._build_client(self.model)

    def _build_client(self, model: str) -> ChatGroq:
        return ChatGroq(
            model=model,
            api_key=self._settings.groq_api_key,
            temperature=self._settings.ai_temperature,
            streaming=True,
        )

    def _swap_to_fallback(self) -> None:
        if self._fell_back:
            return
        logger.warning(
            'Groq model "%s" unavailable (not found / deprecated) — switching to fallback "%s" '
            'for the rest of this process.',
            self.model,
            self.fallback_model,
        )
        self.model = self.fallback_model
        self._client = self._build_client(self.model)
        self._fell_back = True

    def _bound_client(self, tools: list[Any] | None) -> ChatGroq | Runnable:
        return self._client.bind_tools(tools) if tools else self._client

    def bind_tools(self, tools: list[Any]) -> Runnable:
        return self._client.bind_tools(tools)

    @retry(
        retry=retry_if_exception_type(_TRANSIENT_ERRORS),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    async def chat(self, messages: list[BaseMessage], tools: list[Any] | None = None) -> AIMessage:
        try:
            return await self._bound_client(tools).ainvoke(messages)
        except _MODEL_UNAVAILABLE_ERRORS:
            self._swap_to_fallback()
            return await self._bound_client(tools).ainvoke(messages)

    async def stream(
        self, messages: list[BaseMessage], tools: list[Any] | None = None
    ) -> AsyncIterator[Chunk]:
        client = self._bound_client(tools)
        started = False
        try:
            async for delta in client.astream(messages):
                started = True
                yield Chunk(
                    text=delta.content if isinstance(delta.content, str) else '',
                    tool_call_chunks=list(getattr(delta, 'tool_call_chunks', None) or []),
                )
        except _MODEL_UNAVAILABLE_ERRORS:
            if started:
                raise
            self._swap_to_fallback()
            client = self._bound_client(tools)
            async for delta in client.astream(messages):
                yield Chunk(
                    text=delta.content if isinstance(delta.content, str) else '',
                    tool_call_chunks=list(getattr(delta, 'tool_call_chunks', None) or []),
                )
