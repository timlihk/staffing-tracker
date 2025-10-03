import ExcelJS from 'exceljs';
import type { ProjectReportRow, ProjectReportQuery } from './project-report.service';

export async function buildProjectReportWorkbook(
  rows: ProjectReportRow[],
  filters: ProjectReportQuery
) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  // --- Summary Sheet ---
  const summary = wb.addWorksheet('Summary');

  summary.addRows([
    ['Kirkland & Ellis - Project Report'],
    ['Generated:', new Date().toLocaleString()],
    [],
    ['FILTERS'],
    ['Categories', filters.categories || 'All'],
    ['Statuses', filters.statuses || 'All'],
    ['Priorities', filters.priorities || 'All'],
    ['Team Member', filters.staffId ? 'Filtered' : 'All'],
    [],
    ['TOTALS'],
    ['Total Projects', rows.length],
  ]);

  // Styling for summary
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF2563EB' } };
  summary.getRow(4).font = { bold: true, size: 12 };
  summary.getRow(10).font = { bold: true, size: 12 };
  summary.getColumn(1).width = 20;
  summary.getColumn(2).width = 40;

  // --- Data Sheet ---
  const ws = wb.addWorksheet('Project Report', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Project', key: 'projectName', width: 28 },
    { header: 'Filing Date', key: 'filingDate', width: 14 },
    { header: 'Listing Date', key: 'listingDate', width: 14 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'US - Partner', key: 'usLawPartner', width: 20 },
    { header: 'US - Associate', key: 'usLawAssociate', width: 20 },
    { header: 'US - Sr FLIC', key: 'usLawSeniorFlic', width: 20 },
    { header: 'US - Jr FLIC', key: 'usLawJuniorFlic', width: 20 },
    { header: 'US - Intern', key: 'usLawIntern', width: 20 },
    { header: 'HK - Partner', key: 'hkLawPartner', width: 20 },
    { header: 'HK - Associate', key: 'hkLawAssociate', width: 20 },
    { header: 'HK - Sr FLIC', key: 'hkLawSeniorFlic', width: 20 },
    { header: 'HK - Jr FLIC', key: 'hkLawJuniorFlic', width: 20 },
    { header: 'HK - Intern', key: 'hkLawIntern', width: 20 },
    { header: 'B&C Attorney', key: 'bcAttorney', width: 20 },
    { header: 'Milestone', key: 'milestone', width: 30 },
    { header: 'Notes', key: 'notes', width: 40 },
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
  rows.forEach((r) => {
    ws.addRow({
      projectName: r.projectName,
      filingDate: r.filingDate ? new Date(r.filingDate).toISOString().split('T')[0] : '',
      listingDate: r.listingDate ? new Date(r.listingDate).toISOString().split('T')[0] : '',
      category: r.category,
      usLawPartner: r.usLawPartner || '',
      usLawAssociate: r.usLawAssociate || '',
      usLawSeniorFlic: r.usLawSeniorFlic || '',
      usLawJuniorFlic: r.usLawJuniorFlic || '',
      usLawIntern: r.usLawIntern || '',
      hkLawPartner: r.hkLawPartner || '',
      hkLawAssociate: r.hkLawAssociate || '',
      hkLawSeniorFlic: r.hkLawSeniorFlic || '',
      hkLawJuniorFlic: r.hkLawJuniorFlic || '',
      hkLawIntern: r.hkLawIntern || '',
      bcAttorney: r.bcAttorney || '',
      milestone: r.milestone || '',
      notes: r.notes || '',
    });
  });

  // Zebra stripes and borders
  ws.eachRow((row, idx) => {
    row.eachCell((cell) => {
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
    to: { row: 1, column: 17 },
  };

  return wb;
}
