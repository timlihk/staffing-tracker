# Billing Attorney Mapping Guide - Option 1 Implementation

This guide explains how to work with the `attorney_in_charge` field in billing projects, which may contain multiple attorney names as a single string.

## 📋 Overview

**Problem:** The `billing_project.attorney_in_charge` field is a string that may contain:
- Single name: `"John Doe"`
- Multiple names: `"John Doe, Jane Smith"`
- Various separators: commas, semicolons, "and", "&"

**Solution:** Parse the string and map names to Staff records using `billing_bc_attorney_staff_map`.

## 🔧 Implementation Components

### 1. Parser Utility (`billing-attorney-parser.ts`)

Handles parsing and normalizing attorney names from strings.

```typescript
import {
  parseAttorneyNames,
  normalizeAttorneyName,
  hasMultipleAttorneys,
  getPrimaryAttorney
} from '../utils/billing-attorney-parser';

// Example usage:
const field = "John Doe, Jane Smith";
const names = parseAttorneyNames(field);
// Returns: ["John Doe", "Jane Smith"]

const primary = getPrimaryAttorney(field);
// Returns: "John Doe"

const hasMultiple = hasMultipleAttorneys(field);
// Returns: true
```

### 2. Mapping Service (`billing-attorney.service.ts`)

Handles the relationship between billing attorney names and Staff records.

```typescript
import {
  getBillingProjectAttorneys,
  getBillingProjectsForStaff,
  getUnmappedAttorneys,
  createAttorneyMapping,
  getSuggestedStaffMatches
} from '../services/billing-attorney.service';
```

## 📖 Common Use Cases

### Use Case 1: Display Attorneys for a Billing Project

**Scenario:** You're showing billing project details and want to display all B&C attorneys.

```typescript
// In your controller or service
import { getBillingProjectAttorneys } from '../services/billing-attorney.service';

async function showProjectDetails(projectId: bigint) {
  // Get attorneys with their staff mappings
  const attorneys = await getBillingProjectAttorneys(projectId);

  // attorneys structure:
  // [
  //   {
  //     attorneyName: "John Doe",
  //     staff: { id: 5, name: "John Doe", email: "john@example.com", position: "Partner" },
  //     matchConfidence: 1.0,
  //     isAutoMapped: false,
  //     isManuallyConfirmed: true
  //   },
  //   {
  //     attorneyName: "Jane Smith",
  //     staff: null,  // Unmapped
  //     matchConfidence: null,
  //     isAutoMapped: false,
  //     isManuallyConfirmed: false
  //   }
  // ]

  return attorneys;
}
```

**Frontend Display:**
```typescript
attorneys.map(attorney => {
  if (attorney.staff) {
    return (
      <AttorneyChip
        name={attorney.staff.name}
        email={attorney.staff.email}
        position={attorney.staff.position}
        confidence={attorney.matchConfidence}
      />
    );
  } else {
    return (
      <UnmappedAttorneyChip
        name={attorney.attorneyName}
        onMap={() => openMappingDialog(attorney.attorneyName)}
      />
    );
  }
});
```

---

### Use Case 2: Get All Billing Projects for a Staff Member

**Scenario:** Show a staff member all their billing matters where they're the B&C attorney.

```typescript
import { getBillingProjectsForStaff } from '../services/billing-attorney.service';

// Controller endpoint
export async function getStaffBillingProjects(req: AuthRequest, res: Response) {
  const staffId = parseInt(req.params.staffId);

  const projects = await getBillingProjectsForStaff(staffId);

  // Returns billing projects with engagements and milestones
  res.json(projects);
}
```

**API Endpoint:**
```
GET /api/staff/:staffId/billing-projects
```

**Response:**
```json
[
  {
    "project_id": "123",
    "project_name": "Project Alpha",
    "client_name": "Client Corp",
    "attorney_in_charge": "John Doe, Jane Smith",
    "billing_engagement": [
      {
        "engagement_id": "456",
        "engagement_code": "original",
        "billing_milestone": [
          {
            "milestone_id": "789",
            "title": "Signing",
            "amount_value": "50000.00",
            "amount_currency": "USD",
            "due_date": "2025-12-31"
          }
        ]
      }
    ],
    "billing_staffing_project_link": [
      {
        "projects": {
          "id": 42,
          "name": "Project Alpha - Staffing",
          "status": "active"
        }
      }
    ]
  }
]
```

