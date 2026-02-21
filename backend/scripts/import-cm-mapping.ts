import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import * as path from 'path';

async function main() {
  // Use DATABASE_URL from environment or fallback to .env
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });

  // Use environment variable for mapping file path, or default to repo exports directory
  const mappingPath = process.env.CM_MAPPING_PATH || path.resolve(__dirname, '../exports/project_cm_mapping.json');

  // Load mapping
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf-8'));

  // Get all staffing projects
  const projects = await prisma.$queryRaw`SELECT id, name FROM projects`;
  const projectMap = new Map(projects.map((p: any) => [p.name.toLowerCase(), p.id]));

  // Get all billing CM numbers
  const cmNos = await prisma.$queryRaw`SELECT cm_id, cm_no FROM billing_project_cm_no`;
  const cmNoMap = new Map(cmNos.map((c: any) => [c.cm_no, c.cm_id]));

  let updated = 0;

  for (const m of mapping) {
    if (m.cm_number === 'TBC' || m.project_name === 'Project Name') continue;

    let projectId = projectMap.get(m.project_name.toLowerCase());
    if (!projectId) {
      const nameWithoutProject = m.project_name.replace(/^Project /i, '').toLowerCase();
      projectId = projectMap.get(nameWithoutProject);
    }
    if (!projectId) {
      const baseName = m.project_name.split(' - ')[0].replace(/^Project /i, '').toLowerCase();
      projectId = projectMap.get(baseName);
    }
    if (!projectId && /^\d+$/.test(m.project_name)) {
      for (const [name, id] of projectMap) {
        if (name.startsWith(m.project_name + ' ') || name.startsWith(m.project_name + '(')) {
          projectId = id;
          break;
        }
      }
    }

    const cmId = cmNoMap.get(m.cm_number);

    if (projectId && cmId) {
      await prisma.$executeRaw`UPDATE projects SET cm_number = ${m.cm_number} WHERE id = ${projectId}`;
      updated++;
    }
  }

  console.log('Updated', updated, 'projects with cm_number');

  // Verify
  const result = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM projects WHERE cm_number IS NOT NULL`;
  console.log('Projects with cm_number:', result[0].cnt.toString());

  await prisma.$disconnect();
}

main();
