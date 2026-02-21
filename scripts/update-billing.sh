#!/bin/bash
#
# Billing Database Update Script
# 
# Usage:
#   ./scripts/update-billing.sh              # Run all updates
#   ./scripts/update-billing.sh --dry-run    # Validate only
#   ./scripts/update-billing.sh --help       # Show help
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
EXCEL_FILE="${EXCEL_FILE:-$PROJECT_DIR/Billing/HKCM Project List (2026.02.12).xlsx}"

# Help message
show_help() {
    cat << EOF
Billing Database Update Script

Usage:
  $(basename "$0") [OPTIONS]

Options:
  -h, --help          Show this help message
  -d, --dry-run       Validate environment only, don't update
  -e, --excel PATH    Specify Excel file path
  -s, --step N        Start from specific step (1-5)
  --financials-only   Only update financial data
  --map-attorneys     Only run attorney mapping

Environment Variables:
  EXCEL_FILE          Path to Excel file
  DATABASE_URL        PostgreSQL connection string

Examples:
  # Run all updates
  $(basename "$0")

  # Validate setup only
  $(basename "$0") --dry-run

  # Use specific Excel file
  $(basename "$0") -e /path/to/file.xlsx

  # Only update financials
  $(basename "$0") --financials-only

EOF
}

# Parse arguments
DRY_RUN=false
STEP=""
FINANCIALS_ONLY=false
MAP_ATTORNEYS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -e|--excel)
            EXCEL_FILE="$2"
            shift 2
            ;;
        -s|--step)
            STEP="$2"
            shift 2
            ;;
        --financials-only)
            FINANCIALS_ONLY=true
            shift
            ;;
        --map-attorneys)
            MAP_ATTORNEYS_ONLY=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Check Excel file exists
if [[ ! -f "$EXCEL_FILE" ]]; then
    echo -e "${RED}❌ Excel file not found: $EXCEL_FILE${NC}"
    echo ""
    echo "Set EXCEL_FILE environment variable or use -e option:"
    echo "  export EXCEL_FILE=/path/to/file.xlsx"
    echo "  $(basename "$0")"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   BILLING DATABASE UPDATE SCRIPT                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Excel File:${NC} $EXCEL_FILE"
echo -e "${BLUE}Backend Dir:${NC} $BACKEND_DIR"
echo ""

# Export for child processes
export EXCEL_FILE

# Run specific operations based on flags
if [[ "$FINANCIALS_ONLY" == true ]]; then
    echo -e "${YELLOW}▶ Running financial update only...${NC}"
    python3 src/scripts/update-billing-from-excel.py
    exit 0
fi

if [[ "$MAP_ATTORNEYS_ONLY" == true ]]; then
    echo -e "${YELLOW}▶ Running attorney mapping only...${NC}"
    npx ts-node src/scripts/auto-map-bc-attorneys.ts
    exit 0
fi

# Run master script
if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}▶ Running dry-run (validation only)...${NC}"
    npx ts-node src/scripts/update-billing-master.ts --dry-run
else
    echo -e "${GREEN}▶ Running full billing update...${NC}"
    npx ts-node src/scripts/update-billing-master.ts
fi

echo ""
echo -e "${GREEN}✅ Script completed!${NC}"
