import ExcelJS from 'exceljs';

export interface BillingExportExcelRow {
  projectId: number;
  cmNumbers: string;
  projectName: string;
  bcAttorneyName: string;
  sca: string;
  agreedFeeUsd: number;
  milestoneStatus: string;
  milestones: { milestoneId: number; title: string; completed: boolean }[];
  billingUsd: number;
  collectionUsd: number;
  billingCreditUsd: number;
  ubtUsd: number;
  arUsd: number;
  notes: string;
}

interface ExcelFilters {
  attorneys?: string;
  statuses?: string;
}

const HEADER_BG = 'FF1E3A5F';
const HEADER_FG = 'FFFFFFFF';
const ZEBRA_BG = 'FFF8FAFC';
const BORDER_COLOR = 'FFE5E7EB';
const TOTALS_BG = 'FFF1F5F9';

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

const usdFormat = '#,##0';
const usdFormat2 = '#,##0.00';

export async function buildBillingExportWorkbook(
  rows: BillingExportExcelRow[],
  filters: ExcelFilters,
) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  // --- Summary Sheet ---
  const summary = wb.addWorksheet('Summary');
  summary.addRows([
    ['Billing Control Tower Report'],
    ['Generated:', new Date().toLocaleString()],
    [],
    ['FILTERS'],
    ['B&C Attorney', filters.attorneys || 'All'],
    ['Status', filters.statuses || 'All'],
    [],
    ['TOTALS'],
    ['Total Projects', rows.length],
    ['Total Fee (US$)', rows.reduce((s, r) => s + (r.agreedFeeUsd || 0), 0)],
    ['Total Billing ($)', rows.reduce((s, r) => s + (r.billingUsd || 0), 0)],
    ['Total Collections ($)', rows.reduce((s, r) => s + (r.collectionUsd || 0), 0)],
    ['Total Billing Credit ($)', rows.reduce((s, r) => s + (r.billingCreditUsd || 0), 0)],
    ['Total UBT ($)', rows.reduce((s, r) => s + (r.ubtUsd || 0), 0)],
    ['Total AR ($)', rows.reduce((s, r) => s + (r.arUsd || 0), 0)],
  ]);

  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF2563EB' } };
  summary.getRow(4).font = { bold: true, size: 12 };
  summary.getRow(8).font = { bold: true, size: 12 };
  summary.getColumn(1).width = 24;
  summary.getColumn(2).width = 40;

  // Format currency cells in summary
  for (let r = 10; r <= 15; r++) {
    const cell = summary.getCell(r, 2);
    cell.numFmt = usdFormat2;
  }

  // --- Data Sheet ---
  const ws = wb.addWorksheet('Billing Report', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  ws.columns = [
    { header: 'C/M Number', key: 'cmNumbers', width: 14 },
    { header: 'Project Name', key: 'projectName', width: 30 },
    { header: 'B&C Attorney', key: 'bcAttorneyName', width: 18 },
    { header: 'SCA', key: 'sca', width: 10 },
    { header: 'Fee (US$)', key: 'agreedFeeUsd', width: 14 },
    { header: 'Milestone', key: 'milestones', width: 36 },
    { header: 'Billing ($)', key: 'billingUsd', width: 14 },
    { header: 'Collections ($)', key: 'collectionUsd', width: 14 },
    { header: 'Billing Credit ($)', key: 'billingCreditUsd', width: 16 },
    { header: 'UBT ($)', key: 'ubtUsd', width: 12 },
    { header: 'AR ($)', key: 'arUsd', width: 12 },
    { header: 'Notes', key: 'notes', width: 32 },
  ];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: HEADER_FG }, size: 10 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: HEADER_BG },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;

  // Add data rows
  rows.forEach((r) => {
    // Format milestones as multiline text
    const ms = r.milestones ?? [];
    let milestoneText = '';
    if (ms.length) {
      const done = ms.filter((m) => m.completed).length;
      const lines = ms.map((m) => `${m.completed ? '\u2713' : '\u25CB'} ${m.title}`);
      milestoneText = `${done}/${ms.length}\n${lines.join('\n')}`;
    }

    ws.addRow({
      cmNumbers: r.cmNumbers || '\u2014',
      projectName: r.projectName,
      bcAttorneyName: r.bcAttorneyName,
      sca: r.sca || '',
      agreedFeeUsd: r.agreedFeeUsd || 0,
      milestones: milestoneText || '\u2014',
      billingUsd: r.billingUsd || 0,
      collectionUsd: r.collectionUsd || 0,
      billingCreditUsd: r.billingCreditUsd || 0,
      ubtUsd: r.ubtUsd || 0,
      arUsd: r.arUsd || 0,
      notes: r.notes || '',
    });
  });

  // Totals row
  const totalsRowNum = rows.length + 2; // +1 for header, +1 for 1-indexed
  const totalsRow = ws.addRow({
    cmNumbers: '',
    projectName: `Total (${rows.length} projects)`,
    bcAttorneyName: '',
    sca: '',
    agreedFeeUsd: rows.reduce((s, r) => s + (r.agreedFeeUsd || 0), 0),
    milestones: '',
    billingUsd: rows.reduce((s, r) => s + (r.billingUsd || 0), 0),
    collectionUsd: rows.reduce((s, r) => s + (r.collectionUsd || 0), 0),
    billingCreditUsd: rows.reduce((s, r) => s + (r.billingCreditUsd || 0), 0),
    ubtUsd: rows.reduce((s, r) => s + (r.ubtUsd || 0), 0),
    arUsd: rows.reduce((s, r) => s + (r.arUsd || 0), 0),
    notes: '',
  });
  totalsRow.font = { bold: true };
  totalsRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: TOTALS_BG },
  };

  // Currency columns: 5 (Fee), 7 (Billing), 8 (Collections), 9 (Billing Credit), 10 (UBT), 11 (AR)
  const currencyCols = [5, 7, 8, 9, 10, 11];

  // Style data rows
  ws.eachRow((row, idx) => {
    if (idx === 1) return; // skip header

    // Borders on every cell
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
    });

    // Zebra stripe
    if (idx > 1 && idx < totalsRowNum && idx % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ZEBRA_BG },
      };
    }

    // Wrap text on milestone and notes columns, and project name
    row.getCell(2).alignment = { vertical: 'top', wrapText: true }; // Project Name
    row.getCell(6).alignment = { vertical: 'top', wrapText: true }; // Milestone
    row.getCell(12).alignment = { vertical: 'top', wrapText: true }; // Notes

    // Currency formatting
    currencyCols.forEach((col) => {
      const cell = row.getCell(col);
      if (idx === totalsRowNum) {
        cell.numFmt = usdFormat2;
      } else {
        cell.numFmt = usdFormat;
      }
      cell.alignment = { horizontal: 'right' };
    });
  });

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 },
  };

  return wb;
}
