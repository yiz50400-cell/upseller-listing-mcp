#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
node scripts/launch.mjs runtime
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
if [ ! -e mcp/.env ]; then (umask 077; cp mcp/.env.example mcp/.env); fi
npx --yes playwright install chromium >/dev/null 2>&1 || printf '%s\n' 'Optional: run npx playwright install chromium for upseller_login.'
printf '%s\n' 'Dependencies installed. Prefer: Codex call upseller_login (or scripts/login-upseller.sh). Then scripts/check-mcp.sh.'
