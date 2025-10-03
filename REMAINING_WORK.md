# Remaining Work - Implementation Plan

**Date**: October 2, 2025
**Estimated Total Time**: 4-6 hours
**Priority Order**: Assignments → Reporting → Testing

> **Terminology update:** Any references to the "IP" role below map to the modern `Partner` label. Use `npm run db:fix-ip-role` after data imports to normalize legacy values.

---

## 📊 Current Status

### ✅ Completed (90%)
- Backend API with all endpoints
- Database schema with change history
- Frontend core UI (Projects, Staff, Dashboard)
- Change history tracking system
- Deployment to Railway (backend + frontend)
- Data migration from Excel

### ⏳ Remaining (10%)
- Assignment Management UI
- Reporting/Analytics Pages
- Data Export Functionality
- Final Testing & Launch

---

## 1. Assignment Management UI (2 hours) - HIGH PRIORITY

### A. Assignment List Page - 45 minutes

**File to create**: `frontend/src/pages/Assignments.tsx`

**Features:**
```typescript
- Data table with columns:
  - Project Name (clickable → project detail)
  - Staff Name (clickable → staff detail)
  - Role in Project
  - Jurisdiction
  - Allocation %
  - Start Date
  - End Date
  - Is Lead (badge)
  - Actions (Edit, Delete)

- Filters:
  - Search box (project or staff name)
  - Filter by project (dropdown)
  - Filter by staff (dropdown)
  - Filter by role (dropdown)
  - Filter by jurisdiction (dropdown)
  - Date range picker

- Actions:
  - "Create Assignment" button → opens modal
  - Row click → edit modal
  - Delete button with confirmation
```

**API Integration:**
```typescript
// Fetch assignments
GET /api/assignments?projectId=&staffId=

// Delete assignment
DELETE /api/assignments/:id
```

---

### B. Assignment Form Modal - 45 minutes

**Component to create**: `frontend/src/components/AssignmentModal.tsx`

**Features:**
```typescript
<Dialog open={open} onClose={onClose}>
  <DialogTitle>
    {isEdit ? 'Edit Assignment' : 'Create Assignment'}
  </DialogTitle>
  <DialogContent>
    <Autocomplete
      label="Project"
      options={projects}
      value={selectedProject}
      onChange={handleProjectChange}
    />
    <Autocomplete
      label="Staff Member"
      options={staff}
      value={selectedStaff}
      onChange={handleStaffChange}
    />
    <Select
      label="Role in Project"
      options={['IP', 'Associate', 'Senior FLIC', 'Junior FLIC', 'Intern', 'B&C Working Attorney']}
    />
    <Select
      label="Jurisdiction"
      options={['US Law', 'HK Law', 'B&C']}
    />
    <TextField
      label="Allocation %"
      type="number"
      min={0}
      max={100}
      helperText={allocationWarning}
    />
    <DatePicker label="Start Date" />
    <DatePicker label="End Date" />
    <FormControlLabel
      control={<Checkbox />}
      label="Is Lead"
    />
    <TextField
      label="Notes"
      multiline
      rows={3}
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button onClick={handleSubmit} variant="contained">
      {isEdit ? 'Update' : 'Create'}
    </Button>
  </DialogActions>
</Dialog>
```

**Validation:**
- Check total staff allocation when assigning
- Warn if staff > 100% allocated
- Prevent duplicate assignments (same project + staff + role + jurisdiction)

**API Integration:**
```typescript
// Create
POST /api/assignments
Body: { projectId, staffId, roleInProject, jurisdiction, allocationPercentage, startDate, endDate, isLead, notes }

// Update
PUT /api/assignments/:id
Body: { roleInProject, jurisdiction, allocationPercentage, startDate, endDate, isLead, notes }

// Get staff workload to check allocation
GET /api/staff/:id/workload
```

---

### C. Bulk Assignment Interface - 30 minutes

**Component to create**: `frontend/src/components/BulkAssignmentModal.tsx`

**Features:**
```typescript
<Dialog open={open} maxWidth="md">
  <DialogTitle>Bulk Assign to Project</DialogTitle>
  <DialogContent>
    <Autocomplete
      label="Select Project"
      options={projects}
      value={selectedProject}
    />

    <Divider sx={{ my: 2 }} />

    <Typography variant="subtitle2">Select Staff Members</Typography>

    {staffMembers.map((staff) => (
      <Box key={staff.id} display="flex" gap={2} alignItems="center">
        <Checkbox
          checked={selectedStaff.includes(staff.id)}
          onChange={() => toggleStaff(staff.id)}
        />
        <Typography flex={1}>{staff.name}</Typography>
        <Select
          label="Role"
          size="small"
          disabled={!selectedStaff.includes(staff.id)}
        />
        <Select
          label="Jurisdiction"
          size="small"
          disabled={!selectedStaff.includes(staff.id)}
        />
        <TextField
          label="Allocation %"
          type="number"
          size="small"
          disabled={!selectedStaff.includes(staff.id)}
        />
      </Box>
    ))}
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button onClick={handleBulkAssign} variant="contained">
      Assign Selected ({selectedStaff.length})
    </Button>
  </DialogActions>
</Dialog>
```

