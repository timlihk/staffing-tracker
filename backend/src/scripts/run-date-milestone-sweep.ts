import { BillingMilestoneDateSweepService } from '../services/billing-milestone-date-sweep.service';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  const result = await BillingMilestoneDateSweepService.runDailySweep({
    dryRun,
    limit: Number.isFinite(limit || NaN) ? limit : undefined,
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[BillingDateSweep] Script failed:', error);
  process.exit(1);
});

