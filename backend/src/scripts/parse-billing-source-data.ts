/**
 * Parse Billing Source Data
 *
 * Parses data from billing_source_transactions_raw into normalized tables:
 * - billing_project
 * - billing_project_cm_no
 * - billing_engagement
 * - billing_fee_arrangement
 * - billing_milestone
 * - billing_event
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface SourceRow {
  source_id: bigint;
  full_row_text: string;
  import_batch_id: string | null;
  source_row_num: number | null;
}

function parseKeyValue(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = text.split(' | ');

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const key = pair.substring(0, eqIndex).trim();
      const value = pair.substring(eqIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

function extractProjectName(data: Record<string, string>): string {
  return data['Unnamed: 2'] || data['Project Name'] || data['Project'] || 'UNKNOWN';
}

function extractClientName(data: Record<string, string>): string {
  return data['Unnamed: 3'] || data['Client Name'] || data['Client'] || '';
}

function extractCMNo(data: Record<string, string>): string {
  return data['Unnamed: 4'] || data['C/M No'] || data['CM No'] || '';
}

function extractAttorney(data: Record<string, string>): string {
  return data['Unnamed: 5'] || data['Attorney in Charge'] || data['Attorney'] || '';
}

function extractSCA(data: Record<string, string>): string {
  return data['Unnamed: 6'] || data['SCA'] || '';
}

function extractFeeArrangement(data: Record<string, string>): string {
  return data['Unnamed: 8'] || data['Fee Arrangement'] || data['Fee'] || '';
}

function extractFinanceComment(data: Record<string, string>): string {
  return data['Unnamed: 16'] || data['Finance Comment'] || data['Finance'] || '';
}

function extractRemarks(data: Record<string, string>): string {
  return data['Unnamed: 13'] || data['Remarks'] || '';
}

async function parseBillingData() {
  console.log('🔄 Parsing billing source data...\n');

  // Get all source transactions
  const sourceRows = await prisma.$queryRaw<SourceRow[]>`
    SELECT source_id, full_row_text, import_batch_id, source_row_num
    FROM billing_source_transactions_raw
    WHERE full_row_text IS NOT NULL AND full_row_text <> ''
    ORDER BY source_row_num
  `;

  console.log(`Found ${sourceRows.length} source rows to process\n`);

  let lastProjectId: bigint | null = null;
  let lastProjectName: string = '';
  const projectCache = new Map<string, bigint>();
  const cmCache = new Map<string, bigint>();

  let projectsCreated = 0;
  let cmNumbersCreated = 0;
  let engagementsCreated = 0;
  let feeArrangementsCreated = 0;

  for (const row of sourceRows) {
    const data = parseKeyValue(row.full_row_text);

    const projectName = extractProjectName(data);
    const clientName = extractClientName(data);
    const cmNo = extractCMNo(data);
    const attorney = extractAttorney(data);
    const sca = extractSCA(data);
    const feeArrangementText = extractFeeArrangement(data);
    const financeComment = extractFinanceComment(data);
    const remarks = extractRemarks(data);

    // Skip header/empty rows
    if (projectName === '' || projectName.includes('Project Name')) {
      continue;
    }

    // Determine if this is a continuation row
    const isContinuation = projectName.startsWith(',,') || projectName === '';

    // Get or create project
    let projectId: bigint;
    const projectKey = `${projectName}_${clientName}`;

    if (isContinuation && lastProjectId) {
      projectId = lastProjectId;
    } else if (projectCache.has(projectKey)) {
      projectId = projectCache.get(projectKey)!;
    } else {
      // Create new project
      const result = await prisma.$queryRaw<{ project_id: bigint }[]>`
        INSERT INTO billing_project
        (project_name, client_name, attorney_in_charge, sca, base_currency)
        VALUES (
          ${projectName.replace(/^,,\s*/, '')},
          ${clientName},
          ${attorney},
          ${sca},
          'USD'
        )
        RETURNING project_id
      `;

      projectId = result[0].project_id;
      projectCache.set(projectKey, projectId);
      lastProjectName = projectName;
      projectsCreated++;

      console.log(`✅ Created project: ${projectName} (${clientName})`);
    }

    lastProjectId = projectId;

    // Create or get C/M number
    let cmId: bigint;
    const cmKey = `${projectId}_${cmNo || 'AUTO'}`;

    if (cmCache.has(cmKey)) {
      cmId = cmCache.get(cmKey)!;
    } else {
      const cmNoValue = cmNo || `${projectName}-AUTO`;
      const result = await prisma.$queryRaw<{ cm_id: bigint }[]>`
        INSERT INTO billing_project_cm_no
        (project_id, cm_no, is_primary)
        VALUES (${projectId}, ${cmNoValue}, false)
        ON CONFLICT (project_id, cm_no) DO UPDATE SET cm_no = EXCLUDED.cm_no
        RETURNING cm_id
      `;

      cmId = result[0].cm_id;
      cmCache.set(cmKey, cmId);
      cmNumbersCreated++;
    }

    // Determine engagement code
    let engagementCode = 'original';
    if (remarks.toLowerCase().includes('supplemental') || projectName.toLowerCase().includes('supplemental')) {
      if (projectName.toLowerCase().includes('2nd supplemental')) {
        engagementCode = '2nd_supplemental';
      } else {
        engagementCode = 'supplemental';
      }
    }

    // Create engagement
    const engagementResult = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      INSERT INTO billing_engagement
      (project_id, cm_id, engagement_code, engagement_title, status)
      VALUES (${projectId}, ${cmId}, ${engagementCode}, ${remarks || null}, 'active')
      ON CONFLICT (project_id, cm_id, engagement_code)
      DO UPDATE SET engagement_title = EXCLUDED.engagement_title
      RETURNING engagement_id
    `;

    const engagementId = engagementResult[0].engagement_id;

    if (engagementResult.length > 0) {
      engagementsCreated++;
    }

    // Create fee arrangement if exists
    if (feeArrangementText) {
      await prisma.$queryRaw`
        INSERT INTO billing_fee_arrangement
        (engagement_id, source_id, raw_text, parsed_at)
        VALUES (${engagementId}, ${row.source_id}, ${feeArrangementText}, NOW())
        ON CONFLICT DO NOTHING
      `;
      feeArrangementsCreated++;
    }

    // Create finance comment if exists
    if (financeComment) {
      const fingerprint = crypto.createHash('sha256').update(financeComment).digest('hex');

      await prisma.$queryRaw`
        INSERT INTO billing_finance_comment
        (engagement_id, source_id, comment_raw, fingerprint_hash, parsed_at)
        VALUES (${engagementId}, ${row.source_id}, ${financeComment}, ${fingerprint}, NOW())
        ON CONFLICT (engagement_id, fingerprint_hash) DO NOTHING
      `;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Projects created: ${projectsCreated}`);
  console.log(`✅ C/M numbers created: ${cmNumbersCreated}`);
  console.log(`✅ Engagements created: ${engagementsCreated}`);
  console.log(`✅ Fee arrangements created: ${feeArrangementsCreated}`);
  console.log('='.repeat(60));
}

async function main() {
  try {
    await parseBillingData();
    console.log('\n✅ Billing data parsing completed!');
  } catch (error) {
    console.error('❌ Error during parsing:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
