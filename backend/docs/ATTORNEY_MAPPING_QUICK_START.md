# Attorney Mapping - Quick Start Guide

## 🎯 What We Built (Option 1 Implementation)

A smart parsing and mapping system that handles the `attorney_in_charge` string field in billing projects without requiring database schema changes.

## 📦 Files Created

### 1. **`src/utils/billing-attorney-parser.ts`** (2.7 KB)
   - Parses attorney names from comma/semicolon-separated strings
   - Normalizes name formats ("Doe, John" → "John Doe")
   - Filters out TBD/N/A values

   **Key Functions:**
   - `parseAttorneyNames(field)` - Split string into array of names
   - `normalizeAttorneyName(name)` - Standardize name format
   - `getPrimaryAttorney(field)` - Get first attorney listed
   - `hasMultipleAttorneys(field)` - Check if multiple attorneys

### 2. **`src/services/billing-attorney.service.ts`** (9.1 KB)
   - Maps billing attorney names to Staff records
   - Handles fuzzy name matching with confidence scores
   - Provides CRUD operations for attorney mappings

   **Key Functions:**
   - `getBillingProjectAttorneys(projectId)` - Get attorneys for a billing project
   - `getBillingProjectsForStaff(staffId)` - Get billing projects for a staff member
   - `getUnmappedAttorneys()` - List unmapped attorney names
   - `createAttorneyMapping(name, staffId, userId)` - Create manual mapping
   - `getSuggestedStaffMatches(name)` - AI-powered matching suggestions

### 3. **`docs/BILLING_ATTORNEY_MAPPING_GUIDE.md`** (11.8 KB)
   - Complete implementation guide
   - 4 detailed use cases with code examples
   - Frontend integration examples
   - Database queries reference
   - Edge case handling

## 🚀 How to Use It

### **Immediate Usage (No Additional Code Needed)**

```typescript
import { getBillingProjectAttorneys } from '../services/billing-attorney.service';

// Get attorneys for any billing project
const attorneys = await getBillingProjectAttorneys(BigInt(123));

// Returns:
// [
//   {
//     attorneyName: "John Doe",
//     staff: { id: 5, name: "John Doe", email: "...", position: "Partner" },
//     matchConfidence: 1.0,
//     isAutoMapped: false,
//     isManuallyConfirmed: true
//   },
//   {
//     attorneyName: "Jane Smith", // Unmapped
//     staff: null,
//     matchConfidence: null,
//     isAutoMapped: false,
//     isManuallyConfirmed: false
//   }
// ]
```

### **Common Tasks**

#### Task 1: Show Attorneys on Billing Project Page
```typescript
// In your controller
import { getBillingProjectAttorneys } from '../services/billing-attorney.service';

const attorneys = await getBillingProjectAttorneys(projectId);

// Display each attorney with mapping status
attorneys.forEach(a => {
  if (a.staff) {
    console.log(`✅ ${a.attorneyName} → Mapped to ${a.staff.name}`);
  } else {
    console.log(`⚠️  ${a.attorneyName} → Not mapped`);
  }
});
```

#### Task 2: Find Unmapped Attorneys (Admin)
```typescript
import { getUnmappedAttorneys } from '../services/billing-attorney.service';

const unmapped = await getUnmappedAttorneys();

// Returns:
// [
//   { attorneyName: "John Smith", projectCount: 3, sampleProjectIds: [...] },
//   { attorneyName: "Jane Doe", projectCount: 1, sampleProjectIds: [...] }
// ]
```

#### Task 3: Map an Attorney to Staff
```typescript
import { createAttorneyMapping } from '../services/billing-attorney.service';

await createAttorneyMapping(
  "John Doe",        // Attorney name from billing
  5,                 // Staff ID
  req.user.userId,   // User creating mapping
  1.0,               // Confidence (0.0-1.0)
  "Confirmed match"  // Optional notes
);
```

#### Task 4: Get Suggested Matches
```typescript
import { getSuggestedStaffMatches } from '../services/billing-attorney.service';

const suggestions = await getSuggestedStaffMatches("John Doe");

// Returns top 5 matches with confidence scores:
// [
//   { staff: {...}, confidence: 1.0 },    // Exact match
//   { staff: {...}, confidence: 0.85 },   // Close match
//   ...
// ]
```

