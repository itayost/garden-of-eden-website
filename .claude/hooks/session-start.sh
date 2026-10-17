#!/bin/bash
# Prepares a Claude Code cloud session: dependencies, and the same placeholder env CI uses
# (.github/workflows/ci.yml) so tests and next build run. No secrets: nothing here reaches a real
# Supabase project or Grow.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm ci --no-audit --no-fund

if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ ! -f .env.local ]; then
  cat >> "$CLAUDE_ENV_FILE" <<'ENV'
export NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
export SUPABASE_SERVICE_ROLE_KEY=placeholder
export GROW_API_URL=https://placeholder.meshulam.co.il
ENV
fi
