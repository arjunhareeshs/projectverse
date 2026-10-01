#!/usr/bin/env bash
# Deploy (or update) ProjectVerse on the server from pushed images.
#
#   ./deploy.sh               # pull IMG_TAG from docker/.env, back up DB, migrate, start, health-check
#   ./deploy.sh --tag v1.1.3  # deploy a specific tag (also used for rollback)
#   ./deploy.sh --seed        # FIRST deploy only: seeds a fresh database (refuses if users exist)
#   ./deploy.sh --build       # build images from this checkout instead of pulling
#   ./deploy.sh --no-pull     # use images already on this machine (e.g. after ./push.sh --no-push)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE=docker/.env
SEED=0; BUILD=0; PULL=1; TAG_OVERRIDE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --seed) SEED=1 ;;
    --build) BUILD=1 ;;
    --no-pull) PULL=0 ;;
    --tag) TAG_OVERRIDE="${2:?--tag needs a value}"; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

[ -f "$ENV_FILE" ] || { echo "Error: $ENV_FILE missing. Run: cp docker/.env.example docker/.env and fill it in."; exit 1; }

env_value() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^["'\'']//; s/["'\'']$//'; }

# Required settings — fail before touching anything.
missing=()
for key in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET AI_API_KEY_ENCRYPTION_KEY CLIENT_ORIGIN; do
  [ -n "$(env_value "$key")" ] || missing+=("$key")
done
[ "$(env_value POSTGRES_PASSWORD)" = "change-me" ] && missing+=("POSTGRES_PASSWORD (still 'change-me')")
if [ "${#missing[@]}" -gt 0 ]; then
  echo "Error: set these in $ENV_FILE:"; printf '  - %s\n' "${missing[@]}"; exit 1
fi
AI_KEY="$(env_value AI_API_KEY_ENCRYPTION_KEY)"
if [ "${#AI_KEY}" -lt 32 ]; then
  echo "Error: AI_API_KEY_ENCRYPTION_KEY must be at least 32 characters (openssl rand -hex 32)."; exit 1
fi

export IMG_TAG="${TAG_OVERRIDE:-$(env_value IMG_TAG)}"
[ -n "$IMG_TAG" ] || { echo "Error: IMG_TAG not set in $ENV_FILE (e.g. IMG_TAG=v1.1.3)."; exit 1; }

COMPOSE=(docker compose -f docker/docker-compose.yml)
PORT="$(env_value PORT)"; PORT="${PORT:-8080}"
BASE="$(env_value PUBLIC_BASE_PATH)"; BASE="${BASE:-/verse}"
PG_USER="$(env_value POSTGRES_USER)"; PG_USER="${PG_USER:-postgres}"
PG_DB="$(env_value POSTGRES_DB)"; PG_DB="${PG_DB:-projectverse}"

echo "=========================================="
echo " Deploying ProjectVerse ${IMG_TAG}"
echo "=========================================="

# 1. Get images.
if [ "$BUILD" = 1 ]; then
  "${COMPOSE[@]}" build
elif [ "$PULL" = 1 ]; then
  "${COMPOSE[@]}" pull
fi

# 2. Back up the database before migrations run (skipped on the very first deploy).
if [ -n "$("${COMPOSE[@]}" ps -q db 2>/dev/null)" ]; then
  mkdir -p backups
  BACKUP="backups/${PG_DB}-$(date +%Y%m%d-%H%M%S)-before-${IMG_TAG}.dump"
  echo "--> Backing up database to ${BACKUP}"
  "${COMPOSE[@]}" exec -T db pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$BACKUP"
  echo "    $(du -h "$BACKUP" | cut -f1) written"
fi

# 3. Start: db/redis → migrate (one-shot) → server ×N + worker → client → edge.
echo "--> Starting services"
"${COMPOSE[@]}" up -d --no-build --remove-orphans

# 4. Seed a fresh database (explicit flag only; seeding wipes all data).
if [ "$SEED" = 1 ]; then
  users="$("${COMPOSE[@]}" exec -T db psql -U "$PG_USER" -d "$PG_DB" -tAc 'SELECT count(*) FROM "User"' 2>/dev/null | tr -d '[:space:]' || echo 0)"
  if [ "${users:-0}" != "0" ] && [ "${FORCE_SEED:-0}" != 1 ]; then
    echo "Error: database already has ${users} users — refusing to seed (it wipes everything)."
    echo "Only for a deliberate reset: FORCE_SEED=1 ./deploy.sh --seed"
    exit 1
  fi
  echo "--> Seeding fresh database"
  "${COMPOSE[@]}" --profile seed run --rm --no-deps seed
fi

# 5. Health check through the public entrypoint.
echo "--> Waiting for ${BASE}/api/health/ready"
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}${BASE}/api/health/ready" >/dev/null 2>&1; then
    echo
    "${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}'
    echo
    echo "=========================================="
    echo " ProjectVerse ${IMG_TAG} is live on port ${PORT} at ${BASE}/"
    echo " Rollback: ./deploy.sh --tag <previous tag>  (restore a backups/*.dump if the DB changed)"
    echo "=========================================="
    exit 0
  fi
  sleep 2
done

echo "Error: not healthy after 120s. Recent logs:"
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail 40 migrate server edge
exit 1
