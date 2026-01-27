/**
 * Billing Mapping Controller
 *
 * Project mapping endpoints for billing module
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { convertBigIntToNumber } from './billing.utils';

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
    logger.error('Error fetching mapping suggestions', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error linking projects', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error suggesting project matches', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error unlinking projects', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error fetching unmapped attorneys', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error mapping B&C attorney', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Failed to map B&C attorney' });
  }
}
