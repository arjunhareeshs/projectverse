# ProjectVerse Architecture Overview

ProjectVerse uses a modular monorepo architecture optimized for enterprise SaaS development.

## Layers

- Client (React + TypeScript): UI shell, navigation, route guards, design system baseline.
- Server (Express + Prisma): REST API boundary, auth/token strategy, middleware and infrastructure adapters.
- AI Service (FastAPI): AI endpoint boundary and provider abstraction.
- Database (PostgreSQL + Prisma): data model and migration contracts.

## Principles

- Feature-driven modularity
- Clear separation of concerns
- Security-first defaults
- Scalability through service boundaries
- Controlled phase-by-phase delivery
