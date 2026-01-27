import { Resend } from 'resend';
import {
  PartnerReminderPayload,
  formatFieldName as formatReminderFieldName,
} from './project-reminder.service';
import prisma from '../utils/prisma';
import config from '../config';

const resend = config.email.apiKey ? new Resend(config.email.apiKey) : null;
const fromEmail = config.email.from;
const appUrl = config.frontendUrl;

// Utility function to add delay between emails to avoid rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ProjectChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

interface EmailNotificationData {
  staffEmail: string;
  staffName: string;
  staffPosition: string;
  projectId: number;
  projectName: string;
  projectCategory: string;
  changes: ProjectChange[];
}

/**
 * Sends a project update notification email to a staff member
 */
export async function sendProjectUpdateEmail(data: EmailNotificationData) {
  const {
    staffEmail,
    staffName,
    projectId,
    projectName,
    projectCategory,
    changes,
  } = data;

  // Skip if no email configured or in development without email
  if (!config.email.apiKey) {
    console.log('Skipping email (no RESEND_API_KEY):', {
      to: staffEmail,
      project: projectName,
    });
    return null;
  }

  // Format changes for email
  const changesHtml = changes
    .map(
      (change) => `
    <li style="margin-bottom: 8px;">
      <strong>${formatFieldName(change.field)}</strong>:
      ${change.oldValue ? `<span style="color: #666;">${change.oldValue}</span> → ` : ''}
      <span style="color: #2563eb; font-weight: 600;">${change.newValue || 'Removed'}</span>
    </li>
  `
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Project Update</h1>
  </div>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px 20px; border-radius: 0 0 8px 8px;">

    <p style="font-size: 16px; margin-top: 0;">Hello <strong>${staffName}</strong>,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      A project you're assigned to has been updated:
    </p>

    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #1e40af;">
        ${projectName}
      </p>
      <p style="margin: 0; font-size: 14px; color: #64748b;">
        Category: ${projectCategory}
      </p>
    </div>

    <h3 style="color: #1e40af; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">
      Changes Made:
    </h3>

    <ul style="list-style: none; padding: 0; margin: 0 0 24px 0;">
      ${changesHtml}
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/projects/${projectId}"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Project Details
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
      Staffing Tracker<br>
      Asia CM Team<br>
      <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">asia-cm.team</a>
    </p>

  </div>

</body>
</html>
  `;

  const textContent = `
Project Update

Hello ${staffName},

A project you're assigned to has been updated:

Project: ${projectName}
Category: ${projectCategory}

Changes Made:
${changes.map((c) => `- ${formatFieldName(c.field)}: ${c.oldValue || 'None'} → ${c.newValue || 'Removed'}`).join('\n')}

View Project: ${appUrl}/projects/${projectId}

---
Staffing Tracker
Asia CM Team
  `;

  try {
    if (!resend) {
      throw new Error('Resend client not initialized');
    }
    const result = await resend.emails.send({
      from: fromEmail,
      to: staffEmail,
      subject: `Project Update: ${projectName}`,
      html: htmlContent,
      text: textContent,
    });

    console.log('Email sent successfully:', {
      to: staffEmail,
      project: projectName,
      emailId: result.data?.id,
    });

    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    // Don't throw - we don't want email failures to break the app
    return null;
  }
}

/**
 * Format field names for display
 */
function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    status: 'Status',
    name: 'Project Name',
    category: 'Category',
    priority: 'Priority',
    elStatus: 'EL Status',
    timetable: 'Timetable',
    bcAttorney: 'B&C Attorney',
    filingDate: 'Filing Date',
    listingDate: 'Listing Date',
    notes: 'Notes',
  };

  return fieldMap[field] || field;
}

/**
 * Detect changes between old and new project data
 */
export function detectProjectChanges(
  oldProject: any,
  newProject: any
): ProjectChange[] {
  const changes: ProjectChange[] = [];
  const fieldsToWatch = [
    'status',
    'name',
    'category',
    'priority',
    'elStatus',
    'timetable',
    'bcAttorney',
    'filingDate',
    'listingDate',
    'notes',
  ];

  for (const field of fieldsToWatch) {
    const oldValue = oldProject[field];
    const newValue = newProject[field];

    // Handle dates
    if (field === 'filingDate' || field === 'listingDate') {
      const oldDate = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
      const newDate = newValue ? new Date(newValue).toISOString().split('T')[0] : null;

      if (oldDate !== newDate) {
        changes.push({
          field,
          oldValue: oldDate,
          newValue: newDate,
        });
      }
      continue;
    }

    // Handle other fields
    if (oldValue !== newValue) {
      changes.push({
        field,
        oldValue: oldValue?.toString() || null,
        newValue: newValue?.toString() || null,
      });
    }
  }

  return changes;
}

interface WelcomeEmailData {
  email: string;
  username: string;
  tempPassword: string;
}

/**
 * Sends a welcome email to a newly created user with their credentials
 */
export async function sendWelcomeEmail(data: WelcomeEmailData) {
  const { email, username, tempPassword } = data;

  // Skip if no email configured
  if (!config.email.apiKey) {
    console.log('Skipping welcome email (no RESEND_API_KEY):', { to: email, username });
    return null;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Staffing Tracker</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Welcome to Staffing Tracker</h1>
  </div>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px 20px; border-radius: 0 0 8px 8px;">

    <p style="font-size: 16px; margin-top: 0;">Hello <strong>${username}</strong>,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Your account has been created for the Staffing Tracker application. You can now access the system to manage projects and staff assignments.
    </p>

    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 24px 0; border-radius: 4px;">
      <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #1e40af;">
        Your Login Credentials
      </h3>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Username:</strong> <span style="color: #2563eb; font-family: monospace; font-size: 15px;">${username}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Temporary Password:</strong> <span style="color: #2563eb; font-family: monospace; font-size: 15px;">${tempPassword}</span>
      </p>
    </div>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>⚠️ Important:</strong> You will be required to change your password on first login for security purposes.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/login"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Login to Staffing Tracker
      </a>
    </div>

    <div style="background: #f8fafc; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
        <strong>Access URL:</strong>
      </p>
      <p style="margin: 0; font-size: 14px;">
        <a href="${appUrl}" style="color: #2563eb; text-decoration: none; word-break: break-all;">${appUrl}</a>
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 14px; color: #64748b; margin: 16px 0 0 0;">
      If you have any questions or need assistance, please contact your system administrator.
    </p>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 24px 0 0 0;">
      Staffing Tracker<br>
      Asia CM Team<br>
      <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">asia-cm.team</a>
    </p>

  </div>

</body>
</html>
  `;

  const textContent = `
Welcome to Staffing Tracker

Hello ${username},

Your account has been created for the Staffing Tracker application.

Your Login Credentials:
- Username: ${username}
- Temporary Password: ${tempPassword}

⚠️ IMPORTANT: You will be required to change your password on first login for security purposes.

Access the application at: ${appUrl}/login

If you have any questions or need assistance, please contact your system administrator.

---
Staffing Tracker
Asia CM Team
${appUrl}
  `;

  try {
    if (!resend) {
      throw new Error('Resend client not initialized');
    }
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Welcome to Staffing Tracker - Your Account Credentials',
      html: htmlContent,
      text: textContent,
    });

    console.log('Welcome email sent successfully:', {
      to: email,
      username,
      emailId: result.data?.id,
    });

    return result;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - we don't want email failures to break user creation
    return null;
  }
}

