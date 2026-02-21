import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
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

  // Use environment variable for matching results file, or default
  const resultsPath = process.env.CM_MATCHING_RESULTS_PATH ||
    path.resolve(__dirname, '../exports/project_cm_matching_results.json');

  const matchingResults = JSON.parse(
    readFileSync(resultsPath, 'utf-8')
  );

  // Get matched entries only
  const matched = matchingResults.filter((m: any) => m.cm_number && m.match_status.includes('MATCHED'));

  console.log(`Found ${matched.length} matched entries to apply`);

  let applied = 0;
  let errors = 0;

  for (const m of matched) {
    try {
      await prisma.$executeRaw`UPDATE projects SET cm_number = ${m.cm_number} WHERE id = ${m.project_id}`;
      console.log(`  ✅ ${m.project_name} -> ${m.cm_number}`);
      applied++;
    } catch (e) {
      console.log(`  ❌ ${m.project_name}: ${e}`);
      errors++;
    }
  }

  console.log(`\nApplied: ${applied}, Errors: ${errors}`);

  // Verify total
  const result = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM projects WHERE cm_number IS NOT NULL`;
  console.log(`Total projects with cm_number: ${result[0].cnt}`);

  await prisma.$disconnect();
}

main();
