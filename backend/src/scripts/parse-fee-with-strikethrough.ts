/**
 * Parse Fee Arrangements with Strikethrough Detection
 *
 * This script:
 * 1. Reads Excel file and detects strikethrough formatting (completed milestones)
 * 2. Parses bonus information from fee arrangement text
 * 3. Updates database with completion status and bonus amounts
 */

import * as XLSX from 'xlsx';
import prisma from '../utils/prisma';

interface MilestoneWithCompletion {
  ordinal: string;
  text: string;
  isCompleted: boolean;
}

interface ParsedBonus {
  description: string;
  amount_usd: number | null;
  amount_cny: number | null;
}

/**
 * Read Excel file and extract fee arrangements with formatting
 */
async function readFeeArrangementsWithFormatting(filePath: string): Promise<Map<string, { text: string; completedMilestones: Set<string>; bonuses: ParsedBonus[] }>> {
  const workbook = XLSX.readFile(filePath, { cellStyles: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Find column indexes
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  let cmNoCol = -1;
  let feeArrangementCol = -1;

  // Look for headers
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (cell.includes('c/m') || cell.includes('cm no')) {
        cmNoCol = j;
      }
      if (cell.includes('fee') && cell.includes('arrangement')) {
        feeArrangementCol = j;
      }
    }
    if (cmNoCol >= 0 && feeArrangementCol >= 0) break;
  }

  if (cmNoCol < 0 || feeArrangementCol < 0) {
    throw new Error('Could not find C/M No or Fee Arrangement columns in Excel');
  }

  console.log(`Found C/M column at index ${cmNoCol}, Fee Arrangement at index ${feeArrangementCol}`);

  // Build map of C/M No -> { text, completedMilestones, bonuses }
  const feeMap = new Map<string, { text: string; completedMilestones: Set<string>; bonuses: ParsedBonus[] }>();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cmNo = String(row[cmNoCol] || '').trim();
    if (!cmNo) continue;

    // Get cell address for fee arrangement
    const cellAddress = XLSX.utils.encode_cell({ r: i, c: feeArrangementCol });
    const cell = worksheet[cellAddress];

    if (!cell || !cell.v) continue;

    const text = String(cell.v);
    const completedMilestones = new Set<string>();

    // Check for strikethrough formatting in rich text
    if (cell.r && Array.isArray(cell.r)) {
      // Rich text format - check each run for strikethrough
      for (const run of cell.r) {
        if (run.s && run.s.strike && run.t) {
          // Extract milestone ordinal from struck text
          const ordinalMatch = run.t.match(/\(([a-z])\)/);
          if (ordinalMatch) {
            completedMilestones.add(`(${ordinalMatch[1]})`);
          }
        }
      }
    } else if (cell.s && cell.s.font && cell.s.font.strike) {
      // Entire cell is struck through - all milestones completed
      const ordinalMatches = text.matchAll(/\(([a-z])\)/g);
      for (const match of ordinalMatches) {
        completedMilestones.add(`(${match[1]})`);
      }
    }

    // Parse bonuses from text
    const bonuses = parseBonuses(text);

    feeMap.set(cmNo, { text, completedMilestones, bonuses });
  }

  console.log(`Loaded ${feeMap.size} fee arrangements from Excel`);
  return feeMap;
}

/**
 * Parse bonus information from Chinese and English text
 */
function parseBonuses(text: string): ParsedBonus[] {
  const bonuses: ParsedBonus[] = [];

  // Pattern 1: "不低于10万美元奖金" = not less than $100,000 bonus
  // Pattern 2: "不低于X万人民币奖金" = not less than X*10000 RMB bonus
  // Pattern 3: "bonus of $X" or "bonus: $X"
  // Pattern 4: "奖金X万" = bonus X*10000

  // Chinese USD pattern: 不低于X万美元奖金 or X万美元奖金
  const chineseUsdMatch = text.match(/(?:不低于)?(\d+(?:\.\d+)?)万美元奖金/);
  if (chineseUsdMatch) {
    const amount = parseFloat(chineseUsdMatch[1]) * 10000; // 万 = 10,000
    bonuses.push({
      description: chineseUsdMatch[0],
      amount_usd: amount,
      amount_cny: null,
    });
  }

  // Chinese CNY pattern: 不低于X万人民币奖金 or X万元奖金
  const chineseCnyMatch = text.match(/(?:不低于)?(\d+(?:\.\d+)?)万(?:人民币|元)奖金/);
  if (chineseCnyMatch) {
    const amount = parseFloat(chineseCnyMatch[1]) * 10000;
    bonuses.push({
      description: chineseCnyMatch[0],
      amount_usd: null,
      amount_cny: amount,
    });
  }

  // English USD pattern: bonus of $X,XXX or bonus: $X,XXX
  const englishUsdMatch = text.match(/bonus[:\s]+\$\s*([\d,]+)/i);
  if (englishUsdMatch) {
    const amount = parseFloat(englishUsdMatch[1].replace(/,/g, ''));
    bonuses.push({
      description: englishUsdMatch[0],
      amount_usd: amount,
      amount_cny: null,
    });
  }

  // Pattern: "奖金" followed by numbers
  const generalBonusMatch = text.match(/奖金[：:]\s*(\d+(?:\.\d+)?)\s*万/);
  if (generalBonusMatch) {
    const amount = parseFloat(generalBonusMatch[1]) * 10000;
    // Assume USD if not specified
    bonuses.push({
      description: generalBonusMatch[0],
      amount_usd: amount,
      amount_cny: null,
    });
  }

  return bonuses;
}

