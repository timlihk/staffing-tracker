/**
 * Apply Excel sync to the database and store the sync run record.
 *
 * Usage: npx ts-node scripts/apply-sync.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  preprocessExcelBuffer,
  parseExcelFile,
  applyChanges,
} from '../src/services/billing-excel-sync.service';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(
  __dirname,
  '../../Billing/HKCM Project List (2026.02.12).xlsx'
);
const EXCEL_FILENAME = 'HKCM Project List (2026.02.12).xlsx';

async function main() {
  console.log(`Reading: ${EXCEL_PATH}`);
  const raw = fs.readFileSync(EXCEL_PATH);
  const buffer = await preprocessExcelBuffer(raw);
  const rows = await parseExcelFile(buffer);

  console.log(`Parsed ${rows.length} rows. Applying changes...`);
  const result = await applyChanges(rows, undefined);

  console.log('\n=== SYNC RESULT ===');
  console.log(`Projects updated: ${result.projectsUpdated}`);
  console.log(`Financials updated: ${result.financialsUpdated}`);
  console.log(`Engagements upserted: ${result.engagementsUpserted}`);
  console.log(`Milestones created: ${result.milestonesCreated}`);
  console.log(`Milestones updated: ${result.milestonesUpdated}`);
  console.log(`Milestones marked completed: ${result.milestonesMarkedCompleted}`);
  console.log(`New CMs: ${result.syncRunData.newCms.length}`);
  console.log(`Staffing links: ${result.syncRunData.staffingLinks.length}`);
  console.log(`Unmatched new CMs: ${result.syncRunData.unmatchedNewCms.length}`);
  console.log(`Skipped CMs: ${result.syncRunData.skippedCms.length}`);

  // Store sync run record
  const summaryJson = {
    projectsUpdated: result.projectsUpdated,
    financialsUpdated: result.financialsUpdated,
    engagementsUpserted: result.engagementsUpserted,
    milestonesCreated: result.milestonesCreated,
    milestonesUpdated: result.milestonesUpdated,
    milestonesMarkedCompleted: result.milestonesMarkedCompleted,
    newCmCount: result.syncRunData.newCms.length,
    updatedCmCount: result.syncRunData.updatedCms.length,
    staffingLinksCount: result.syncRunData.staffingLinks.length,
    unmatchedCount: result.syncRunData.unmatchedNewCms.length,
    skippedCount: result.syncRunData.skippedCms.length,
  };

  const syncRun = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    INSERT INTO billing_sync_run (
      uploaded_by, excel_filename, excel_file, status,
      summary_json, changes_json, staffing_links_json
    ) VALUES (
      NULL,
      ${EXCEL_FILENAME},
      ${raw},
      'completed',
      ${JSON.stringify(summaryJson)}::jsonb,
      ${JSON.stringify(result.syncRunData)}::jsonb,
      ${JSON.stringify(result.syncRunData.staffingLinks)}::jsonb
    )
    RETURNING id
  `);

  console.log(`\nSync run stored with ID: ${syncRun[0].id}`);
  console.log(`View report at: /billing/sync-report/${syncRun[0].id}`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
