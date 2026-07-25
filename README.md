<div align="center">

# ProjectVerse AI

**Enterprise-grade project management, powered by an AI-guided project catalog**

*A Jira/Linear-class platform purpose-built for academic project selection, team collaboration, and delivery tracking.*

[![Node](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](#license)

</div>

---

## Overview

ProjectVerse AI replaces the traditional dropdown-and-form project intake process with a **conversational, AI-guided catalog experience**. Students navigate a live problem-statement catalog — 1,400+ real, categorized project briefs spanning 26 engineering domains — entirely through a chat interface, propose and validate their own problem statements with an LLM, and walk through an AI-driven feasibility interview before a project is greenlit.

On top of that sits a full project-delivery suite: team workspaces, Kanban boards, Gantt timelines, GitHub repository analytics, real-time team chat, and an admin control tower for oversight across every cohort.

---

## ✨ Key Features

### 🧭 AI-Guided Project Selection
- **Conversational catalog navigation** — Category → Domain → Subdomain → Problem Statement, driven entirely by database-backed option pills (no blind dropdowns).
- **1,400+ real problem statements** across 26 domains (AI/ML, AgriTech, Biomedical & HealthTech, GovTech, Cybersecurity, and more), imported and normalized from source data.
- **Custom problem statement proposals** — students can pitch their own idea; an LLM validates it for domain relevance, novelty (checked against the existing catalog), and technical scope before it's added.
- **AI feasibility interview** — once a problem statement is picked, an AI mentor interviews the team on implementation plan and technical approach, then generates a readiness report before the project is finalized.
- **Team capacity limits, duplicate-selection protection, and full backward navigation** through every step of the flow.

### 📊 Project & Team Delivery
- Kanban boards, Gantt timelines, sprints, and milestone tracking
- Team workspaces with real-time chat, activity feeds, and velocity charts
- **GitHub repository integration** — attach a repo when finalizing a project or edit it later from the team dashboard; automatically pulls commit, contributor, and language analytics for public repos
- Document management, file uploads (Cloudinary), and project review workflows

### 🛡️ Admin Portal
- Bulk problem-statement upload/management, user & team administration
- Cohort-wide analytics: team trends, student trends, project health
- Full audit logging and role-based access control

### 🔐 Security
- JWT access/refresh token authentication with bcrypt password hashing
- Role-based route protection (Admin / Student)
- Server-side validation on every mutating endpoint (Zod)

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, Tailwind CSS (HSL design tokens), Redux Toolkit, React Hook Form + Zod, React Router, Lucide Icons |
| **Backend** | Node.js + Express, TypeScript, Prisma ORM, Socket.io, JWT + bcrypt |
| **Database** | PostgreSQL 16 |
| **AI** | LLM-backed catalog validation, mentor interview, and readiness reports (via Groq) — integrated directly into the API server |
| **Integrations** | GitHub REST API (repo analytics), Cloudinary (file storage) |

---

## 📦 Project Structure

```text
projectverse/
├── client/                 # React frontend
│   └── src/
│       ├── pages/           # Route-level views (chat catalog, dashboard, teams, admin…)
│       ├── components/      # Reusable UI components
│       └── services/        # API client modules
├── server/                  # Express backend API
│   ├── src/
│   │   ├── modules/         # Feature modules (projects, teams, github, ai, admin…)
│   │   └── scripts/         # Seed & verification scripts
│   └── database/
│       ├── prisma/          # Schema & migrations
│       └── data/            # Source catalog datasets
└── docker/                  # Docker Compose configurations

🛠️ Prerequisites
Node.js v18 or higher
npm v9 or higher
Docker Desktop (for PostgreSQL)
🚦 Getting Started
1. Install dependencies

npm install
2. Configure environment variables

cp .env.example .env
cp server/.env.example server/.env
server/.env must contain at minimum:


NODE_ENV=development
SERVER_PORT=4000
CLIENT_ORIGIN=http://localhost:7333
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/projectverse?schema=public
JWT_ACCESS_SECRET=super_secret_access_token_key_12345
JWT_REFRESH_SECRET=super_secret_refresh_token_key_67890
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY powers problem-statement validation and the AI mentor interview. The app degrades gracefully to heuristic fallbacks without it, but for the full experience it's required.

3. Start the database

docker run -d \
  --name projectverse-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=projectverse \
  -p 5434:5432 \
  postgres:16-alpine
Already created it before? docker start projectverse-postgres

4. Run database migrations

cd server
npx prisma migrate dev
5. Seed the database

# Core demo data — org, teams, tasks, and accounts
npm run prisma:seed

# The full problem-statement catalog (1,400+ real entries across 26 domains)
npm run seed:catalog

# Optional — verify the catalog seeded correctly
npm run verify:catalog
6. Start the development servers
Terminal 1 — Backend (port 4000):


npm run dev -w server
Terminal 2 — Frontend (port 7333):


npm run dev -w client
Open http://localhost:7333.

🔑 Login Credentials
All accounts share the password: password123

Role	Email	Access
Admin	admin@projectverse.com	Full admin portal — catalog management, user/team administration, analytics
Student	Any student email seeded from the roster	Dashboard, AI-guided project selection, Kanban, timeline, team workspace, documents
🔄 Resetting the Database

cd server
npm run prisma:seed
npm run seed:catalog
⚠️ prisma:seed deletes existing demo data. seed:catalog is idempotent and safe to re-run — it upserts by problem ID and never removes catalog entries a team has already selected.

🎨 Design System
Primary Blue: #2563EB · Secondary Purple: #7C3AED
Typography: Inter
Theme: Full light & dark mode support
🔒 Authentication Flow
User submits credentials via the login form
Server validates against bcrypt-hashed passwords in PostgreSQL
A short-lived Access Token (15 min) is returned and stored in Redux state
Protected routes attach the Bearer token automatically via an Axios interceptor
A Refresh Token (7 days) silently renews the session
🐛 Troubleshooting
Problem	Solution
401 Unauthorized on login	Database isn't running — docker start projectverse-postgres
P1001: Can't reach database	Same as above
EPERM on prisma migrate dev	Stop the running server first, then migrate, then restart
Port 7333 already in use	vite.config.ts has strictPort: true — free the port or change it
Login works but no data shows	Run npm run prisma:seed (and npm run seed:catalog for the project catalog)
Project catalog is empty or shows generic domains	Run npm run seed:catalog, then npm run verify:catalog to confirm
AI validation/mentor chat falls back to generic replies	Set GROQ_API_KEY in server/.env
📄 License
Private and Confidential.


