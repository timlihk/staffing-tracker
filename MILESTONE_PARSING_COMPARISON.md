# Milestone Parsing Scripts - Comparison Analysis

## 📜 Existing Scripts Overview

### 1. `parse-strikethrough-milestones.py` (Python)
**Purpose:** Detect strikethrough formatting and mark milestones as completed

**Approach:**
- Uses `openpyxl` with `CellRichText` and `TextBlock` classes
- Checks for `cell.font.strike` (cell-level) or `text_block.font.strike` (rich text)
- Extracts milestone ordinals from struck text: `\(([a-z])\)`
- Updates database by project name lookup
- **Does NOT parse/create milestones** - only marks existing ones as completed

**Key Code:**
```python
if isinstance(cell.value, CellRichText):
    for text_block in cell.value:
        if text_block.font and text_block.font.strike:
            strikethrough_texts.append(text_block.text)
elif cell.font and cell.font.strike and cell.value:
    strikethrough_texts.append(str(cell.value))
```

---

### 2. `parse-fee-arrangements.ts` (TypeScript)
**Purpose:** Parse fee arrangement text to extract LSD and milestones

**Approach:**
- Uses `ExcelJS` library
- **Does NOT detect strikethrough** - only parses text
- Milestone regex: `/\(([a-z])\)\s*([^(]+?)(?:\((\d+(?:\.\d+)?)%\))?\s*-\s*([\d,]+)/gi`
- Deletes and re-inserts all milestones (destructive update)
- Sets `completed = false` for all milestones

**Key Code:**
```typescript
const milestoneRegex = /\(([a-z])\)\s*([^(]+?)(?:\((\d+(?:\.\d+)?)%\))?\s*-\s*([\d,]+)/gi;
while ((match = milestoneRegex.exec(text)) !== null) {
  // Parse milestone
}
```

---

### 3. `parse-fee-with-strikethrough.ts` (TypeScript)
**Purpose:** Parse strikethrough AND bonuses

**Approach:**
- Uses `ExcelJS` library
- Detects strikethrough via `richText` or `cell.font.strike`
- **Only updates completion status** - does NOT create milestones
- Also parses bonus amounts from text
- Updates by C/M number lookup

**Key Code:**
```typescript
const richText = (cell.value as { richText?: Array<{ font?: { strike?: boolean }; text?: string }> } | null)?.richText;
if (Array.isArray(richText)) {
  for (const run of richText) {
    if (run.font?.strike && run.text) {
      completedMilestones.add(`(${ordinalMatch[1].toLowerCase()})`);
    }
  }
}
```

---

## 🆕 NEW SCRIPT: `update-billing-from-excel.py`

### Combined Approach
The new script **combines all functionality** from the existing scripts:

| Feature | Old Scripts | New Script |
|---------|-------------|------------|
| Parse milestones from text | ✅ `parse-fee-arrangements.ts` | ✅ |
| Detect strikethrough | ✅ `parse-strikethrough-milestones.py` | ✅ |
| Mark completed in DB | ✅ `parse-fee-with-strikethrough.ts` | ✅ |
| Update financials | ❌ (separate script) | ✅ |
| Parse bonuses | ✅ `parse-fee-with-strikethrough.ts` | ✅ |
| Add finance comments | ❌ | ✅ |
| Single command | ❌ (multiple scripts) | ✅ |

---

## 🔍 Technical Comparison

### Milestone Parsing Regex

#### Old (TypeScript):
```typescript
/\(([a-z])\)\s*([^(]+?)(?:\((\d+(?:\.\d+)?)%\))?\s*-\s*([\d,]+)/gi
```
- Uses `g` (global) flag with `exec()` loop
- May miss milestones if pattern doesn't match perfectly

#### New (Python):
```python
re.search(
    r'\(([a-z])\)\s*(.+?)(?:\((\d+(?:\.\d+)?)%\))?\s*-\s*([\d,]+)',
    line,
    re.IGNORECASE
)
```
- Processes line-by-line
- More lenient description matching (`(.+?)` vs `[^(]+?`)
- Better for Chinese text with embedded parentheses

### Strikethrough Detection

#### Old Python Script:
```python
if isinstance(cell.value, CellRichText):
    for text_block in cell.value:
        if isinstance(text_block, TextBlock):
            if text_block.font and text_block.font.strike:
                strikethrough_texts.append(text_block.text)
```

#### Old TypeScript Script:
```typescript
const richText = (cell.value as { richText?: Array<{ font?: { strike?: boolean }; text?: string }> } | null)?.richText;
if (Array.isArray(richText)) {
  for (const run of richText) {
    if (run.font?.strike && run.text) {
      // process
    }
  }
}
```

#### New Python Script:
```python
# Check for rich text with strikethrough
if hasattr(cell.value, 'richText') and cell.value.richText:
    for run in cell.value.richText:
        if hasattr(run, 'font') and run.font and getattr(run.font, 'strike', False):
            match = re.search(r'\(([a-z])\)', str(run.text), re.IGNORECASE)
            if match:
                completed.add(f"({match[1].lower()})")

# Check if entire cell has strikethrough
if cell.font and getattr(cell.font, 'strike', False):
    matches = re.finditer(r'\(([a-z])\)', text, re.IGNORECASE)
    for match in matches:
        completed.add(f"({match[1].lower()})")
```

