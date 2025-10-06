#!/bin/bash

set -e

# Database Restore Script
# Usage: ./scripts/restore-backup.sh <backup-file.dump.gz>

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.dump.gz>"
  echo ""
  echo "Example:"
  echo "  DATABASE_URL=postgres://... $0 railway-backup-2025-01-01.dump.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable not set"
  echo ""
  echo "Set it with:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:port/database'"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "========================================="
echo "Database Restore Script"
echo "========================================="
echo "Backup file: $BACKUP_FILE"
echo "Target database: ${DATABASE_URL%%@*}@***"
echo ""

# Confirm
read -p "⚠️  This will OVERWRITE the target database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

# Extract if gzipped
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "📦 Extracting backup..."
  RESTORE_FILE="${BACKUP_FILE%.gz}"
  gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
  CLEANUP_TEMP=true
fi

# Validate backup
echo "✅ Validating backup integrity..."
if ! pg_restore --list "$RESTORE_FILE" > /dev/null 2>&1; then
  echo "❌ ERROR: Backup file is corrupt or invalid"
  [ "$CLEANUP_TEMP" = true ] && rm -f "$RESTORE_FILE"
  exit 1
fi

# Show backup info
echo ""
echo "Backup contains:"
pg_restore --list "$RESTORE_FILE" | grep -E "^[0-9]+; [0-9]+ [0-9]+" | head -10
backup_lines=$(pg_restore --list "$RESTORE_FILE" | grep -E "^[0-9]+; [0-9]+ [0-9]+" | wc -l)
echo "... and $((backup_lines - 10)) more items"
echo ""

# Restore
echo "🔄 Starting restore..."
pg_restore --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  "$RESTORE_FILE"

restore_exit_code=$?

# Cleanup temp file
[ "$CLEANUP_TEMP" = true ] && rm -f "$RESTORE_FILE"

if [ $restore_exit_code -ne 0 ]; then
  echo ""
  echo "❌ Restore completed with warnings/errors (exit code: $restore_exit_code)"
  echo "This might be normal if tables didn't exist before."
  exit $restore_exit_code
fi

echo ""
echo "✅ Restore completed successfully!"
echo ""
echo "Verify with:"
echo "  psql \"\$DATABASE_URL\" -c 'SELECT COUNT(*) FROM staff;'"
echo "  psql \"\$DATABASE_URL\" -c 'SELECT COUNT(*) FROM projects;'"
