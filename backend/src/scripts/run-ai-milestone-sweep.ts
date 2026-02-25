import { BillingMilestoneAISweepService } from '../services/billing-milestone-ai-sweep.service';

const parseNumberFlag = (prefix: string): number | undefined => {
  const arg = process.argv.find((value) => value.startsWith(`${prefix}=`));
  if (!arg) return undefined;
  const parsed = Number(arg.split('=')[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limit = parseNumberFlag('--limit');
  const batchSize = parseNumberFlag('--batch-size');
  const minConfidence = parseNumberFlag('--min-confidence');

  const result = await BillingMilestoneAISweepService.runDailySweep({
    dryRun,
    limit,
    batchSize,
    minConfidence,
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[BillingAISweep] Script failed:', error);
  process.exit(1);
});
