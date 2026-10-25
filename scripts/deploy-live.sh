#!/usr/bin/env bash
# THE HUB, LIVE (Stage 2, 25 Oct 2026). Two Vercel projects on Thulaib's Pro account:
#   the-hub-api   the server (apps/api, Next 15), function region hnd1, beside the database in ap-northeast-1
#   the-hub       the app clients install (the Angular build with config.json naming the server)
# The sales demo (the-hub-demo, scripts/deploy-pages.sh) is NOT touched by this.
# THE SERVER IS NEVER PUT ONLINE WITHOUT ITS SECRETS: without them it would start in memory mode on a public address.
# This script reads the NAMES of the production variables (never their values) and stops when one is missing.
#   bash scripts/deploy-live.sh api      the server only
#   bash scripts/deploy-live.sh app      the app only (needs the server's address in HUB_API_URL)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; export PATH="$HOME/.local/node/bin:$PATH"
V="npx --yes vercel@63.1.0"; WHAT="${1:-}"
API_DIR="$HOME/bb-systems/the-hub-api"; APP_DIR="$HOME/bb-systems/the-hub"
NEED="SUPABASE_SERVICE_ROLE_KEY HUB_SECRET BB_ADMIN_SECRET DATA_MODE SUPABASE_URL SUPABASE_ANON_KEY"
# HUB_ORIGINS is set after the app's first deploy gives its address; then the server is deployed once more
if [ "$WHAT" = "api" ]; then
  mkdir -p "$API_DIR"
  rsync -a --delete --exclude node_modules --exclude .next --exclude .vercel --exclude ".env*" --exclude .vercelignore "$ROOT/apps/api/" "$API_DIR/"
  printf '.env*\nnode_modules\n.next\nsql\n' > "$API_DIR/.vercelignore"   # a pulled .env.local holds a token: never uploaded
  printf '{ "regions": ["hnd1"], "headers": [ { "source": "/(.*)", "headers": [ { "key": "X-Robots-Tag", "value": "noindex" } ] } ] }\n' > "$API_DIR/vercel.json"
  cd "$API_DIR"
  [ -d .vercel ] || $V link --yes --project the-hub-api
  have="$($V env ls production 2>/dev/null | awk '{print $1}')"
  miss=""; for n in $NEED; do echo "$have" | grep -qx "$n" || miss="$miss $n"; done
  if [ -n "$miss" ]; then echo "STOP: the server is not put online. Missing in Vercel (production):$miss"; exit 1; fi
  $V deploy --prod --yes
elif [ "$WHAT" = "app" ]; then
  [ -n "${HUB_API_URL:-}" ] || { echo "STOP: say the server's address, HUB_API_URL=https://the-hub-api.vercel.app"; exit 1; }
  (cd "$ROOT/apps/web" && npx ng build --configuration production >/dev/null)
  mkdir -p "$APP_DIR"
  rsync -a --delete --exclude .vercel --exclude vercel.json "$ROOT/apps/web/dist/web/browser/" "$APP_DIR/"
  printf '{ "api": "%s", "bbWa": "94767412531" }\n' "$HUB_API_URL" > "$APP_DIR/config.json"
  printf '{ "headers": [ { "source": "/(.*)", "headers": [ { "key": "X-Robots-Tag", "value": "noindex" } ] }, { "source": "/(sw.js|version.json|index.html|config.json)", "headers": [ { "key": "Cache-Control", "value": "no-cache" } ] } ] }\n' > "$APP_DIR/vercel.json"
  cd "$APP_DIR"; [ -d .vercel ] || $V link --yes --project the-hub
  $V deploy --prod --yes
else echo "say api or app"; exit 2; fi
