/**
 * Billing Controller
 *
 * Handles all billing-related API endpoints
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

/**
 * Helper function to convert BigInt values to numbers
 */
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertBigIntToNumber(obj[key]);
    }
    return result;
  }
  return obj;
}

/**
 * GET /api/billing/projects
 * Get all billing projects with financial summary
 */
export async function getBillingProjects(req: AuthRequest, res: Response) {
  try {
    const authUser = req.user;
    const isAdmin = authUser?.role === 'admin';

    // Get full user record with staffId
    const user = authUser?.userId
      ? await prisma.user.findUnique({
          where: { id: authUser.userId },
          select: { staffId: true },
        })
      : null;

    // If user is B&C attorney (not admin), filter by their staff_id
    let userProjectIds: bigint[] = [];
    if (!isAdmin && user?.staffId) {
      // Get project IDs where this staff member is a B&C attorney
      const userProjects = await prisma.billing_project_bc_attorney.findMany({
        where: { staff_id: user.staffId },
        select: { billing_project_id: true },
      });
      userProjectIds = userProjects.map(p => p.billing_project_id);
    }

    const projects = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_bc_attorney_dashboard
      ORDER BY project_name
    `;

    // Apply authorization filters:
    // 1. Admins can see all billing projects
    // 2. B&C attorneys can only see their assigned projects
    // 3. Everyone else sees nothing
    let filteredProjects: any[];
    if (isAdmin) {
      filteredProjects = projects;
    } else if (userProjectIds.length > 0) {
      filteredProjects = projects.filter(p => userProjectIds.includes(BigInt(p.project_id)));
    } else {
      // Non-admins with no assigned projects should see nothing
      filteredProjects = [];
    }

    // Convert BigInt values to numbers for JSON serialization
    const sanitizedProjects = convertBigIntToNumber(filteredProjects);

    res.json(sanitizedProjects);
  } catch (error) {
    console.error('Error fetching billing projects:', error);
    res.status(500).json({ error: 'Failed to fetch billing projects' });
  }
}

/**
 * GET /api/billing/projects/:id
 * Get billing project detail with milestones, events, etc.
 * Structured by C/M numbers → Engagements → Milestones
 *
 * Query params:
 * - view: 'summary' | 'full' (default: 'full')
 * - cmId: specific CM number to fetch
 * - engagementId: specific engagement to fetch details for
 */
export async function getBillingProjectDetail(req: AuthRequest, res: Response) {
  try {
    // Disable caching to ensure fresh data after updates
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { id } = req.params;
    const projectId = parseInt(id, 10);
    const { view = 'full', cmId, engagementId } = req.query;

    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    if (Array.isArray(cmId) || (cmId !== undefined && typeof cmId !== 'string')) {
      return res.status(400).json({ error: 'Invalid cmId parameter' });
    }
    const cmIdNumber = typeof cmId === 'string' ? Number.parseInt(cmId, 10) : undefined;
    if (typeof cmId === 'string' && Number.isNaN(cmIdNumber)) {
      return res.status(400).json({ error: 'Invalid cmId parameter' });
    }

    if (Array.isArray(engagementId) || (engagementId !== undefined && typeof engagementId !== 'string')) {
      return res.status(400).json({ error: 'Invalid engagementId parameter' });
    }
    const engagementIdNumber = typeof engagementId === 'string'
      ? Number.parseInt(engagementId, 10)
      : undefined;
    if (typeof engagementId === 'string' && Number.isNaN(engagementIdNumber)) {
      return res.status(400).json({ error: 'Invalid engagementId parameter' });
    }

    // Get project basic info
    const projectData = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_bc_attorney_dashboard
      WHERE project_id = ${projectId}
      LIMIT 1
    `;

    if (!projectData || projectData.length === 0) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // For summary view, return minimal data without nested details
    if (view === 'summary') {
      const summaryData = await prisma.$queryRaw<any[]>`
        SELECT
          cm.cm_id,
          cm.cm_no,
          cm.is_primary,
          cm.open_date,
          cm.closed_date,
          cm.status,
          COUNT(DISTINCT e.engagement_id) as engagement_count,
          COUNT(DISTINCT m.milestone_id) as milestone_count,
          COUNT(DISTINCT CASE WHEN m.completed THEN m.milestone_id END) as completed_milestone_count
        FROM billing_project_cm_no cm
        LEFT JOIN billing_engagement e ON e.cm_id = cm.cm_id
        LEFT JOIN billing_milestone m ON m.engagement_id = e.engagement_id
        WHERE cm.project_id = ${projectId}
        GROUP BY cm.cm_id, cm.cm_no, cm.is_primary, cm.open_date, cm.closed_date, cm.status
        ORDER BY cm.is_primary DESC, cm.cm_no
      `;

      // Get minimal event and comment counts
      const eventCount = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count
        FROM billing_event be
        INNER JOIN billing_engagement e ON e.engagement_id = be.engagement_id
        INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
        WHERE cm.project_id = ${projectId}
      `;

      return res.json(convertBigIntToNumber({
        project: projectData[0],
        cmNumbers: summaryData.map(cm => ({
          ...cm,
          engagements: [] // Empty array for lazy loading
        })),
        events: [],
        financeComments: [],
        eventCount: eventCount[0]?.count || 0,
        viewMode: 'summary'
      }));
    }

    let whereCondition = '';
    if (cmIdNumber !== undefined) {
      whereCondition += ` AND cm.cm_id = ${cmIdNumber}`;
    }
    if (engagementIdNumber !== undefined) {
      whereCondition += ` AND e.engagement_id = ${engagementIdNumber}`;
    }
    const appendedConditions = Prisma.raw(whereCondition);

    // Use a single comprehensive query with JSON aggregation for full data
    // Apply optional filters directly in the query
    const fullData = await prisma.$queryRaw<any[]>`
      WITH project_data AS (
        SELECT
          cm.cm_id,
          cm.cm_no,
          cm.is_primary,
          cm.project_id,
          cm.open_date,
          cm.closed_date,
          cm.status,
          cm.billing_to_date_usd,
          cm.billing_to_date_cny,
          cm.collected_to_date_usd,
          cm.collected_to_date_cny,
          cm.ubt_usd,
          cm.ubt_cny,
          cm.billing_credit_usd,
          cm.billing_credit_cny,
          cm.financials_updated_at,
          cm.financials_updated_by,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'engagement_id', e.engagement_id,
                'cm_id', e.cm_id,
                'engagement_code', e.engagement_code,
                'engagement_title', e.engagement_title,
                'name', e.name,
                'start_date', e.start_date,
                'end_date', e.end_date,
                'feeArrangement', (
                  SELECT JSON_BUILD_OBJECT(
                    'fee_id', fa.fee_id,
                    'raw_text', fa.raw_text,
                    'lsd_date', fa.lsd_date,
                    'lsd_raw', fa.lsd_raw
                  )
                  FROM billing_fee_arrangement fa
                  WHERE fa.engagement_id = e.engagement_id
                  LIMIT 1
                ),
                'milestones', (
                  SELECT COALESCE(JSON_AGG(
                    JSON_BUILD_OBJECT(
                      'milestone_id', m.milestone_id,
                      'ordinal', m.ordinal,
                      'title', m.title,
                      'description', m.description,
                      'trigger_type', m.trigger_type,
                      'trigger_text', m.trigger_text,
                      'amount_value', m.amount_value,
                      'amount_currency', m.amount_currency,
                      'is_percent', m.is_percent,
                      'percent_value', m.percent_value,
                      'due_date', m.due_date,
                      'completed', m.completed,
                      'completion_date', m.completion_date,
                      'completion_source', m.completion_source,
                      'invoice_sent_date', m.invoice_sent_date,
                      'payment_received_date', m.payment_received_date,
                      'notes', m.notes,
                      'raw_fragment', m.raw_fragment,
                      'sort_order', m.sort_order
                    ) ORDER BY m.sort_order ASC, m.ordinal ASC
                  ), '[]'::JSON)
                  FROM billing_milestone m
                  WHERE m.engagement_id = e.engagement_id
                )
              ) ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC
            ) FILTER (WHERE e.engagement_id IS NOT NULL),
            '[]'::JSON
          ) as engagements,
          efs.billing_usd,
          efs.collection_usd,
          efs.agreed_fee_usd,
          efs.agreed_fee_cny,
          efs.billing_cny,
          efs.collection_cny
        FROM billing_project_cm_no cm
        LEFT JOIN billing_engagement e ON e.cm_id = cm.cm_id
        LEFT JOIN billing_engagement_financial_summary efs ON efs.cm_id = cm.cm_id
        WHERE cm.project_id = ${projectId}${appendedConditions}
        GROUP BY cm.cm_id, cm.cm_no, cm.is_primary, cm.project_id, cm.open_date, cm.closed_date, cm.status,
                 cm.billing_to_date_usd, cm.billing_to_date_cny, cm.collected_to_date_usd, cm.collected_to_date_cny,
                 cm.ubt_usd, cm.ubt_cny, cm.billing_credit_usd, cm.billing_credit_cny,
                 cm.financials_updated_at, cm.financials_updated_by,
                 efs.billing_usd, efs.collection_usd, efs.agreed_fee_usd, efs.agreed_fee_cny,
                 efs.billing_cny, efs.collection_cny
        ORDER BY cm.is_primary DESC, cm.cm_no
      )
      SELECT * FROM project_data
    `;

    // Get events only if full view and no specific filters
    let events = [];
    let financeComments = [];

    if (cmIdNumber === undefined && engagementIdNumber === undefined) {
      const engagementIds = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT e.engagement_id
        FROM billing_engagement e
        INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
        WHERE cm.project_id = ${projectId}
      `;

      const engIds = engagementIds.map(e => e.engagement_id);

      if (engIds.length > 0) {
        events = await prisma.$queryRaw<any[]>`
          SELECT *
          FROM billing_event
          WHERE engagement_id = ANY(${engIds}::int[])
          ORDER BY event_date DESC
          LIMIT 50
        `;

        financeComments = await prisma.$queryRaw<any[]>`
          SELECT *
          FROM billing_finance_comment
          WHERE engagement_id = ANY(${engIds}::int[])
          ORDER BY created_at DESC
          LIMIT 100
        `;
      }
    }

    const response = convertBigIntToNumber({
      project: projectData[0],
      cmNumbers: fullData,
      events,
      financeComments,
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching billing project detail:', error);
    res.status(500).json({ error: 'Failed to fetch billing project detail' });
  }
}

