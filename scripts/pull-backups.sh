#!/usr/bin/env bash
# ============================================================================
# Farm Operations Platform — Off-Droplet Backup Pull
# ============================================================================
# Pulls the droplet's daily backups down to this machine so data survives
# even if the droplet's backups are purged or the droplet itself is lost.
#
# Deliberately does NOT use --delete: local copies persist after the
# droplet's retention cleanup removes them upstream.
#
# Runs daily via launchd (com.whughesfarms.backup-pull), which executes the
# installed copy at ~/.local/bin/pull-backups.sh (launchd can't read Desktop
# paths due to macOS TCC). After editing this file, re-install with:
#   cp scripts/pull-backups.sh ~/.local/bin/pull-backups.sh
# Run manually:
#   scripts/pull-backups.sh
#
# Born from the 2026-06-27 seed-inventory data-loss incident: 566 orders
# were unrecoverable because the only backups lived on the droplet with
# 7-day retention.
# ============================================================================

set -uo pipefail

VPS_USER="root"
VPS_IP="165.22.6.194"
REMOTE_BACKUPS="/var/backups/farm-ops/"
LOCAL_BACKUPS="$HOME/FarmOpsBackups/"
LOG_FILE="$HOME/FarmOpsBackups/pull.log"

mkdir -p "$LOCAL_BACKUPS"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] pull started" >> "$LOG_FILE"

if rsync -az --timeout=120 \
    "${VPS_USER}@${VPS_IP}:${REMOTE_BACKUPS}" "$LOCAL_BACKUPS" >> "$LOG_FILE" 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] pull OK — $(du -sh "$LOCAL_BACKUPS" | cut -f1) total" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] pull FAILED (rsync exit $?)" >> "$LOG_FILE"
  exit 1
fi
