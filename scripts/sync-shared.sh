#!/usr/bin/env bash
#
# sync-shared.sh — push the canonical platform assets into every app
#
#   ./scripts/sync-shared.sh           copy shared/platform/* into each app
#   ./scripts/sync-shared.sh --check   verify they match; exit 1 if not
#
# Why this exists: platform-tokens.css, settings-panel.js and
# formatting-agent.js are loaded by <link>/<script> from each app's own
# public/ directory, so every app needs its own copy on disk. They were
# copied by hand, and by 2026-09 had split into three different versions
# of platform-tokens.css and three of settings-panel.js — the font and
# weight pickers and a text-contrast fix existed only in farm-budget,
# and the harvest theme could only be selected in grain-tickets.
#
# shared/platform/ is now the only place to edit them. Run --check in CI
# or before a deploy; run the plain form after editing a canonical file.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/shared/platform"

# Every app that loads the shared assets from its own public/ directory.
APPS=(
  farm-budget
  fsa-acres
  meristem-malt
  farm-registry
  seed-inventory
  grain-tickets
  glomalin-portal
)

FILES=(
  platform-tokens.css
  settings-panel.js
  formatting-agent.js
  theme-boot.js
)

CHECK=0
[[ "${1:-}" == "--check" ]] && CHECK=1

fail=0
copied=0

for app in "${APPS[@]}"; do
  dest="$ROOT/$app/public"
  if [[ ! -d "$dest" ]]; then
    echo "  ?  $app/public does not exist — skipped"
    continue
  fi
  for f in "${FILES[@]}"; do
    if [[ $CHECK -eq 1 ]]; then
      if ! cmp -s "$SRC/$f" "$dest/$f"; then
        echo "  ✗  $app/public/$f differs from shared/platform/$f"
        fail=1
      fi
    else
      if ! cmp -s "$SRC/$f" "$dest/$f" 2>/dev/null; then
        cp "$SRC/$f" "$dest/$f"
        echo "  →  $app/public/$f"
        copied=$((copied + 1))
      fi
    fi
  done
done

# The boot script and the panel each carry their own copy of the default,
# because neither can import from the other. Catch them drifting apart.
boot_default=$(grep -o "DEFAULT_THEME = '[a-z]*'" "$SRC/theme-boot.js" | head -1)
panel_default=$(grep -o "DEFAULT_THEME = '[a-z]*'" "$SRC/settings-panel.js" | head -1)
if [[ "$boot_default" != "$panel_default" ]]; then
  echo "  ✗  theme-boot.js has $boot_default but settings-panel.js has $panel_default"
  echo "     They must match or the page paints one theme and swaps to the other."
  fail=1
fi

if [[ $CHECK -eq 1 ]]; then
  if [[ $fail -eq 0 ]]; then
    echo "shared assets in sync across ${#APPS[@]} apps"
  else
    echo
    echo "Run ./scripts/sync-shared.sh to bring the copies back in line."
    exit 1
  fi
else
  [[ $fail -eq 1 ]] && exit 1
  if [[ $copied -eq 0 ]]; then
    echo "already in sync — nothing copied"
  else
    echo "synced $copied file(s); commit shared/platform/ together with the copies"
  fi
fi
