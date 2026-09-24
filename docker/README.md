# ProjectVerse — Docker deployment

Everything runs in Docker: frontend, backend, background worker, PostgreSQL, Redis and the nginx edge.
The app is served under `/verse` (e.g. `https://pcdp.bitsathy.ac.in/verse`).

```text
Browser ──► edge (nginx, the only published port)
              /verse/            ──► client   (static React build)
              /verse/api/        ──► server ×3 (Express, prefix stripped → /api)
              /verse/socket.io/  ──► server ×3 (WebSocket)
              /verse/uploads/    ──► server ×3
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
                 db (Postgres 16)   redis (7)          worker ×1 (cron jobs)
                                    socket fan-out,
                                    rate limits, cron locks
migrate (one-shot) applies the Prisma migration before server/worker start.
seed    (one-shot, profile) fills a FRESH database.
```

## Configure

```bash
cp docker/.env.example docker/.env
```

Fill in at least `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`AI_API_KEY_ENCRYPTION_KEY` (each `openssl rand -hex 32`), `CLIENT_ORIGIN`, and the Google client IDs.
The server refuses to start in production without `AI_API_KEY_ENCRYPTION_KEY`; never change it
after launch or every stored user AI key becomes unreadable.

If another nginx on the host proxies to this stack, set `TRUST_PROXY=2` so client IPs are correct.

## Release (build machine)

The release version lives in `/VERSION` (currently `1.1.0` → image tag `v1.1.0`).

```bash
docker login                 # once, as the Docker Hub account (default user: pcdpbit)
./push.sh                    # Linux/macOS   — or  .\push.ps1  on Windows
```

This builds `linux/amd64` images for **server, client and edge**, tags each `v<VERSION>`,
`sha-<commit>` and `latest`, and pushes them. Guards:

- refuses uncommitted changes (`ALLOW_DIRTY=1` / `-AllowDirty` to override)
- refuses to overwrite a version already on Docker Hub — bump `VERSION` instead (`FORCE=1` / `-Force`)
- `./push.sh --no-push` builds locally only, for rehearsals

`VITE_GOOGLE_CLIENT_ID` is baked into the client at build time; it is read from the environment,
else `docker/.env`, else the root `.env`.

## Deploy (server)

Copy the repo to the server, create `docker/.env` (see *Configure*), set `IMG_TAG=v1.1.0`, then:

```bash
./deploy.sh --seed     # FIRST deploy on a fresh database
./deploy.sh            # every later release
```

`deploy.sh` checks required secrets, pulls the images, backs up the database to `backups/`
(when one exists), runs the migration, starts everything and waits for
`/verse/api/health/ready`. `--seed` refuses if the database already has users (seeding wipes it).

Rollback: `./deploy.sh --tag v1.0.x`, and restore the matching `backups/*.dump` if that release's
migration changed the schema:

```bash
docker compose -f docker/docker-compose.yml exec -T db pg_restore -U postgres -d projectverse --clean < backups/<file>.dump
```

Other flags: `--tag <tag>` deploy a specific tag, `--build` build here instead of pulling,
`--no-pull` use images already on this machine.

Seeded logins: `admin@projectverse.com` / `adminverse123`, `developer@projectverse.com` /
`developerverse123` (AI & system observability portal). Change these passwords after first login.

## Local full stack (no registry)

```bash
npm run docker:up      # build + start everything; migrate runs automatically
npm run docker:seed    # ONCE on a fresh database
```

## Scaling

- `SERVER_REPLICAS` (default 3) — API replicas; edge re-resolves them automatically.
- `DB_POOL_SERVER` × replicas + `DB_POOL_WORKER` must stay under `POSTGRES_MAX_CONNECTIONS`.
- Keep `worker` at 1 replica (cron jobs are also Redis-locked as a safeguard).
- Uploads live in a volume shared by all containers on this host; set `UPLOADS_PATH=/uploads`
  to bind-mount a host directory instead.

## Operations

```bash
npm run docker:logs                                        # all logs
docker compose -f docker/docker-compose.yml ps             # health
docker compose -f docker/docker-compose.yml exec db pg_dump -U postgres -Fc projectverse > backup.dump
npm run docker:down                                        # stop (volumes kept)
```

Live monitoring (requests, latency, errors, load, AI token usage) is in the app at
`/verse/developer/system-health` and `/verse/developer/ai-observability` (developer account only).
