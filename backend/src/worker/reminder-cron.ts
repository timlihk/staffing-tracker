import cron from 'node-cron';
import prisma from '../utils/prisma';
import { getPartnersWithIncompleteProjects } from '../services/project-reminder.service';
import { sendDailyPartnerReminders } from '../services/email.service';
import { logger } from '../utils/logger';

const TIMEZONE = 'Asia/Hong_Kong';

async function run(trigger: string) {
  logger.info('📧 Reminders job started', { trigger, timestamp: new Date().toISOString() });

  if (process.env.ENABLE_PROJECT_REMINDERS !== 'true') {
    logger.info('⏭️ Reminders job disabled');
    return;
  }

  if (process.env.EMAIL_TEST_MODE === 'true') {
    logger.info('⚠️ TEST MODE active', { recipient: process.env.EMAIL_TEST_RECIPIENT });
  }

  try {
    const reminders = await getPartnersWithIncompleteProjects();
    logger.info('✓ Found partners', { count: reminders.length });

    if (!reminders.length) {
      logger.info('✅ Nothing to send');
      return;
    }

    const results = await sendDailyPartnerReminders(reminders);
    logger.info('✅ Reminders job completed', {
      sent: results.sent,
      total: results.total,
      failed: results.failed,
    });
  } catch (error) {
    logger.error('❌ Reminders job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

cron.schedule('0 1 * * *', () => run('scheduled').catch(console.error), { timezone: TIMEZONE });

if (process.env.RUN_REMINDERS_ON_START === 'true') {
  run('startup').catch(console.error);
}

process.on('SIGTERM', async () => {
  logger.info('Graceful shutdown');
  await prisma.$disconnect();
  process.exit(0);
});