/**
 * GET /api/billing/projects/:id/engagement/:engagementId
 * Get detailed data for a specific engagement (for lazy loading)
 */
export async function getEngagementDetail(req: AuthRequest, res: Response) {
  try {
    const { id, engagementId } = req.params;
    const projectId = parseInt(id, 10);
    const engId = parseInt(engagementId, 10);

    if (Number.isNaN(projectId) || Number.isNaN(engId)) {
      return res.status(400).json({ error: 'Invalid project or engagement ID' });
    }

    // Get engagement details with JSON aggregation
    const engagementData = await prisma.$queryRaw<any[]>`
      SELECT
        e.engagement_id,
        e.cm_id,
        e.engagement_code,
        e.engagement_title,
        e.name,
        e.start_date,
        e.end_date,
        cm.billing_to_date_usd,
        cm.billing_to_date_cny,
        cm.collected_to_date_usd,
        cm.collected_to_date_cny,
        cm.ubt_usd,
        cm.ubt_cny,
        cm.billing_credit_usd,
        cm.billing_credit_cny,
        cm.financials_updated_at,
        cm.financials_updated_by,
        efs.billing_usd,
        efs.collection_usd,
        efs.billing_credit_usd as efs_billing_credit_usd,
        efs.ubt_usd as efs_ubt_usd,
        efs.billing_cny,
        efs.collection_cny,
        efs.billing_credit_cny as efs_billing_credit_cny,
        efs.ubt_cny as efs_ubt_cny,
        efs.agreed_fee_usd,
        efs.agreed_fee_cny,
        efs.financials_last_updated_at as efs_financials_last_updated_at,
        efs.financials_last_updated_by as efs_financials_last_updated_by,
        (
          SELECT JSON_BUILD_OBJECT(
            'fee_id', fa.fee_id,
            'raw_text', fa.raw_text,
            'lsd_date', fa.lsd_date,
            'lsd_raw', fa.lsd_raw
          )
          FROM billing_fee_arrangement fa
          WHERE fa.engagement_id = e.engagement_id
          LIMIT 1
        ) as "feeArrangement",
        (
          SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
              'milestone_id', m.milestone_id,
              'ordinal', m.ordinal,
              'title', m.title,
              'description', m.description,
              'trigger_type', m.trigger_type,
              'trigger_text', m.trigger_text,
              'amount_value', m.amount_value,
              'amount_currency', m.amount_currency,
              'is_percent', m.is_percent,
              'percent_value', m.percent_value,
              'due_date', m.due_date,
              'completed', m.completed,
              'completion_date', m.completion_date,
              'completion_source', m.completion_source,
              'invoice_sent_date', m.invoice_sent_date,
              'payment_received_date', m.payment_received_date,
              'notes', m.notes,
              'raw_fragment', m.raw_fragment
            ) ORDER BY m.sort_order ASC, m.ordinal ASC
          ), '[]'::JSON)
          FROM billing_milestone m
          WHERE m.engagement_id = e.engagement_id
        ) as milestones,
        (
          SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
              'comment_id', fc.comment_id,
              'engagement_id', fc.engagement_id,
              'milestone_id', fc.milestone_id,
              'comment_text', fc.comment_text,
              'notes', fc.notes,
              'created_at', fc.created_at,
              'created_by', fc.created_by
            ) ORDER BY fc.created_at DESC
          ), '[]'::JSON)
          FROM (
            SELECT
              comment_id,
              engagement_id,
              milestone_id,
              comment_text,
              notes,
              created_at,
              created_by
            FROM billing_finance_comment
            WHERE engagement_id = e.engagement_id
            ORDER BY created_at DESC
            LIMIT 100
          ) fc
        ) as "financeComments",
        (
          SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
              'event_id', be.event_id,
              'engagement_id', be.engagement_id,
              'event_type', be.event_type,
              'event_date', be.event_date,
              'description', be.description,
              'amount_usd', be.amount_usd,
              'amount_cny', be.amount_cny,
              'created_at', be.created_at,
              'created_by', be.created_by
            ) ORDER BY be.event_date DESC, be.event_id DESC
          ), '[]'::JSON)
          FROM (
            SELECT
              event_id,
              engagement_id,
              event_type,
              event_date,
              description,
              amount_usd,
              amount_cny,
              created_at,
              created_by
            FROM billing_event
            WHERE engagement_id = e.engagement_id
            ORDER BY event_date DESC, event_id DESC
            LIMIT 50
          ) be
        ) as events
      FROM billing_engagement e
      INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      LEFT JOIN billing_engagement_financial_summary efs ON efs.cm_id = cm.cm_id
      WHERE e.engagement_id = ${engId}
        AND cm.project_id = ${projectId}
      LIMIT 1
    `;

    if (!engagementData || engagementData.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    res.json(convertBigIntToNumber(engagementData[0]));
  } catch (error) {
    console.error('Error fetching engagement detail:', error);
    res.status(500).json({ error: 'Failed to fetch engagement detail' });
  }
}

/**
 * GET /api/billing/projects/:id/cm/:cmId/engagements
 * Get engagements for a specific C/M number (for lazy loading)
 */
export async function getCMEngagements(req: AuthRequest, res: Response) {
  try {
    const { id, cmId } = req.params;
    const projectId = parseInt(id, 10);
    const cmIdNumber = parseInt(cmId, 10);

    if (Number.isNaN(projectId) || Number.isNaN(cmIdNumber)) {
      return res.status(400).json({ error: 'Invalid project or CM ID' });
    }

    const engagements = await prisma.$queryRaw<any[]>`
      SELECT
        e.engagement_id,
        e.cm_id,
        e.engagement_code,
        e.engagement_title,
        e.name,
        e.start_date,
        e.end_date,
        COUNT(m.milestone_id) as milestone_count,
        COUNT(CASE WHEN M.completed THEN 1 END) as completed_milestone_count
      FROM billing_engagement e
      INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      LEFT JOIN billing_milestone m ON m.engagement_id = e.engagement_id
      WHERE cm.project_id = ${projectId}
        AND cm.cm_id = ${cmIdNumber}
      GROUP BY
        e.engagement_id, e.cm_id, e.engagement_code, e.engagement_title,
        e.name, e.start_date, e.end_date
      ORDER BY e.start_date DESC NULLS LAST, e.engagement_id
    `;

    res.json(convertBigIntToNumber(engagements));
  } catch (error) {
    console.error('Error fetching CM engagements:', error);
    res.status(500).json({ error: 'Failed to fetch CM engagements' });
  }
}

/**
 * GET /api/billing/projects/:id/activity
 * Fetch recent billing events and finance comments without loading full hierarchy
 */
export async function getBillingProjectActivity(req: AuthRequest, res: Response) {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const engagementIds = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      SELECT DISTINCT e.engagement_id
      FROM billing_engagement e
      INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
      WHERE cm.project_id = ${projectId}
    `;

    if (!engagementIds.length) {
      return res.json({ events: [], financeComments: [], eventCount: 0 });
    }

    const engIds = engagementIds.map(row => Number(row.engagement_id));

    const events = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM billing_event
      WHERE engagement_id = ANY(${engIds}::int[])
      ORDER BY event_date DESC
      LIMIT 50
    `;

    const financeComments = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM billing_finance_comment
      WHERE engagement_id = ANY(${engIds}::int[])
      ORDER BY created_at DESC
      LIMIT 100
    `;

    res.json(convertBigIntToNumber({
      events,
      financeComments,
      eventCount: events.length,
    }));
  } catch (error) {
    console.error('Error fetching billing project activity:', error);
    res.status(500).json({ error: 'Failed to fetch billing project activity' });
  }
}

/**
 * PATCH /api/billing/engagements/:engagementId/fee-arrangement
 * Update fee arrangement reference text and LSD date for an engagement
 */
export async function updateFeeArrangement(req: AuthRequest, res: Response) {
  try {
    const engagementId = parseInt(req.params.engagementId, 10);
    if (Number.isNaN(engagementId)) {
      return res.status(400).json({ error: 'Invalid engagement ID' });
    }

    const { raw_text, lsd_date } = req.body as { raw_text?: string; lsd_date?: string | null };

    if (typeof raw_text !== 'string' || raw_text.trim().length === 0) {
      return res.status(400).json({ error: 'Fee arrangement text is required' });
    }

    const existing = await prisma.$queryRaw<{ fee_id: bigint }[]>`
      SELECT fee_id
      FROM billing_fee_arrangement
      WHERE engagement_id = ${engagementId}
      LIMIT 1
    `;

    const trimmedLsdDate = typeof lsd_date === 'string' ? lsd_date.trim() : '';
    const lsdDateValue = trimmedLsdDate ? parseDate(trimmedLsdDate) : null;

    if (trimmedLsdDate && !lsdDateValue) {
      return res.status(400).json({ error: 'Invalid long stop date' });
    }

    if (!existing.length) {
      await prisma.$executeRaw`
        INSERT INTO billing_fee_arrangement (engagement_id, raw_text, lsd_date)
        VALUES (${engagementId}, ${raw_text}, ${lsdDateValue})
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE billing_fee_arrangement
        SET raw_text = ${raw_text},
            lsd_date = ${lsdDateValue}
        WHERE fee_id = ${existing[0].fee_id}
      `;
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'update',
          entityType: 'billing_fee_arrangement',
          entityId: engagementId,
          description: `Updated fee arrangement for engagement ${engagementId}`,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating fee arrangement:', error);
    res.status(500).json({ error: 'Failed to update fee arrangement' });
  }
}

/**
 * PATCH /api/billing/milestones
 * Bulk update milestone status and notes
 */
export async function updateMilestones(req: AuthRequest, res: Response) {
  try {
    const { milestones } = req.body as {
      milestones?: Array<{
        milestone_id: number;
        completed?: boolean;
        invoice_sent_date?: string | null;
        payment_received_date?: string | null;
        notes?: string | null;
        due_date?: string | null;
        title?: string | null;
        trigger_text?: string | null;
        amount_value?: number | null;
        amount_currency?: string | null;
        ordinal?: number | null;
      }>;
    };

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: 'Milestones payload is required' });
    }

    // Process each milestone update sequentially to avoid transaction timeout
    for (const milestone of milestones) {
      const milestoneId = Number(milestone.milestone_id);
      if (Number.isNaN(milestoneId)) {
        throw new Error('Invalid milestone ID');
      }

      const updateExpressions: Prisma.Sql[] = [];

      if (Object.prototype.hasOwnProperty.call(milestone, 'completed')) {
        const completed = Boolean(milestone.completed);
        updateExpressions.push(Prisma.sql`completed = ${completed}`);
        updateExpressions.push(
          Prisma.sql`
            completion_date = CASE
              WHEN ${completed} = true AND completed = false THEN NOW()
              WHEN ${completed} = false THEN NULL
              ELSE completion_date
            END
          `
        );
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'invoice_sent_date')) {
        const invoiceDate = parseDate(milestone.invoice_sent_date);
        updateExpressions.push(Prisma.sql`invoice_sent_date = ${invoiceDate}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'payment_received_date')) {
        const paymentDate = parseDate(milestone.payment_received_date);
        updateExpressions.push(Prisma.sql`payment_received_date = ${paymentDate}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'notes')) {
        const notes = parseNullableString(milestone.notes);
        updateExpressions.push(Prisma.sql`notes = ${notes}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'due_date')) {
        const dueDate = parseDate(milestone.due_date);
        updateExpressions.push(Prisma.sql`due_date = ${dueDate}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'title')) {
        const title = parseNullableString(milestone.title);
        updateExpressions.push(Prisma.sql`title = ${title}`);
        updateExpressions.push(Prisma.sql`description = ${title}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'trigger_text')) {
        const triggerText = parseNullableString(milestone.trigger_text);
        updateExpressions.push(Prisma.sql`trigger_text = ${triggerText}`);
        updateExpressions.push(Prisma.sql`raw_fragment = ${triggerText}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'amount_value')) {
        const amountValue = parseNullableNumber(milestone.amount_value);
        updateExpressions.push(Prisma.sql`amount_value = ${amountValue}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'amount_currency')) {
        const currency = parseNullableString(milestone.amount_currency);
        updateExpressions.push(Prisma.sql`amount_currency = ${currency}`);
      }

      if (Object.prototype.hasOwnProperty.call(milestone, 'ordinal')) {
        const ordinal = parseNullableNumber(milestone.ordinal);
        updateExpressions.push(Prisma.sql`ordinal = ${ordinal}`);
      }

      if (updateExpressions.length === 0) {
        continue;
      }

      updateExpressions.push(Prisma.sql`updated_at = NOW()`);

      const updateResult = await prisma.$executeRaw(
        Prisma.sql`
          UPDATE billing_milestone
          SET ${Prisma.join(updateExpressions, ', ')}
          WHERE milestone_id = ${milestoneId}
        `
      );

      console.log(`Milestone ${milestoneId} update result:`, updateResult, 'rows affected');
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'update',
          entityType: 'billing_milestone',
          entityId: milestones[0].milestone_id,
          description: `Updated ${milestones.length} billing milestones`,
        },
      });
    }

    // Set cache-control headers to prevent stale data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating milestones:', error);
    res.status(500).json({ error: 'Failed to update milestones' });
  }
}

