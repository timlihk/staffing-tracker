import { buildBillingExportWorkbook, type BillingExportExcelRow } from '../services/billing-export.excel';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleRows: BillingExportExcelRow[] = [
  {
    projectId: 1,
    cmNumbers: 'CM-001',
    projectName: 'Test Project Alpha',
    bcAttorneyName: 'John Smith',
    sca: 'SCA-A',
    agreedFeeUsd: 500000,
    milestoneStatus: '2/3',
    milestones: [
      { milestoneId: 1, title: 'Due Diligence', completed: true },
      { milestoneId: 2, title: 'Filing', completed: true },
      { milestoneId: 3, title: 'Closing', completed: false },
    ],
    billingUsd: 300000,
    collectionUsd: 250000,
    billingCreditUsd: 10000,
    ubtUsd: 40000,
    arUsd: 50000,
    notes: 'On track',
  },
  {
    projectId: 2,
    cmNumbers: 'CM-002',
    projectName: '测试项目 Beta (Chinese Test)',
    bcAttorneyName: '李明',
    sca: '',
    agreedFeeUsd: 200000,
    milestoneStatus: '0/0',
    milestones: [],
    billingUsd: 100000,
    collectionUsd: 80000,
    billingCreditUsd: 0,
    ubtUsd: 20000,
    arUsd: 0,
    notes: '备注：中文字符测试',
  },
  {
    projectId: 3,
    cmNumbers: 'CM-003, CM-004',
    projectName: 'Multi-CM Project',
    bcAttorneyName: 'Jane Doe',
    sca: 'SCA-B',
    agreedFeeUsd: 0,
    milestoneStatus: '1/1',
    milestones: [
      { milestoneId: 10, title: 'Completion', completed: true },
    ],
    billingUsd: 0,
    collectionUsd: 0,
    billingCreditUsd: 0,
    ubtUsd: 0,
    arUsd: 0,
    notes: '',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildBillingExportWorkbook', () => {
  it('should create a workbook with Summary and Data sheets', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});

    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain('Summary');
    expect(sheetNames).toContain('Billing Report');
  });

  it('should have correct number of data rows plus header and totals', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    // 1 header + 3 data rows + 1 totals = 5 rows
    expect(ws.rowCount).toBe(5);
  });

  it('should have 12 columns in the data sheet', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    expect(ws.columns?.length).toBe(12);
  });

  it('should set correct header labels', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;
    const headerRow = ws.getRow(1);

    const expectedHeaders = [
      'C/M Number', 'Project Name', 'B&C Attorney', 'SCA', 'Fee (US$)',
      'Milestone', 'Billing ($)', 'Collections ($)', 'Billing Credit ($)',
      'UBT ($)', 'AR ($)', 'Notes',
    ];

    expectedHeaders.forEach((header, idx) => {
      expect(headerRow.getCell(idx + 1).value).toBe(header);
    });
  });

  it('should populate data rows with correct values', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    // Row 2 = first data row
    const row2 = ws.getRow(2);
    expect(row2.getCell(1).value).toBe('CM-001');             // C/M Number
    expect(row2.getCell(2).value).toBe('Test Project Alpha'); // Project Name
    expect(row2.getCell(3).value).toBe('John Smith');         // B&C Attorney
    expect(row2.getCell(4).value).toBe('SCA-A');              // SCA
    expect(row2.getCell(5).value).toBe(500000);               // Fee
    expect(row2.getCell(7).value).toBe(300000);               // Billing
    expect(row2.getCell(8).value).toBe(250000);               // Collections
    expect(row2.getCell(12).value).toBe('On track');          // Notes
  });

  it('should format milestones as multiline text with checkmarks', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    const milestoneCell = ws.getRow(2).getCell(6).value as string;
    expect(milestoneCell).toContain('2/3');
    expect(milestoneCell).toContain('\u2713'); // ✓ for completed
    expect(milestoneCell).toContain('\u25CB'); // ○ for pending
    expect(milestoneCell).toContain('Due Diligence');
    expect(milestoneCell).toContain('Closing');
  });

  it('should show em-dash for rows with no milestones', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    // Row 3 = second data row (no milestones)
    const milestoneCell = ws.getRow(3).getCell(6).value as string;
    expect(milestoneCell).toBe('\u2014');
  });

  it('should handle Chinese characters in project name, attorney, and notes', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    // Row 3 = second data row (Chinese characters)
    const row3 = ws.getRow(3);
    expect(row3.getCell(2).value).toContain('测试项目');
    expect(row3.getCell(3).value).toBe('李明');
    expect(row3.getCell(12).value).toContain('中文字符测试');
  });

  it('should compute correct totals in the last row', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    // Totals row = row 5 (header + 3 data + 1 totals)
    const totalsRow = ws.getRow(5);
    expect(totalsRow.getCell(2).value).toContain('Total (3 projects)');
    expect(totalsRow.getCell(5).value).toBe(700000);   // 500k + 200k + 0
    expect(totalsRow.getCell(7).value).toBe(400000);   // 300k + 100k + 0
    expect(totalsRow.getCell(8).value).toBe(330000);   // 250k + 80k + 0
    expect(totalsRow.getCell(9).value).toBe(10000);    // 10k + 0 + 0
    expect(totalsRow.getCell(10).value).toBe(60000);   // 40k + 20k + 0
    expect(totalsRow.getCell(11).value).toBe(50000);   // 50k + 0 + 0
  });

  it('should make totals row bold', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    const totalsRow = ws.getRow(5);
    expect(totalsRow.font?.bold).toBe(true);
  });

  it('should set frozen pane on data sheet', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    const views = ws.views;
    expect(views.length).toBeGreaterThan(0);
    expect(views[0].state).toBe('frozen');
    expect(views[0].ySplit).toBe(1);
  });

  it('should include auto-filter', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});
    const ws = wb.getWorksheet('Billing Report')!;

    expect(ws.autoFilter).toBeDefined();
  });

  it('should populate summary sheet with filters and totals', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {
      attorneys: '1,2',
      statuses: 'active,suspended',
    });
    const summary = wb.getWorksheet('Summary')!;

    // Row 1: Title
    expect(summary.getRow(1).getCell(1).value).toBe('Billing Control Tower Report');

    // Row 5: Attorney filter
    expect(summary.getRow(5).getCell(1).value).toBe('B&C Attorney');
    expect(summary.getRow(5).getCell(2).value).toBe('1,2');

    // Row 6: Status filter
    expect(summary.getRow(6).getCell(1).value).toBe('Status');
    expect(summary.getRow(6).getCell(2).value).toBe('active,suspended');

    // Row 9: Total Projects
    expect(summary.getRow(9).getCell(2).value).toBe(3);
  });

  it('should write to buffer without errors', async () => {
    const wb = await buildBillingExportWorkbook(sampleRows, {});

    const buffer = await wb.xlsx.writeBuffer();
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should handle empty rows array', async () => {
    const wb = await buildBillingExportWorkbook([], {});
    const ws = wb.getWorksheet('Billing Report')!;

    // Only header row + totals row
    expect(ws.rowCount).toBe(2);

    const totalsRow = ws.getRow(2);
    expect(totalsRow.getCell(2).value).toContain('Total (0 projects)');
    expect(totalsRow.getCell(5).value).toBe(0);
  });
});
