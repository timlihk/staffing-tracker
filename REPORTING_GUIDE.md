# Reporting System Guide

**Last Updated**: October 2, 2025
**Version**: 1.0

---

## Overview

The Staffing Tracker includes a comprehensive reporting system that allows users to filter, view, print, and export staffing data. The report builder provides real-time filtering with multiple criteria and supports both print and Excel export formats.

---

## Features

### 1. Advanced Filtering

The report builder supports multi-select filtering on:

- **Categories**: Filter by project categories (HK Transaction, US Transaction, HK Compliance, US Compliance, Others)
- **Staff Roles**: Filter by staff positions (Income Partner, Associate, Senior FLIC, Junior FLIC, Intern, B&C Working Attorney)
- **Priorities**: Filter by project priority (High, Medium, Low)
- **Statuses**: Filter by project status (Active, Slow-down, Suspended)
- **Jurisdictions**: Filter by jurisdiction (US Law, HK Law, B&C)
- **Date Range**: Filter assignments by start/end date overlap

### 2. Real-Time Results

- Results update automatically as filters change
- Summary statistics displayed prominently:
  - Total assignments
  - Unique projects
  - Unique staff members
  - Average allocation percentage
- Active filters shown as chips for easy visibility

### 3. Data Display

Interactive table showing:
- Project Code & Name
- Category, Priority, Status
- EL Status & Timetable
- Staff Name, Role, Department
- Role in Project & Jurisdiction
- Allocation Percentage
- Lead designation
- Start/End dates

### 4. Export Options

#### Print (PDF)
- Click "Print" button to generate clean, printable layout
- Landscape orientation optimized for wide tables
- Professional formatting with header
- Automatic page breaks

#### Excel Export
- Click "Export to Excel" button
- Downloads formatted `.xlsx` file
- **Summary Sheet** includes:
  - Report metadata
  - Applied filters
  - Aggregate statistics
- **Data Sheet** includes:
  - All filtered data
  - Professional formatting
  - Auto-filter enabled
  - Frozen header row
  - Zebra striping for readability

---

## How to Use

### Accessing Reports

1. Log into the Staffing Tracker
2. Click "Reports" in the sidebar navigation
3. The Report Builder will open with default filters (current month)

### Applying Filters

1. Use the **filter sidebar** on the left
2. Select one or more options from each filter:
   - Click on dropdown to see available options
   - Select multiple values if needed
3. Choose date range using date pickers
4. Click **"Apply"** to update results
5. Click **"Reset"** to clear all filters

### Viewing Results

- Results appear in the data table on the right
- Summary statistics shown at the top
- Active filters displayed as chips
- Scroll horizontally/vertically as needed
- Sort by clicking column headers

### Printing

1. Apply desired filters
2. Click **"Print"** button
3. Browser print dialog will open
4. Adjust print settings if needed (recommended: Landscape)
5. Print or save as PDF

### Exporting to Excel

1. Apply desired filters
2. Click **"Export to Excel"** button
3. File will download automatically
4. Open in Excel, Google Sheets, or compatible software
5. File includes:
   - **Summary** sheet with filters and totals
   - **Data** sheet with all filtered records

---

## API Endpoints

### JSON Report
```
GET /api/reports/staffing
```

**Query Parameters**:
- `categories`: Comma-separated categories
- `staffRoles`: Comma-separated staff roles
- `priorities`: Comma-separated priorities
- `statuses`: Comma-separated statuses
- `jurisdictions`: Comma-separated jurisdictions
- `dateFrom`: ISO date string (YYYY-MM-DD)
- `dateTo`: ISO date string (YYYY-MM-DD)