**API Integration:**
```typescript
POST /api/assignments/bulk
Body: {
  assignments: [
    { projectId, staffId, roleInProject, jurisdiction, allocationPercentage, isLead },
    ...
  ]
}
```

---

## 2. Reporting Pages (1-2 hours) - MEDIUM PRIORITY

### A. Workload Report Page - 30 minutes

**File to create**: `frontend/src/pages/WorkloadReport.tsx`

**Features:**
```typescript
// Enhanced version of dashboard workload
- Bar chart: Staff allocation percentage
- Table with detailed breakdown:
  - Staff name
  - Total allocation %
  - Active projects count
  - List of projects with allocation per project
- Filters:
  - Department (US Law, HK Law)
  - Role (IP, Associate, FLIC, Intern)
  - Status filter (show only over-allocated)
- Export button (Excel/PDF)
```

**API Integration:**
```typescript
GET /api/dashboard/workload-report
```

---

### B. Project Status Report - 30 minutes

**File to create**: `frontend/src/pages/ProjectStatusReport.tsx`

**Features:**
```typescript
- Pie chart: Projects by status (Active, Slow-down, Suspended)
- Bar chart: Projects by category
- Table grouped by status:
  - Project name
  - Category
  - Team size
  - Target filing date
  - Days until deadline
- Timeline view (optional):
  - Gantt chart showing project timelines
- Export button
```

**API Integration:**
```typescript
GET /api/dashboard/summary
GET /api/projects?status=Active
```

---

### C. Resource Allocation Matrix - 30 minutes

**File to create**: `frontend/src/pages/ResourceMatrix.tsx`

**Features:**
```typescript
// Matrix visualization
- Rows: Staff members
- Columns: Active projects
- Cells: Allocation percentage (color-coded)
  - Green: 0-50%
  - Yellow: 51-80%
  - Orange: 81-100%
  - Red: >100%
- Click cell → show assignment details
- Export to Excel
```

**API Integration:**
```typescript
GET /api/staff (with assignments)
GET /api/projects (with assignments)
```

---

## 3. Data Export Functionality (1 hour) - LOW PRIORITY

### A. Excel Export - 45 minutes

**Install library:**
```bash
npm install xlsx
```

**Utility to create**: `frontend/src/utils/excelExport.ts`

**Functions:**
```typescript
export const exportProjectsToExcel = (projects: Project[]) => {
  const ws = XLSX.utils.json_to_sheet(projects.map(p => ({
    'Project Name': p.name,
    'Project Code': p.projectCode || '',
    'Category': p.category,
    'Status': p.status,
    'Priority': p.priority || '',
    'Start Date': p.startDate ? new Date(p.startDate).toLocaleDateString() : '',
    'Target Filing': p.targetFilingDate ? new Date(p.targetFilingDate).toLocaleDateString() : '',
    'Notes': p.notes || ''
  })));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Projects');
  XLSX.writeFile(wb, `Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportStaffToExcel = (staff: Staff[]) => {
  // Similar implementation
};

export const exportAssignmentsToExcel = (assignments: ProjectAssignment[]) => {
  // Similar implementation
};

export const exportWorkloadReport = (workloadData: any[]) => {
  // Similar implementation
};
```

**Integration:**
- Add "Export" button to each list page
- Add "Export Report" button to reporting pages

---

### B. PDF Export (Optional) - 15 minutes

**Install library:**
```bash
npm install jspdf jspdf-autotable
```

**Simple implementation for reports:**
```typescript
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportReportToPDF = (title: string, data: any[], columns: string[]) => {
  const doc = new jsPDF();

  doc.text(title, 14, 15);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

  (doc as any).autoTable({
    head: [columns],
    body: data,
    startY: 30,
  });

  doc.save(`${title}_${new Date().toISOString().split('T')[0]}.pdf`);
};
```

---

## 4. Testing & Launch (1 hour)

### A. Functional Testing - 30 minutes

**Test scenarios:**
```
✓ Login/Logout
✓ Dashboard loads with data
✓ Projects list, create, edit, delete
✓ Staff list, create, edit, delete
✓ Assignments list, create, edit, delete, bulk assign
✓ Change history displays correctly
✓ Reports generate correctly
✓ Export to Excel works
✓ Filters work correctly
✓ Navigation works
✓ Error handling works
```

---

### B. User Acceptance Testing - 20 minutes

**Steps:**
1. Show application to end users
2. Walk through key workflows:
   - Creating a new project
   - Assigning staff to project
   - Checking workload
   - Viewing change history
   - Generating reports
3. Gather feedback
4. Make minor adjustments

---

### C. Launch Preparation - 10 minutes

**Checklist:**
- [ ] Change default admin password
- [ ] Create additional user accounts
- [ ] Verify all data is accurate
- [ ] Test on different browsers
- [ ] Mobile responsive check
- [ ] Share application URL with team
- [ ] Provide quick start guide

---

## 5. Routes to Add

**Update `frontend/src/App.tsx`:**

```typescript
// Add these routes
<Route path="/assignments" element={<ProtectedRoute><Layout><Assignments /></Layout></ProtectedRoute>} />

