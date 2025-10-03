# Email Notification Setup Guide

This guide walks you through setting up email notifications for the Staffing Tracker application using Resend with your Cloudflare-hosted domain.

## Overview

**Email Service**: Resend (Free Tier - 3,000 emails/month)
**Domain**: asia-cm.team
**Use Case**: Notify staff members when projects they're assigned to are updated

## Step 1: Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up with your email
3. Verify your email address
4. Log in to the Resend dashboard

## Step 2: Add and Verify Your Domain

### 2.1 Add Domain in Resend

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain: `asia-cm.team`
4. Click **Add**

### 2.2 Get DNS Records

Resend will provide you with DNS records that need to be added to Cloudflare. You'll receive:

- **SPF Record** (TXT): Allows Resend to send emails on your behalf
- **DKIM Records** (TXT): Authenticates your emails and prevents spoofing
- **DMARC Record** (TXT): Defines how to handle unauthenticated emails

Example records (your actual values will be different):
```
Type: TXT
Name: @
Value: v=spf1 include:sendgrid.net ~all

Type: TXT
Name: resend._domainkey
Value: k=rsa; p=MIGfMA0GCS...

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; pct=100; rua=mailto:dmarc@asia-cm.team
```

### 2.3 Add DNS Records to Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain: `asia-cm.team`
3. Go to **DNS** > **Records**
4. For each DNS record from Resend:
   - Click **Add record**
   - Select **Type** (TXT)
   - Enter **Name** (e.g., `@`, `resend._domainkey`, `_dmarc`)
   - Enter **Content** (the value from Resend)
   - Set **TTL** to Auto
   - Click **Save**

### 2.4 Verify Domain in Resend

1. Return to Resend dashboard
2. Go to **Domains**
3. Click **Verify** next to your domain
4. Wait for verification (can take a few minutes to propagate)
5. Once verified, you'll see a green checkmark

## Step 3: Create API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Name it: `Staffing Tracker Production`
4. Select **Sending access**
5. Click **Create**
6. **IMPORTANT**: Copy the API key immediately (starts with `re_`)
7. Store it securely - you won't be able to see it again

## Step 4: Configure Application

### 4.1 Add Environment Variable (Local Development)

Edit `backend/.env`:
```bash
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=notifications@asia-cm.team
```

### 4.2 Add Environment Variable (Railway Production)

1. Go to [Railway Dashboard](https://railway.app)
2. Select your backend service
3. Go to **Variables**
4. Click **New Variable**
5. Add:
   - Name: `RESEND_API_KEY`
   - Value: `re_your_api_key_here`
6. Add another:
   - Name: `EMAIL_FROM`
   - Value: `notifications@asia-cm.team`
7. Click **Deploy** to apply changes

## Step 5: Test Email Sending

Once the implementation is complete, you can test email notifications by:

1. Updating a project that has staff assigned
2. Check the assigned staff member's email
3. Verify the notification was received

## Troubleshooting

### Domain Not Verifying
- Wait 10-15 minutes for DNS propagation
- Check DNS records are exactly as provided by Resend
- Use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) to verify DNS records

### Emails Not Sending
- Verify `RESEND_API_KEY` is set correctly in Railway
- Check Resend dashboard > Logs for delivery status
- Ensure staff members have valid email addresses in the database
- Check application logs for errors

### Emails Going to Spam
- Ensure all DNS records (SPF, DKIM, DMARC) are properly configured
- Start with small volume to build sender reputation
- Ask recipients to mark as "Not Spam" and add to contacts

## Email Notification Triggers

The system will send emails when:

1. **Project Status Changes**: Active → Slow-down, Suspended, etc.
2. **Project Dates Change**: Filing date or listing date updated
3. **Staff Assignment Changes**: Staff added or removed from project
4. **Project Details Update**: Name, category, priority, or notes changed

## Email Template Preview

```
To: [Staff Member Email]
BCC: mengyu.lu@kirkland.hk (automatic)
Subject: Project Update: [Project Name]

Hello [Staff Name],

A project you're assigned to has been updated:

Project: [Project Name]
Category: [Category]

Changes:
- Status changed from "Active" to "Slow-down"
- Filing date changed to 2025-10-15

View Project: https://asia-cm.team/projects/123

---
Staffing Tracker
Kirkland & Ellis
```

**Note**: All notification emails automatically BCC mengyu.lu@kirkland.hk for monitoring and oversight. This BCC is hidden from recipients.

## Monthly Usage Limits

**Free Tier**: 3,000 emails/month

Estimated usage for your team:
- ~50 staff members
- ~10 project updates per day
- ~5 staff per project average
- **Estimated**: ~1,500 emails/month (well within free tier)

## Support

- **Resend Documentation**: https://resend.com/docs
- **Resend Support**: support@resend.com
- **DNS Issues**: Contact Cloudflare support

## Next Steps

Once this setup is complete, the development team will:
1. Install Resend SDK in the backend
2. Create email service and templates
3. Add notification triggers to project controllers
4. Deploy to production
5. Test end-to-end email delivery
