#!/usr/bin/env bash
# Kept for existing habits — the release pipeline lives in ../push.sh (server, client and edge images).
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/push.sh" "$@"
