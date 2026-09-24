#!/usr/bin/env bash
# Build and push the three ProjectVerse images (server, client, edge) for a release.
#
#   ./push.sh                 # version from VERSION → tags v<VERSION>, sha-<commit>, latest
#   ./push.sh 1.1.1           # override the version
#   ./push.sh --no-push       # build locally only (loads into docker, nothing is pushed)
#
# Env: DOCKERHUB_USER (default pcdpbit), VITE_GOOGLE_CLIENT_ID (else read from docker/.env),
#      PUBLIC_BASE_PATH (default /verse), ALLOW_DIRTY=1, FORCE=1 (re-push an existing version tag).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PUSH=1
VERSION=""
for arg in "$@"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) VERSION="$arg" ;;
  esac
done

VERSION="${VERSION:-$(tr -d ' \r\n' < VERSION)}"
VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Error: version '$VERSION' is not X.Y.Z"; exit 1; }
TAG="v${VERSION}"

DOCKERHUB_USER="${DOCKERHUB_USER:-pcdpbit}"
PUBLIC_BASE_PATH="${PUBLIC_BASE_PATH:-/verse}"

env_value() { # read KEY from docker/.env, then root .env (first non-empty wins)
  local f v
  for f in docker/.env .env; do
    [ -f "$f" ] || continue
    v="$({ grep -E "^$1=" "$f" || true; } | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^["'\'']//; s/["'\'']$//')"
    [ -n "$v" ] && { echo "$v"; return 0; }
  done
  return 0
}
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-$(env_value VITE_GOOGLE_CLIENT_ID)}"

if [ "$PUSH" = 1 ] && [ -n "$(git status --porcelain)" ] && [ "${ALLOW_DIRTY:-0}" != 1 ]; then
  echo "Error: uncommitted changes — a pushed image must match a commit."
  echo "Commit first, or run with ALLOW_DIRTY=1."
  git status -s | head -20
  exit 1
fi
GIT_SHA="$(git rev-parse --short=12 HEAD)"

if [ "$PUSH" = 1 ] && [ "${FORCE:-0}" != 1 ] \
   && docker manifest inspect "${DOCKERHUB_USER}/projectverse-server:${TAG}" >/dev/null 2>&1; then
  echo "Error: ${DOCKERHUB_USER}/projectverse-server:${TAG} already exists."
  echo "Bump VERSION (released tags stay immutable for rollback), or run with FORCE=1."
  exit 1
fi

[ -n "$VITE_GOOGLE_CLIENT_ID" ] || echo "Warning: VITE_GOOGLE_CLIENT_ID is empty — Google sign-in will be disabled in this build."

echo "=========================================="
echo " ProjectVerse release"
echo " Registry : ${DOCKERHUB_USER}"
echo " Version  : ${TAG}   (sha-${GIT_SHA})"
echo " Base path: ${PUBLIC_BASE_PATH}"
echo " Mode     : $([ "$PUSH" = 1 ] && echo 'build + push (linux/amd64)' || echo 'build only (local)')"
echo "=========================================="

build() { # name dockerfile [extra buildx args...]
  local name="$1" file="$2"; shift 2
  local repo="${DOCKERHUB_USER}/projectverse-${name}"
  echo; echo "--> projectverse-${name}"
  docker buildx build --platform linux/amd64 -f "$file" "$@" \
    -t "${repo}:${TAG}" -t "${repo}:sha-${GIT_SHA}" -t "${repo}:latest" \
    $([ "$PUSH" = 1 ] && echo --push || echo --load) .
}

build server docker/Dockerfile.server
build client docker/Dockerfile.client \
  --build-arg "VITE_BASE_PATH=${PUBLIC_BASE_PATH}" \
  --build-arg "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}"
build edge docker/Dockerfile.edge

echo
echo "=========================================="
if [ "$PUSH" = 1 ]; then
  echo " Pushed ${DOCKERHUB_USER}/projectverse-{server,client,edge}:${TAG}"
  echo
  echo " On the server:"
  echo "   1. set IMG_TAG=${TAG} in docker/.env"
  echo "   2. ./deploy.sh            (first deploy on a fresh DB: ./deploy.sh --seed)"
else
  echo " Built locally: ${DOCKERHUB_USER}/projectverse-{server,client,edge}:${TAG} (not pushed)"
fi
echo "=========================================="
