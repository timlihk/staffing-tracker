# Kimi Billing Database Updater

## Overview

This script uses the **Kimi-powered milestone parser** to update the billing database with:
- Project information (client, attorney, SCA)
- CM numbers and financial data
- Parsed milestones with completion status from Excel strikethrough

## Scripts

### `update-billing-kimi-fast.py` ⭐ **RECOMMENDED**

Optimized version with:
- Cached database lookups
- Batch commits every 5 projects
- Progress reporting
- Strikethrough detection (cell-level + XML-level)

## Usage

### Dry Run (Preview)
```bash
cd backend/src/scripts
python3 update-billing-kimi-fast.py --dry-run
```

### Update Specific Rows
```bash
python3 update-billing-kimi-fast.py --row 5 --row 7 --row 10
```

### Full Update (All 224 projects)
```bash
python3 update-billing-kimi-fast.py
```

**Note:** Full update takes approximately **10-15 minutes** due to database latency.

## Database Updates

The script updates these tables:

1. **billing_project** - Project basic info
   - client_name
   - attorney_in_charge
   - sca

2. **billing_project_cm_no** - CM numbers & financials
   - cm_no
   - billing_to_date_usd
   - collected_to_date_usd
   - ubt_usd, billing_credit_usd, etc.

3. **billing_engagement** - Engagements
   - Creates 'original' engagement if not exists

4. **billing_fee_arrangement** - Fee text
   - raw_text (fee arrangement from Excel)
   - parser_version = 'kimi-v1'

5. **billing_milestone** - Parsed milestones
   - ordinal (e.g., "(a)", "(b)")
   - description
   - amount_value, amount_currency
   - percent_value, is_percent
   - completed (from strikethrough)
   - completion_source = 'excel_strikethrough'

## How It Works

### 1. Excel Parsing
- Reads the "Transactions" sheet from row 5 onwards
- Carries forward CM numbers from previous rows if empty
- Extracts cell-level strikethrough from Excel formatting
- Extracts XML-level strikethrough from sharedStrings.xml

### 2. Milestone Parsing (Kimi Logic)
- Finds ordinals: `(a)`, `(b)`, `(c)`, `(1)`, `(2)`
- Extracts amounts: `$100,000`, `100,000 USD`, etc.
- Detects currency: USD, CNY, HKD
- Extracts percentages: `(50%)`
- Marks completed based on strikethrough

### 3. Database Matching
- First tries to match by CM number
- Falls back to project name or client name
- Updates existing records or creates new ones

### 4. Batch Processing
- Processes projects in batches of 5
- Commits every 5 projects
- Shows progress: "Progress: 50/224 projects (45 matched, 5 not found)"

## Sample Output

```
================================================================================
🤖 KIMI BILLING DATABASE UPDATER (FAST)
================================================================================
Mode: LIVE
Excel: /Users/timli/.../HKCM Project List (2026.02.12).xlsx
================================================================================
📂 Loading Excel: ...
  Extracting strikethrough data...

📊 Loaded 224 projects

🔄 APPLYING CHANGES...
================================================================================
  Loading project cache...
    Cached 353 CM numbers, 273 names
  Progress: 50/224 projects (48 matched, 2 not found)
  Progress: 100/224 projects (96 matched, 4 not found)
  ...

================================================================================
✅ DATABASE UPDATE COMPLETE
================================================================================
Projects updated: 224
CM numbers updated: 224
Engagements created: 12
Fee arrangements created: 15
Milestones inserted: 156
Milestones updated: 892
```

## Troubleshooting

### "Project not found"
- The CM number or project name doesn't match any existing project in the database
- Check the Excel CM number matches the database

### Slow performance
- Database is on Railway with ~0.7s latency per query
- Full update takes 10-15 minutes
- This is normal - the script commits every 5 projects to avoid locks

### Missing milestones
- If a cell has no parseable ordinals, no milestones will be created
- Check the fee arrangement text format

## Testing

Test with a few rows first:
```bash
python3 update-billing-kimi-fast.py --row 5 --row 7 --row 10
```

Then run the full update:
```bash
python3 update-billing-kimi-fast.py
```

## Verification

After updating, verify the data:
```sql
-- Check project count
SELECT COUNT(*) FROM billing_project;

-- Check milestone count
SELECT COUNT(*) FROM billing_milestone;

-- Check completed milestones
SELECT COUNT(*) FROM billing_milestone WHERE completed = true;

-- Sample milestones
SELECT ordinal, amount_value, amount_currency, completed
FROM billing_milestone
LIMIT 10;
```
