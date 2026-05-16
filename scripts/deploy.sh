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

# Verify build produced artifacts before restarting PM2
if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: .next/BUILD_ID not found — build failed or incomplete. Aborting restart."
  exit 1
fi
echo "  ✓ Build verified ($(cat .next/BUILD_ID))"
EOF

# ── Step 3: Restart PM2 ───────────────────────────────────────────
# Always use ecosystem.config.js — if portal was started ad-hoc (pm2 show glomalin-portal
# shows exec interpreter = /usr/bin/npm), delete and re-register to pick up crash-loop guards.
echo ""
echo "[3/3] Restarting apps..."
ssh $VPS 'bash -s' << 'EOF'
set -euo pipefail
cd /srv/farm-ops

# Re-register glomalin-portal from ecosystem config if it was started ad-hoc
INTERP=$(pm2 show glomalin-portal 2>/dev/null | grep "exec interpreter" | awk '{print $NF}' || echo "")
if [ "$INTERP" = "/usr/bin/npm" ] || [ "$INTERP" = "/usr/bin/node" ]; then
  echo "  Re-registering glomalin-portal from ecosystem.config.js (was started ad-hoc)..."
  pm2 delete glomalin-portal 2>/dev/null || true
  pm2 start ecosystem.config.js --only glomalin-portal
else
  pm2 restart ecosystem.config.js
fi

pm2 save
echo ""
pm2 status
EOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DEPLOY COMPLETE"
echo "  https://portal.whughesfarms.com"
echo "═══════════════════════════════════════════════════"
