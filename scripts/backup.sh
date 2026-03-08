#!/usr/bin/env bash
# ============================================================================
# Farm Operations Platform — Daily Backup Script
# ============================================================================
# Backs up all JSON data files (5 apps), local PostgreSQL databases (2),
# and Supabase PostgreSQL database (1) to timestamped directories.
#
# Install as daily cron:
#   crontab -e
#   0 2 * * * /srv/farm-ops/scripts/backup.sh
#
# Backups stored at: /var/backups/farm-ops/YYYY-MM-DD/
# Retention: 7 days (configurable via RETENTION_DAYS)
# ============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_ROOT="/var/backups/farm-ops"
APP_ROOT="/srv/farm-ops"
RETENTION_DAYS=7
LOG_FILE="/var/log/farm-ops-backup.log"
TIMESTAMP=$(date +%Y-%m-%d)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

ERROR_COUNT=0

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

log_error() {
    log "ERROR: $1"
    ERROR_COUNT=$((ERROR_COUNT + 1))
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
log "=========================================="
log "BACKUP STARTED"
log "=========================================="
log "Backup directory: $BACKUP_DIR"

# ---------------------------------------------------------------------------
# Create backup directory structure
# ---------------------------------------------------------------------------
if ! mkdir -p "$BACKUP_DIR"/{json,postgres}; then
    log_error "Failed to create backup directory structure"
    exit 1
fi
log "Created backup directory: $BACKUP_DIR"

# ---------------------------------------------------------------------------
# JSON data file backups (5 apps)
# ---------------------------------------------------------------------------
log "--- JSON Data Files ---"

declare -A JSON_APPS=(
    ["farm-budget"]="farm-budget/data/data.json"
    ["farm-registry"]="farm-registry/data/data.json"
    ["fsa-acres"]="fsa-acres/data/data.json"
    ["meristem-malt"]="meristem-malt/data/data.json"
    ["seed-inventory"]="seed-inventory/data/data.json"
)

for app in "${!JSON_APPS[@]}"; do
    src="$APP_ROOT/${JSON_APPS[$app]}"
    dst="$BACKUP_DIR/json/${app}.json"
    if [ -f "$src" ]; then
        if cp "$src" "$dst"; then
            log "OK: $app data backed up ($(du -h "$dst" | cut -f1))"
        else
            log_error "Failed to copy $src -> $dst"
        fi
    else
        log_error "Source file not found: $src"
    fi
done

# ---------------------------------------------------------------------------
# PostgreSQL database backups (2 local databases)
# ---------------------------------------------------------------------------
log "--- PostgreSQL Databases (local) ---"

# Helper: extract DATABASE_URL from a .env file and run pg_dump
backup_postgres() {
    local app_name="$1"
    local env_file="$2"
    local dump_file="$BACKUP_DIR/postgres/${app_name}.dump"

    if [ ! -f "$env_file" ]; then
        log_error "$app_name: .env file not found at $env_file"
        return 1
    fi

    local db_url
    db_url=$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d'=' -f2-)
    # Remove surrounding quotes if present
    db_url=$(echo "$db_url" | sed 's/^["'"'"']//;s/["'"'"']$//')

    if [ -z "$db_url" ]; then
        log_error "$app_name: DATABASE_URL not found in $env_file"
        return 1
    fi

    if pg_dump --format=custom "$db_url" -f "$dump_file" 2>>"$LOG_FILE"; then
        log "OK: $app_name database backed up ($(du -h "$dump_file" | cut -f1))"
    else
        log_error "$app_name: pg_dump failed"
        return 1
    fi
}

# Grain Tickets (local PostgreSQL)
if backup_postgres "grain-tickets" "$APP_ROOT/grain-tickets/.env"; then
    :
fi

# Organic Cert (local PostgreSQL)
if backup_postgres "organic-cert" "$APP_ROOT/organic-cert/.env"; then
    :
fi

# ---------------------------------------------------------------------------
# Supabase PostgreSQL backup (1 remote database)
# ---------------------------------------------------------------------------
log "--- Supabase Database (CRITICAL — only backup of portal data) ---"

PORTAL_ENV="$APP_ROOT/glomalin-portal/.env"
if [ -f "$PORTAL_ENV" ]; then
    SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' "$PORTAL_ENV" | head -1 | cut -d'=' -f2-)
    SUPABASE_DB_URL=$(echo "$SUPABASE_DB_URL" | sed 's/^["'"'"']//;s/["'"'"']$//')

    if [ -z "$SUPABASE_DB_URL" ]; then
        log_error "glomalin-portal: SUPABASE_DB_URL not found in $PORTAL_ENV"
    else
        SUPABASE_DUMP="$BACKUP_DIR/postgres/glomalin-portal.dump"
        if pg_dump --format=custom "$SUPABASE_DB_URL" -f "$SUPABASE_DUMP" 2>>"$LOG_FILE"; then
            log "OK: glomalin-portal (Supabase) backed up ($(du -h "$SUPABASE_DUMP" | cut -f1))"
            log "    *** This is the ONLY copy of portal data — Supabase free tier has NO built-in backups ***"
        else
            log_error "glomalin-portal: pg_dump of Supabase database FAILED — portal data is NOT backed up"
        fi
    fi
else
    log_error "glomalin-portal: .env file not found at $PORTAL_ENV"
fi

# ---------------------------------------------------------------------------
# Retention cleanup — delete backups older than RETENTION_DAYS
# ---------------------------------------------------------------------------
log "--- Retention Cleanup (>${RETENTION_DAYS} days) ---"

CLEANED=0
while IFS= read -r old_dir; do
    if [ -n "$old_dir" ]; then
        log "Removing old backup: $old_dir"
        rm -rf "$old_dir"
        CLEANED=$((CLEANED + 1))
    fi
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -not -path "$BACKUP_ROOT")

if [ "$CLEANED" -eq 0 ]; then
    log "No old backups to clean up"
else
    log "Cleaned up $CLEANED old backup(s)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "=========================================="
if [ "$ERROR_COUNT" -eq 0 ]; then
    log "BACKUP COMPLETE — SUCCESS"
elif [ "$ERROR_COUNT" -lt 8 ]; then
    log "BACKUP COMPLETE — PARTIAL ($ERROR_COUNT error(s))"
else
    log "BACKUP COMPLETE — FAILED ($ERROR_COUNT error(s))"
fi
log "Total backup size: ${BACKUP_SIZE:-unknown}"
log "Backup location: $BACKUP_DIR"
log "=========================================="

exit "$ERROR_COUNT"
