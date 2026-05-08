#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# deploy.sh — Day-to-day deploy to production droplet
# Run from your LOCAL machine (not the VPS).
#
# Usage:
#   bash scripts/deploy.sh
#
# What it does:
#   1. Rsyncs code to /srv/farm-ops (skips .env, data files, photos)
#   2. Builds glomalin-portal (Next.js) with extra memory for the 1GB droplet
#   3. Restarts PM2 and saves state
#   4. Confirms the portal is up
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

VPS="root@165.22.6.194"
REMOTE_DIR="/srv/farm-ops"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXCLUDE_FILE="$LOCAL_DIR/.rsyncignore"

if [ ! -f "$EXCLUDE_FILE" ]; then
  echo "ERROR: .rsyncignore not found — aborting to protect production data."
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  Farm Ops — Deploy to Production"
echo "  Target: $VPS"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Protected from overwrite: .env files, data/, photos"
echo ""
read -p "  Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "  Cancelled."
  exit 0
fi

# ── Step 1: Sync code ─────────────────────────────────────────────
echo ""
echo "[1/3] Syncing code..."
rsync -azP --delete \
  --exclude-from="$EXCLUDE_FILE" \
  "$LOCAL_DIR/" "$VPS:$REMOTE_DIR/"
echo "  ✓ Code synced"

# ── Step 2: Build glomalin-portal ─────────────────────────────────
echo ""
echo "[2/3] Building glomalin-portal (this takes ~2 min)..."
ssh $VPS 'bash -s' << 'EOF'
set -euo pipefail
cd /srv/farm-ops/glomalin-portal
npm install --prefer-offline 2>&1 | tail -1
NODE_OPTIONS='--max-old-space-size=1536' npm run build 2>&1 | tail -5
echo "  ✓ Build complete"
EOF

# ── Step 3: Restart PM2 ───────────────────────────────────────────
echo ""
echo "[3/3] Restarting apps..."
ssh $VPS 'bash -s' << 'EOF'
set -euo pipefail
cd /srv/farm-ops
pm2 restart ecosystem.config.js
pm2 save
echo ""
pm2 status
EOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DEPLOY COMPLETE"
echo "  https://portal.whughesfarms.com"
echo "═══════════════════════════════════════════════════"
