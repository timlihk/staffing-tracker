import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.EMAIL_FROM || 'Asia CM Team <notifications@asia-cm.team>';
const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

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
  if (!process.env.RESEND_API_KEY) {
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
      bcc: 'mengyu.lu@kirkland.hk',
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
  if (!process.env.RESEND_API_KEY) {
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
 * Sends multiple project update emails with rate limiting
 * Resend rate limit: 2 requests per second
 * We send 1 email every 600ms to stay well under the limit
 */
export async function sendProjectUpdateEmails(emailDataList: EmailNotificationData[]) {
  const results = [];

  for (let i = 0; i < emailDataList.length; i++) {
    const emailData = emailDataList[i];

    // Add delay before each email (except the first one)
    if (i > 0) {
      await delay(600); // 600ms = 1.67 emails per second (safely under 2/sec limit)
    }

    try {
      const result = await sendProjectUpdateEmail(emailData);
      results.push({ success: true, email: emailData.staffEmail, result });
    } catch (error) {
      console.error(`Failed to send email to ${emailData.staffEmail}:`, error);
      results.push({ success: false, email: emailData.staffEmail, error });
    }
  }

  return results;
}
