import ExcelJS from 'exceljs';
import type { ReportRow, ReportQuery } from '../types/reports.types';

export async function buildStaffingWorkbook(rows: ReportRow[], filters: ReportQuery) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  // --- Summary Sheet ---
  const summary = wb.addWorksheet('Summary');
  const count = rows.length;
  const uniqueProjects = new Set(rows.map(r => r.name)).size;
  const uniqueStaff = new Set(rows.map(r => r.staffName)).size;
  const avg = count > 0
    ? rows.reduce((acc, r) => acc + r.allocationPct, 0) / count
    : 0;

  summary.addRows([
    ['Kirkland & Ellis - Staffing Report'],
    ['Generated:', new Date().toLocaleString()],
    [],
    ['FILTERS'],
    ['Categories', filters.categories || 'All'],
    ['Staff Roles', filters.staffRoles || 'All'],
    ['Priorities', filters.priorities || 'All'],
    ['Statuses', filters.statuses || 'All'],
    ['Jurisdictions', filters.jurisdictions || 'All'],
    ['Date From', filters.dateFrom || ''],
    ['Date To', filters.dateTo || ''],
    [],
    ['TOTALS'],
    ['Total Assignments', count],
    ['Unique Projects', uniqueProjects],
    ['Unique Staff', uniqueStaff],
    ['Avg Allocation %', Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0],
  ]);

  // Styling for summary
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF2563EB' } };
  summary.getRow(4).font = { bold: true, size: 12 };
  summary.getRow(13).font = { bold: true, size: 12 };
  summary.getColumn(1).width = 20;
  summary.getColumn(2).width = 40;

  // --- Data Sheet ---
  const ws = wb.addWorksheet('Data', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Project Code', key: 'name', width: 14 },
    { header: 'Project Name', key: 'projectName', width: 32 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'EL Status', key: 'elStatus', width: 16 },
    { header: 'Timetable', key: 'timetable', width: 20 },
    { header: 'Staff Name', key: 'staffName', width: 22 },
    { header: 'Staff Role', key: 'staffRole', width: 16 },
    { header: 'Department', key: 'staffDepartment', width: 14 },
    { header: 'Role in Project', key: 'roleInProject', width: 18 },
    { header: 'Jurisdiction', key: 'jurisdiction', width: 14 },
    { header: 'Allocation %', key: 'allocationPct', width: 12, style: { numFmt: '0' } },
    { header: 'Lead', key: 'isLead', width: 8 },
    { header: 'Start Date', key: 'startDate', width: 14 },
    { header: 'End Date', key: 'endDate', width: 14 },
  ];

  // Header styling
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 20;

  // Add data rows
  rows.forEach(r => {
    ws.addRow({
      name: r.name,
      projectName: r.projectName,
      category: r.category,
      priority: r.priority || '',
      status: r.status,
      elStatus: r.elStatus || '',
      timetable: r.timetable || '',
      staffName: r.staffName,
      staffRole: r.staffRole,
      staffDepartment: r.staffDepartment || '',
      roleInProject: r.roleInProject,
      jurisdiction: r.jurisdiction || '',
      allocationPct: r.allocationPct,
      isLead: r.isLead ? 'Yes' : 'No',
      startDate: r.startDate ? new Date(r.startDate).toISOString().split('T')[0] : '',
      endDate: r.endDate ? new Date(r.endDate).toISOString().split('T')[0] : '',
    });
  });

  // Zebra stripes and borders
  ws.eachRow((row, idx) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    if (idx > 1 && idx % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
    }
  });

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 16 },
  };

  return wb;
}
