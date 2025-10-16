import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TimeFeesRow {
  cmNo: string;
  feesBilled: number;
  collected: number;
  ar: number;
}

interface UAReportRow {
  cmNo: string;
  ubt: number;
}

async function readExcelData() {
  const filePath = '/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List_20251008_with formulas & source reports.xlsx';

  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);

  // Read Time & Fees reports sheet
  console.log('\nProcessing Time & Fees reports sheet...');
  const timeFeesSheet = workbook.Sheets['Time & Fees reports'];
  if (!timeFeesSheet) {
    throw new Error('Sheet "Time & Fees reports" not found');
  }

  const timeFeesData = XLSX.utils.sheet_to_json(timeFeesSheet, { header: 1 }) as any[][];

  // Time & Fees sheet has no header row, data starts from row 0
  // C/M number is in column 9 (Mttr#)
  // Fees Billed is in column Q (index 16)
  // Collected is in column W (index 22)
  // A/R is in column X (index 23)
  const cmColIndex = 9;
  const feesBilledColIndex = 16; // Column Q (0-indexed: Q = 16)
  const collectedColIndex = 22; // Column W (0-indexed: W = 22)
  const arColIndex = 23; // Column X (0-indexed: X = 23)

  console.log(`Using CM No column at index ${cmColIndex}`);

  const timeFeesMap = new Map<string, TimeFeesRow>();

  // Process all data rows (no header row)
  for (let i = 0; i < timeFeesData.length; i++) {
      const row = timeFeesData[i];
      const cmNo = row[cmColIndex];

      if (cmNo && String(cmNo).trim()) {
        const cmNoStr = String(cmNo).trim();
        const feesBilled = parseFloat(row[feesBilledColIndex]) || 0;
        const collected = parseFloat(row[collectedColIndex]) || 0;
        const ar = parseFloat(row[arColIndex]) || 0;

        timeFeesMap.set(cmNoStr, {
          cmNo: cmNoStr,
          feesBilled,
          collected,
          ar
        });
      }
  }

  console.log(`Extracted ${timeFeesMap.size} rows from Time & Fees reports (sample C/M numbers: ${Array.from(timeFeesMap.keys()).slice(0, 5).join(', ')})`);

  // Read UA Report sheet
  console.log('\nProcessing UA Report sheet...');
  const uaSheet = workbook.Sheets['UA Report'];
  if (!uaSheet) {
    throw new Error('Sheet "UA Report" not found');
  }

  const uaData = XLSX.utils.sheet_to_json(uaSheet, { header: 1 }) as any[][];

  // UA Report has header row at index 0
  // C/M number is in column 0 (Client matter)
  // UBT is in column AE (index 30)
  const uaHeaderRowIndex = 0;
  const uaCmColIndex = 0; // Client matter column
  const ubtColIndex = 30; // Column AE (0-indexed: AE = 30)

  console.log(`Using header row at index ${uaHeaderRowIndex}, CM No column at index ${uaCmColIndex}`);

  const uaMap = new Map<string, UAReportRow>();

  // Process data rows (start from row 1, after header)
  for (let i = uaHeaderRowIndex + 1; i < uaData.length; i++) {
      const row = uaData[i];
      const cmNo = row[uaCmColIndex];

      if (cmNo && String(cmNo).trim()) {
        const cmNoStr = String(cmNo).trim();
        const ubt = parseFloat(row[ubtColIndex]) || 0;

        uaMap.set(cmNoStr, {
          cmNo: cmNoStr,
          ubt
        });
      }
  }

  console.log(`Extracted ${uaMap.size} rows from UA Report (sample C/M numbers: ${Array.from(uaMap.keys()).slice(0, 5).join(', ')})`);

  return { timeFeesMap, uaMap };
}

async function updateBillingData() {
  try {
    const { timeFeesMap, uaMap } = await readExcelData();

    console.log('\n=== Sample Data ===');
    console.log('\nTime & Fees (first 5):');
    Array.from(timeFeesMap.entries()).slice(0, 5).forEach(([cmNo, data]) => {
      console.log(`  ${cmNo}: Billed=${data.feesBilled}, Collected=${data.collected}, A/R=${data.ar}`);
    });

    console.log('\nUA Report (first 5):');
    Array.from(uaMap.entries()).slice(0, 5).forEach(([cmNo, data]) => {
      console.log(`  ${cmNo}: UBT=${data.ubt}`);
    });

    // Get all CM numbers from database
    console.log('\n=== Matching with Database ===');
    const allCmNos = await prisma.billing_project_cm_no.findMany({
      select: {
        cm_id: true,
        cm_no: true,
        project_id: true
      }
    });

    console.log(`Found ${allCmNos.length} CM numbers in database`);

    let matchedCount = 0;
    let updatedCount = 0;

    for (const cmRecord of allCmNos) {
      const cmNo = cmRecord.cm_no.trim();
      const timeFeesData = timeFeesMap.get(cmNo);
      const uaData = uaMap.get(cmNo);

      if (timeFeesData || uaData) {
        matchedCount++;
        console.log(`\nUpdating CM No: ${cmNo}`);

        const updateData: any = {
          financials_updated_at: new Date()
        };

        // Update billing to date (fees billed)
        if (timeFeesData && timeFeesData.feesBilled !== 0) {
          updateData.billing_to_date_usd = timeFeesData.feesBilled;
          console.log(`  - Billing to date: $${timeFeesData.feesBilled.toLocaleString()}`);
        }

        // Update collected to date
        if (timeFeesData && timeFeesData.collected !== 0) {
          updateData.collected_to_date_usd = timeFeesData.collected;
          console.log(`  - Collected to date: $${timeFeesData.collected.toLocaleString()}`);
        }

        // A/R is calculated as billing - collected, but we can store it for reference
        // Note: The user mentioned A/R in column X, so we'll note it but not store separately
        if (timeFeesData && timeFeesData.ar !== 0) {
          console.log(`  - A/R (reference): $${timeFeesData.ar.toLocaleString()}`);
        }

        // Update UBT
        if (uaData && uaData.ubt !== 0) {
          updateData.ubt_usd = uaData.ubt;
          console.log(`  - UBT: $${uaData.ubt.toLocaleString()}`);
        }

        if (Object.keys(updateData).length > 1) { // More than just financials_updated_at
          await prisma.billing_project_cm_no.update({
            where: { cm_id: cmRecord.cm_id },
            data: updateData
          });
          updatedCount++;
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total CM numbers in database: ${allCmNos.length}`);
    console.log(`Matched CM numbers from Excel: ${matchedCount}`);
    console.log(`Updated CM numbers: ${updatedCount}`);
    console.log(`\nNote: A/R is not stored separately as it's calculated as (billing_to_date - collected_to_date)`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBillingData();
