#!/usr/bin/env bash
# THE HUB, LIVE ON RAILWAY (25 Oct 2026; Thulaib: Railway, the account BB already pays for, not Vercel Pro). Project "The Hub",
# service the-hub, address https://the-hub-production-dc56.up.railway.app. ONE service: the Next server plus the Angular app in
# its public folder. Without SUPABASE_SERVICE_ROLE_KEY in Railway the server starts and refuses every sign in (the safe state).
#   bash scripts/deploy-railway.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; export PATH="$HOME/.local/node/bin:$PATH"
OUT="$HOME/bb-systems/the-hub-live"; URL="https://the-hub-production-dc56.up.railway.app"
rsync -a --delete --exclude node_modules --exclude .next --exclude ".env*" --exclude sql --exclude public "$ROOT/apps/api/" "$OUT/"
(cd "$ROOT/apps/web" && npx ng build --configuration production >/dev/null)
rm -rf "$OUT/public" && mkdir -p "$OUT/public"
rsync -a --exclude casts "$ROOT/apps/web/dist/web/browser/" "$OUT/public/"
printf '{ "api": "%s", "bbWa": "94767412531" }\n' "$URL" > "$OUT/public/config.json"
printf '.env*\nnode_modules\n.next\n' > "$OUT/.railwayignore"
cd "$OUT" && railway up --service the-hub --detach
echo "sent: $URL (health at $URL/api/health)"
