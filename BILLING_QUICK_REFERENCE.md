# Billing Update - Quick Reference

## 🚀 One-Command Update

```bash
./scripts/update-billing.sh
```

---

## 📋 Common Tasks

| Task | Command |
|------|---------|
| **Full update** | `./scripts/update-billing.sh` |
| **Validate only** | `./scripts/update-billing.sh --dry-run` |
| **Financials only** | `./scripts/update-billing.sh --financials-only` |
| **Map attorneys only** | `./scripts/update-billing.sh --map-attorneys` |
| **Use different Excel** | `./scripts/update-billing.sh -e /path/to/file.xlsx` |
| **Show help** | `./scripts/update-billing.sh --help` |

---

## 🔧 npm Scripts (from `backend/`)

```bash
cd backend

npm run billing:update-all          # Full update
npm run billing:update-financials   # Financial data only
npm run billing:parse-fees          # Fee arrangements
npm run billing:parse-completion    # Completed milestones
npm run billing:map-attorneys       # Attorney mapping
```

---

## 📊 Excel → Database Mapping

| Excel | Database Field | Table |
|-------|----------------|-------|
| Column J (Billing US$) | `billing_to_date_usd` | `billing_project_cm_no` |
| Column K (Collection US$) | `collected_to_date_usd` | `billing_project_cm_no` |
| Column M (UBT US$) | `ubt_usd` | `billing_project_cm_no` |
| Column L (Billing Credit US$) | `billing_credit_usd` | `billing_project_cm_no` |
| Column I (Fee Arrangement) | Parsed to milestones | `billing_milestone` |
| Column R (Finance Comment) | `comment_raw` | `billing_finance_comment` |

---

## ✅ Verification Queries

```sql
-- Recent financial updates
SELECT cm_no, billing_to_date_usd, collected_to_date_usd, 
       financials_updated_at
FROM billing_project_cm_no
ORDER BY financials_updated_at DESC
LIMIT 5;

-- Milestones created today
SELECT bp.project_name, bm.ordinal, bm.title, bm.amount_value
FROM billing_milestone bm
JOIN billing_fee_arrangement fa ON bm.fee_id = fa.fee_id
JOIN billing_engagement be ON fa.engagement_id = be.engagement_id
JOIN billing_project bp ON be.project_id = bp.project_id
WHERE DATE(bm.created_at) = CURRENT_DATE;

-- Completed milestones from Excel
SELECT bp.project_name, bm.ordinal, bm.title, bm.completion_date
FROM billing_milestone bm
JOIN billing_fee_arrangement fa ON bm.fee_id = fa.fee_id
JOIN billing_engagement be ON fa.engagement_id = be.engagement_id
JOIN billing_project bp ON be.project_id = bp.project_id
WHERE bm.completion_source = 'excel_strikethrough';
```

---

## 🐛 Quick Fixes

### "Excel file not found"
```bash
export EXCEL_FILE="/absolute/path/to/HKCM Project List.xlsx"
./scripts/update-billing.sh
```

### "Database connection failed"
```bash
export DATABASE_URL="postgresql://postgres:..."
./scripts/update-billing.sh
```

### "Python module not found"
```bash
pip install openpyxl psycopg2-binary
```

---

## 📁 Key Files

```
Billing/
└── HKCM Project List (2026.02.12).xlsx     ⬅️ SOURCE FILE

backend/src/scripts/
├── update-billing-from-excel.py            ⬅️ MAIN SCRIPT
├── update-billing-master.ts                ⬅️ ORCHESTRATOR
└── ... (individual scripts)

scripts/
└── update-billing.sh                       ⬅️ EASY WRAPPER

BILLING_UPDATE_GUIDE.md                     ⬅️ FULL DOCUMENTATION
BILLING_QUICK_REFERENCE.md                  ⬅️ THIS FILE
```

---

## 📝 Output Legend

When running the script, you'll see indicators:

| Symbol | Meaning |
|--------|---------|
| `[F]` | Financials updated |
| `[M3]` | 3 milestones created |
| `[B]` | Bonus information updated |
| `[C]` | Finance comment added |

Example output:
```
Processing 1/223: Salus [F][M3][B]     ← Financials + 3 milestones + bonus
Processing 2/223: Salus-1 [F]          ← Financials only
Processing 3/223: Renaissance [F][M4][C]  ← Financials + 4 milestones + comment
```

---

## 🆘 Need Help?

1. Check full guide: `BILLING_UPDATE_GUIDE.md`
2. Run validation: `./scripts/update-billing.sh --dry-run`
3. Check logs in terminal output
4. Verify Excel file format matches expected structure

---

**Last Updated:** 2026-02-19
**Excel File:** `Billing/HKCM Project List (2026.02.12).xlsx`
