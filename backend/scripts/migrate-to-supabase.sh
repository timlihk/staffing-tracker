#!/bin/bash

# Supabase Migration Script
# This script helps migrate your database from Railway to Supabase

set -e  # Exit on error

echo "🚀 Supabase Migration Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}❌ pg_dump not found. Please install PostgreSQL client tools.${NC}"
    echo "   macOS: brew install postgresql"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"
echo ""

# Step 2: Get connection strings
echo "📝 Step 2: Enter connection strings"
echo ""
read -p "Enter Railway DATABASE_URL: " RAILWAY_URL
read -p "Enter Supabase DATABASE_URL (direct, not pooled): " SUPABASE_URL

echo ""
echo "📦 Step 3: Creating backup..."

# Create backup directory
BACKUP_DIR="./database-backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/railway_backup_${TIMESTAMP}.sql"

# Dump Railway database
echo "   Backing up Railway database to $BACKUP_FILE..."
pg_dump "$RAILWAY_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --verbose \
  > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup created successfully${NC}"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

echo ""
echo "🔄 Step 4: Restoring to Supabase..."
echo -e "${YELLOW}⚠️  This will replace all data in the Supabase database.${NC}"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

# Restore to Supabase
psql "$SUPABASE_URL" < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database restored to Supabase successfully${NC}"
else
    echo -e "${RED}❌ Restore failed${NC}"
    exit 1
fi

echo ""
echo "🎉 Migration Complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env files with the Supabase connection strings"
echo "2. Update Railway environment variables for deployed services"
echo "3. Test your applications with the new database"
echo "4. Keep the Railway database running for a few days as backup"
echo ""
echo "Connection strings to use:"
echo "  - Development (Direct): Use the direct connection URL"
echo "  - Production (Pooled): Use the connection pooling URL from Supabase"
echo ""
