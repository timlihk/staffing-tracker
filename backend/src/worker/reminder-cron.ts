import cron from 'node-cron';
import prisma from '../utils/prisma';
import { getPartnersWithIncompleteProjects } from '../services/project-reminder.service';
import { sendDailyPartnerReminders } from '../services/email.service';

const TIMEZONE = 'Asia/Hong_Kong';

async function run(trigger: string) {
  console.log(`📧 [Reminders] ${trigger} at ${new Date().toISOString()}`);

  if (process.env.ENABLE_PROJECT_REMINDERS !== 'true') {
    console.log('⏭️  Disabled');
    return;
  }

  if (process.env.EMAIL_TEST_MODE === 'true') {
    console.log(`⚠️  TEST MODE → ${process.env.EMAIL_TEST_RECIPIENT}`);
  }

  try {
    const reminders = await getPartnersWithIncompleteProjects();
    console.log(`✓ Found ${reminders.length} partners`);

    if (!reminders.length) {
      console.log('✅ Nothing to send');
      return;
    }

    const results = await sendDailyPartnerReminders(reminders);
    console.log(`✅ Sent ${results.sent}/${results.total} (failed ${results.failed})`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

cron.schedule('0 1 * * *', () => run('scheduled').catch(console.error), { timezone: TIMEZONE });

if (process.env.RUN_REMINDERS_ON_START === 'true') {
  run('startup').catch(console.error);
}

process.on('SIGTERM', async () => {
  console.log('Graceful shutdown');
  await prisma.$disconnect();
  process.exit(0);
});