---

### Use Case 3: Map Unmapped Attorneys

**Scenario:** Admin wants to see all unmapped attorneys and map them to staff records.

```typescript
import { getUnmappedAttorneys, getSuggestedStaffMatches, createAttorneyMapping } from '../services/billing-attorney.service';

// Step 1: Get list of unmapped attorneys
export async function listUnmappedAttorneys(req: AuthRequest, res: Response) {
  const unmapped = await getUnmappedAttorneys();

  // Returns:
  // [
  //   {
  //     attorneyName: "John Doe",
  //     projectCount: 5,
  //     sampleProjectIds: [123, 456, 789]
  //   },
  //   ...
  // ]

  res.json(unmapped);
}

// Step 2: Get suggested matches for an attorney
export async function suggestMatches(req: AuthRequest, res: Response) {
  const { attorneyName } = req.query;

  const suggestions = await getSuggestedStaffMatches(attorneyName as string);

  // Returns:
  // [
  //   {
  //     staff: { id: 5, name: "John Doe", email: "john@example.com", position: "Partner" },
  //     confidence: 1.0
  //   },
  //   {
  //     staff: { id: 12, name: "John A. Doe", email: "jdoe@example.com", position: "Counsel" },
  //     confidence: 0.85
  //   }
  // ]

  res.json(suggestions);
}

// Step 3: Create the mapping
export async function mapAttorneyToStaff(req: AuthRequest, res: Response) {
  const { attorneyName, staffId, confidence, notes } = req.body;
  const userId = req.user!.userId!;

  const mapping = await createAttorneyMapping(
    attorneyName,
    staffId,
    userId,
    confidence,
    notes
  );

  res.json({ success: true, mapping });
}
```

**Frontend Flow:**

```typescript
// 1. Show unmapped attorneys
const unmapped = await api.get('/api/billing/bc-attorneys/unmapped');

// 2. User clicks "Map" on "John Doe"
const suggestions = await api.get('/api/billing/bc-attorneys/suggestions?attorneyName=John Doe');

// 3. User selects staff member from suggestions
await api.post('/api/billing/bc-attorneys/map', {
  attorneyName: "John Doe",
  staffId: 5,
  confidence: 1.0,
  notes: "Confirmed by admin"
});
```

---

### Use Case 4: Query Billing Data with Attorney Filter

**Scenario:** Filter billing projects by a specific staff member.

```typescript
export async function filterProjectsByAttorney(req: AuthRequest, res: Response) {
  const staffId = parseInt(req.query.staffId as string);

  // Get attorney names for this staff member
  const mappings = await prisma.billing_bc_attorney_staff_map.findMany({
    where: { staff_id: staffId },
    select: { billing_attorney_name: true }
  });

  const attorneyNames = mappings.map(m => m.billing_attorney_name);

  // Find projects where attorney_in_charge contains any of these names
  const projects = await prisma.billing_project.findMany({
    where: {
      OR: attorneyNames.map(name => ({
        attorney_in_charge: { contains: name }
      }))
    }
  });

  res.json(projects);
}
```

---

## 🔄 Complete Workflow Example

### Scenario: Display Billing Project with Linked Staffing Data

```typescript
async function getBillingProjectComplete(projectId: bigint) {
  // 1. Get base billing project
  const billingProject = await prisma.billing_project.findUnique({
    where: { project_id: projectId },
    include: {
      billing_engagement: {
        include: {
          billing_milestone: true,
          billing_fee_arrangement: true
        }
      }
    }
  });

  // 2. Parse and map attorneys
  const attorneys = await getBillingProjectAttorneys(projectId);

  // 3. Get linked staffing project (if exists)
  const link = await prisma.billing_staffing_project_link.findFirst({
    where: { billing_project_id: projectId },
    include: {
      projects: {
        include: {
          assignments: {
            include: {
              staff: true
            }
          },
          bcAttorneys: {
            include: {
              staff: true
            }
          }
        }
      }
    }
  });

  return {
    ...billingProject,
    attorneys,  // Parsed and mapped B&C attorneys
    linkedStaffingProject: link?.projects || null
  };
}
```

