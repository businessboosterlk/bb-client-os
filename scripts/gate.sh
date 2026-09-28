#!/usr/bin/env bash
# THE HUB GATE. Every check the Hub has, in the order of what is cheapest to fail, each with its
# count. Nothing is published unless every line here is green.
#   bash scripts/gate.sh            build, then every check
#   bash scripts/gate.sh --quick    skip the four long browser runs (walk, click path, data, wall)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"; export PATH="$HOME/.local/node/bin:$PATH"
QUICK="${1:-}"; FAIL=0; N=0
run(){ local name="$1"; shift; N=$((N+1)); local out; out="$("$@" 2>&1)"; local code=$?
  local line; line="$(printf '%s\n' "$out" | grep -E 'RESULT|passed\.|^PASS|^FAIL|EVERY SCREEN|CLICK PATH:|TENANT WALL|stack standard|ALL GREEN|stamped' | tail -1)"
  if [ $code -eq 0 ]; then printf 'PASS  %-28s %s\n' "$name" "${line:0:150}"; else FAIL=$((FAIL+1)); printf 'FAIL  %-28s %s\n' "$name" "${line:0:150}"; printf '%s\n' "$out" | grep -E '^ *FAIL|NOT FOUND|rror' | head -12 | sed 's/^/        /'; fi; }
nonative(){ local hits; hits="$(grep -rnE '(^|[^.a-zA-Z])(confirm|prompt|alert)\(' apps/web/src/app --include='*.ts' | grep -v 'ask.service.ts' || true)"; [ -z "$hits" ] && echo "PASS  the app asks its own questions: no browser confirm, prompt or alert in the source" || { echo "FAIL  browser boxes in the source:"; echo "$hits"; return 1; }; }
insets(){ local t b; t=$(grep -rhoE 'var\(--sat\)' apps/web/src | wc -l | tr -d ' '); b=$(grep -rhoE 'var\(--sab\)' apps/web/src | wc -l | tr -d ' '); [ "$t" -ge 8 ] && [ "$b" -ge 8 ] && echo "PASS  the insets are USED, not only declared: --sat $t times, --sab $b times" || { echo "FAIL  the insets are declared and barely used: --sat $t, --sab $b"; return 1; }; }
style(){ local out code n; n=$(wc -l < evidence/gallery/words.txt | tr -d ' '); [ "$n" -ge 100 ] || { echo "FAIL  only $n lines of words were read: the walk did not write them"; return 1; }
  out="$(python3 "$HOME/bb-consultancy/house_style.py" evidence/gallery/words.txt)"; code=$?; echo "$out" | grep -F '[FAIL]'; echo "$([ $code -eq 0 ] && echo PASS || echo FAIL)  $n lines a person can read, $(echo "$out" | grep -cF '[OK') of $(echo "$out" | grep -cE '^\[') house style rules hold"; return $code; }
firsttry(){ local out code; out="$(node "$HOME/bb-systems/qa/first-try.mjs" "$@")"; code=$?; echo "$out" | grep -E 'FAIL F'; echo "$([ $code -eq 0 ] && echo PASS || echo FAIL)  $(echo "$out" | grep -cE '  PASS') of $# files pass the first try rules, $(echo "$out" | grep -cE 'WARN') to read"; return $code; }
paged(){ local hits; hits="$(grep -rnE "\.from\('[a-z_]+'\)" apps/api/lib apps/api/app | grep -vE 'maybeSingle|\.single\(\)|\.range\(|\.limit\(|insert|update|delete' || true)"; local bad=""; while IFS= read -r l; do [ -z "$l" ] && continue; f="${l%%:*}"; n="$(echo "$l" | cut -d: -f2)"; sed -n "${n},$((n+3))p" "$f" | grep -qE 'range\(|limit\(|maybeSingle|single\(\)|insert|update\(|delete\(' || bad="$bad$l"$'\n'; done <<< "$hits"; [ -z "$bad" ] && echo "PASS  every list read in the API names a range or a limit" || { echo "FAIL  list reads with no range:"; echo "$bad"; return 1; }; }

echo "THE HUB GATE  $(date '+%Y-%m-%d %H:%M')"
run "build stamp"            node scripts/stamp.mjs --check
run "icons from the sets"    node scripts/build-icons.mjs --check
run "icons on centre"        node scripts/icon-centre.mjs --check
run "no svg typed by hand"   node "$HOME/bb-systems/qa/hand-svg.mjs" apps/web/src --allow app/ui/icon.component.ts=1
run "stack standard"         python3 "$HOME/bb-systems/stack-standard/check_stack.py" .
run "casts"                  node scripts/check-casts.mjs
run "first try: the page"    firsttry apps/web/src/index.html
run "first try: the API"     firsttry apps/api/lib/store.js apps/api/lib/library.js apps/api/lib/clients.js
run "API reads are paged"    paged
run "no browser boxes"       nonative
run "insets used"            insets
run "build"                  bash -c 'cd apps/web && npx ng build --configuration production 2>&1 | grep -E "rror|✘" && exit 1; echo "PASS  the app builds"'
run "self test"              node scripts/selftest-run.mjs
run "pixel precision"        node scripts/ui-precision.mjs
run "accessibility"          node scripts/a11y.mjs
if [ "$QUICK" != "--quick" ]; then
  run "every screen measured"  node scripts/ui-walk.mjs
  run "house style, the words" style
  run "click path"             node scripts/click-path.mjs
  run "data laws"              node scripts/data-run.mjs
  run "tenant wall"            node scripts/tenant-wall.mjs
fi
echo; [ $FAIL -eq 0 ] && echo "GATE: ALL $N GREEN" || echo "GATE: $FAIL of $N RED"
exit $FAIL