/**
 * Update database with completion status and bonuses
 */
async function updateCompletionAndBonuses() {
  try {
    console.log('Reading Excel file with formatting...');
    const excelPath = '/home/timlihk/staffing-tracker/billing-matter/HKCM Project List(81764217.1)_6Oct25.xlsx';
    const feeMap = await readFeeArrangementsWithFormatting(excelPath);

    console.log('\nFetching all fee arrangements...');
    const feeArrangements = await prisma.$queryRaw<any[]>`
      SELECT fa.fee_id, fa.engagement_id,
             bp.project_id, bp.project_name,
             string_agg(pcm.cm_no, ', ') as cm_numbers
      FROM billing_fee_arrangement fa
      JOIN billing_engagement be ON fa.engagement_id = be.engagement_id
      JOIN billing_project bp ON be.project_id = bp.project_id
      LEFT JOIN billing_project_cm_no pcm ON bp.project_id = pcm.project_id
      GROUP BY fa.fee_id, fa.engagement_id, bp.project_id, bp.project_name
    `;

    console.log(`Found ${feeArrangements.length} fee arrangements to update`);

    let updatedCount = 0;
    let bonusCount = 0;

    for (const fa of feeArrangements) {
      const cmNumbers = (fa.cm_numbers || '').split(', ');

      for (const cmNo of cmNumbers) {
        const excelData = feeMap.get(cmNo);
        if (!excelData) continue;

        // Update bonus information in fee_arrangement
        if (excelData.bonuses.length > 0) {
          const bonus = excelData.bonuses[0]; // Take first bonus if multiple
          await prisma.$executeRaw`
            UPDATE billing_fee_arrangement
            SET bonus_description = ${bonus.description},
                bonus_amount_usd = ${bonus.amount_usd},
                bonus_amount_cny = ${bonus.amount_cny},
                updated_at = NOW()
            WHERE fee_id = ${fa.fee_id}
          `;

          // Also update engagement table for dashboard view
          await prisma.$executeRaw`
            UPDATE billing_engagement
            SET bonus_usd = ${bonus.amount_usd || 0},
                bonus_cny = ${bonus.amount_cny || 0},
                updated_at = NOW()
            WHERE engagement_id = ${fa.engagement_id}
          `;

          console.log(`  💰 Project "${fa.project_name}" (C/M ${cmNo}): Bonus ${bonus.description}`);
          bonusCount++;
        }

        // Update milestone completion status
        if (excelData.completedMilestones.size > 0) {
          for (const ordinal of excelData.completedMilestones) {
            const result = await prisma.$executeRaw`
              UPDATE billing_milestone
              SET completed = true,
                  completion_source = 'excel_strikethrough',
                  completion_date = CURRENT_DATE,
                  updated_at = NOW()
              WHERE fee_id = ${fa.fee_id}
                AND ordinal = ${ordinal}
                AND completed = false
            `;

            if (result > 0) {
              console.log(`  ✓ Project "${fa.project_name}" (C/M ${cmNo}): Milestone ${ordinal} marked completed`);
              updatedCount++;
            }
          }
        }

        break; // Only process first matching C/M number
      }
    }

    console.log(`\n✅ Updated ${updatedCount} milestones to completed status`);
    console.log(`✅ Added ${bonusCount} bonus amounts`);

  } catch (error) {
    console.error('Error updating completion and bonuses:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateCompletionAndBonuses();
