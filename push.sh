#!/usr/bin/env bash
# Usage: bash push.sh [version]   (default: contents of VERSION, tag is v<version>)
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RAW_VERSION="${1:-$(tr -d '\r\n' < VERSION 2>/dev/null || true)}"
if [ -z "$RAW_VERSION" ]; then
    echo "Error: Version is required. Pass it as an argument or add a value to VERSION." >&2
    exit 1
fi
VERSION="v${RAW_VERSION#v}"
DOCKERHUB_USER="${DOCKERHUB_USER:-pcdpbit}"
PUSH_RETRIES="${PUSH_RETRIES:-5}"

# Docker Hub uploads occasionally time out; retry (already-pushed layers are skipped).
push_with_retry() {
    local image="$1" n=1
    until docker push "$image"; do
        if [ "$n" -ge "$PUSH_RETRIES" ]; then
            echo "Error: push of $image failed after $n attempts." >&2
            return 1
        fi
        echo "Push of $image failed (attempt $n/$PUSH_RETRIES); retrying in $((n * 10))s..." >&2
        sleep $((n * 10))
        n=$((n + 1))
    done
}

build_and_push() {
    local name="$1" dockerfile="$2"; shift 2
    docker build "$@" -t "projectverse-$name:$VERSION" -f "$dockerfile" .
    docker tag "projectverse-$name:$VERSION" "$DOCKERHUB_USER/projectverse-$name:$VERSION"
    push_with_retry "$DOCKERHUB_USER/projectverse-$name:$VERSION"
}

echo "Releasing $DOCKERHUB_USER/projectverse-{client,server,edge}:$VERSION"

build_and_push client ./docker/Dockerfile.client \
    --build-arg VITE_GOOGLE_CLIENT_ID="559631489145-0se6ttjttb0qd3098d7ppha28gitqasu.apps.googleusercontent.com" \
    --build-arg VITE_API_URL="https://pcdp.bitsathy.ac.in/verse/api" \
    --build-arg VITE_BACKEND_URL="https://pcdp.bitsathy.ac.in/verse"
build_and_push server ./docker/Dockerfile.server
build_and_push edge ./docker/Dockerfile.edge

echo "Done: all images pushed as $VERSION"
