/**
 * Parse Fee Arrangements and Update Database
 *
 * This script:
 * 1. Reads the Excel file to get agreed fees for each project
 * 2. Parses fee arrangement text to extract LSD and milestones
 * 3. Updates the billing database
 */

import * as XLSX from 'xlsx';
import prisma from '../utils/prisma';

interface ParsedMilestone {
  ordinal: string; // e.g., "(a)", "(b)", "(c)"
  title: string;
  description: string;
  trigger_text: string;
  amount_value: number | null;
  is_percent: boolean;
  percent_value: number | null;
  sort_order: number;
}

interface ParsedFeeArrangement {
  lsd_date: Date | null;
  lsd_raw: string | null;
  milestones: ParsedMilestone[];
}

/**
 * Parse LSD (Long Stop Date) from text
 * Example: "(LSD: 31 Dec 2025)"
 */
function parseLSD(text: string): { date: Date | null; raw: string | null } {
  const lsdMatch = text.match(/\(LSD:\s*([^)]+)\)/i);
  if (!lsdMatch) return { date: null, raw: null };

  const lsdText = lsdMatch[1].trim();

  // Try to parse date in format: "31 Dec 2025"
  const dateMatch = lsdText.match(/(\d{1,2})\s+(\w{3,})\s+(\d{4})/);
  if (dateMatch) {
    const [, day, monthStr, year] = dateMatch;
    const monthMap: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };

    const month = monthMap[monthStr.toLowerCase()];
    if (month !== undefined) {
      return {
        date: new Date(parseInt(year), month, parseInt(day)),
        raw: lsdText,
      };
    }
  }

  return { date: null, raw: lsdText };
}

/**
 * Parse milestones from fee arrangement text
 * Example: "(a) 签署本协议后的20个工作日内(25%) - 226,000"
 */
function parseMilestones(text: string): ParsedMilestone[] {
  const milestones: ParsedMilestone[] = [];

  // Match patterns like: (a) description (percentage%) - amount
  const milestoneRegex = /\(([a-z])\)\s*([^(]+?)(?:\((\d+(?:\.\d+)?)%\))?\s*-\s*([\d,]+)/gi;

  let match;
  let sortOrder = 1;

  while ((match = milestoneRegex.exec(text)) !== null) {
    const [, ordinal, description, percentStr, amountStr] = match;

    const amount = parseFloat(amountStr.replace(/,/g, ''));
    const percent = percentStr ? parseFloat(percentStr) : null;

    milestones.push({
      ordinal: `(${ordinal})`,
      title: description.trim().substring(0, 100), // First 100 chars as title
      description: description.trim(),
      trigger_text: description.trim(),
      amount_value: amount,
      is_percent: !!percent,
      percent_value: percent,
      sort_order: sortOrder++,
    });
  }

  return milestones;
}

/**
 * Parse full fee arrangement text
 */
function parseFeeArrangement(rawText: string): ParsedFeeArrangement {
  const { date: lsd_date, raw: lsd_raw } = parseLSD(rawText);
  const milestones = parseMilestones(rawText);

  return {
    lsd_date,
    lsd_raw,
    milestones,
  };
}

/**
 * Read Excel file and extract fee data
 */
async function readExcelFees(filePath: string): Promise<Map<string, number>> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  // Find column indexes
  let cmNoCol = -1;
  let feeCol = -1;

  // Look for headers in first few rows
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (cell.includes('c/m') || cell.includes('cm no')) {
        cmNoCol = j;
      }
      if (cell.includes('fee') && cell.includes('us')) {
        feeCol = j;
      }
    }
    if (cmNoCol >= 0 && feeCol >= 0) break;
  }

  if (cmNoCol < 0 || feeCol < 0) {
    throw new Error('Could not find C/M No or Fees (US$) columns in Excel');
  }

  // Build map of C/M No -> Fee
  const feeMap = new Map<string, number>();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cmNo = String(row[cmNoCol] || '').trim();
    const feeStr = String(row[feeCol] || '').trim();

    if (!cmNo || !feeStr) continue;

    // Parse fee value (handle formats like "1,130,000" or "$1130000")
    const feeValue = parseFloat(feeStr.replace(/[\$,]/g, ''));
    if (!isNaN(feeValue) && feeValue > 0) {
      feeMap.set(cmNo, feeValue);
    }
  }

  console.log(`Loaded ${feeMap.size} fee entries from Excel`);
  return feeMap;
}

