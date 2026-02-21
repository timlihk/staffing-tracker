import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

async function main() {
  const workbook = XLSX.readFile('/Users/timli/Downloads/Copy of projects_cm_matching_analysis.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  // Get valid updates only (with project_id)
  const updates = data
    .filter((r: any) => r.project_id && r.manual_cm_number)
    .map((r: any) => ({
      project_id: r.project_id,
      project_name: r.project_name,
      manual_cm_number: r.manual_cm_number
    }));

  console.log('Applying', updates.length, 'updates...');

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway' } }
  });

  for (const u of updates) {
    await prisma.$executeRaw`UPDATE projects SET cm_number = ${u.manual_cm_number} WHERE id = ${u.project_id}`;
    console.log('✅', u.project_name, '->', u.manual_cm_number);
  }

  const total = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM projects WHERE cm_number IS NOT NULL`;
  console.log('\nTotal projects with cm_number:', total[0].cnt.toString());

  await prisma.$disconnect();
}

main();
