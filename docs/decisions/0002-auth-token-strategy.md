# ADR 0002: Auth Token Strategy (Phase 1 Baseline)

## Decision

Use JWT access tokens and refresh tokens with refresh tokens stored in httpOnly secure cookies.

## Rationale

- Reduced XSS exposure for refresh credentials
- Compatible with enterprise session lifecycle patterns
- Enables incremental hardening in subsequent phases
