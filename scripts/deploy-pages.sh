#!/usr/bin/env bash
# PUBLISH THE DEMO, GATED. Stamps the build, runs every check the Hub has, publishes the files that
# were tested to the gh-pages branch and then reads the live files back and compares their hashes.
# Never rewrites history: the branch is updated from a fresh shallow clone each time.
#   bash scripts/deploy-pages.sh           stamp, full gate, publish, verify
#   bash scripts/deploy-pages.sh --tested  publish the build the gate has just passed (no new stamp)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; export PATH="$HOME/.local/node/bin:$PATH"
if [ "${1:-}" != "--tested" ]; then
  node scripts/sync-casts.mjs
  node scripts/stamp.mjs
  bash scripts/gate.sh || { echo "NOT PUBLISHED: the gate is red"; exit 1; }
fi
node scripts/stamp.mjs --check
grep -q "\"build\":\"$(sed -n "s/.*BUILD = '\(.*\)'.*/\1/p" apps/web/src/app/core/build.ts)\"" apps/web/dist/web/browser/version.json || { echo "NOT PUBLISHED: the build on disk does not carry the current stamp"; exit 1; }
D="$(mktemp -d)"
git clone -q --branch gh-pages --depth 1 git@github.com:businessboosterlk/bb-client-os.git "$D"
find "$D" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -r {} +
cp -R apps/web/dist/web/browser/. "$D/"
cp "$D/index.html" "$D/404.html"
touch "$D/.nojekyll"
( cd "$D" && git add -A && git commit -q -m "The Hub build $(cat "$ROOT/apps/web/public/version.json")" && git push -q origin gh-pages )
echo "pushed. Reading the live files back:"
node scripts/verify-live.mjs
echo "published: https://businessboosterlk.github.io/bb-client-os/"
