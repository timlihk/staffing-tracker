# Billing Database Update Guide

This guide explains how to update the billing database using the HKCM Project List Excel file.

## 📁 Files Overview

```
Billing/
└── HKCM Project List (2026.02.12).xlsx    # Source Excel file

backend/src/scripts/
├── update-billing-from-excel.py            # Master Python script (recommended)
├── update-billing-master.ts                # TypeScript orchestrator
├── parse-fee-arrangements.ts               # Parse fee arrangements
├── parse-fee-with-strikethrough.ts         # Detect completed milestones
├── auto-map-bc-attorneys.ts                # Map attorneys to staff
└── ... (other utility scripts)

scripts/
└── update-billing.sh                       # Shell script wrapper
```

## 🚀 Quick Start

### Option 1: Using Shell Script (Easiest)

```bash
# Run all updates
./scripts/update-billing.sh

# Validate only (dry run)
./scripts/update-billing.sh --dry-run

# Update financials only
./scripts/update-billing.sh --financials-only

# Map attorneys only
./scripts/update-billing.sh --map-attorneys

# Use specific Excel file
./scripts/update-billing.sh -e /path/to/file.xlsx
```

### Option 2: Using npm Scripts

```bash
cd backend

# Run all updates
npm run billing:update-all

# Or step by step:
npm run billing:update-financials    # Update billing, collection, UBT
npm run billing:parse-fees           # Parse fee arrangements
npm run billing:parse-completion     # Mark completed milestones
npm run billing:map-attorneys        # Map attorneys to staff
```

### Option 3: Using Python Directly

```bash
cd backend
export EXCEL_FILE="/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List (2026.02.12).xlsx"
python3 src/scripts/update-billing-from-excel.py
```

---

## 📊 What Gets Updated

### 1. Financial Data (Columns H, J, K, L, M, N, P, Q)

| Database Field | Excel Column | Description |
|----------------|--------------|-------------|
| `billing_to_date_usd` | J (Billing US$) | Total fees billed |
| `collected_to_date_usd` | K (Collection US$) | Total collected |
| `ubt_usd` | M (UBT US$) | Unbilled time |
| `billing_credit_usd` | L (Billing Credit US$) | Billing credits |
| `billing_credit_cny` | P (Billing Credit CNY) | Billing credits (CNY) |
| `ubt_cny` | Q (UBT CNY) | Unbilled time (CNY) |
| `financials_updated_at` | - | Timestamp of update |

### 2. Fee Arrangements & Milestones (Column I)

Parses fee arrangement text like:
```
(a) 签署本协议后的20个工作日内(25%) - 226,000
(b) 完成A1递交后的20个工作日内(25%) - 226,000
(LSD: 31 Dec 2025)
```

Creates records in:
- `billing_fee_arrangement` - Fee arrangement header with LSD
- `billing_milestone` - Individual milestone items

### 3. Completed Milestones (Strikethrough Detection)

Detects strikethrough formatting in Excel to mark milestones as completed.

### 4. Bonus Information

Parses bonus amounts from text:
- Chinese: `不低于10万美元奖金` → $100,000 USD
- English: `bonus: $50,000` → $50,000 USD

### 5. Finance Comments (Column R)

Adds finance comments to `billing_finance_comment` table.

---

## 🔧 Prerequisites

### Environment Variables

```bash
# Required: Database connection
export DATABASE_URL="postgresql://postgres:..."

# Optional: Excel file path (defaults to Billing/ folder)
export EXCEL_FILE="/path/to/HKCM Project List.xlsx"
```

### Python Dependencies

```bash
pip install openpyxl psycopg2-binary
```

### Node.js Dependencies

```bash
cd backend
npm install
```

---

## 📋 Detailed Usage

### Full Update Workflow

```bash
# 1. Navigate to project root
cd /Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker

# 2. Run the master update script
./scripts/update-billing.sh

# 3. Follow the prompts and check output
```

### Step-by-Step Manual Process

If you need more control, run each step individually:

```bash
cd backend

# Step 1: Update financials from Excel
npm run billing:update-financials

# Step 2: Parse fee arrangements and create milestones
npm run billing:parse-fees

# Step 3: Detect completed milestones from strikethrough
npm run billing:parse-completion

# Step 4: Map B&C attorneys to staff records
npm run billing:map-attorneys
```

### Verifying Updates

