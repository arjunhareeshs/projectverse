#!/usr/bin/env bash
set -euo pipefail

# ProjectVerse Image Release & Tagging Script
# Builds multi-arch linux/amd64 Docker images, tags with SemVer + immutable git SHA + latest, and pushes to Docker Hub.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

DOCKER_USER="${1:-${DOCKERHUB_USER:-${USER:-}}}"

if [ -z "${DOCKER_USER}" ]; then
  echo "Error: Docker username not specified."
  echo "Usage: ./scripts/release.sh <dockerhub_username>"
  echo "Or set DOCKERHUB_USER environment variable."
  exit 1
fi

if [ ! -f "VERSION" ]; then
  echo "Error: VERSION file not found at ${ROOT_DIR}/VERSION"
  exit 1
fi

VERSION="$(tr -d ' \r\n' < VERSION)"

# Refuse to build dirty trees to guarantee immutable SHA traceability
if [ -n "$(git status --porcelain)" ] && [ "${ALLOW_DIRTY:-0}" != "1" ]; then
  echo "Error: Working directory has uncommitted changes."
  echo "Commit your changes before releasing, or run with ALLOW_DIRTY=1 to bypass."
  git status -s
  exit 1
fi

GIT_SHA="$(git rev-parse --short=12 HEAD)"

echo "=========================================="
echo "ProjectVerse Release Pipeline"
echo "Registry User : ${DOCKER_USER}"
echo "Version       : ${VERSION}"
echo "Git SHA Tag   : sha-${GIT_SHA}"
echo "Target Arch   : linux/amd64"
echo "=========================================="

# Build & push Server image
echo ""
echo "--> Building & pushing projectverse-server..."
docker buildx build --platform linux/amd64 \
  -f docker/Dockerfile.server \
  -t "${DOCKER_USER}/projectverse-server:${VERSION}" \
  -t "${DOCKER_USER}/projectverse-server:sha-${GIT_SHA}" \
  -t "${DOCKER_USER}/projectverse-server:latest" \
  --push .

# Build & push Client image
echo ""
echo "--> Building & pushing projectverse-client..."
docker buildx build --platform linux/amd64 \
  -f docker/Dockerfile.client \
  ${VITE_GOOGLE_CLIENT_ID:+--build-arg VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID}"} \
  -t "${DOCKER_USER}/projectverse-client:${VERSION}" \
  -t "${DOCKER_USER}/projectverse-client:sha-${GIT_SHA}" \
  -t "${DOCKER_USER}/projectverse-client:latest" \
  --push .

echo ""
echo "=========================================="
echo "To deploy this release with Docker Compose:"
echo "1. Set image versions in docker/.env or docker-compose.yml:"
echo "   Server: ${DOCKER_USER}/projectverse-server:sha-${GIT_SHA}"
echo "   Client: ${DOCKER_USER}/projectverse-client:sha-${GIT_SHA}"
echo ""
echo "2. Run Docker Compose:"
echo "   docker compose -f docker/docker-compose.yml up -d"
echo "=========================================="

