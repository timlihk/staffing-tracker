/**
 * Billing Project Controller
 *
 * Project-related endpoints for billing module
 */

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import {
  BILLING_DASHBOARD_SELECT,
  buildStaffCondition,
  canAccessBillingProject,
  parseNumericIdParam,
  parseOptionalQueryId,
  resolveBillingAccessScope,
  toSafeNumber,
  convertBigIntToNumber,
} from './billing.utils';

interface BillingProjectRow {
  project_id: bigint;
  project_name: string;
  client_name: string;
  attorney_in_charge: string | null;
  bc_attorney_staff_id: string | null;
  bc_attorney_name: string | null;
  bc_attorney_position: string | null;
  bc_attorney_status: string | null;
  is_auto_mapped: boolean;
  match_confidence: number | null;
  cm_numbers: string | null;
  cm_status: string | null;
  cm_open_date: Date | null;
  cm_closed_date: Date | null;
  fee_arrangement_text: string | null;
  lsd_date: Date | null;
  agreed_fee_usd: number | null;
  billing_usd: number | null;
  collection_usd: number | null;
  billing_credit_usd: number | null;
  ubt_usd: number | null;
  agreed_fee_cny: number | null;
  billing_cny: number | null;
  collection_cny: number | null;
  billing_credit_cny: number | null;
  ubt_cny: number | null;
  total_milestones: bigint;
  completed_milestones: bigint;
  staffing_project_id: number | null;
  staffing_project_name: string | null;
  staffing_project_status: string | null;
  linked_at: Date | null;
  financials_last_updated_at: Date | null;
  financials_last_updated_by_username: string | null;
}

interface BCAttorneyRow {
  bc_attorney_name: string | null;
  bc_attorney_staff_id: string | null;
}

interface CMSummaryRow {
  cm_id: bigint;
  cm_no: string;
  is_primary: boolean;
  open_date: Date | null;
  closed_date: Date | null;
  status: string | null;
  engagement_count: bigint;
  milestone_count: bigint;
  completed_milestone_count: bigint;
}

interface EventCountRow {
  count: bigint;
}

interface BillingEventRow {
  event_id: bigint;
  engagement_id: bigint;
  event_type: string;
  event_date: Date;
  description: string | null;
  amount_usd: number | null;
  amount_cny: number | null;
  created_at: Date;
  created_by: string | null;
}

interface FinanceCommentRow {
  comment_id: bigint;
  engagement_id: bigint;
  milestone_id: bigint | null;
  comment_text: string | null;
  notes: string | null;
  created_at: Date;
  created_by: string | null;
}

/**
 * GET /api/billing/projects
 * Get all billing projects with financial summary
 */
