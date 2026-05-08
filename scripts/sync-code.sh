#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# sync-code.sh — Safe code-only sync to production droplet
#
# ALWAYS use this instead of raw rsync to avoid overwriting
# production data (JSON data files, photos, .env files).
#
# Usage:
#   bash scripts/sync-code.sh              # sync all apps
#   bash scripts/sync-code.sh seed-inventory  # sync one app
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

VPS_IP="165.22.6.194"
VPS_USER="root"
REMOTE_DIR="/srv/farm-ops"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXCLUDE_FILE="$LOCAL_DIR/.rsyncignore"

if [ ! -f "$EXCLUDE_FILE" ]; then
  echo "ERROR: .rsyncignore not found at $EXCLUDE_FILE"
  echo "This file prevents production data from being overwritten."
  exit 1
fi

# Optional: sync a single app
APP_FILTER="${1:-}"

echo "═══════════════════════════════════════════════════"
echo "  Safe Code Sync → ${VPS_USER}@${VPS_IP}"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Protected from overwrite:"
echo "    - */data/data.json (production data)"
echo "    - */data/photos"
echo "    - *.env files"
echo ""

if [ -n "$APP_FILTER" ]; then
  echo "  Syncing: $APP_FILTER only"
  SRC="$LOCAL_DIR/$APP_FILTER/"
  DST="${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/$APP_FILTER/"

  if [ ! -d "$LOCAL_DIR/$APP_FILTER" ]; then
    echo "ERROR: App directory not found: $LOCAL_DIR/$APP_FILTER"
    exit 1
  fi
else
  echo "  Syncing: all apps"
  SRC="$LOCAL_DIR/"
  DST="${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/"
fi

echo ""
read -p "  Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "  Cancelled."
  exit 0
fi

echo ""
rsync -azP --delete \
  --exclude-from="$EXCLUDE_FILE" \
  "$SRC" "$DST"

echo ""
echo "  ✓ Code synced (data files untouched)"
echo ""
echo "  Next steps:"
echo "    ssh ${VPS_USER}@${VPS_IP}"
echo "    cd ${REMOTE_DIR}"
echo "    pm2 restart ecosystem.config.js"
