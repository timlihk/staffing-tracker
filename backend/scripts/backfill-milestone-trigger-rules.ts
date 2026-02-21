import 'dotenv/config';
import prisma from '../src/utils/prisma';
import { ProjectEventTriggerService } from '../src/services/project-event-trigger.service';

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const onlyMissing = process.env.ONLY_MISSING !== 'false';
  const limit = process.env.LIMIT ? Number.parseInt(process.env.LIMIT, 10) : undefined;

  if (limit !== undefined && Number.isNaN(limit)) {
    throw new Error('LIMIT must be a valid integer');
  }

  const result = await ProjectEventTriggerService.backfillMilestoneTriggerRules({
    dryRun,
    onlyMissing,
    limit,
  });

  console.log(JSON.stringify({
    dryRun,
    onlyMissing,
    limit: limit || null,
    result,
  }, null, 2));

  if (!dryRun) {
    const counts = await prisma.$queryRawUnsafe(`
      SELECT trigger_mode, COUNT(*)::int AS count
      FROM billing_milestone_trigger_rule
      GROUP BY trigger_mode
      ORDER BY count DESC, trigger_mode
    `);
    console.log(JSON.stringify({ ruleModeDistribution: counts }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