/**
 * Check if a staff member should receive email notifications based on their position
 */
export async function shouldReceiveNotification(staffPosition: string): Promise<boolean> {
  try {
    // Get email settings
    const settings = await prisma.emailSettings.findFirst();

    // If no settings exist or emails are globally disabled, don't send
    if (!settings || !settings.emailNotificationsEnabled) {
      return false;
    }

    // Map position to notification setting
    const positionMap: Record<string, boolean> = {
      'Partner': settings.notifyPartner,
      'Associate': settings.notifyAssociate,
      'Junior FLIC': settings.notifyJuniorFlic,
      'Senior FLIC': settings.notifySeniorFlic,
      'Intern': settings.notifyIntern,
      'B&C Working Attorney': settings.notifyBCWorkingAttorney,
    };

    // Return the setting for this position, default to true if position not found
    return positionMap[staffPosition] ?? true;
  } catch (error) {
    console.error('Error checking email notification settings:', error);
    // Default to true if there's an error (fail open for notifications)
    return true;
  }
}

/**
 * Sends project update email to all assigned staff in one email
 * This saves API quota by sending 1 email instead of N individual emails
 * All recipients in To field for full deal team transparency
 */
export async function sendProjectUpdateEmails(emailDataList: EmailNotificationData[]) {
  if (emailDataList.length === 0) {
    return [];
  }

  // Skip if no email configured
  if (!config.email.apiKey) {
    console.log('Skipping project update emails (no RESEND_API_KEY):', {
      project: emailDataList[0]?.projectName,
      recipients: emailDataList.length,
    });
    return [];
  }

  // Check if email notifications are enabled globally
  const settings = await prisma.emailSettings.findFirst();
  if (!settings || !settings.emailNotificationsEnabled) {
    console.log('Skipping project update emails (notifications disabled):', {
      project: emailDataList[0]?.projectName,
      recipients: emailDataList.length,
    });
    return [];
  }

  // Filter recipients based on their position settings
  const filteredEmailData = [];
  for (const emailData of emailDataList) {
    if (await shouldReceiveNotification(emailData.staffPosition)) {
      filteredEmailData.push(emailData);
    }
  }

  if (filteredEmailData.length === 0) {
    console.log('No recipients after filtering by position settings:', {
      project: emailDataList[0]?.projectName,
      originalRecipients: emailDataList.length,
    });
    return [];
  }

  // Extract unique email addresses - this prevents duplicates if:
  // 1. Same person is assigned to project multiple times (different jurisdictions)
  // 2. Same person's position matches multiple enabled notification settings
  const ccEmails = [...new Set(filteredEmailData.map(data => data.staffEmail))];

  console.log('Email recipients after deduplication:', {
    project: emailDataList[0]?.projectName,
    totalAssignments: emailDataList.length,
    afterFiltering: filteredEmailData.length,
    uniqueEmails: ccEmails.length,
  });

  // Use first staff member's data for email content (all have same project/changes)
  const firstData = emailDataList[0];
  const { projectId, projectName, projectCategory, changes } = firstData;

  // Format changes for email
  const changesHtml = changes
    .map(
      (change) => `
    <li style="margin-bottom: 8px;">
      <strong>${formatFieldName(change.field)}</strong>:
      ${change.oldValue ? `<span style="color: #666;">${change.oldValue}</span> → ` : ''}
      <span style="color: #2563eb; font-weight: 600;">${change.newValue || 'Removed'}</span>
    </li>
  `
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Project Update</h1>
  </div>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px 20px; border-radius: 0 0 8px 8px;">

    <p style="font-size: 16px; margin-top: 0;">Hello,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      A project you're assigned to has been updated:
    </p>

    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #1e40af;">
        ${projectName}
      </p>
      <p style="margin: 0; font-size: 14px; color: #64748b;">
        Category: ${projectCategory}
      </p>
    </div>

    <h3 style="color: #1e40af; font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">
      Changes Made:
    </h3>

    <ul style="list-style: none; padding: 0; margin: 0 0 24px 0;">
      ${changesHtml}
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/projects/${projectId}"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Project Details
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
      Staffing Tracker<br>
      Asia CM Team<br>
      <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">asia-cm.team</a>
    </p>

  </div>

</body>
</html>
  `;

  const textContent = `
Project Update

A project you're assigned to has been updated:

Project: ${projectName}
Category: ${projectCategory}

Changes Made:
${changes.map((c) => `- ${formatFieldName(c.field)}: ${c.oldValue || 'None'} → ${c.newValue || 'Removed'}`).join('\n')}

View Project: ${appUrl}/projects/${projectId}

---
Staffing Tracker
Asia CM Team
  `;

  try {
    if (!resend) {
      throw new Error('Resend client not initialized');
    }

    // Send ONE email with all recipients in To field (deal team transparency)
    const result = await resend.emails.send({
      from: fromEmail,
      to: ccEmails, // All recipients in To field
      subject: `Project Update: ${projectName}`,
      html: htmlContent,
      text: textContent,
    });

    console.log('Project update email sent successfully:', {
      project: projectName,
      recipients: ccEmails.length,
      emailId: result.data?.id,
    });

    return [{ success: true, recipients: ccEmails, result }];
  } catch (error) {
    console.error('Failed to send project update email:', error);

    // Log failure to database
    const prisma = (await import('../utils/prisma')).default;
    try {
      await prisma.activityLog.create({
        data: {
          actionType: 'error',
          entityType: 'email',
          description: `Project update email failed: ${projectName} (${ccEmails.length} recipients)`,
          userId: null,
        },
      });
    } catch (logError) {
      console.error('[Email] Failed to log email failure to database:', logError);
    }

    return [{ success: false, recipients: ccEmails, error }];
  }
}

/**
 * Build partner reminder email HTML and text content
 * Pure function - returns both formats for reuse in preview and sender
 */
export function buildPartnerReminderHTML(data: PartnerReminderPayload): {
  html: string;
  text: string;
} {
  const { partnerName, projects } = data;

  // Build table rows
  const tableRows = projects
    .map(
      (project) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #1e40af;">${project.name || 'Untitled Project'}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #64748b;">
            ${project.category || '-'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
              ${project.missingFields.map((field) => `<li>${formatReminderFieldName(field)}</li>`).join('')}
            </ul>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            <a href="${appUrl}/projects/${project.id}"
               style="display: inline-block; background: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">
              Update
            </a>
          </td>
        </tr>
      `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Information Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Project Information Reminder</h1>
  </div>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px 20px; border-radius: 0 0 8px 8px;">

    <p style="font-size: 16px; margin-top: 0;">Hello <strong>${partnerName}</strong>,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      You have <strong>${projects.length}</strong> project${projects.length > 1 ? 's' : ''} with missing critical information that need${projects.length === 1 ? 's' : ''} to be updated:
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb;">Project Name</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb;">Category</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb;">Missing Information</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: #1e40af; border-bottom: 2px solid #e5e7eb;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>📅 Reminder Schedule:</strong> This reminder runs daily at 9 AM HKT. Please update the missing information by end of day.
      </p>
    </div>

    <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #1e40af;">
        <strong>Note:</strong> If multiple partners are assigned to a project, any partner can update these fields.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
      Staffing Tracker<br>
      Asia CM Team<br>
      <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">asia-cm.team</a>
    </p>

  </div>

</body>
</html>
  `;

  const text = `
Project Information Reminder

Hello ${partnerName},

You have ${projects.length} project${projects.length > 1 ? 's' : ''} with missing critical information:

${projects
  .map(
    (project, index) => `
${index + 1}. ${project.name || 'Untitled Project'} (${project.category || '-'})
   Missing: ${project.missingFields.map((f) => formatReminderFieldName(f)).join(', ')}
   Update: ${appUrl}/projects/${project.id}
`
  )
  .join('\n')}

📅 This reminder runs daily at 9 AM HKT. Please update by end of day.

Note: If multiple partners are assigned to a project, any partner can update these fields.

---
Staffing Tracker
Asia CM Team
${appUrl}
  `;

  return { html, text };
}

/**
 * Send partner reminder email
 * Respects test mode and debug logging
 */
export async function sendPartnerReminderEmail(
  data: PartnerReminderPayload
): Promise<any> {
  const { partnerEmail } = data;

  // Skip if no email configured
  if (!config.email.apiKey) {
    console.log('[Reminders] Skipping (no RESEND_API_KEY):', { to: partnerEmail });
    return null;
  }

  // Test mode: redirect to test recipient
  let recipient: string;
  if (process.env.EMAIL_TEST_MODE === 'true') {
    if (!process.env.EMAIL_TEST_RECIPIENT) {
      throw new Error(
        '[Reminders] EMAIL_TEST_MODE is enabled but EMAIL_TEST_RECIPIENT is not set. ' +
        'Refusing to send to partner email in test mode.'
      );
    }
    recipient = process.env.EMAIL_TEST_RECIPIENT;
  } else {
    recipient = partnerEmail;
  }

  // Debug logging
  if (process.env.LOG_EMAIL_PAYLOADS === 'true') {
    console.log('[DEBUG] Partner reminder payload:', JSON.stringify(data, null, 2));
  }

  // Build email content
  const { html, text } = buildPartnerReminderHTML(data);

  try {
    if (!resend) {
      throw new Error('Resend client not initialized');
    }

    const result = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject: 'Project Information Reminder - Action Required',
      html,
      text,
    });

    console.log('[Reminders] Sent successfully:', {
      to: recipient,
      projects: data.projects.length,
      emailId: result.data?.id,
    });

    return result;
  } catch (error) {
    console.error('[Reminders] Failed to send email:', error);
    throw error;
  }
}

/**
 * Send daily partner reminders with rate limiting
 * Returns summary of sent/failed emails
 */
export async function sendDailyPartnerReminders(
  reminders: PartnerReminderPayload[]
): Promise<{
  sent: number;
  failed: number;
  total: number;
  errors: Array<{ email: string; error: any }>;
}> {
  console.log(`📧 [Reminders] Sending to ${reminders.length} partners`);

  const results = {
    sent: 0,
    failed: 0,
    total: reminders.length,
    errors: [] as Array<{ email: string; error: any }>,
  };

  for (let i = 0; i < reminders.length; i++) {
    const reminder = reminders[i];

    // Rate limiting: delay between emails (except first)
    if (i > 0) {
      await delay(600); // 600ms = 1.67 emails/sec (under Resend's 2/sec limit)
    }

    try {
      await sendPartnerReminderEmail(reminder);
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({ email: reminder.partnerEmail, error });
    }
  }

  console.log(
    `✅ [Reminders] Complete: Sent ${results.sent}/${results.total}, Failed ${results.failed}`
  );

  // Log failures to database for monitoring
  if (results.failed > 0) {
    const prisma = (await import('../utils/prisma')).default;

    try {
      await prisma.activityLog.create({
        data: {
          actionType: 'error',
          entityType: 'email',
          description: `Partner reminder failures: ${results.failed}/${results.total} emails failed`,
          userId: null, // System action
        },
      });

      console.error(`⚠️  [Reminders] Logged ${results.failed} failures to database`);

      // If failure rate is high, log additional warning
      const failureRate = (results.failed / results.total) * 100;
      if (failureRate > 20) {
        console.error(`🚨 [Reminders] HIGH FAILURE RATE: ${failureRate.toFixed(1)}% of emails failed!`);
      }
    } catch (logError) {
      console.error('[Reminders] Failed to log email failures to database:', logError);
    }
  }

  return results;
}