export async function createMilestone(req: AuthRequest, res: Response) {
  try {
    const engagementId = parseInt(req.params.engagementId, 10);

    if (Number.isNaN(engagementId)) {
      return res.status(400).json({ error: 'Invalid engagement ID' });
    }

    const engagement = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      SELECT engagement_id
      FROM billing_engagement
      WHERE engagement_id = ${engagementId}
      LIMIT 1
    `;

    if (!engagement || engagement.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const feeRecord = await prisma.$queryRaw<{ fee_id: bigint }[]>`
      SELECT fee_id
      FROM billing_fee_arrangement
      WHERE engagement_id = ${engagementId}
      LIMIT 1
    `;

    const { body } = req;
    const title = parseNullableString(body?.title);
    const triggerText = parseNullableString(body?.trigger_text);
    const notes = parseNullableString(body?.notes);
    const dueDate = parseDate(body?.due_date);
    const invoiceDate = parseDate(body?.invoice_sent_date);
    const paymentDate = parseDate(body?.payment_received_date);
    const amountValue = parseNullableNumber(body?.amount_value);
    const amountCurrency = parseNullableString(body?.amount_currency);
    const ordinal = parseNullableNumber(body?.ordinal);
    const completed = Boolean(body?.completed);

    const nextSort = await prisma.$queryRaw<{ next_sort: number }[]>`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort
      FROM billing_milestone
      WHERE engagement_id = ${engagementId}
    `;

    const sortOrder = nextSort[0]?.next_sort ?? 1;

    const inserted = await prisma.$queryRaw<{ milestone_id: bigint }[]>`
      INSERT INTO billing_milestone (
        engagement_id,
        fee_id,
        ordinal,
        title,
        description,
        trigger_type,
        trigger_text,
        amount_value,
        amount_currency,
        is_percent,
        percent_value,
        due_date,
        completed,
        completion_date,
        invoice_sent_date,
        payment_received_date,
        notes,
        raw_fragment,
        sort_order,
        created_at,
        updated_at
      ) VALUES (
        ${engagementId},
        ${feeRecord[0]?.fee_id ?? null},
        ${ordinal},
        ${title},
        ${title},
        'manual',
        ${triggerText},
        ${amountValue},
        ${amountCurrency},
        false,
        NULL,
        ${dueDate},
        ${completed},
        CASE WHEN ${completed} THEN NOW() ELSE NULL END,
        ${invoiceDate},
        ${paymentDate},
        ${notes},
        ${triggerText ?? title},
        ${sortOrder},
        NOW(),
        NOW()
      )
      RETURNING milestone_id
    `;

    const milestoneId = inserted[0]?.milestone_id;

    if (!milestoneId) {
      throw new Error('Failed to create milestone');
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'create',
          entityType: 'billing_milestone',
          entityId: Number(milestoneId),
          description: `Created billing milestone for engagement ${engagementId}`,
        },
      });
    }

    res.json(convertBigIntToNumber({ success: true, milestone_id: milestoneId }));
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
}

export async function deleteMilestone(req: AuthRequest, res: Response) {
  try {
    const milestoneId = parseInt(req.params.milestoneId, 10);

    if (Number.isNaN(milestoneId)) {
      return res.status(400).json({ error: 'Invalid milestone ID' });
    }

    const deleted = await prisma.$queryRaw<{ milestone_id: bigint }[]>`
      DELETE FROM billing_milestone
      WHERE milestone_id = ${milestoneId}
      RETURNING milestone_id
    `;

    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'delete',
          entityType: 'billing_milestone',
          entityId: milestoneId,
          description: `Deleted billing milestone ${milestoneId}`,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
}

const parseDate = (value: string | null | undefined) => {
  if (!value || value === '') return null;

  // Handle date strings like "2024-12-11"
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const parseNullableString = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseNullableNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};
/**
 * PATCH /api/billing/projects/:id/financials
 * Update UBT and Billing Credits for a project
 */
export async function updateFinancials(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const projectId = parseInt(id, 10);
    const { ubt_usd, ubt_cny, billing_credit_usd, billing_credit_cny } = req.body;
    const userId = req.user?.userId;

    // Get engagement for this project
    const engagement = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      SELECT engagement_id FROM billing_engagement
      WHERE project_id = ${projectId}
      LIMIT 1
    `;

    if (!engagement || engagement.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const engagementId = engagement[0].engagement_id;

    // Update financials
    await prisma.$executeRaw`
      UPDATE billing_engagement
      SET
        ubt_usd = ${parseFloat(ubt_usd) || 0},
        ubt_cny = ${parseFloat(ubt_cny) || 0},
        billing_credit_usd = ${parseFloat(billing_credit_usd) || 0},
        billing_credit_cny = ${parseFloat(billing_credit_cny) || 0},
        financials_last_updated_at = NOW(),
        financials_last_updated_by = ${userId}
      WHERE engagement_id = ${engagementId}
    `;

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        actionType: 'update',
        entityType: 'billing_financials',
        entityId: Number(engagementId),
        description: `Updated UBT and Billing Credits for billing project ${projectId}`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating financials:', error);
    res.status(500).json({ error: 'Failed to update financials' });
  }
}

/**
 * GET /api/billing/mapping/suggestions
 * Get project mapping suggestions (billing → staffing)
 */
export async function getMappingSuggestions(req: AuthRequest, res: Response) {
  try {
    const suggestions = await prisma.$queryRaw<any[]>`
      SELECT
        bp.project_id as billing_project_id,
        bp.project_name as billing_project_name,
        bp.client_name,
        pcm.cm_no,
        bp.attorney_in_charge,

        -- Suggest staffing projects by name similarity
        sp.id as suggested_staffing_project_id,
        sp.name as suggested_staffing_project_name,
        sp.category,
        sp.status,

        -- Match confidence
        similarity(bp.project_name, sp.name) as name_similarity,

        -- Link status
        bspl.staffing_project_id IS NOT NULL as is_linked,
        bspl.linked_at,
        bspl.linked_by

      FROM billing_project bp
      LEFT JOIN billing_project_cm_no pcm ON pcm.project_id = bp.project_id AND pcm.is_primary = true
      LEFT JOIN projects sp ON similarity(bp.project_name, sp.name) > 0.3
      LEFT JOIN billing_staffing_project_link bspl ON bspl.billing_project_id = bp.project_id
      ORDER BY bp.project_id, name_similarity DESC NULLS LAST
    `;

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching mapping suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch mapping suggestions' });
  }
}

/**
 * POST /api/billing/mapping/link
 * Link a billing project to a staffing project
 */
export async function linkProjects(req: AuthRequest, res: Response) {
  try {
    const { billing_project_id, staffing_project_id, notes } = req.body;
    const userId = req.user?.userId;

    await prisma.$executeRaw`
      INSERT INTO billing_staffing_project_link
      (billing_project_id, staffing_project_id, linked_by, notes)
      VALUES (${billing_project_id}, ${staffing_project_id}, ${userId}, ${notes || null})
      ON CONFLICT (billing_project_id, staffing_project_id)
      DO UPDATE SET
        linked_by = ${userId},
        linked_at = NOW(),
        notes = ${notes || null}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error linking projects:', error);
    res.status(500).json({ error: 'Failed to link projects' });
  }
}

/**
 * GET /api/billing/mapping/suggest/:billingProjectId
 * Get suggested staffing project matches for a billing project using fuzzy matching
 */
export async function suggestProjectMatches(req: AuthRequest, res: Response) {
  try {
    const { billingProjectId } = req.params;
    const { findBestMatches } = await import('../utils/fuzzyMatch');

    // Get the billing project
    const billingProject = await prisma.billing_project.findUnique({
      where: { project_id: BigInt(billingProjectId) },
      select: { project_id: true, project_name: true },
    });

    if (!billingProject) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // Check if already linked
    const existingLink = await prisma.billing_staffing_project_link.findFirst({
      where: { billing_project_id: billingProject.project_id },
      include: {
        projects: {
          select: { id: true, name: true, status: true, category: true },
        },
      },
    });

    if (existingLink?.projects) {
      return res.json({
        billing_project: convertBigIntToNumber(billingProject),
        existing_link: convertBigIntToNumber(existingLink.projects),
        suggestions: [],
      });
    }

    // Get all staffing projects
    const staffingProjects = await prisma.project.findMany({
      where: { status: { in: ['Active', 'Slow-down', 'On-hold'] } },
      select: { id: true, name: true, status: true, category: true },
    });

    // Find best matches using fuzzy matching
    const matches = findBestMatches(
      billingProject.project_name,
      staffingProjects.map(p => ({ id: p.id, name: p.name })),
      0.6, // threshold
      5 // maxResults
    );

    // Enhance matches with full project data
    const suggestions = matches.map(match => {
      const project = staffingProjects.find(p => p.id === match.id);
      return {
        ...match,
        ...project,
      };
    });

    res.json({
      billing_project: convertBigIntToNumber(billingProject),
      existing_link: null,
      suggestions: convertBigIntToNumber(suggestions),
    });
  } catch (error) {
    console.error('Error suggesting project matches:', error);
    res.status(500).json({ error: 'Failed to suggest matches' });
  }
}

/**
 * DELETE /api/billing/mapping/unlink/:linkId
 * Unlink a billing-staffing project connection
 */
export async function unlinkProjects(req: AuthRequest, res: Response) {
  try {
    const { linkId } = req.params;

    await prisma.$executeRaw`
      DELETE FROM billing_staffing_project_link
      WHERE link_id = ${parseInt(linkId)}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking projects:', error);
    res.status(500).json({ error: 'Failed to unlink projects' });
  }
}

/**
 * GET /api/billing/bc-attorneys/unmapped
 * Get unmapped B&C attorneys that need manual assignment
 */
export async function getUnmappedAttorneys(req: AuthRequest, res: Response) {
  try {
    const unmapped = await prisma.$queryRaw<any[]>`
      SELECT
        map_id,
        billing_attorney_name,
        staff_id,
        match_confidence,
        is_auto_mapped,
        s.name as staff_name,
        s.position as staff_position
      FROM billing_bc_attorney_staff_map bmap
      LEFT JOIN staff s ON s.id = bmap.staff_id
      WHERE bmap.staff_id IS NULL OR bmap.is_auto_mapped = false
      ORDER BY billing_attorney_name
    `;

    res.json(unmapped);
  } catch (error) {
    console.error('Error fetching unmapped attorneys:', error);
    res.status(500).json({ error: 'Failed to fetch unmapped attorneys' });
  }
}

/**
 * POST /api/billing/bc-attorneys/map
 * Manually map a billing attorney to a staff member
 */
export async function mapBCAttorney(req: AuthRequest, res: Response) {
  try {
    const { billing_attorney_name, staff_id } = req.body;
    const userId = req.user?.userId;

    await prisma.$executeRaw`
      UPDATE billing_bc_attorney_staff_map
      SET
        staff_id = ${staff_id},
        manually_confirmed_by = ${userId},
        confirmed_at = NOW()
      WHERE billing_attorney_name = ${billing_attorney_name}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error mapping B&C attorney:', error);
    res.status(500).json({ error: 'Failed to map B&C attorney' });
  }
}

/**
 * GET /api/billing/settings/access
 * Get billing access settings
 */
export async function getBillingAccessSettings(req: AuthRequest, res: Response) {
  try {
    const settings = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_access_settings ORDER BY id DESC LIMIT 1
    `;

    if (!settings || settings.length === 0) {
      return res.json({
        billing_module_enabled: false,
        access_level: 'admin_only',
      });
    }

    res.json(settings[0]);
  } catch (error) {
    console.error('Error fetching billing settings:', error);
    res.status(500).json({ error: 'Failed to fetch billing settings' });
  }
}

/**
 * PATCH /api/billing/settings/access
 * Update billing access settings
 */
export async function updateBillingAccessSettings(req: AuthRequest, res: Response) {
  try {
    const { billing_module_enabled, access_level } = req.body;
    const userId = req.user?.userId;

    await prisma.$executeRaw`
      UPDATE billing_access_settings
      SET
        billing_module_enabled = ${billing_module_enabled},
        access_level = ${access_level},
        updated_by = ${userId},
        updated_at = NOW()
      WHERE id = (SELECT id FROM billing_access_settings ORDER BY id DESC LIMIT 1)
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating billing settings:', error);
    res.status(500).json({ error: 'Failed to update billing settings' });
  }
}

/**
 * GET /api/billing/projects/:id/bc-attorneys
 * Get B&C attorneys assigned to a billing project
 */
export async function getBillingProjectBCAttorneys(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const projectId = BigInt(id);

    const bcAttorneys = await prisma.billing_project_bc_attorney.findMany({
      where: { billing_project_id: projectId },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            position: true,
          },
        },
      },
    });

    // Convert BigInt values for JSON serialization
    const sanitized = convertBigIntToNumber(bcAttorneys);
    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching BC attorneys:', error);
    res.status(500).json({ error: 'Failed to fetch BC attorneys' });
  }
}

/**
 * PUT /api/billing/projects/:id
 * Update billing project information including project details, BC attorneys, and financials
 */
export async function updateBillingProject(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const projectId = BigInt(id);
    const userId = req.user?.userId;

    const {
      project_name,
      client_name,
      bc_attorney_staff_ids,
      agreed_fee_usd,
      agreed_fee_cny,
      billing_usd,
      billing_cny,
      collection_usd,
      collection_cny,
      ubt_usd,
      ubt_cny,
      billing_credit_usd,
      billing_credit_cny,
      bonus_usd,
    } = req.body;

    // Verify project exists
    const project = await prisma.billing_project.findUnique({
      where: { project_id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // Build update data for billing_project table
    const updateData: any = {
      updated_at: new Date(),
    };

    if (project_name !== undefined) updateData.project_name = project_name;
    if (client_name !== undefined) updateData.client_name = client_name;
    if (agreed_fee_usd !== undefined) updateData.agreed_fee_usd = agreed_fee_usd;
    if (agreed_fee_cny !== undefined) updateData.agreed_fee_cny = agreed_fee_cny;
    if (billing_usd !== undefined) updateData.billing_usd = billing_usd;
    if (billing_cny !== undefined) updateData.billing_cny = billing_cny;
    if (collection_usd !== undefined) updateData.collection_usd = collection_usd;
    if (collection_cny !== undefined) updateData.collection_cny = collection_cny;
    if (ubt_usd !== undefined) updateData.ubt_usd = ubt_usd;
    if (ubt_cny !== undefined) updateData.ubt_cny = ubt_cny;
    if (billing_credit_usd !== undefined) updateData.billing_credit_usd = billing_credit_usd;
    if (billing_credit_cny !== undefined) updateData.billing_credit_cny = billing_credit_cny;
    if (bonus_usd !== undefined) updateData.bonus_usd = bonus_usd;

    // Update the project
    await prisma.billing_project.update({
      where: { project_id: projectId },
      data: updateData,
    });

    // Update B&C attorneys if provided
    if (bc_attorney_staff_ids !== undefined && Array.isArray(bc_attorney_staff_ids)) {
      // Delete all existing B&C attorney assignments
      await prisma.billing_project_bc_attorney.deleteMany({
        where: { billing_project_id: projectId },
      });

      // Create new assignments
      if (bc_attorney_staff_ids.length > 0) {
        await prisma.billing_project_bc_attorney.createMany({
          data: bc_attorney_staff_ids.map((staffId: number) => ({
            billing_project_id: projectId,
            staff_id: staffId,
            role: 'bc_attorney',
          })),
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        actionType: 'update',
        entityType: 'billing_project',
        entityId: Number(projectId),
        description: `Updated billing project ${project_name || project.project_name}`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating billing project:', error);
    res.status(500).json({ error: 'Failed to update billing project' });
  }
}
