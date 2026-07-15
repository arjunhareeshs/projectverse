# Local Development Runbook

## Prerequisites

- Node.js 20+
- pnpm 10+
- Python 3.12+
- Docker Desktop

## Start Workspace Services (Node)

1. Install dependencies: `pnpm install`
2. Run client and server: `pnpm dev`

## Start AI Service

1. Create venv in ai-service
2. Install dependencies from requirements.txt
3. Run: `uvicorn app.main:app --reload --port 8000`

## Run with Docker

- `docker compose up --build`

## Quality Checks

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
