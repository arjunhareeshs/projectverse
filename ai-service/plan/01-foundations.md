# Stage 1 — Foundations: Config, Security, Logging, LLM Provider

> Ref: master plan Parts B, D, E. Nothing downstream (Stages 2–10) can be built or tested without this
> stage — it is the substrate every other module imports.

## Goal

Stand up the skeleton every later stage plugs into: typed settings, request identity/security, structured
logging, error handling, and a working, streaming Groq LLM call — proven live, not mocked.

## Why this comes first

Every stage from here on needs to call the LLM, needs a settings object, and needs to trust that a request
claiming to be "from Node, for user X with role Y" actually is. Building RAG or agents before this exists
means re-plumbing config through every module later.

## Dependencies

None (this is Stage 0 of actual code).

## Files to create

```
app/core/config.py       # pydantic-settings, one typed Settings object, loaded once
app/core/security.py     # verify X-Internal-Token (HMAC) from Node, extract identity
app/core/identity.py     # RequestIdentity {userId, role, teamId, orgId}
app/core/logging.py      # structured JSON logs + request id (extends existing logging.py)
app/core/errors.py       # AppError hierarchy → HTTP status mapping
app/llm/provider.py      # LLMProvider: chat(), stream(), bind_tools(), fallback + retry
app/api/health.py        # GET /health — reports model warm status (extends existing health.py)
app/api/chat.py          # POST /chat — first end-to-end SSE smoke test (echoes real Groq stream)
```

## Key design details

### `config.py`
One `Settings(BaseSettings)` object read once via `lru_cache`, replacing the current ad-hoc
`os.getenv` calls in `app/core/config.py`. Required keys (see master plan Part D for the full list):
`GROQ_API_KEY`, `AI_MODEL=meta-llama/llama-4-scout-17b-16e-instruct`, `AI_FALLBACK_MODEL=openai/gpt-oss-120b`,
`INTERNAL_TOKEN_SECRET`, `NODE_INTERNAL_URL`, `QDRANT_URL`, `EMBED_MODEL`, `RERANK_MODEL`, `VAULT_ROOT`,
`JOBS_DB`. Fail fast (raise at startup) if `GROQ_API_KEY` or `INTERNAL_TOKEN_SECRET` are missing — don't let
the service boot into a state where every request 500s.

### `security.py`
Node signs `X-Internal-Token: HMAC-SHA256(secret, f"{userId}.{role}.{ts}")` on every proxied request.
`verify_internal_token(request) -> RequestIdentity` checks signature + a small timestamp skew window
(replay protection), raises `AppError(401)` otherwise. Every API route in Stages 2–10 depends on this.

### `llm/provider.py` — the most important file in this stage
```python
class LLMProvider:
    def __init__(self, settings: Settings): ...
    async def stream(self, messages, tools=None) -> AsyncIterator[Chunk]: ...
    async def chat(self, messages, tools=None) -> AIMessage: ...
    def bind_tools(self, tools: list) -> Runnable: ...
```
Wraps `langchain_groq.ChatGroq`. Retry/backoff via `tenacity`. **Fallback logic:** if a call fails with a
model-not-found/deprecated error, log a warning, swap `self.model` to `settings.AI_FALLBACK_MODEL` for the
rest of the process lifetime, and retry once. This means a future Groq deprecation of Scout degrades
gracefully instead of taking the whole service down.

### `/health` and `/chat` (smoke test only — full chat lands in Stage 8)
`/health` returns `{status, models_warm: {embed: false, rerank: false}}` (those flip to `true` once Stage 4
loads them at lifespan startup). `/chat` in this stage is a **throwaway** SSE endpoint: take a raw prompt,
call `LLMProvider.stream()`, forward `text.delta` frames. It exists purely to prove Groq + SSE + streaming
work end-to-end before any agent logic is layered on. Stage 8 replaces its internals with the real graph.

## What NOT to build yet

No tools, no RAG, no memory, no agents. This stage's `/chat` does not call any tool and does not read the
vault. Resist the urge to wire the real system prompt in yet — that's Stage 2.

## Acceptance criteria

- `uvicorn app.main:app` boots with no missing-env crash when `.env` is filled in.
- `curl localhost:8000/health` → `{"status":"ok", ...}`.
- A signed request to `POST /chat {"prompt":"say hi"}` streams real tokens from Groq over SSE in a terminal
  `curl -N` session — not placeholder text, not a buffered single response.
- An unsigned or badly-signed request to `/chat` gets a 401, not a 500.
- Temporarily pointing `AI_MODEL` at an invalid model id proves the fallback path logs a warning and still
  returns a valid response via `AI_FALLBACK_MODEL`.
