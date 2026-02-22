import cron from 'node-cron';
import { BillingMilestoneAISweepService } from '../services/billing-milestone-ai-sweep.service';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { SweepLockError } from '../utils/sweep-lock';

const RUN_ON_START = process.env.RUN_BILLING_AI_SWEEP_ON_START === 'true';
const CRON_EXPRESSION = process.env.BILLING_AI_SWEEP_CRON || '30 2 * * *';
const TIMEZONE = process.env.BILLING_AI_SWEEP_TIMEZONE || 'Asia/Hong_Kong';
const ENV_ENABLED = process.env.ENABLE_BILLING_AI_SWEEP === 'true';
const ENV_LIMIT = Number.parseInt(process.env.BILLING_AI_SWEEP_LIMIT || '300', 10);
const ENV_BATCH_SIZE = Number.parseInt(process.env.BILLING_AI_SWEEP_BATCH_SIZE || '20', 10);
const ENV_MIN_CONFIDENCE = Number.parseFloat(process.env.BILLING_AI_SWEEP_MIN_CONFIDENCE || '0.75');
const ENV_AUTO_CONFIRM_CONFIDENCE = Number.parseFloat(
  process.env.BILLING_AI_SWEEP_AUTO_CONFIRM_CONFIDENCE || '0.92'
);

const run = async (trigger: 'scheduled' | 'startup') => {
  try {
    const settings = await prisma.appSettings.findFirst();
    const enabled = settings?.billingAiSweepEnabled ?? ENV_ENABLED;
    const limit = settings?.billingAiSweepLimit ?? ENV_LIMIT;
    const batchSize = settings?.billingAiSweepBatchSize ?? ENV_BATCH_SIZE;
    const minConfidence = settings?.billingAiSweepMinConfidence ?? ENV_MIN_CONFIDENCE;
    const autoConfirmConfidence =
      settings?.billingAiSweepAutoConfirmConfidence ?? ENV_AUTO_CONFIRM_CONFIDENCE;

    if (!enabled) {
      logger.info('[BillingAISweep] Skipped (disabled in app settings)');
      return;
    }

    logger.info('[BillingAISweep] Job started', {
      trigger,
      cron: CRON_EXPRESSION,
      timezone: TIMEZONE,
      limit,
      batchSize,
      minConfidence,
      autoConfirmConfidence,
    });

    const result = await BillingMilestoneAISweepService.runDailySweep({
      dryRun: false,
      limit: Number.isFinite(limit) ? limit : undefined,
      batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
      minConfidence: Number.isFinite(minConfidence) ? minConfidence : undefined,
      autoConfirmConfidence: Number.isFinite(autoConfirmConfidence)
        ? autoConfirmConfidence
        : undefined,
    });

    logger.info('[BillingAISweep] Job completed', { result });
  } catch (error) {
    if (error instanceof SweepLockError) {
      logger.info('[BillingAISweep] Skipped — another run is in progress');
      return;
    }
    logger.error('[BillingAISweep] Job failed', {
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

if (!cron.validate(CRON_EXPRESSION)) {
  logger.error('[BillingAISweep] Invalid cron expression, scheduler NOT started', {
    cron: CRON_EXPRESSION,
  });
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
