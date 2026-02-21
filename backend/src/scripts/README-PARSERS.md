# Excel Milestone Parser Scripts

## Overview

Three milestone parsing solutions for extracting billing data from Excel files with strikethrough detection.

---

## Scripts

### 1. `update-billing-from-excel-v2.py` ⭐ **RECOMMENDED**

**Purpose:** Master update script combining all functionality - financial data extraction, milestone parsing, and strikethrough detection.

**Key Features:**
- ✅ **Dual-level strikethrough detection** (cell-level + XML rich text)
- ✅ **Database upsert** with proper conflict handling
- ✅ **Dry-run mode** for testing
- ✅ **Comprehensive logging**

**Strikethrough Detection:**
1. First checks `cell.font.strike` (cell-level formatting)
2. If False, parses `sharedStrings.xml` for rich text strikethrough
3. Correctly handles partial strikethrough (e.g., only milestone "(a)" struck, not "(b)")

**Usage:**
```bash
cd backend/src/scripts
python3 update-billing-from-excel-v2.py --dry-run  # Test mode
python3 update-billing-from-excel-v2.py            # Real run
```

---

### 2. `smart-parse-milestones.py` 🧠 **RULE-BASED**

**Purpose:** Standalone milestone parser with sophisticated extraction logic.

**Key Features:**
- Multi-pattern matching for various milestone formats
- Chinese/English mixed text handling
- Ordinal extraction: `(a)`, `(b)`, `(1)`, `(2)`, etc.
- Amount parsing with currency detection

**Limitation:** Only checks XML-level strikethrough, not cell-level.

**Usage:**
```bash
python3 smart-parse-milestones.py
```

---

### 3. `ai-parse-milestones.py` 🤖 **AI-POWERED** (Experimental)

**Purpose:** OpenAI GPT-4 powered parser for irregular formatting.

**Requirements:**
```bash
pip install openai
export OPENAI_API_KEY="your-key-here"
```

**Key Features:**
- AI extraction of structured milestone data
- Handles messy Chinese/English text better than regex
- Automatic fallback to rule-based if AI unavailable

**Limitation:** Requires OpenAI API key and credits.

**Usage:**
```bash
export OPENAI_API_KEY="sk-..."
python3 ai-parse-milestones.py
```

---

## Key Technical Finding: Strikethrough Detection

### The Problem

Excel stores strikethrough in **two different places**:

1. **Cell-level:** `cell.font.strike` - applies to entire cell content
2. **XML-level:** `<rPr><strike/>` tags in `sharedStrings.xml` - applies to individual text runs

### Our Solution

```python
def extract_strikethrough_from_excel(file_path):
    struck_ordinals = defaultdict(set)
    
    # 1. Check cell-level strikethrough
    if cell.font and cell.font.strike:
        # Entire cell has strikethrough → all milestones completed
        return {"*"}  # Special marker for "all completed"
    
    # 2. Parse sharedStrings.xml for partial strikethrough
    for r in si.findall('.//main:r', NS):
        t = r.find('.//main:t', NS)
        r_pr = r.find('.//main:rPr', NS)
        
        if r_pr is not None and r_pr.find('.//main:strike', NS) is not None:
            text = t.text if t is not None else ""
            # Extract ordinals from struck text
            for match in re.finditer(r'\(([a-z])\)', text, re.IGNORECASE):
                struck_ordinals.add(f"({match[1].lower()})")
    
    return struck_ordinals
```

### Real Examples

| Row | Project | Cell-level Strike | XML-level Strike | Result |
|-----|---------|-------------------|------------------|--------|
| 5 | Salus | ✅ True | Only Part 1 | All milestones completed |
| 196 | 9606 | ❌ False | Only (a) struck | Only (a) completed, (b) pending |

---

## Milestone Parsing Patterns

### Supported Formats

| Format | Example | Status |
|--------|---------|--------|
| Letter ordinal | `(a) description - $100,000` | ✅ Supported |
| Number ordinal | `(1) description - $100,000` | ✅ Supported |
| With percentage | `(a) description (50%) - $100,000` | ✅ Supported |
| Chinese text | `(a) 上市聆讯后的20个工作日内 - 195,000` | ✅ Supported |
| Missing amount | `(c) 2021年7月31 - 支付...` | ✅ Conditional handling |

---

## Database Schema

### billing_milestone table

```sql
CREATE TABLE billing_milestone (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES billing_project(id),
    ordinal VARCHAR(10),        -- "(a)", "(b)", "(1)"
    description TEXT,
    amount NUMERIC(15,2),
    currency VARCHAR(3),
    completed BOOLEAN DEFAULT FALSE,
    completion_source VARCHAR(50),  -- 'excel_strikethrough'
    completion_date TIMESTAMP,
    UNIQUE(project_id, ordinal)
);
```

---

## Validation Results

### Test Case: Row 196 (9606)

```
CM Number: 9606
Original: (a) 2021年3月31 - 支付195,000 
          (b) 2021年7月31 - 支付(a)按上市项目实际产生的费用减去本所... 或 260,000

✅ Parsed correctly:
   - (a): completed=True (strikethrough), amount=195000
   - (b): completed=False (no strikethrough), amount=260000
```

### Test Case: Row 5 (Salus)

```
Cell-level strikethrough: True
→ All 3 milestones marked completed regardless of XML-level formatting
```

---

## Recommendations

1. **Use `update-billing-from-excel-v2.py`** for production runs - it handles all edge cases correctly

2. **Always use `--dry-run` first** to preview changes before writing to database

3. **Check logs** for warnings about unparseable milestones

4. **The smart parser** is good for quick testing and development, but lacks cell-level strikethrough detection

5. **The AI parser** is experimental - only use if rule-based parsing consistently fails on certain formats

---

## Dependencies

```bash
# Core
pip install openpyxl

# For XML parsing (v2 script)
# Built-in: zipfile, xml.etree.ElementTree

# Optional: AI parser
pip install openai

# Database
pip install psycopg2-binary
```

---

## Future Improvements

1. ✅ ~~Partial strikethrough detection~~ (Completed)
2. ✅ ~~Chinese/English mixed text parsing~~ (Completed)
3. ✅ ~~Cell-level + XML-level strikethrough~~ (Completed)
4. 🔄 Better handling of conditional milestones (e.g., "(c) If condition...")
5. 🔄 Support for nested parentheses in descriptions
6. 🔄 Automatic currency detection from context

---

## Troubleshooting

### Issue: Milestones not marked completed

**Check:**
1. Is the strikethrough at cell level or XML level?
2. Does the ordinal pattern match? `(a)` vs `a)` vs `(1)`
3. Are there invisible formatting characters?

### Issue: Amount not extracted

**Check:**
1. Amount format: `$100,000` vs `100,000` vs `RMB 100,000`
2. Is the amount on the same line as the ordinal?
3. Is there a dash/hyphen separating description and amount?

### Issue: Database update fails

**Check:**
1. PostgreSQL connection string in environment variables
2. Does the project exist in `billing_project` table?
3. Is there a UNIQUE constraint violation on `(project_id, ordinal)`?
