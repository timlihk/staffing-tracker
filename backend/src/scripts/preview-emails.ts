import fs from 'fs';
import path from 'path';
import { buildPartnerReminderHTML } from '../services/email.service';
import type { PartnerReminderPayload } from '../services/project-reminder.service';

/**
 * Email Preview Generator
 * Generates HTML preview of partner reminder email for testing/review
 * No Resend API calls - just writes HTML to file
 */

// Mock data for preview
const mockReminder: PartnerReminderPayload = {
  partnerEmail: 'john.smith@example.com',
  partnerName: 'John Smith',
  projects: [
    {
      id: 1,
      name: 'Project Alpha - HK Transaction',
      category: 'HK Trx',
      missingFields: ['filingDate', 'elStatus'],
    },
    {
      id: 2,
      name: 'Project Beta - US Compliance Matter',
      category: 'US Comp',
      missingFields: ['listingDate', 'bcAttorney'],
    },
    {
      id: 3,
      name: 'Project Gamma - Complex Cross-Border Deal',
      category: 'HK Comp',
      missingFields: ['filingDate', 'listingDate', 'elStatus', 'bcAttorney'],
    },
  ],
};

async function generatePreview() {
  console.log('📧 Generating email preview...');

  try {
    // Generate HTML from template
    const { html } = buildPartnerReminderHTML(mockReminder);

    // Create preview directory
    const previewDir = path.join(__dirname, '../../email-previews');
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
      console.log(`✓ Created directory: ${previewDir}`);
    }

    // Write HTML file
    const previewPath = path.join(previewDir, 'partner-reminder.html');
    fs.writeFileSync(previewPath, html);

    console.log(`✓ Preview generated: ${previewPath}`);
    console.log('\nOpen this file in your browser to review the email template.');
    console.log('Mock data includes 3 projects with various missing fields.');
  } catch (error) {
    console.error('✗ Failed to generate preview:', error);
    process.exit(1);
  }
}

// Run preview generation
generatePreview().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
