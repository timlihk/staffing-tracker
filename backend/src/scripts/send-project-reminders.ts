import prisma from '../utils/prisma';
import { getPartnersWithIncompleteProjects } from '../services/project-reminder.service';
import { sendDailyPartnerReminders } from '../services/email.service';

/**
 * Daily Partner Reminder Script
 * Sends emails to partners about projects with missing critical information
 * Runs daily at 9 AM HKT (1 AM UTC) via Railway cron
 */

async function main() {
  console.log('📧 [Reminders] Starting daily partner reminders...');
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  // Feature flag check
  if (process.env.ENABLE_PROJECT_REMINDERS !== 'true') {
    console.log('⏭️  [Reminders] Disabled (ENABLE_PROJECT_REMINDERS=false)');
    console.log('   Set ENABLE_PROJECT_REMINDERS=true to enable');
    process.exit(0);
  }

  // Test mode warning
  if (process.env.EMAIL_TEST_MODE === 'true') {
    console.log(
      `⚠️  [Reminders] TEST MODE - All emails redirected to: ${process.env.EMAIL_TEST_RECIPIENT}`
    );
  }

  try {
    // Get partners with incomplete projects
    console.log('🔍 [Reminders] Querying database for partners with incomplete projects...');
    const reminders = await getPartnersWithIncompleteProjects();

    console.log(`✓ [Reminders] Found ${reminders.length} partners with incomplete projects`);

    if (reminders.length === 0) {
      console.log('✅ [Reminders] No reminders needed - all projects complete');
      console.log('   All Active/Slow-down projects have required information');
      process.exit(0);
    }

    // Log summary of what will be sent
    console.log('\n📊 [Reminders] Summary:');
    reminders.forEach((reminder, index) => {
      console.log(
        `   ${index + 1}. ${reminder.partnerName} (${reminder.partnerEmail}) - ${reminder.projects.length} project(s)`
      );
    });
    console.log('');

    // Send emails
    console.log('📤 [Reminders] Sending emails...');
    const results = await sendDailyPartnerReminders(reminders);

    // Final summary
    console.log('\n✅ [Reminders] Daily run complete:');
    console.log(`   Sent: ${results.sent}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Total: ${results.total}`);

    if (results.failed > 0) {
      console.error('\n⚠️  [Reminders] Failed emails:');
      results.errors.forEach((err) => {
        console.error(`   - ${err.email}: ${err.error.message || err.error}`);
      });
      process.exit(1);
    }

    console.log('\n🎉 [Reminders] All emails sent successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Reminders] Fatal error:', error);
    console.error(
      '   Please check database connection and environment variables'
    );
    process.exit(1);
  } finally {
    // Always disconnect from database
    await prisma.$disconnect();
  }
}

// Run the script
main().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
