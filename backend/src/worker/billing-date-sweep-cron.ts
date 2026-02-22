import cron from 'node-cron';
import { BillingMilestoneDateSweepService } from '../services/billing-milestone-date-sweep.service';
import { logger } from '../utils/logger';

const ENABLED = process.env.ENABLE_BILLING_DATE_SWEEP === 'true';
const RUN_ON_START = process.env.RUN_BILLING_DATE_SWEEP_ON_START === 'true';
const CRON_EXPRESSION = process.env.BILLING_DATE_SWEEP_CRON || '0 2 * * *';
const TIMEZONE = process.env.BILLING_DATE_SWEEP_TIMEZONE || 'Asia/Hong_Kong';
const LIMIT = Number.parseInt(process.env.BILLING_DATE_SWEEP_LIMIT || '2000', 10);

const run = async (trigger: 'scheduled' | 'startup') => {
  if (!ENABLED) {
    return;
  }

  try {
    logger.info('[BillingDateSweep] Job started', {
      trigger,
      cron: CRON_EXPRESSION,
      timezone: TIMEZONE,
      limit: LIMIT,
    });

    const result = await BillingMilestoneDateSweepService.runDailySweep({
      dryRun: false,
      limit: Number.isFinite(LIMIT) ? LIMIT : undefined,
    });

    logger.info('[BillingDateSweep] Job completed', { result });
  } catch (error) {
    logger.error('[BillingDateSweep] Job failed', {
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

if (!ENABLED) {
  logger.info('[BillingDateSweep] Disabled via ENABLE_BILLING_DATE_SWEEP');
} else {
  cron.schedule(CRON_EXPRESSION, () => {
    run('scheduled').catch((error) => {
      logger.error('[BillingDateSweep] Scheduled run crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, { timezone: TIMEZONE });

  logger.info('[BillingDateSweep] Scheduler initialized', {
    cron: CRON_EXPRESSION,
    timezone: TIMEZONE,
    runOnStart: RUN_ON_START,
  });

  if (RUN_ON_START) {
    run('startup').catch((error) => {
      logger.error('[BillingDateSweep] Startup run crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
