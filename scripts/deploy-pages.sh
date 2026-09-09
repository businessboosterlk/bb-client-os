#!/usr/bin/env bash
# Builds the Angular app for GitHub Pages and publishes it to the gh-pages branch.
# Never rewrites history: the branch is updated from a fresh shallow clone each time.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node scripts/check-casts.mjs
python3 ~/bb-systems/stack-standard/check_stack.py "$ROOT"
node scripts/sync-casts.mjs
(cd apps/web && npx ng build --configuration production --base-href /bb-client-os/)
D="$(mktemp -d)"
git clone -q --branch gh-pages --depth 1 git@github.com:businessboosterlk/bb-client-os.git "$D"
find "$D" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -r {} +
cp -R apps/web/dist/web/browser/. "$D/"
cp "$D/index.html" "$D/404.html"
touch "$D/.nojekyll"
cd "$D" && git add -A && git commit -q -m "BB Client OS build $(date +%Y-%m-%d\ %H:%M)" && git push -q origin gh-pages
echo "published: https://businessboosterlk.github.io/bb-client-os/?c=demo"
