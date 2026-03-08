#!/usr/bin/env bash
# ============================================================================
# Farm Operations Platform — Restore Script
# ============================================================================
# Restores JSON data files and/or PostgreSQL databases from a daily backup.
#
# Usage:
#   restore.sh                          # List available backups
#   restore.sh YYYY-MM-DD              # Restore everything from that date
#   restore.sh YYYY-MM-DD --component json      # Restore JSON files only
#   restore.sh YYYY-MM-DD --component postgres   # Restore databases only
#   restore.sh YYYY-MM-DD --component all        # Restore everything (default)
# ============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_ROOT="/var/backups/farm-ops"
APP_ROOT="/srv/farm-ops"
LOG_FILE="/var/log/farm-ops-backup.log"

ERROR_COUNT=0

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] RESTORE: $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

log_error() {
    log "ERROR: $1"
    ERROR_COUNT=$((ERROR_COUNT + 1))
}

# ---------------------------------------------------------------------------
# Usage / list backups
# ---------------------------------------------------------------------------
usage() {
    echo "Farm Operations Platform — Restore Script"
    echo ""
    echo "Usage:"
    echo "  $0                                    List available backups"
    echo "  $0 YYYY-MM-DD                        Restore all data from backup date"
    echo "  $0 YYYY-MM-DD --component json       Restore JSON files only"
    echo "  $0 YYYY-MM-DD --component postgres   Restore PostgreSQL databases only"
    echo "  $0 YYYY-MM-DD --component all        Restore everything (default)"
    echo ""

    if [ -d "$BACKUP_ROOT" ]; then
        echo "Available backups:"
        local found=0
        for dir in "$BACKUP_ROOT"/*/; do
            if [ -d "$dir" ]; then
                local date_name
                date_name=$(basename "$dir")
                local size
                size=$(du -sh "$dir" 2>/dev/null | cut -f1)
                echo "  $date_name  ($size)"
                found=1
            fi
        done
        if [ "$found" -eq 0 ]; then
            echo "  (none)"
        fi
    else
        echo "Backup directory not found: $BACKUP_ROOT"
    fi
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
if [ $# -eq 0 ]; then
    usage
    exit 0
fi

BACKUP_DATE="$1"
COMPONENT="all"

if [ $# -ge 3 ] && [ "$2" = "--component" ]; then
    COMPONENT="$3"
fi

BACKUP_DIR="$BACKUP_ROOT/$BACKUP_DATE"

# Validate backup exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: No backup found for date: $BACKUP_DATE"
    echo "       Expected directory: $BACKUP_DIR"
    echo ""
    usage
    exit 1
fi

# Validate component
if [[ "$COMPONENT" != "json" && "$COMPONENT" != "postgres" && "$COMPONENT" != "all" ]]; then
    echo "ERROR: Invalid component '$COMPONENT'. Must be: json, postgres, or all"
    exit 1
fi

# ---------------------------------------------------------------------------
# Confirmation prompt
# ---------------------------------------------------------------------------
echo "=========================================="
echo "RESTORE FROM: $BACKUP_DATE"
echo "COMPONENT:    $COMPONENT"
echo "BACKUP DIR:   $BACKUP_DIR"
echo "=========================================="
echo ""
echo "WARNING: This will overwrite current production data."

if [ "$COMPONENT" = "postgres" ] || [ "$COMPONENT" = "all" ]; then
    echo "WARNING: PostgreSQL databases will be dropped and recreated."
    if [ -f "$BACKUP_DIR/postgres/glomalin-portal.dump" ]; then
        echo "WARNING: Supabase production database will be overwritten."
    fi
fi

echo ""
read -rp "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Restore cancelled."
    exit 0
fi

log "=========================================="
log "RESTORE STARTED from $BACKUP_DATE (component: $COMPONENT)"
log "=========================================="

# ---------------------------------------------------------------------------
# JSON restore
# ---------------------------------------------------------------------------
if [ "$COMPONENT" = "json" ] || [ "$COMPONENT" = "all" ]; then
    log "--- Restoring JSON Data Files ---"

    declare -A JSON_APPS=(
        ["farm-budget"]="farm-budget/data/data.json"
        ["farm-registry"]="farm-registry/data/data.json"
        ["fsa-acres"]="fsa-acres/data/data.json"
        ["meristem-malt"]="meristem-malt/data/data.json"
        ["seed-inventory"]="seed-inventory/data/data.json"
    )

    for app in "${!JSON_APPS[@]}"; do
        src="$BACKUP_DIR/json/${app}.json"
        dst="$APP_ROOT/${JSON_APPS[$app]}"
        if [ -f "$src" ]; then
            # Ensure target directory exists
            mkdir -p "$(dirname "$dst")"
            if cp "$src" "$dst"; then
                log "OK: Restored $app data"
            else
                log_error "Failed to restore $app data"
            fi
        else
            log "SKIP: No backup file for $app ($src not found)"
        fi
    done
fi

# ---------------------------------------------------------------------------
# PostgreSQL restore (local databases)
# ---------------------------------------------------------------------------
restore_postgres() {
    local app_name="$1"
    local env_file="$2"
    local dump_file="$BACKUP_DIR/postgres/${app_name}.dump"

    if [ ! -f "$dump_file" ]; then
        log "SKIP: No backup dump for $app_name ($dump_file not found)"
        return 0
    fi

    if [ ! -f "$env_file" ]; then
        log_error "$app_name: .env file not found at $env_file"
        return 1
    fi

    local db_url
    db_url=$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d'=' -f2-)
    db_url=$(echo "$db_url" | sed 's/^["'"'"']//;s/["'"'"']$//')

    if [ -z "$db_url" ]; then
        log_error "$app_name: DATABASE_URL not found in $env_file"
        return 1
    fi

    if pg_restore --clean --if-exists -d "$db_url" "$dump_file" 2>>"$LOG_FILE"; then
        log "OK: Restored $app_name database"
    else
        # pg_restore returns non-zero for warnings too; check if it's serious
        log "WARN: $app_name pg_restore completed with warnings (check $LOG_FILE)"
    fi
}

if [ "$COMPONENT" = "postgres" ] || [ "$COMPONENT" = "all" ]; then
    log "--- Restoring PostgreSQL Databases (local) ---"

    restore_postgres "grain-tickets" "$APP_ROOT/grain-tickets/.env"
    restore_postgres "organic-cert" "$APP_ROOT/organic-cert/.env"

    # ---------------------------------------------------------------------------
    # Supabase restore
    # ---------------------------------------------------------------------------
    log "--- Restoring Supabase Database ---"

    SUPABASE_DUMP="$BACKUP_DIR/postgres/glomalin-portal.dump"
    if [ -f "$SUPABASE_DUMP" ]; then
        PORTAL_ENV="$APP_ROOT/glomalin-portal/.env"
        if [ -f "$PORTAL_ENV" ]; then
            SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' "$PORTAL_ENV" | head -1 | cut -d'=' -f2-)
            SUPABASE_DB_URL=$(echo "$SUPABASE_DB_URL" | sed 's/^["'"'"']//;s/["'"'"']$//')

            if [ -z "$SUPABASE_DB_URL" ]; then
                log_error "glomalin-portal: SUPABASE_DB_URL not found in $PORTAL_ENV"
            else
                log "*** WARNING: Restoring to PRODUCTION Supabase database ***"
                if pg_restore --clean --if-exists -d "$SUPABASE_DB_URL" "$SUPABASE_DUMP" 2>>"$LOG_FILE"; then
                    log "OK: Restored glomalin-portal (Supabase) database"
                else
                    log "WARN: glomalin-portal pg_restore completed with warnings (check $LOG_FILE)"
                fi
            fi
        else
            log_error "glomalin-portal: .env file not found at $PORTAL_ENV"
        fi
    else
        log "SKIP: No Supabase backup dump found"
    fi
fi

# ---------------------------------------------------------------------------
# Post-restore
# ---------------------------------------------------------------------------
log "=========================================="
if [ "$ERROR_COUNT" -eq 0 ]; then
    log "RESTORE COMPLETE — SUCCESS"
else
    log "RESTORE COMPLETE — $ERROR_COUNT error(s)"
fi
log "=========================================="

echo ""
echo "Post-restore steps:"
echo "  1. Restart all apps:  pm2 restart all"
echo "  2. Verify apps:       pm2 status"
echo "  3. Check logs:        pm2 logs"
echo ""

exit "$ERROR_COUNT"
