import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { mkdirSync, existsSync } from 'fs';
import * as path from 'path';

async function main() {
  // Use DATABASE_URL from environment or fail
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });

  const projects = await prisma.$queryRaw`
    SELECT id, name, status, category FROM projects
    WHERE cm_number IS NULL
    ORDER BY name
  `;

  const data = projects.map((p: any) => ({
    project_id: p.id,
    project_name: p.name,
    status: p.status,
    category: p.category
  }));

  await prisma.$disconnect();

  // Use environment variable for exports directory, or default
  const exportsDir = process.env.EXPORTS_DIR ||
    path.resolve(__dirname, '../exports');

  if (!existsSync(exportsDir)) {
    mkdirSync(exportsDir, { recursive: true });
  }

  // Save as JSON
  writeFileSync(`${exportsDir}/projects_without_cm.json`, JSON.stringify(data, null, 2));

  // Save as CSV
  const csv = 'project_id,project_name,status,category\n' +
    data.map(p => `${p.project_id},"${p.project_name.replace(/"/g, '""')}",${p.status},${p.category}`).join('\n');

  writeFileSync(`${exportsDir}/projects_without_cm.csv`, csv);

  console.log('Files saved:');
  console.log(`  JSON: ${exportsDir}/projects_without_cm.json`);
  console.log(`  CSV:  ${exportsDir}/projects_without_cm.csv`);
  console.log('');
  console.log('Total projects without C/M:', data.length);
}

main();
