#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
node scripts/launch.mjs runtime
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
if [ ! -e mcp/.env ]; then (umask 077; cp mcp/.env.example mcp/.env); fi
printf '%s\n' 'Dependencies installed. Fill mcp/.env locally, then run scripts/check-mcp.sh.'
