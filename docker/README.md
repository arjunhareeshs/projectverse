# ProjectVerse Docker Deployment

Self-contained Docker Compose architecture for ProjectVerse AI: Frontend, Backend API, Background Worker, PostgreSQL Database, Redis, and Nginx Gateway.

---

## 🏗️ Architecture

```text
[ Client Browser ]
        │
        ▼ (Port 8080)
┌─────────────────────────────────────────────────────────┐
│                    edge (Nginx Proxy)                  │
│                                                         │
│  /           ──> client (React 18 + Vite static build)  │
│  /api/       ──> server (Node.js/Express API :4000)     │
│  /socket.io/ ──> server (WebSocket server :4000)       │
│  /uploads/   ──> server (Local uploads volume)          │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
                ▼                         ▼
      ┌──────────────────┐      ┌──────────────────┐
      │  db (Postgres 16)│      │  redis (Redis 7) │
      └──────────────────┘      └──────────────────┘
                ▲
                │
      ┌──────────────────┐
      │ migrate (Prisma) │ (runs at startup to apply migrations)
      └──────────────────┘
                │
      ┌──────────────────┐
      │ worker (Cron)    │ (scheduler for lifecycle & streak nudges)
      └──────────────────┘
```

---

## 🚀 Quick Start

### 1. Configure Environment

From the project root or the `docker/` folder:

```bash
cp docker/.env.example docker/.env
```

Review `docker/.env` and update secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) and API keys (such as `GROQ_API_KEY`) as required.

### 2. Start Services

From the project root:

```bash
npm run docker:up
```

*Or using Docker Compose directly:*

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Access the application at: **http://localhost:8080**

---

## 📦 Services

| Service | Port (Host) | Internal Port | Description |
|---|---|---|---|
| **edge** | `8080` | `80` | Nginx reverse proxy serving client and routing `/api/` & `/socket.io/` to backend |
| **client** | — | `8080` | Nginx serving production Vite React SPA |
| **server** | `4000` | `4000` | Express API server handling authentication, projects, and AI integrations |
| **worker** | — | — | Background task scheduler running daily log nudges and streak tracking |
| **migrate**| — | — | One-shot container that executes Prisma migrations (`prisma migrate deploy`) |
| **db** | `5434` | `5432` | PostgreSQL 16 database with persistent volume `pgdata` |
| **redis** | `6379` | `6379` | Redis 7 in-memory cache and Socket.io adapter |

---

## 🔄 Database Seeding

To populate the database with demo users (admin, teams, students) and the 1,400+ problem statements catalog:

### Option A: Using NPM script from project root

```bash
npm run docker:seed
```

### Option B: Using Docker Compose profile

```bash
docker compose -f docker/docker-compose.yml --profile seed run --rm seed
```

### Option C: Running individual seed scripts inside the container

```bash
# Seed demo accounts and groups:
docker compose -f docker/docker-compose.yml run --rm server node dist/scripts/seed.js

# Seed problem statement catalog:
docker compose -f docker/docker-compose.yml run --rm server node dist/scripts/seedProblemStatements.js
```

---

## 📊 Management & Logs

### View Logs

```bash
# All services
npm run docker:logs
# or
docker compose -f docker/docker-compose.yml logs -f

# Specific service (e.g. server or db)
docker compose -f docker/docker-compose.yml logs -f server
```

### Stop Services

```bash
npm run docker:down
# or
docker compose -f docker/docker-compose.yml down
```

### Reset Database Volume (Clean Slate)

```bash
docker compose -f docker/docker-compose.yml down -v
```

---

## 🔑 Default Seed Credentials

- **Admin**: `admin@projectverse.com` / `password123`
- **Students**: Seeded from student roster / `password123`
