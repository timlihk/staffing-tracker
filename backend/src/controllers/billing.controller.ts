/**
 * Billing Controller
 *
 * Handles all billing-related API endpoints
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

/**
 * Helper function to convert BigInt values to numbers
 */
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
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
    let attorneyNames: string[] = [];
    if (!isAdmin && user?.staffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: user.staffId },
        select: { position: true },
      });

      if (staff?.position === 'B&C Working Attorney') {
        // Get attorney names mapped to this staff member
        const mappings = await prisma.$queryRaw<{ billing_attorney_name: string }[]>`
          SELECT billing_attorney_name
          FROM billing_bc_attorney_staff_map
          WHERE staff_id = ${user.staffId}
        `;
        attorneyNames = mappings.map(r => r.billing_attorney_name);
      }
    }

    const projects = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_bc_attorney_dashboard
      ORDER BY project_name
    `;

    // Apply filter if needed (for B&C attorneys, show only their projects)
    const filteredProjects = !isAdmin && attorneyNames.length > 0
      ? projects.filter(p => attorneyNames.includes(p.attorney_in_charge))
      : projects;

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
 */
export async function getBillingProjectDetail(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const projectId = parseInt(id);

    // Get project basic info
    const projectData = await prisma.$queryRaw<any[]>`
      SELECT * FROM billing_bc_attorney_dashboard
      WHERE project_id = ${projectId}
      LIMIT 1
    `;

    if (!projectData || projectData.length === 0) {
      return res.status(404).json({ error: 'Billing project not found' });
    }

    // Get C/M numbers for this project
    const cmNumbers = await prisma.$queryRaw<any[]>`
      SELECT
        cm_id,
        cm_no,
        is_primary,
        project_id,
        open_date,
        closed_date,
        status
      FROM billing_project_cm_no
      WHERE project_id = ${projectId}
      ORDER BY is_primary DESC, cm_no
    `;

    // For each C/M number, get engagements with milestones
    const cmNumbersWithData = await Promise.all(
      cmNumbers.map(async (cm: any) => {
        // Get engagements for this C/M
        const engagements = await prisma.$queryRaw<any[]>`
          SELECT
            e.engagement_id,
            e.cm_id,
            e.engagement_code,
            e.engagement_title,
            e.name,
            e.start_date,
            e.end_date,
            e.total_agreed_fee_value,
            e.total_agreed_fee_currency,
            e.ubt_usd,
            e.ubt_cny,
            e.billing_credit_usd,
            e.billing_credit_cny,
            e.financials_last_updated_at,
            e.financials_last_updated_by,
            e.created_at,
            e.updated_at,
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
            efs.financials_last_updated_by as efs_financials_last_updated_by
          FROM billing_engagement e
          LEFT JOIN billing_engagement_financial_summary efs ON efs.engagement_id = e.engagement_id
          WHERE e.cm_id = ${cm.cm_id}
          ORDER BY e.start_date DESC NULLS LAST, e.created_at DESC
        `;

        // For each engagement, get fee arrangement and milestones
        const engagementsWithData = await Promise.all(
          engagements.map(async (engagement: any) => {
            // Get fee arrangement text
            const feeArrangement = await prisma.$queryRaw<any[]>`
              SELECT
                fee_id,
                raw_text,
                lsd_date,
                lsd_raw,
                parsed_json
              FROM billing_fee_arrangement
              WHERE engagement_id = ${engagement.engagement_id}
              LIMIT 1
            `;

            // Get milestones for this engagement
            const milestones = await prisma.$queryRaw<any[]>`
              SELECT
                milestone_id,
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
                completion_source,
                invoice_sent_date,
                payment_received_date,
                notes,
                raw_fragment,
                sort_order
              FROM billing_milestone
              WHERE engagement_id = ${engagement.engagement_id}
              ORDER BY sort_order ASC, ordinal ASC
            `;

            return {
              ...engagement,
              feeArrangement: feeArrangement[0] || null,
              milestones: milestones || [],
            };
          })
        );

        return {
          ...cm,
          engagements: engagementsWithData,
        };
      })
    );

    // Get billing events for all engagements in this project
    const events = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM billing_event
      WHERE engagement_id IN (
        SELECT engagement_id FROM billing_engagement
        WHERE cm_id IN (
          SELECT cm_id FROM billing_project_cm_no WHERE project_id = ${projectId}
        )
      )
      ORDER BY event_date DESC
    `;

    // Convert BigInt values to numbers for JSON serialization
    const response = convertBigIntToNumber({
      project: projectData[0],
      cmNumbers: cmNumbersWithData,
      events,
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching billing project detail:', error);
    res.status(500).json({ error: 'Failed to fetch billing project detail' });
  }
}

/**
 * PATCH /api/billing/projects/:id/financials
 * Update UBT and Billing Credits for a project
 */
export async function updateFinancials(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const projectId = parseInt(id);
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
