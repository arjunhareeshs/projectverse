import contextvars

from pydantic import BaseModel


class RequestIdentity(BaseModel):
    """Identity of the caller, extracted from a Node-signed internal request."""

    user_id: str
    role: str
    team_id: str | None = None
    org_id: str | None = None


# Set once per request/agent-turn (see app/api/chat.py and Stage 8's graph entry node) so tools
# (Stage 7) can resolve "who is calling" without the LLM ever supplying userId/role as a tool
# argument — that would be a direct authorization hole (the model could just claim to be someone
# else).
current_identity: contextvars.ContextVar[RequestIdentity | None] = contextvars.ContextVar(
    'current_identity', default=None
)


def get_current_identity() -> RequestIdentity:
    identity = current_identity.get()
    if identity is None:
        raise RuntimeError('No RequestIdentity bound to this context — tools must run inside a request/agent turn.')
    return identity
