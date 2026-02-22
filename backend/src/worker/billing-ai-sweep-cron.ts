import cron from 'node-cron';
import { BillingMilestoneAISweepService } from '../services/billing-milestone-ai-sweep.service';
import { logger } from '../utils/logger';

const ENABLED = process.env.ENABLE_BILLING_AI_SWEEP === 'true';
const RUN_ON_START = process.env.RUN_BILLING_AI_SWEEP_ON_START === 'true';
const CRON_EXPRESSION = process.env.BILLING_AI_SWEEP_CRON || '30 2 * * *';
const TIMEZONE = process.env.BILLING_AI_SWEEP_TIMEZONE || 'Asia/Hong_Kong';
const LIMIT = Number.parseInt(process.env.BILLING_AI_SWEEP_LIMIT || '300', 10);
const BATCH_SIZE = Number.parseInt(process.env.BILLING_AI_SWEEP_BATCH_SIZE || '20', 10);
const MIN_CONFIDENCE = Number.parseFloat(process.env.BILLING_AI_SWEEP_MIN_CONFIDENCE || '0.75');
const AUTO_CONFIRM_CONFIDENCE = Number.parseFloat(
  process.env.BILLING_AI_SWEEP_AUTO_CONFIRM_CONFIDENCE || '0.92'
);

const run = async (trigger: 'scheduled' | 'startup') => {
  if (!ENABLED) {
    return;
  }

  try {
    logger.info('[BillingAISweep] Job started', {
      trigger,
      cron: CRON_EXPRESSION,
      timezone: TIMEZONE,
      limit: LIMIT,
      batchSize: BATCH_SIZE,
      minConfidence: MIN_CONFIDENCE,
      autoConfirmConfidence: AUTO_CONFIRM_CONFIDENCE,
    });

    const result = await BillingMilestoneAISweepService.runDailySweep({
      dryRun: false,
      limit: Number.isFinite(LIMIT) ? LIMIT : undefined,
      batchSize: Number.isFinite(BATCH_SIZE) ? BATCH_SIZE : undefined,
      minConfidence: Number.isFinite(MIN_CONFIDENCE) ? MIN_CONFIDENCE : undefined,
      autoConfirmConfidence: Number.isFinite(AUTO_CONFIRM_CONFIDENCE)
        ? AUTO_CONFIRM_CONFIDENCE
        : undefined,
    });

    logger.info('[BillingAISweep] Job completed', { result });
  } catch (error) {
    logger.error('[BillingAISweep] Job failed', {
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

if (!ENABLED) {
  logger.info('[BillingAISweep] Disabled via ENABLE_BILLING_AI_SWEEP');
} else {
  cron.schedule(
    CRON_EXPRESSION,
    () => {
      run('scheduled').catch((error) => {
        logger.error('[BillingAISweep] Scheduled run crashed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { timezone: TIMEZONE }
  );

  logger.info('[BillingAISweep] Scheduler initialized', {
    cron: CRON_EXPRESSION,
    timezone: TIMEZONE,
    runOnStart: RUN_ON_START,
  });

  if (RUN_ON_START) {
    run('startup').catch((error) => {
      logger.error('[BillingAISweep] Startup run crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