## 🔗 Integration with Existing Code

### Already Integrated:
- ✅ Uses existing `billing_bc_attorney_staff_map` table
- ✅ Works with existing `billing_project` schema
- ✅ Compatible with existing billing endpoints
- ✅ No migrations required

### To Add (Optional):
1. **Controller Endpoints** - Add to `billing.controller.ts`:
   ```typescript
   export async function getProjectAttorneys(req, res) {
     const projectId = BigInt(req.params.id);
     const attorneys = await getBillingProjectAttorneys(projectId);
     res.json(attorneys);
   }
   ```

2. **API Routes** - Add to `billing.routes.ts`:
   ```typescript
   router.get('/projects/:id/attorneys', authenticate, asyncHandler(getProjectAttorneys));
   ```

3. **Frontend Display** - Show attorneys in UI:
   ```tsx
   {attorneys.map(attorney => (
     attorney.staff ? (
       <Chip label={attorney.staff.name} color="success" />
     ) : (
       <Chip label={attorney.attorneyName + " (Unmapped)"} color="warning" />
     )
   ))}
   ```

## 📊 Current Database Tables Used

### `billing_project`
```sql
- project_id: BigInt (PK)
- attorney_in_charge: String  ← We parse this field
- project_name: String
- ...
```

### `billing_bc_attorney_staff_map`
```sql
- map_id: Int (PK)
- billing_attorney_name: String (unique)  ← Parsed name
- staff_id: Int (FK → Staff)              ← Links to staff
- match_confidence: Decimal(3,2)
- is_auto_mapped: Boolean
- manually_confirmed_by: Int (FK → User)
- notes: String
```

## 🎓 Example Workflow

### Scenario: Admin Maps All Unmapped Attorneys

```typescript
// 1. Get list of unmapped
const unmapped = await getUnmappedAttorneys();
console.log(`Found ${unmapped.length} unmapped attorneys`);

// 2. For each unmapped attorney
for (const { attorneyName } of unmapped) {
  // Get AI suggestions
  const suggestions = await getSuggestedStaffMatches(attorneyName);

  if (suggestions.length > 0 && suggestions[0].confidence > 0.9) {
    // Auto-map high confidence matches
    await createAttorneyMapping(
      attorneyName,
      suggestions[0].staff.id,
      adminUserId,
      suggestions[0].confidence,
      "Auto-mapped"
    );
    console.log(`✅ Auto-mapped ${attorneyName} → ${suggestions[0].staff.name}`);
  } else {
    // Require manual review
    console.log(`⚠️  Manual review needed for ${attorneyName}`);
  }
}
```

## 🧪 Testing

```bash
# Import the functions in your test file
import { parseAttorneyNames } from '../utils/billing-attorney-parser';

// Test parsing
expect(parseAttorneyNames("John Doe, Jane Smith"))
  .toEqual(["John Doe", "Jane Smith"]);

expect(parseAttorneyNames("John Doe and Jane Smith"))
  .toEqual(["John Doe", "Jane Smith"]);
```

## 📚 Next Steps

1. **✅ DONE** - Parser utility created
2. **✅ DONE** - Service functions created
3. **✅ DONE** - Documentation written
4. **TODO** - Add controller endpoints (optional)
5. **TODO** - Build frontend mapping UI (optional)
6. **TODO** - Run initial attorney mapping script

## 💡 Key Benefits

✅ **No Schema Changes** - Works with existing database
✅ **Handles Multiple Formats** - Comma, semicolon, "and", "&"
✅ **Fuzzy Matching** - AI-powered name matching
✅ **Audit Trail** - Tracks who mapped what and when
✅ **Confidence Scores** - Know which mappings are reliable
✅ **Gradual Migration** - Map attorneys as needed

## 🆘 Need Help?

See the complete guide: **`docs/BILLING_ATTORNEY_MAPPING_GUIDE.md`**

Key sections:
- **Use Case 1**: Display attorneys for a project
- **Use Case 2**: Get billing projects for a staff member
- **Use Case 3**: Map unmapped attorneys (admin)
- **Use Case 4**: Query with attorney filter
- **Edge Cases**: Handling all scenarios

---

**You're ready to use Option 1! No additional code required to start using the parser and mapping functions.** 🎉
