/**
 * Update Billing Financials from Excel
 * 
 * Reads the new Excel format (single "Transactions" sheet) and updates
 * billing_project_cm_no table with:
 * - Fees (US$) -> billing_to_date_usd
 * - Billing (US$) -> billing_to_date_usd  
 * - Collection (US$) -> collected_to_date_usd
 * - Billing Credit (US$) -> billing_credit_usd
 * - UBT (US$) -> ubt_usd
 */

import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ExcelRow {
  cmNo: string;
  feesUsd: number;
  billingUsd: number;
  collectionUsd: number;
  billingCreditUsd: number;
  ubtUsd: number;
  arUsd: number;
  projectName: string;
  clientName: string;
  attorneyInCharge: string;
}

function parseAmount(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove commas, $, and any whitespace
    const cleaned = value.replace(/[,$?\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

async function readExcelData(): Promise<Map<string, ExcelRow>> {
  const filePath = '/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List (2026.02.12).xlsx';

  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(filePath);
  
  // Check for "Transactions" sheet
  const sheetName = 'Transactions';
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  console.log(`Total rows in sheet: ${data.length}`);

  // Headers are in row 4 (index 3)
  const headers = data[3];
  console.log('\nHeaders:', headers);

  // Find column indices by header name
  const colIndex: Record<string, number> = {};
  headers.forEach((header, idx) => {
    if (header) {
      const headerStr = String(header).trim();
      if (headerStr.includes('C/M No')) colIndex['cmNo'] = idx;
      else if (headerStr.includes('Fees (US$)')) colIndex['feesUsd'] = idx;
      else if (headerStr.includes('Billing \r\n(US$)') || headerStr.includes('Billing (US$)')) colIndex['billingUsd'] = idx;
      else if (headerStr.includes('Collection \r\n(US$)') || headerStr.includes('Collection (US$)')) colIndex['collectionUsd'] = idx;
      else if (headerStr.includes('Billing Credit \r\n(US$)') || headerStr.includes('Billing Credit (US$)')) colIndex['billingCreditUsd'] = idx;
      else if (headerStr.includes('UBT') && headerStr.includes('US$')) colIndex['ubtUsd'] = idx;
      else if (headerStr.includes('AR') && headerStr.includes('US$')) colIndex['arUsd'] = idx;
      else if (headerStr.includes('Project Name')) colIndex['projectName'] = idx;
      else if (headerStr.includes('Client Name')) colIndex['clientName'] = idx;
      else if (headerStr.includes('Attorney in Charge')) colIndex['attorneyInCharge'] = idx;
    }
  });

  console.log('\nColumn mapping:', colIndex);

  // Data starts from row 5 (index 4)
  const excelMap = new Map<string, ExcelRow>();

  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Skip rows that are category headers (like "IPOs", "Corporate", etc.)
    const maybeNo = row[1];
    if (maybeNo === undefined || maybeNo === null) continue;
    
    // If column B is not a number, it's a category header row - skip
    if (typeof maybeNo !== 'number') continue;

    const cmNo = colIndex['cmNo'] !== undefined ? row[colIndex['cmNo']] : null;
    if (!cmNo || String(cmNo).trim() === '') continue;

    const cmNoStr = String(cmNo).trim();
    
    const excelRow: ExcelRow = {
      cmNo: cmNoStr,
      feesUsd: colIndex['feesUsd'] !== undefined ? parseAmount(row[colIndex['feesUsd']]) : 0,
      billingUsd: colIndex['billingUsd'] !== undefined ? parseAmount(row[colIndex['billingUsd']]) : 0,
      collectionUsd: colIndex['collectionUsd'] !== undefined ? parseAmount(row[colIndex['collectionUsd']]) : 0,
      billingCreditUsd: colIndex['billingCreditUsd'] !== undefined ? parseAmount(row[colIndex['billingCreditUsd']]) : 0,
      ubtUsd: colIndex['ubtUsd'] !== undefined ? parseAmount(row[colIndex['ubtUsd']]) : 0,
      arUsd: colIndex['arUsd'] !== undefined ? parseAmount(row[colIndex['arUsd']]) : 0,
      projectName: colIndex['projectName'] !== undefined ? String(row[colIndex['projectName']] || '') : '',
      clientName: colIndex['clientName'] !== undefined ? String(row[colIndex['clientName']] || '') : '',
      attorneyInCharge: colIndex['attorneyInCharge'] !== undefined ? String(row[colIndex['attorneyInCharge']] || '') : '',
    };

    excelMap.set(cmNoStr, excelRow);
  }

  console.log(`\nExtracted ${excelMap.size} rows from Excel`);
  console.log('Sample C/M numbers:', Array.from(excelMap.keys()).slice(0, 10).join(', '));

  return excelMap;
}

async function updateBillingData() {
  try {
    const excelMap = await readExcelData();

    console.log('\n=== Sample Data (first 5) ===');
    Array.from(excelMap.entries()).slice(0, 5).forEach(([cmNo, data]) => {
      console.log(`  ${cmNo}: Fees=$${data.feesUsd.toLocaleString()}, Billing=$${data.billingUsd.toLocaleString()}, Collection=$${data.collectionUsd.toLocaleString()}, UBT=$${data.ubtUsd.toLocaleString()}`);
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
      const excelData = excelMap.get(cmNo);

      if (excelData) {
        matchedCount++;
        console.log(`\nUpdating CM No: ${cmNo} (${excelData.projectName})`);

        const updateData: any = {
          financials_updated_at: new Date()
        };

        // Use Billing column as primary, fall back to Fees if Billing is 0
        const billingValue = excelData.billingUsd || excelData.feesUsd;
        if (billingValue > 0) {
          updateData.billing_to_date_usd = billingValue;
          console.log(`  - Billing to date: $${billingValue.toLocaleString()}`);
        }

        if (excelData.collectionUsd > 0) {
          updateData.collected_to_date_usd = excelData.collectionUsd;
          console.log(`  - Collected to date: $${excelData.collectionUsd.toLocaleString()}`);
        }

        if (excelData.billingCreditUsd > 0) {
          updateData.billing_credit_usd = excelData.billingCreditUsd;
          console.log(`  - Billing Credit: $${excelData.billingCreditUsd.toLocaleString()}`);
        }

        if (excelData.ubtUsd > 0) {
          updateData.ubt_usd = excelData.ubtUsd;
          console.log(`  - UBT: $${excelData.ubtUsd.toLocaleString()}`);
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

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBillingData();
