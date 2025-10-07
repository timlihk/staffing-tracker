/**
 * Import Billing Data from CSV files
 *
 * Imports parsed billing data from billing-matter/parsed_tables/*.csv
 * into the billing database tables.
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface SourceTransaction {
  source_id: string;
  import_batch_id: string;
  source_row_num: string;
  full_row_text: string;
  project_name_raw: string;
  cm_no_raw: string;
  fee_arrangement_raw: string;
  finance_comment_raw: string;
  remarks_raw: string;
  row_hash: string;
}

interface Project {
  project_id: string;
  project_name: string;
  client_name: string;
  attorney_in_charge: string;
  sca: string;
  base_currency: string;
}

interface ProjectCmNo {
  cm_id: string;
  project_id: string;
  cm_no: string;
  is_primary: string;
}

interface Engagement {
  engagement_id: string;
  project_id: string;
  cm_id: string;
  engagement_code: string;
  engagement_title: string;
  status: string;
}

async function readCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return resolve([]);
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function importSourceTransactions(csvPath: string) {
  console.log('\n📥 Importing source transactions...');
  const transactions = await readCSV<SourceTransaction>(csvPath);

  let imported = 0;
  for (const tx of transactions) {
    try {
      await prisma.$executeRaw`
        INSERT INTO billing_source_transactions_raw
        (import_batch_id, source_row_num, full_row_text, project_name_raw, cm_no_raw,
         fee_arrangement_raw, finance_comment_raw, remarks_raw, row_hash)
        VALUES (
          ${tx.import_batch_id || 'csv_import'},
          ${parseInt(tx.source_row_num) || 0},
          ${tx.full_row_text || ''},
          ${tx.project_name_raw || ''},
          ${tx.cm_no_raw || ''},
          ${tx.fee_arrangement_raw || ''},
          ${tx.finance_comment_raw || ''},
          ${tx.remarks_raw || ''},
          ${tx.row_hash}
        )
        ON CONFLICT (row_hash) DO NOTHING
      `;
      imported++;
    } catch (err) {
      console.error(`Error importing transaction ${tx.source_id}:`, err);
    }
  }

  console.log(`✅ Imported ${imported} / ${transactions.length} source transactions`);
}

async function importProjects(csvPath: string) {
  console.log('\n📥 Importing billing projects...');
  const projects = await readCSV<Project>(csvPath);

  let imported = 0;
  for (const proj of projects) {
    try {
      await prisma.$executeRaw`
        INSERT INTO billing_project
        (project_name, client_name, attorney_in_charge, sca, base_currency)
        VALUES (
          ${proj.project_name || 'UNKNOWN'},
          ${proj.client_name || ''},
          ${proj.attorney_in_charge || ''},
          ${proj.sca || ''},
          ${proj.base_currency || 'USD'}
        )
        ON CONFLICT DO NOTHING
      `;
      imported++;
    } catch (err) {
      console.error(`Error importing project ${proj.project_id}:`, err);
    }
  }

  console.log(`✅ Imported ${imported} / ${projects.length} billing projects`);
}

async function importCmNumbers(csvPath: string) {
  console.log('\n📥 Importing C/M numbers...');
  const cmNumbers = await readCSV<ProjectCmNo>(csvPath);

  let imported = 0;
  for (const cm of cmNumbers) {
    try {
      await prisma.$executeRaw`
        INSERT INTO billing_project_cm_no
        (project_id, cm_no, is_primary)
        VALUES (
          ${parseInt(cm.project_id)},
          ${cm.cm_no},
          ${cm.is_primary === 'true' || cm.is_primary === 't'}
        )
        ON CONFLICT (project_id, cm_no) DO NOTHING
      `;
      imported++;
    } catch (err) {
      console.error(`Error importing C/M ${cm.cm_id}:`, err);
    }
  }

  console.log(`✅ Imported ${imported} / ${cmNumbers.length} C/M numbers`);
}

async function importEngagements(csvPath: string) {
  console.log('\n📥 Importing engagements...');
  const engagements = await readCSV<Engagement>(csvPath);

  let imported = 0;
  for (const eng of engagements) {
    try {
      await prisma.$executeRaw`
        INSERT INTO billing_engagement
        (project_id, cm_id, engagement_code, engagement_title, status)
        VALUES (
          ${parseInt(eng.project_id)},
          ${parseInt(eng.cm_id)},
          ${eng.engagement_code || 'original'},
          ${eng.engagement_title || ''},
          ${eng.status || 'active'}
        )
        ON CONFLICT (project_id, cm_id, engagement_code) DO NOTHING
      `;
      imported++;
    } catch (err) {
      console.error(`Error importing engagement ${eng.engagement_id}:`, err);
    }
  }

  console.log(`✅ Imported ${imported} / ${engagements.length} engagements`);
}

async function main() {
  console.log('🚀 Starting Billing Data Import...\n');

  const basePath = path.join(process.cwd(), '..', 'billing-matter', 'parsed_tables');

  try {
    // Import in order (respecting foreign key constraints)
    await importSourceTransactions(path.join(basePath, 'source_transactions_raw.csv'));
    await importProjects(path.join(basePath, 'project.csv'));
    await importCmNumbers(path.join(basePath, 'project_cm_no.csv'));
    await importEngagements(path.join(basePath, 'engagement.csv'));

    // Note: fee_arrangement, milestone, billing_event, finance_comment CSVs
    // appear to be empty in your data. These will be populated via ETL script
    // or manually as billing events occur.

    console.log('\n✅ Billing data import completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run auto-mapping script: npm run billing:map-attorneys');
    console.log('2. Review and manually confirm B&C attorney mappings');
    console.log('3. Link billing projects to staffing projects via admin UI');

  } catch (error) {
    console.error('❌ Error during import:', error);
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