**Comparison:**
- All three use similar logic for detection
- New script handles both rich text AND cell-level strikethrough
- New script is more defensive with `hasattr` and `getattr`

---

## 📊 Database Update Logic

### Old Scripts

1. **`parse-strikethrough-milestones.py`**:
   - Updates by `project_name` lookup
   - May match multiple engagements per project
   - Updates ALL milestones with matching ordinal across all fee arrangements

2. **`parse-fee-arrangements.ts`**:
   - Deletes ALL existing milestones for fee arrangement
   - Re-inserts parsed milestones
   - **Destructive** - loses manual edits

3. **`parse-fee-with-strikethrough.ts`**:
   - Updates by C/M number
   - Only updates completion status
   - Non-destructive for milestone data

### New Script

- **Upsert pattern**: Updates existing, creates new
- **Preserves manual edits** to title, description, amounts
- **Only updates completion** if strikethrough detected
- Tracks seen ordinals to avoid duplicates
- Updates by C/M number → engagement → fee arrangement

**Key Code:**
```python
# Check if milestone exists
existing = self.cur.fetchone()

if existing:
    milestone_id = existing['milestone_id']
    was_completed = existing['completed']
    
    # Update existing (preserve manual edits)
    self.cur.execute("UPDATE ... SET title = %s, description = %s ...")
    
    # Only mark completed if strikethrough AND not already completed
    if milestone['ordinal'] in project.completed_milestones and not was_completed:
        self.cur.execute("UPDATE ... SET completed = true, completion_source = 'excel_strikethrough'")
else:
    # Create new with completion status
    self.cur.execute("INSERT ... completed = %s", 
        (milestone['ordinal'] in project.completed_milestones,))
```

---

## ⚠️ Key Differences & Considerations

### 1. Excel File Path

| Script | Default Path |
|--------|--------------|
| Old Python | `/home/timlihk/staffing-tracker/billing-matter/HKCM Project List(81764217.1)_6Oct25.xlsx` |
| Old TypeScript | `/home/timlihk/staffing-tracker/billing-matter/HKCM Project List(81764217.1)_6Oct25.xlsx` |
| **New Python** | `/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List (2026.02.12).xlsx` |

### 2. Column Detection

| Script | Column Detection |
|--------|------------------|
| Old Python | Uses header row (row 4) to find columns by name |
| Old TypeScript | Scans first 5 rows for header names |
| **New Python** | **Hardcoded column indexes** (Column I = index 9) |

**⚠️ Warning:** New script uses hardcoded column positions. If Excel structure changes, update these:
```python
# In load_excel_data():
project_name=str(row[2].value or "").strip(),   # Column C
client_name=str(row[3].value or "").strip(),    # Column D
cm_no=str(row[4].value or "").strip(),          # Column E
# ...
fee_cell = sheet.cell(row=row_idx, column=9)    # Column I
```

### 3. Duplicate Handling

| Script | Behavior |
|--------|----------|
| Old TypeScript (parse-fees) | **Deletes all** existing milestones - destructive |
| Old TypeScript (parse-completion) | Only updates completion status |
| **New Python** | **Upsert** - preserves manual edits, updates if changed |

### 4. Milestone Sorting

| Script | Sort Order |
|--------|------------|
| Old TypeScript | `sortOrder++` sequential |
| **New Python** | `ord(ordinal.lower()) - ord('a') + 1` (a=1, b=2, etc.) |

---

## ✅ Recommendation

### Use the NEW script (`update-billing-from-excel.py`) for:
- **Initial import** of all billing data
- **Regular updates** when new Excel file arrives
- **One-command** operation

### Use the OLD scripts for:
- **Selective updates** (e.g., only strikethrough detection)
- **Debugging** specific issues
- **Historical compatibility** with existing workflows

### Migration Path:
```bash
# Before (multiple steps):
npm run billing:parse-fees         # Parse milestones
npm run billing:parse-completion    # Mark completed
python3 src/scripts/update-financials-from-excel.py  # Update financials

# After (single step):
./scripts/update-billing.sh
```

---

## 🧪 Verification

To verify the new script works the same as the old ones:

```bash
# Run old script (mark only completion)
npx ts-node src/scripts/parse-fee-with-strikethrough.ts

# Check results
psql $DATABASE_URL -c "
  SELECT COUNT(*) as completed_count 
  FROM billing_milestone 
  WHERE completion_source = 'excel_strikethrough';
"

# Reset
psql $DATABASE_URL -c "
  UPDATE billing_milestone 
  SET completed = false, completion_source = null, completion_date = null
  WHERE completion_source = 'excel_strikethrough';
"

# Run new script
./scripts/update-billing.sh

# Check results - should match
psql $DATABASE_URL -c "
  SELECT COUNT(*) as completed_count 
  FROM billing_milestone 
  WHERE completion_source = 'excel_strikethrough';
"
```