<Route path="/reports/workload" element={<ProtectedRoute><Layout><WorkloadReport /></Layout></ProtectedRoute>} />

<Route path="/reports/projects" element={<ProtectedRoute><Layout><ProjectStatusReport /></Layout></ProtectedRoute>} />

<Route path="/reports/resources" element={<ProtectedRoute><Layout><ResourceMatrix /></Layout></ProtectedRoute>} />
```

**Update `frontend/src/components/Sidebar.tsx`:**

```typescript
// Update menu items
const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Projects', icon: <FolderIcon />, path: '/projects' },
  { text: 'Staff', icon: <PeopleIcon />, path: '/staff' },
  { text: 'Assignments', icon: <AssignmentIcon />, path: '/assignments' },
  {
    text: 'Reports',
    icon: <AssessmentIcon />,
    subItems: [
      { text: 'Workload', path: '/reports/workload' },
      { text: 'Projects', path: '/reports/projects' },
      { text: 'Resources', path: '/reports/resources' },
    ]
  },
];
```

---

## 6. File Creation Summary

**New files to create (7 total):**

1. `frontend/src/pages/Assignments.tsx` - Assignment list page
2. `frontend/src/components/AssignmentModal.tsx` - Create/edit assignment
3. `frontend/src/components/BulkAssignmentModal.tsx` - Bulk assignment
4. `frontend/src/pages/WorkloadReport.tsx` - Workload report page
5. `frontend/src/pages/ProjectStatusReport.tsx` - Project status report
6. `frontend/src/pages/ResourceMatrix.tsx` - Resource allocation matrix
7. `frontend/src/utils/excelExport.ts` - Excel export utilities

**Files to update (2):**
1. `frontend/src/App.tsx` - Add new routes
2. `frontend/src/components/Sidebar.tsx` - Add menu items

---

## 7. Dependencies to Install

```bash
cd frontend

# Excel export
npm install xlsx

# PDF export (optional)
npm install jspdf jspdf-autotable

# Date pickers (if not already installed)
npm install @mui/x-date-pickers date-fns
```

---

## 8. Implementation Order

**Recommended sequence:**

### Day 1 (2-3 hours):
1. ✅ Assignment List Page (45 min)
2. ✅ Assignment Modal (45 min)
3. ✅ Bulk Assignment (30 min)
4. ✅ Update routes and sidebar (15 min)

### Day 2 (2-3 hours):
5. ✅ Workload Report (30 min)
6. ✅ Project Status Report (30 min)
7. ✅ Resource Matrix (30 min)
8. ✅ Excel Export (45 min)
9. ✅ Testing (30 min)

---

## 9. Success Criteria

**Application is complete when:**
- ✅ All CRUD operations work for Projects, Staff, Assignments
- ✅ Change history tracks all modifications
- ✅ Assignment management fully functional
- ✅ Reports display accurate data
- ✅ Export to Excel works
- ✅ No console errors
- ✅ All features accessible via navigation
- ✅ User acceptance testing passed
- ✅ Application deployed and accessible

---

## 10. Post-Launch Enhancements (Future)

**Nice to have (not required for launch):**
- Email notifications for status changes
- Advanced search and filtering
- Calendar view for project deadlines
- Drag-and-drop assignment interface
- Mobile app (React Native)
- SSO integration
- Role-based feature restrictions
- Audit log viewer
- Data backup/restore

---

## Summary

**Time Breakdown:**
- Assignment Management: 2 hours
- Reporting Pages: 1-2 hours
- Export Functionality: 1 hour
- Testing & Launch: 1 hour
- **Total: 5-6 hours**

**Current Status: 90% Complete**
**Remaining: 10% (5-6 hours of focused work)**

Once these features are implemented, the application will be 100% complete and ready for production use!
