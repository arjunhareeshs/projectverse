# ADR 0003: Frontend State Boundaries

## Decision

Use Redux Toolkit for durable application state and TanStack Query for server state.

## Rationale

- Predictable auth/session state handling
- Better caching and async data lifecycle management
- Reduced complexity compared to storing server data in Redux