---

## 📊 Database Queries Reference

### Check if Attorney is Mapped
```sql
SELECT * FROM billing_bc_attorney_staff_map
WHERE billing_attorney_name = 'John Doe';
```

### Find All Projects for an Attorney Name
```sql
SELECT * FROM billing_project
WHERE attorney_in_charge LIKE '%John Doe%';
```

### Get Mapping Statistics
```sql
SELECT
  (SELECT COUNT(DISTINCT billing_attorney_name) FROM billing_bc_attorney_staff_map) as mapped_count,
  (SELECT COUNT(*) FROM billing_project WHERE attorney_in_charge IS NOT NULL AND attorney_in_charge != '') as total_projects;
```

---

## ⚠️ Edge Cases & Handling

### Case 1: Multiple Attorneys in String
```typescript
const field = "John Doe, Jane Smith, Bob Johnson";
const names = parseAttorneyNames(field);
// ["John Doe", "Jane Smith", "Bob Johnson"]

// Map each one
for (const name of names) {
  await createAttorneyMapping(name, staffId, userId);
}
```

### Case 2: Name Format Variations
```typescript
// Handles various formats:
"Doe, John"     → normalizes to → "John Doe"
"John   Doe"    → normalizes to → "John Doe"
"JOHN DOE"      → case-insensitive matching
```

### Case 3: Null or Empty Attorney Field
```typescript
const attorneys = await getBillingProjectAttorneys(projectId);
// Returns [] if attorney_in_charge is null/empty
```

### Case 4: Attorney Not Yet Mapped
```typescript
const attorneys = await getBillingProjectAttorneys(projectId);
// Returns:
// [
//   {
//     attorneyName: "Unknown Attorney",
//     staff: null,  // ← Not mapped yet
//     matchConfidence: null,
//     isAutoMapped: false,
//     isManuallyConfirmed: false
//   }
// ]

// Handle in frontend:
if (!attorney.staff) {
  // Show "Map Attorney" button or warning
}
```

---

## 🧪 Testing Examples

```typescript
import { parseAttorneyNames } from '../utils/billing-attorney-parser';

describe('Attorney Name Parser', () => {
  it('parses single attorney', () => {
    expect(parseAttorneyNames("John Doe")).toEqual(["John Doe"]);
  });

  it('parses comma-separated attorneys', () => {
    expect(parseAttorneyNames("John Doe, Jane Smith"))
      .toEqual(["John Doe", "Jane Smith"]);
  });

  it('parses "and" separated attorneys', () => {
    expect(parseAttorneyNames("John Doe and Jane Smith"))
      .toEqual(["John Doe", "Jane Smith"]);
  });

  it('filters out TBD', () => {
    expect(parseAttorneyNames("John Doe, TBD"))
      .toEqual(["John Doe"]);
  });

  it('handles null', () => {
    expect(parseAttorneyNames(null)).toEqual([]);
  });
});
```

---

## 🚀 Next Steps

1. ✅ **Parser utility created** → `billing-attorney-parser.ts`
2. ✅ **Service functions created** → `billing-attorney.service.ts`
3. ⏭️ **Add controller endpoints** → Integrate into `billing.controller.ts`
4. ⏭️ **Create frontend components** → Attorney mapping UI
5. ⏭️ **Run initial mapping** → Map existing attorneys

## 📚 Related Files

- **Utility:** `src/utils/billing-attorney-parser.ts`
- **Service:** `src/services/billing-attorney.service.ts`
- **Controller:** `src/controllers/billing.controller.ts`
- **Schema:** `prisma/schema.prisma` (billing_bc_attorney_staff_map)
- **Routes:** `src/routes/billing.routes.ts`

---

**Summary:** This approach keeps your current database structure while adding intelligent parsing and mapping layers. No schema changes needed, and you can gradually map attorneys as needed! 🎯