/**
 * Update database with parsed fee arrangements and agreed fees
 */
async function updateBillingData() {
  try {
    console.log('Reading Excel file...');
    const excelPath = '/home/timlihk/staffing-tracker/billing-matter/HKCM Project List(81764217.1)_6Oct25.xlsx';
    const feeMap = await readExcelFees(excelPath);

    console.log('\nFetching all fee arrangements...');
    const feeArrangements = await prisma.$queryRaw<any[]>`
      SELECT fa.fee_id, fa.raw_text, fa.engagement_id,
             bp.project_id, bp.project_name,
             string_agg(pcm.cm_no, ', ') as cm_numbers
      FROM billing_fee_arrangement fa
      JOIN billing_engagement be ON fa.engagement_id = be.engagement_id
      JOIN billing_project bp ON be.project_id = bp.project_id
      LEFT JOIN billing_project_cm_no pcm ON bp.project_id = pcm.project_id
      GROUP BY fa.fee_id, fa.raw_text, fa.engagement_id, bp.project_id, bp.project_name
    `;

    console.log(`Found ${feeArrangements.length} fee arrangements to parse`);

    let parsedCount = 0;
    let updatedFeeCount = 0;

    for (const fa of feeArrangements) {
      // Parse fee arrangement
      const parsed = parseFeeArrangement(fa.raw_text);

      // Update fee arrangement with LSD
      if (parsed.lsd_date || parsed.lsd_raw) {
        await prisma.$executeRaw`
          UPDATE billing_fee_arrangement
          SET lsd_date = ${parsed.lsd_date},
              lsd_raw = ${parsed.lsd_raw},
              parsed_at = NOW(),
              parser_version = 'v1.0'
          WHERE fee_id = ${fa.fee_id}
        `;
      }

      // Delete existing milestones and insert new ones
      await prisma.$transaction(async (tx) => {
        // Delete existing milestones for this fee arrangement
        await tx.$executeRaw`
          DELETE FROM billing_milestone WHERE fee_id = ${fa.fee_id}
        `;

        // Insert parsed milestones (with UPSERT to handle duplicates)
        for (const milestone of parsed.milestones) {
          await tx.$executeRaw`
            INSERT INTO billing_milestone (
              fee_id, ordinal, title, description, trigger_type, trigger_text,
              amount_value, amount_currency, is_percent, percent_value,
              completed, raw_fragment, sort_order
            ) VALUES (
              ${fa.fee_id},
              ${milestone.ordinal},
              ${milestone.title},
              ${milestone.description},
              'date_based',
              ${milestone.trigger_text},
              ${milestone.amount_value},
              'USD',
              ${milestone.is_percent},
              ${milestone.percent_value},
              false,
              ${milestone.description},
              ${milestone.sort_order}
            )
            ON CONFLICT (fee_id, ordinal) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              amount_value = EXCLUDED.amount_value,
              sort_order = EXCLUDED.sort_order,
              updated_at = NOW()
          `;
        }
      });

      // Check if Excel has fee data for reporting
      const cmNumbers = (fa.cm_numbers || '').split(', ');
      for (const cmNo of cmNumbers) {
        if (feeMap.has(cmNo)) {
          const excelFee = feeMap.get(cmNo)!;
          const calculatedFee = parsed.milestones.reduce((sum, m) => sum + (m.amount_value || 0), 0);
          if (Math.abs(calculatedFee - excelFee) > 1) {
            console.log(`  ⚠️  Project "${fa.project_name}" (C/M ${cmNo}): Excel fee $${excelFee.toLocaleString()} vs Parsed ${calculatedFee.toLocaleString()}`);
          } else {
            console.log(`  ✓ Project "${fa.project_name}" (C/M ${cmNo}): $${excelFee.toLocaleString()}`);
          }
          updatedFeeCount++;
          break;
        }
      }

      parsedCount++;
      if (parsedCount % 10 === 0) {
        console.log(`  Parsed ${parsedCount}/${feeArrangements.length} fee arrangements...`);
      }
    }

    console.log(`\n✅ Successfully parsed ${parsedCount} fee arrangements`);
    console.log(`✅ Verified ${updatedFeeCount} fees against Excel`);

  } catch (error) {
    console.error('Error updating billing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateBillingData();
