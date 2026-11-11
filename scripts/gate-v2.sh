#!/bin/bash
# THE GATE, version 2 (10 Nov 2026). The frozen gate.sh, untouched, plus the foundation lines:
# security, speed, stack standard and recipe from ~/bb-systems/qa/foundation-gate.sh.
#
#   bash scripts/gate-v2.sh [--quick] [--url http://localhost:4200] [--policies export.json] [--ship]
#   bash scripts/gate-v2.sh --foundation-only [...]     the new lines alone, without the 23 old checks
#
# gate.sh is never edited: this file calls it. Exit is non-zero when either half is red.
cd "$(dirname "$0")/.."
OLD=(); NEW=(); ONLY=0
while [ $# -gt 0 ]; do case "$1" in
  --quick) OLD+=("$1"); shift;;
  --foundation-only) ONLY=1; shift;;
  --url|--policies|--kind|--rate-path|--upload-path) NEW+=("$1" "$2"); shift 2;;
  *) NEW+=("$1"); shift;;
esac; done
A=0
if [ $ONLY -eq 0 ]; then bash scripts/gate.sh "${OLD[@]}"; A=$?; echo; fi
bash "$HOME/bb-systems/qa/foundation-gate.sh" . --kind system "${NEW[@]}"; B=$?
echo; [ $((A+B)) -eq 0 ] && echo "GATE V2: GREEN" || echo "GATE V2: RED (old gate $A, foundation $B)"
exit $((A+B))