**Response**:
```json
{
  "data": [
    {
      "projectCode": "ACM-001",
      "projectName": "Acme Merger",
      "category": "US Transaction Projects",
      "priority": "High",
      "status": "Active",
      "elStatus": "Due Diligence",
      "timetable": "Q1 2026",
      "staffName": "Jane Smith",
      "staffRole": "Associate",
      "staffDepartment": "US Law",
      "roleInProject": "Associate",
      "jurisdiction": "US Law",
      "allocationPct": 80,
      "isLead": false,
      "startDate": "2025-10-01T00:00:00.000Z",
      "endDate": "2025-12-31T00:00:00.000Z"
    }
  ],
  "meta": {
    "filters": { "categories": "US Transaction Projects", ... },
    "totals": {
      "rows": 124,
      "projects": 42,
      "staff": 28,
      "avgAllocationPct": 65.5
    }
  }
}
```

### Excel Export
```
GET /api/reports/staffing.xlsx
```

**Query Parameters**: Same as JSON endpoint

**Response**: Binary Excel file (.xlsx)

---

## Technical Details

### Backend Architecture

**Dependencies**:
- `zod` - Schema validation
- `exceljs` - Excel file generation
- `dayjs` - Date manipulation

**Files**:
- `backend/src/types/reports.types.ts` - TypeScript types and Zod schemas
- `backend/src/services/reports.service.ts` - Data fetching logic with Prisma
- `backend/src/services/reports.excel.ts` - Excel workbook generation
- `backend/src/controllers/reports.controller.ts` - Request handlers
- `backend/src/routes/reports.routes.ts` - Route definitions

### Frontend Architecture

**Dependencies**:
- `@mui/x-data-grid` - Interactive data table
- `@mui/x-date-pickers` - Date range selection
- `dayjs` - Date formatting
- `file-saver` - File download handling

**Files**:
- `frontend/src/pages/Reports.tsx` - Main report builder component
- `frontend/src/styles/print.css` - Print-specific styling

### Performance Considerations

- **Query Limit**: Backend limits to 10,000 assignments per query
- **Pagination**: Frontend DataGrid supports pagination (25/50/100/200 per page)
- **Indexing**: Database indexes on projectId, staffId for fast filtering
- **Caching**: Consider browser caching for frequently used filters

---

## Best Practices

### For Users

1. **Start Broad, Then Narrow**: Begin with broader filters and refine as needed
2. **Use Date Ranges**: Limit results by date for faster loading
3. **Export Regularly**: Download Excel reports for offline analysis
4. **Print Preview**: Always preview before printing to verify layout

### For Administrators

1. **Monitor Performance**: Watch for slow queries with many filters
2. **Data Quality**: Ensure project and staff data is complete for accurate reports
3. **Regular Exports**: Encourage monthly Excel exports for record-keeping
4. **Training**: Train users on effective filter combinations

---

## Troubleshooting

### Report Not Loading

- Check internet connection
- Verify authentication (log out and log back in)
- Clear browser cache
- Check browser console for errors

### Excel Export Fails

- Ensure pop-up blocker is disabled
- Check available disk space
- Verify browser supports file downloads
- Try different browser if issue persists

### Print Layout Issues

- Use landscape orientation
- Adjust print scale if needed (90-95% often works best)
- Ensure "Print backgrounds" is enabled in browser settings
- Consider using "Save as PDF" for consistent results

### Missing Data

- Verify filters are not too restrictive
- Check date range includes expected assignments
- Ensure projects/staff have proper category/role assignments
- Contact administrator if data appears incorrect

---

## Future Enhancements

Potential improvements for future versions:

- **Saved Filters**: Save frequently used filter combinations
- **Scheduled Reports**: Email reports automatically
- **Charts**: Add visualizations to report output
- **Custom Columns**: Allow users to select which columns to display
- **Grouping**: Group results by project or staff
- **Comparison Reports**: Compare time periods
- **Advanced Exports**: PDF export with charts, CSV format

---

## Support

For questions or issues with the reporting system:

1. Check this guide for common solutions
2. Review the API documentation
3. Contact your system administrator
4. Report bugs via GitHub issues

---

**Report Builder is now live and ready to use!**

Access it from the main navigation: **Reports** → **Staffing Report**