export async function getBillingProjects(req: AuthRequest, res: Response) {
  try {
    const authUser = req.user;
    const scope = await resolveBillingAccessScope(authUser);
    const isAdmin = scope.isAdmin;
    const pageParam = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
    const limitParam = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 100;
    const searchParam = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const bcAttorneyParam = typeof req.query.bcAttorney === 'string' ? req.query.bcAttorney.trim() : '';
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Math.max(1, Math.min(250, Number.isFinite(limitParam) ? Math.floor(limitParam) : 100));
    const offset = Math.max(0, Math.floor((page - 1) * limit));

    let staffFilter: bigint | null = null;
    if (!isAdmin) {
      if (!scope.staffId) {
        return res.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
      staffFilter = BigInt(scope.staffId);
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
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.sql``;

    const [countResult] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT project_id) as count
      FROM billing_bc_attorney_dashboard
      ${whereClause}
    `;

    const projects = await prisma.$queryRaw<BillingProjectRow[]>`
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
    logger.error('Error fetching billing projects', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch billing projects' });
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

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    // Get project basic info from the view
    const projectData = await prisma.$queryRaw<BillingProjectRow[]>`
      ${BILLING_DASHBOARD_SELECT}
      WHERE project_id = ${projectIdBigInt}
      LIMIT 1
    `;

    if (!projectData || projectData.length === 0) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // Get B&C attorneys directly from the project-level table
    const bcAttorneys = await prisma.$queryRaw<BCAttorneyRow[]>`
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
      const summaryData = await prisma.$queryRaw<CMSummaryRow[]>`
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
      const eventCount = await prisma.$queryRaw<EventCountRow[]>`
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
    const fullData = await prisma.$queryRaw<Record<string, unknown>[]>`
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
          cm.matter_notes,
          cm.finance_remarks,
          cm.unbilled_per_el,
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
                'signed_date', e.signed_date,
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
    let events: BillingEventRow[] = [];
    let financeComments: FinanceCommentRow[] = [];

    if (cmIdFilter === null && engagementIdFilter === null) {
      events = await prisma.$queryRaw<BillingEventRow[]>`
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

      financeComments = await prisma.$queryRaw<FinanceCommentRow[]>`
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
    logger.error('Error fetching billing project detail', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch billing project detail' });
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

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    const events = await prisma.$queryRaw<BillingEventRow[]>`
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

    const financeComments = await prisma.$queryRaw<FinanceCommentRow[]>`
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
    logger.error('Error fetching billing project activity', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch billing project activity' });
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

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
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
    logger.error('Error fetching BC attorneys', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch BC attorneys' });
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
      cm_no,
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

    let normalizedCmNo: string | undefined;
    if (cm_no !== undefined) {
      if (typeof cm_no !== 'string') {
        return res.status(400).json({ error: 'C/M number must be a string' });
      }
      const trimmedCmNo = cm_no.trim();
      if (!trimmedCmNo) {
        return res.status(400).json({ error: 'C/M number is required' });
      }
      if (!/^\d{5}-\d{1,5}$/.test(trimmedCmNo)) {
        return res.status(400).json({ error: 'C/M number must be in format XXXXX-XXXXX' });
      }
      normalizedCmNo = trimmedCmNo;
    }

    // Verify project exists
    const project = await prisma.billing_project.findUnique({
      where: { project_id: projectIdBigInt },
    });

    if (!project) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // Build update data for billing_project table (only project-level fields)
    const updateData: any = {
      updated_at: new Date(),
    };

    if (project_name !== undefined) updateData.project_name = project_name;
    if (client_name !== undefined) updateData.client_name = client_name;

    // Update the project
    await prisma.billing_project.update({
      where: { project_id: projectIdBigInt },
      data: updateData,
    });

    // Update the primary C/M number if provided.
    if (normalizedCmNo !== undefined) {
      const primaryCm = await prisma.billing_project_cm_no.findFirst({
        where: { project_id: projectIdBigInt },
        select: { cm_id: true },
        orderBy: [
          { is_primary: 'desc' },
          { cm_id: 'asc' },
        ],
      });

      try {
        if (primaryCm) {
          await prisma.billing_project_cm_no.update({
            where: { cm_id: primaryCm.cm_id },
            data: { cm_no: normalizedCmNo },
          });
        } else {
          await prisma.billing_project_cm_no.create({
            data: {
              project_id: projectIdBigInt,
              cm_no: normalizedCmNo,
              is_primary: true,
              status: 'active',
            },
          });
        }
      } catch (cmError: any) {
        if (cmError?.code === 'P2002') {
          return res.status(409).json({ error: 'C/M number already exists for this project' });
        }
        throw cmError;
      }
    }

    // Update financial fields on the primary billing_project_cm_no record
    const hasFinancials = [
      agreed_fee_usd, billing_usd, billing_cny, collection_usd, collection_cny,
      ubt_usd, ubt_cny, billing_credit_usd, billing_credit_cny,
    ].some((v) => v !== undefined);

    if (hasFinancials) {
      const primaryCm = await prisma.billing_project_cm_no.findFirst({
        where: { project_id: projectIdBigInt },
        orderBy: [{ is_primary: 'desc' }, { cm_id: 'asc' }],
      });

      if (primaryCm) {
        const cmUpdate: any = {};
        if (agreed_fee_usd !== undefined) cmUpdate.agreed_fee_usd = agreed_fee_usd;
        if (billing_usd !== undefined) cmUpdate.billing_to_date_usd = billing_usd;
        if (billing_cny !== undefined) cmUpdate.billing_to_date_cny = billing_cny;
        if (collection_usd !== undefined) cmUpdate.collected_to_date_usd = collection_usd;
        if (collection_cny !== undefined) cmUpdate.collected_to_date_cny = collection_cny;
        if (ubt_usd !== undefined) cmUpdate.ubt_usd = ubt_usd;
        if (ubt_cny !== undefined) cmUpdate.ubt_cny = ubt_cny;
        if (billing_credit_usd !== undefined) cmUpdate.billing_credit_usd = billing_credit_usd;
        if (billing_credit_cny !== undefined) cmUpdate.billing_credit_cny = billing_credit_cny;

        if (Object.keys(cmUpdate).length > 0) {
          cmUpdate.financials_updated_at = new Date();
          cmUpdate.financials_updated_by = userId;
          await prisma.billing_project_cm_no.update({
            where: { cm_id: primaryCm.cm_id },
            data: cmUpdate,
          });
        }
      }
    }

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
    logger.error('Error updating billing project', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to update billing project' });
  }
}

/**
 * DELETE /api/billing/projects/:id
 * Delete a billing project and all related data (cascades)
 */
export async function deleteProject(req: AuthRequest, res: Response) {
  try {
    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(req.params.id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const project = await prisma.billing_project.findUnique({
      where: { project_id: projectIdBigInt },
      select: { project_id: true, project_name: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    await prisma.billing_project.delete({
      where: { project_id: projectIdBigInt },
    });

    if (req.user?.userId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          actionType: 'delete',
          entityType: 'billing_project',
          entityId: toSafeNumber(projectIdBigInt),
          description: `Deleted billing project "${project.project_name}"`,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting billing project', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to delete billing project' });
  }
}

/**
 * GET /api/billing/projects/:id/change-log
 * Get audit trail for a billing project and all its child entities
 */
export async function getBillingProjectChangeLog(req: AuthRequest, res: Response) {
  try {
    let projectIdBigInt: bigint;
    try {
      projectIdBigInt = parseNumericIdParam(req.params.id, 'project ID');
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }

    const hasAccess = await canAccessBillingProject(projectIdBigInt, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - Project not assigned to you' });
    }

    const projectIdNum = toSafeNumber(projectIdBigInt);

    const logs = await prisma.$queryRaw<Array<{
      id: number;
      action_type: string;
      entity_type: string;
      entity_id: number | null;
      description: string | null;
      username: string | null;
      created_at: Date;
    }>>(Prisma.sql`
      SELECT
        al.id,
        al.action_type,
        al.entity_type,
        al.entity_id,
        al.description,
        u.username,
        al.created_at
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE (
        (al.entity_type = 'billing_project' AND al.entity_id = ${projectIdNum})
        OR (al.entity_type = 'billing_financials' AND al.entity_id = ${projectIdNum})
        OR (al.entity_type = 'billing_engagement' AND al.entity_id IN (
          SELECT CAST(e.engagement_id AS INTEGER)
          FROM billing_engagement e
          WHERE e.project_id = ${projectIdBigInt}
        ))
        OR (al.entity_type = 'billing_milestone' AND al.entity_id IN (
          SELECT CAST(m.milestone_id AS INTEGER)
          FROM billing_milestone m
          JOIN billing_engagement e ON e.engagement_id = m.engagement_id
          WHERE e.project_id = ${projectIdBigInt}
        ))
        OR (al.entity_type = 'billing_fee_arrangement' AND al.entity_id IN (
          SELECT CAST(e.engagement_id AS INTEGER)
          FROM billing_engagement e
          WHERE e.project_id = ${projectIdBigInt}
        ))
      )
      ORDER BY al.created_at DESC
      LIMIT 100
    `);

    res.json({
      data: logs.map((log) => ({
        id: log.id,
        actionType: log.action_type,
        entityType: log.entity_type,
        entityId: log.entity_id,
        description: log.description,
        username: log.username || 'System',
        createdAt: log.created_at,
      })),
      total: logs.length,
    });
  } catch (error) {
    logger.error('Error fetching billing change log', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch change log' });
  }
}

/**
 * Lookup billing project info by C/M number
 * GET /billing/cm-lookup/:cmNo
 */
export async function lookupByCmNumber(req: AuthRequest, res: Response): Promise<any> {
  try {
    const cmNo = req.params.cmNo as string;

    if (!cmNo || !/^\d{5}-\d{1,5}$/.test(cmNo)) {
      return res.status(400).json({ error: 'Invalid C/M number format' });
    }

    const rows = await prisma.$queryRaw<Array<{
      billing_project_id: number;
      project_name: string | null;
      client_name: string | null;
      attorney_in_charge: string | null;
      cm_id: number;
      is_primary: boolean;
      status: string | null;
    }>>(Prisma.sql`
      SELECT
        bp.project_id AS billing_project_id,
        bp.project_name,
        bp.client_name,
        bp.attorney_in_charge,
        cm.cm_id,
        cm.is_primary,
        bp.status
      FROM billing_project_cm_no cm
      JOIN billing_project bp ON bp.project_id = cm.project_id
      WHERE cm.cm_no = ${cmNo}
      ORDER BY cm.is_primary DESC, bp.project_id ASC
      LIMIT 1
    `);

    if (rows.length === 0) {
      return res.json({ found: false });
    }

    const row = rows[0];
    return res.json({
      found: true,
      billingProjectId: Number(row.billing_project_id),
      projectName: row.project_name,
      clientName: row.client_name,
      attorneyInCharge: row.attorney_in_charge,
      cmId: Number(row.cm_id),
      isPrimary: row.is_primary,
      status: row.status,
    });
  } catch (error) {
    logger.error('Error looking up C/M number', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to look up C/M number' });
  }
}

/**
 * Look up billing project by staffing project ID via the link table
 * GET /billing/mapping/by-staffing-project/:staffingProjectId
 */
export async function getBillingProjectByStaffingId(req: AuthRequest, res: Response): Promise<any> {
  try {
    const staffingProjectId = parseInt(req.params.staffingProjectId as string, 10);
    if (isNaN(staffingProjectId)) {
      return res.status(400).json({ error: 'Invalid staffing project ID' });
    }

    const link = await prisma.billing_staffing_project_link.findFirst({
      where: { staffing_project_id: staffingProjectId },
      select: { billing_project_id: true },
      orderBy: { linked_at: 'desc' },
    });

    if (!link || !link.billing_project_id) {
      return res.json({ billingProjectId: null });
    }

    return res.json({ billingProjectId: Number(link.billing_project_id) });
  } catch (error) {
    logger.error('Error looking up billing project by staffing ID', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to look up billing project' });
  }
}

/**
 * GET /billing/projects/:id/notes
 * Get all notes for a billing project
 */
export async function getBillingNotes(req: AuthRequest, res: Response) {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const notes = await prisma.billing_note.findMany({
      where: { project_id: projectId },
      include: {
        author: { select: { id: true, username: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json(notes.map(n => ({
      id: n.id,
      project_id: Number(n.project_id),
      cm_id: n.cm_id ? Number(n.cm_id) : null,
      author_name: n.author.username,
      author_id: n.author.id,
      content: n.content,
      created_at: n.created_at.toISOString(),
    })));
  } catch (error) {
    logger.error('Error fetching billing notes', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

/**
 * POST /billing/projects/:id/notes
 * Create a new note for a billing project
 */
export async function createBillingNote(req: AuthRequest, res: Response) {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { content, cm_id } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const note = await prisma.billing_note.create({
      data: {
        project_id: projectId,
        cm_id: cm_id ? BigInt(cm_id) : null,
        author_id: req.user!.userId,
        content: content.trim(),
      },
      include: {
        author: { select: { id: true, username: true } },
      },
    });

    return res.status(201).json({
      id: note.id,
      project_id: Number(note.project_id),
      cm_id: note.cm_id ? Number(note.cm_id) : null,
      author_name: note.author.username,
      author_id: note.author.id,
      content: note.content,
      created_at: note.created_at.toISOString(),
    });
  } catch (error) {
    logger.error('Error creating billing note', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to create note' });
  }
}