```sql
-- Check financials updated
SELECT 
    pcm.cm_no,
    bp.project_name,
    pcm.billing_to_date_usd,
    pcm.collected_to_date_usd,
    pcm.ubt_usd,
    pcm.financials_updated_at
FROM billing_project_cm_no pcm
JOIN billing_project bp ON pcm.project_id = bp.project_id
ORDER BY pcm.financials_updated_at DESC NULLS LAST
LIMIT 10;

-- Check milestones created
SELECT 
    bp.project_name,
    bm.ordinal,
    bm.title,
    bm.amount_value,
    bm.completed,
    bm.completion_source
FROM billing_milestone bm
JOIN billing_fee_arrangement fa ON bm.fee_id = fa.fee_id
JOIN billing_engagement be ON fa.engagement_id = be.engagement_id
JOIN billing_project bp ON be.project_id = bp.project_id
WHERE bm.completion_source = 'excel_strikethrough'
LIMIT 20;
```

---

## ⚙️ Configuration

### Excel Column Mapping

The script expects the following structure in the "Transactions" sheet:

| Column | Header | Data Type | Purpose |
|--------|--------|-----------|---------|
| C | Project Name | Text | Project identification |
| D | Client Name | Text | Client name |
| E | C/M No | Text | Client matter number (key) |
| F | Attorney in Charge | Text | B&C attorney name |
| H | Fees (US$) | Number | Agreed fee amount |
| I | Fee Arrangement | Text | Milestone descriptions |
| J | Billing (US$) | Number | Billed amount |
| K | Collection (US$) | Number | Collected amount |
| L | Billing Credit (US$) | Number | Credits |
| M | UBT (US$) | Number | Unbilled time |
| P | Billing Credit (CNY) | Number | Credits (CNY) |
| Q | UBT (CNY) | Number | Unbilled time (CNY) |
| R | Finance Comment | Text | Comments |

### Customizing the Script

If your Excel structure differs, edit the column indexes in `update-billing-from-excel.py`:

```python
# Line ~290-300 in update-billing-from-excel.py
project_name=str(row[2].value or "").strip(),   # Column C
client_name=str(row[3].value or "").strip(),    # Column D
cm_no=str(row[4].value or "").strip(),          # Column E
# ... etc
```

---

## 🐛 Troubleshooting

### Issue: "Excel file not found"

**Solution:**
```bash
# Set the correct path
export EXCEL_FILE="/absolute/path/to/your/file.xlsx"

# Or use the -e flag
./scripts/update-billing.sh -e /path/to/file.xlsx
```

### Issue: "Database connection failed"

**Solution:**
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Set it if missing
export DATABASE_URL="postgresql://postgres:..."
```

### Issue: Python module not found

**Solution:**
```bash
pip install openpyxl psycopg2-binary
```

### Issue: Milestones not being created

**Check:**
1. Does the C/M number exist in `billing_project_cm_no`?
2. Does the engagement exist in `billing_engagement`?
3. Is the fee arrangement text in the correct format?

```sql
-- Check if C/M exists
SELECT * FROM billing_project_cm_no WHERE cm_no = '50284-00001';

-- Check if engagement exists
SELECT * FROM billing_engagement WHERE cm_id = <cm_id>;
```

---

## 📝 Log Output Example

```
================================================================================
                         BILLING DATABASE UPDATE
================================================================================

ℹ Excel file: /Users/timli/.../Billing/HKCM Project List (2026.02.12).xlsx
ℹ Database: configured
✅ Loaded 223 projects from Excel
ℹ Connecting to database...

================================================================================
                              UPDATING DATABASE
================================================================================

Processing 1/223: Salus [F][M3][B]
Processing 2/223: Salus-1 [F]
Processing 3/223: Renaissance [F][M4][C]
...

================================================================================
                                UPDATE SUMMARY
================================================================================
✓ Financial records updated: 215
✓ Milestones created: 156
✓ Milestones marked completed: 23
✓ Bonuses updated: 45
✓ Finance comments added: 89

================================================================================
              ✅ Billing database update completed successfully!
================================================================================
```

Legend:
- `[F]` - Financials updated
- `[M3]` - 3 milestones created
- `[B]` - Bonus updated
- `[C]` - Comment added

---

## 🔄 Automation

### Schedule Regular Updates

Add to crontab (macOS/Linux):

```bash
# Edit crontab
crontab -e

# Add weekly update (Mondays at 9 AM)
0 9 * * 1 cd /Users/timli/.../staffing-tracker && ./scripts/update-billing.sh >> /var/log/billing-update.log 2>&1
```

### GitHub Actions (if applicable)

```yaml
name: Billing Update
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Update Billing
        run: ./scripts/update-billing.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 📞 Support

If you encounter issues:

1. Check the Excel file format matches expected structure
2. Verify database connection string
3. Review script output for specific error messages
4. Check database tables have expected data

For persistent issues, check the individual script logs or run with verbose output:

```bash
# Python script with verbose output
python3 backend/src/scripts/update-billing-from-excel.py -v

# TypeScript with debug
DEBUG=* npx ts-node backend/src/scripts/update-billing-master.ts
```
