/**
 * Billing Controller
 *
 * Handles all billing-related API endpoints
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

const NUMERIC_ID_REGEX = /^\d+$/;

const BILLING_DASHBOARD_SELECT = Prisma.sql`
  SELECT
    project_id,
    project_name,
    client_name,
    attorney_in_charge,
    bc_attorney_staff_id,
    bc_attorney_name,
    bc_attorney_position,
    bc_attorney_status,
    is_auto_mapped,
    match_confidence,
    cm_numbers,
    cm_status,
    cm_open_date,
    cm_closed_date,
    fee_arrangement_text,
    lsd_date,
    agreed_fee_usd,
    billing_usd,
    collection_usd,
    billing_credit_usd,
    ubt_usd,
    agreed_fee_cny,
    billing_cny,
    collection_cny,
    billing_credit_cny,
    ubt_cny,
    total_milestones,
    completed_milestones,
    staffing_project_id,
    staffing_project_name,
    staffing_project_status,
    linked_at,
    financials_last_updated_at,
    financials_last_updated_by_username
  FROM billing_bc_attorney_dashboard
`;

const buildStaffCondition = (staffId?: bigint | null) => (
  staffId
    ? Prisma.sql`EXISTS (
        SELECT 1
        FROM billing_project_bc_attorney bpa
        WHERE bpa.billing_project_id = billing_bc_attorney_dashboard.project_id
          AND bpa.staff_id = ${staffId}
      )`
    : null
);

const parseNumericIdParam = (value: string | undefined, label: string) => {
  if (typeof value !== 'string' || !NUMERIC_ID_REGEX.test(value.trim())) {
    throw new Error(`Invalid ${label}`);
  }
  return BigInt(value);
};

const parseOptionalQueryId = (value: unknown, label: string) => {
  if (value === undefined) return null;
  if (Array.isArray(value) || typeof value !== 'string' || !NUMERIC_ID_REGEX.test(value.trim())) {
    throw new Error(`Invalid ${label}`);
  }
  return BigInt(value);
};

const toSafeNumber = (value: bigint) =>
  value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);

/**
 * Convert BigInt values to JSON-safe representations.
 * Returns a Number when it is within the safe integer range,
 * otherwise returns a string to avoid precision loss.
 */
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') {
    const asNumber = Number(obj);
    return Number.isSafeInteger(asNumber) ? asNumber : obj.toString();
  }
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
    const pageParam = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
    const limitParam = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
    const searchParam = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const bcAttorneyParam = typeof req.query.bcAttorney === 'string' ? req.query.bcAttorney.trim() : '';
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Math.max(1, Math.min(250, Number.isFinite(limitParam) ? Math.floor(limitParam) : 100));
    const offset = Math.max(0, Math.floor((page - 1) * limit));

    // Get full user record with staffId
    const user = authUser?.userId
      ? await prisma.user.findUnique({
          where: { id: authUser.userId },
          select: { staffId: true },
        })
      : null;

    let staffFilter: bigint | null = null;
    if (!isAdmin) {
      if (!user?.staffId) {
        return res.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
      staffFilter = BigInt(user.staffId);
    }

    const searchValue = searchParam.toLowerCase();
    const staffCondition = buildStaffCondition(staffFilter);
    const conditions: Prisma.Sql[] = [];
    if (staffCondition) conditions.push(staffCondition);
    if (searchValue) {
      const likeValue = `%${searchValue}%`;
      conditions.push(Prisma.sql`
        (
          LOWER(COALESCE(project_name, '')) LIKE ${likeValue}
          OR LOWER(COALESCE(client_name, '')) LIKE ${likeValue}
          OR LOWER(COALESCE(cm_numbers, '')) LIKE ${likeValue}
        )
      `);
    }
    if (bcAttorneyParam) {
      const attorneyPattern = `%${bcAttorneyParam}%`;
      conditions.push(Prisma.sql`
        (
          COALESCE(bc_attorney_name, '') ILIKE ${attorneyPattern}
          OR COALESCE(attorney_in_charge, '') ILIKE ${attorneyPattern}
        )
      `);
    }

    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.sql``;

    const [countResult] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT project_id) as count
      FROM billing_bc_attorney_dashboard
      ${whereClause}
    `;

    const projects = await prisma.$queryRaw<any[]>`
      ${BILLING_DASHBOARD_SELECT}
      ${whereClause}
      ORDER BY project_name
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const totalBigInt = countResult?.count ?? 0n;
    const total = toSafeNumber(totalBigInt);

    const pagination = {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };

    res.json({
      data: convertBigIntToNumber(projects),
      pagination,
    });
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
    // Use short cache for better performance while maintaining data freshness
    // Cache for 30 seconds - balances performance with data accuracy
    res.set('Cache-Control', 'private, max-age=30');
    res.set('Pragma', 'cache');

    const { id } = req.params;
    const { view = 'full', cmId, engagementId } = req.query;

    let projectIdBigInt: bigint;
    let cmIdFilter: bigint | null = null;
    let engagementIdFilter: bigint | null = null;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
      cmIdFilter = parseOptionalQueryId(cmId, 'cmId parameter');
      engagementIdFilter = parseOptionalQueryId(engagementId, 'engagementId parameter');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    // Get project basic info from the view
    const projectData = await prisma.$queryRaw<any[]>`
      ${BILLING_DASHBOARD_SELECT}
      WHERE project_id = ${projectIdBigInt}
      LIMIT 1
    `;

    if (!projectData || projectData.length === 0) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // Get B&C attorneys directly from the project-level table
    const bcAttorneys = await prisma.$queryRaw<any[]>`
      SELECT
        string_agg(DISTINCT s.name, ', ' ORDER BY s.name) AS bc_attorney_name,
        string_agg(DISTINCT s.id::text, ', ' ORDER BY s.id::text) AS bc_attorney_staff_id
      FROM billing_project_bc_attorneys bpba
      JOIN staff s ON s.id = bpba.staff_id
      WHERE bpba.billing_project_id = ${projectIdBigInt}
    `;

    // Merge B&C attorney info into project data
    if (bcAttorneys && bcAttorneys.length > 0) {
      projectData[0].bc_attorney_name = bcAttorneys[0].bc_attorney_name || null;
      projectData[0].bc_attorney_staff_id = bcAttorneys[0].bc_attorney_staff_id || null;
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
        WHERE cm.project_id = ${projectIdBigInt}
        GROUP BY cm.cm_id, cm.cm_no, cm.is_primary, cm.open_date, cm.closed_date, cm.status
        ORDER BY cm.is_primary DESC, cm.cm_no
      `;

      // Get minimal event and comment counts
      const eventCount = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count
        FROM billing_event be
        INNER JOIN billing_engagement e ON e.engagement_id = be.engagement_id
        INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
        WHERE cm.project_id = ${projectIdBigInt}
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

    const cmFilterClause = cmIdFilter ? Prisma.sql` AND cm.cm_id = ${cmIdFilter}` : Prisma.sql``;
    const engagementFilterClause = engagementIdFilter
      ? Prisma.sql` AND e.engagement_id = ${engagementIdFilter}`
      : Prisma.sql``;

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
        WHERE cm.project_id = ${projectIdBigInt}${cmFilterClause}${engagementFilterClause}
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

    if (cmIdFilter === null && engagementIdFilter === null) {
      events = await prisma.$queryRaw<any[]>`
        SELECT *
        FROM billing_event
        WHERE engagement_id IN (
          SELECT e.engagement_id
          FROM billing_engagement e
          INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
          WHERE cm.project_id = ${projectIdBigInt}
        )
        ORDER BY event_date DESC
        LIMIT 50
      `;

      financeComments = await prisma.$queryRaw<any[]>`
        SELECT *
        FROM billing_finance_comment
        WHERE engagement_id IN (
          SELECT e.engagement_id
          FROM billing_engagement e
          INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
          WHERE cm.project_id = ${projectIdBigInt}
        )
        ORDER BY created_at DESC
        LIMIT 100
      `;
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
    let projectIdBigInt: bigint;
    let engagementIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
      engagementIdBigInt = parseNumericIdParam(engagementId, 'engagement ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
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
      WHERE e.engagement_id = ${engagementIdBigInt}
        AND cm.project_id = ${projectIdBigInt}
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
    let projectIdBigInt: bigint;
    let cmIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
      cmIdBigInt = parseNumericIdParam(cmId, 'CM ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
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
      WHERE cm.project_id = ${projectIdBigInt}
        AND cm.cm_id = ${cmIdBigInt}
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
    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(req.params.id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const events = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM billing_event
      WHERE engagement_id IN (
        SELECT e.engagement_id
        FROM billing_engagement e
        INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
        WHERE cm.project_id = ${projectIdBigInt}
      )
      ORDER BY event_date DESC
      LIMIT 50
    `;

    const financeComments = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM billing_finance_comment
      WHERE engagement_id IN (
        SELECT e.engagement_id
        FROM billing_engagement e
        INNER JOIN billing_project_cm_no cm ON cm.cm_id = e.cm_id
        WHERE cm.project_id = ${projectIdBigInt}
      )
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
    let engagementIdBigInt: bigint;
    try {
      engagementIdBigInt = parseNumericIdParam(req.params.engagementId, 'engagement ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const { raw_text, lsd_date } = req.body as { raw_text?: string; lsd_date?: string | null };

    if (typeof raw_text !== 'string' || raw_text.trim().length === 0) {
      return res.status(400).json({ error: 'Fee arrangement text is required' });
    }

    const existing = await prisma.$queryRaw<{ fee_id: bigint }[]>`
      SELECT fee_id
      FROM billing_fee_arrangement
      WHERE engagement_id = ${engagementIdBigInt}
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
        VALUES (${engagementIdBigInt}, ${raw_text}, ${lsdDateValue})
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
          entityId: toSafeNumber(engagementIdBigInt),
          description: `Updated fee arrangement for engagement ${engagementIdBigInt.toString()}`,
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
    let engagementIdBigInt: bigint;
    try {
      engagementIdBigInt = parseNumericIdParam(req.params.engagementId, 'engagement ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const engagement = await prisma.$queryRaw<{ engagement_id: bigint }[]>`
      SELECT engagement_id
      FROM billing_engagement
      WHERE engagement_id = ${engagementIdBigInt}
      LIMIT 1
    `;

    if (!engagement || engagement.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const feeRecord = await prisma.$queryRaw<{ fee_id: bigint }[]>`
      SELECT fee_id
      FROM billing_fee_arrangement
      WHERE engagement_id = ${engagementIdBigInt}
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
      WHERE engagement_id = ${engagementIdBigInt}
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
        ${engagementIdBigInt},
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
          entityId: toSafeNumber(milestoneId),
          description: `Created billing milestone for engagement ${engagementIdBigInt.toString()}`,
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
    let milestoneIdBigInt: bigint;
    try {
      milestoneIdBigInt = parseNumericIdParam(req.params.milestoneId, 'milestone ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const deleted = await prisma.$queryRaw<{ milestone_id: bigint }[]>`
      DELETE FROM billing_milestone
      WHERE milestone_id = ${milestoneIdBigInt}
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
          entityId: toSafeNumber(milestoneIdBigInt),
          description: `Deleted billing milestone ${milestoneIdBigInt.toString()}`,
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
    const { ubt_usd, ubt_cny, billing_credit_usd, billing_credit_cny } = req.body;
    const userId = req.user?.userId;

    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const engagements = await prisma.billing_engagement.findMany({
      where: { project_id: projectIdBigInt },
      select: { engagement_id: true },
    });

    if (!engagements.length) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Update financials
    await prisma.$executeRaw`
      UPDATE billing_engagement
      SET
        ubt_usd = ${parseNullableNumber(ubt_usd) ?? 0},
        ubt_cny = ${parseNullableNumber(ubt_cny) ?? 0},
        billing_credit_usd = ${parseNullableNumber(billing_credit_usd) ?? 0},
        billing_credit_cny = ${parseNullableNumber(billing_credit_cny) ?? 0},
        financials_last_updated_at = NOW(),
        financials_last_updated_by = ${userId}
      WHERE project_id = ${projectIdBigInt}
    `;

    const activityEntityId = toSafeNumber(projectIdBigInt);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        actionType: 'update',
        entityType: 'billing_financials',
        entityId: activityEntityId,
        description: `Updated UBT and Billing Credits for billing project ${projectIdBigInt.toString()} (${engagements.length} engagement${engagements.length === 1 ? '' : 's'})`,
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

    // Use upsert pattern: try to get existing row first
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM billing_access_settings ORDER BY id DESC LIMIT 1
    `;

    if (existing && existing.length > 0) {
      // Update existing row
      await prisma.$executeRaw`
        UPDATE billing_access_settings
        SET
          billing_module_enabled = ${billing_module_enabled},
          access_level = ${access_level},
          updated_by = ${userId},
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      // Insert new row if none exists
      await prisma.$executeRaw`
        INSERT INTO billing_access_settings (billing_module_enabled, access_level, updated_by, updated_at)
        VALUES (${billing_module_enabled}, ${access_level}, ${userId}, NOW())
      `;
    }

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
    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const bcAttorneys = await prisma.billing_project_bc_attorney.findMany({
      where: { billing_project_id: projectIdBigInt },
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
 * GET /api/billing/bc-attorneys
 * Get distinct B&C attorneys used across billing projects (for filters)
 */
export async function listAllBCAttorneys(req: AuthRequest, res: Response) {
  try {
    const attorneys = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT
        s.id AS staff_id,
        s.name,
        s.position
      FROM billing_project_bc_attorneys bpba
      JOIN staff s ON s.id = bpba.staff_id
      ORDER BY s.name
    `;

    res.json(convertBigIntToNumber(attorneys));
  } catch (error) {
    console.error('Error listing BC attorneys:', error);
    res.status(500).json({ error: 'Failed to list BC attorneys' });
  }
}

/**
 * PUT /api/billing/projects/:id
 * Update billing project information including project details, BC attorneys, and financials
 */
export async function updateBillingProject(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
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
      where: { project_id: projectIdBigInt },
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
      where: { project_id: projectIdBigInt },
      data: updateData,
    });

    // Update B&C attorneys if provided
    if (bc_attorney_staff_ids !== undefined && Array.isArray(bc_attorney_staff_ids)) {
      // Delete all existing B&C attorney assignments
      await prisma.billing_project_bc_attorney.deleteMany({
        where: { billing_project_id: projectIdBigInt },
      });

      // Create new assignments
      if (bc_attorney_staff_ids.length > 0) {
        await prisma.billing_project_bc_attorney.createMany({
          data: bc_attorney_staff_ids.map((staffId: number) => ({
            billing_project_id: projectIdBigInt,
            staff_id: staffId,
            role: 'bc_attorney',
          })),
        });
      }
    }

    // Log activity
    const activityProjectId = toSafeNumber(projectIdBigInt);
    await prisma.activityLog.create({
      data: {
        userId,
        actionType: 'update',
        entityType: 'billing_project',
        entityId: activityProjectId,
        description: `Updated billing project ${project_name || project.project_name}`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating billing project:', error);
    res.status(500).json({ error: 'Failed to update billing project' });
  }
}
