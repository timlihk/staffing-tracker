import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { getCached, setCached, invalidateCache, CACHE_KEYS } from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';
import { parseQueryInt, wasValueClamped } from '../utils/queryParsing';
import { logger } from '../utils/logger';
import { StaffWhereInput, ControllerError } from '../types/prisma';
import { Prisma } from '@prisma/client';
import { ActionType, EntityType } from '../constants';

/**
 * Helper function to convert BigInt values to numbers for JSON serialization
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

export const getAllStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { position, department, status, search, page, limit } = req.query;

    // Parse pagination params
    const pageNum = parseQueryInt(page as string, { default: 1, min: 1 });
    const limitNum = parseQueryInt(limit as string, { default: 25, min: 1, max: 100 });
    const skip = (pageNum - 1) * limitNum;

    // Generate cache key based on query parameters
    const cacheKey = CACHE_KEYS.STAFF_LIST(
      `position=${position}&department=${department}&status=${status}&search=${search}&page=${pageNum}&limit=${limitNum}`
    );

    // Try to get from cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const where: StaffWhereInput = {};

    if (position && typeof position === 'string') {
      where.position = position;
    }
    if (department && typeof department === 'string') {
      where.department = department;
    }
    if (status && typeof status === 'string') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.staff.count({ where });

    const staff = await prisma.staff.findMany({
      where,
      skip,
      take: limitNum,
      // Optimized with selective fields for list view
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        department: true,
        status: true,
        assignments: {
          select: {
            id: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const response = {
      data: staff,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // Cache the response
    setCached(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('Get staff error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id as string, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    // Try to get from cache first
    const cacheKey = CACHE_KEYS.STAFF_DETAIL(staffId);
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      // Optimized with selective fields for detail view
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        department: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        assignments: {
          select: {
            id: true,
            jurisdiction: true,
            createdAt: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                category: true,
                priority: true,
                elStatus: true,
                timetable: true,
                filingDate: true,
                listingDate: true,
                side: true,
                sector: true,
                updatedAt: true,
                lastConfirmedAt: true,
                lastConfirmedBy: true,
                confirmedBy: {
                  select: {
                    id: true,
                    username: true,
                    staff: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Cache the staff member
    setCached(cacheKey, staff);

    res.json(staff);
  } catch (error) {
    logger.error('Get staff error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, position, department, status, notes } = req.body;

    if (!name || !position) {
      return res.status(400).json({ error: 'Name and position are required' });
    }

    const staff = await prisma.$transaction(async (tx) => {
      const newStaff = await tx.staff.create({
        data: {
          name,
          email: email === '' ? null : email,
          position,
          department: department === '' ? null : department,
          status: status || 'active',
          notes: notes === '' ? null : notes,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: ActionType.CREATE,
          entityType: EntityType.STAFF,
          entityId: newStaff.id,
          description: `Created staff: ${newStaff.name}`,
        },
      });

      return newStaff;
    });

    // Invalidate cache for staff lists
    invalidateCache('staff:list');

    res.status(201).json(staff);
  } catch (error) {
    logger.error('Create staff error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, position, department, status, notes } = req.body;

    const staffId = parseInt(id as string, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    const existingStaff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Build update data
    const updateData: Prisma.StaffUpdateInput = {};
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email === '' ? null : email;
    if (position) updateData.position = position;
    if (department !== undefined) updateData.department = department === '' ? null : department;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes === '' ? null : notes;

    // Track all field changes
    await trackFieldChanges({
      entityId: staffId,
      entityType: 'staff',
      oldData: existingStaff,
      newData: updateData,
      userId: req.user?.userId,
    });

    const staff = await prisma.$transaction(async (tx) => {
      const updatedStaff = await tx.staff.update({
        where: { id: staffId },
        data: updateData,
      });

      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: ActionType.UPDATE,
          entityType: EntityType.STAFF,
          entityId: staffId,
          description: `Updated staff: ${updatedStaff.name}`,
        },
      });

      return updatedStaff;
    });

    // Invalidate cache for this staff member and staff lists
    invalidateCache(CACHE_KEYS.STAFF_DETAIL(staffId));
    invalidateCache('staff:list');

    res.json(staff);
  } catch (error) {
    logger.error('Update staff error', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Unique constraint violation
      const target = error.meta?.target as string[] | undefined;
      const field = target?.[0] || 'field';
      return res.status(400).json({ error: `This ${field} is already in use by another staff member` });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id as string, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.staff.delete({ where: { id: staffId } });
      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: ActionType.DELETE,
          entityType: EntityType.STAFF,
          entityId: staffId,
          description: `Deleted staff: ${staff.name}`,
        },
      });
    });

    // Invalidate cache for this staff member and staff lists
    invalidateCache(CACHE_KEYS.STAFF_DETAIL(staffId));
    invalidateCache('staff:list');

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    logger.error('Delete staff error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffWorkload = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id as string, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        assignments: {
          where: {
            project: { status: { in: ['Active', 'Slow-down'] } },
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                category: true,
                priority: true,
              },
            },
          },
        },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const projectsByCategory = staff.assignments?.reduce((acc: Record<string, number>, assignment) => {
      const category = assignment.project.category;
      if (!acc[category]) acc[category] = 0;
      acc[category]++;
      return acc;
    }, {} as Record<string, number>) || {};

    res.json({
      staff: {
        id: staff.id,
        name: staff.name,
        position: staff.position,
      },
      activeProjects: staff.assignments?.length || 0,
      projectsByCategory,
      assignments: staff.assignments || [],
    });
  } catch (error) {
    logger.error('Get staff workload error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffChangeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    const staffId = parseInt(id as string, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    const limitNum = parseQueryInt(limit as string, { default: 100, min: 1, max: 500 });

    if (wasValueClamped(limit as string, limitNum, { max: 500 })) {
      logger.warn('Staff change history limit clamped', { limit: limitNum, userId: req.user?.userId });
    }

    const changes = await prisma.staffChangeHistory.findMany({
      where: {
        staffId,
      },
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { changedAt: 'desc' },
      take: limitNum,
    });

    res.json(
      changes.map((change) => ({
        id: change.id,
        fieldName: change.fieldName,
        oldValue: change.oldValue,
        newValue: change.newValue,
        changeType: change.changeType,
        username: change.user?.username || 'System',
        changedAt: change.changedAt,
      }))
    );
  } catch (error) {
    logger.error('Get staff change history error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffBillingProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id as string, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    // Verify staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, position: true },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Get billing projects where staff is BC attorney
    const billingProjectAttorneys = await prisma.billing_project_bc_attorney.findMany({
      where: { staff_id: staffId },
      include: {
        billing_project: {
          include: {
            billing_engagement: {
              include: {
                billing_milestone: {
                  where: {
                    completed: false,
                  },
                  orderBy: { sort_order: 'asc' },
                  take: 5, // Show first 5 pending milestones
                },
              },
              orderBy: { created_at: 'desc' },
            },
            billing_staffing_project_link: {
              include: {
                projects: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                    category: true,
                  },
                },
              },
            },
            billing_project_bc_attorney: {
              include: {
                staff: {
                  select: {
                    id: true,
                    name: true,
                    position: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        billing_project: {
          updated_at: 'desc',
        },
      },
    });

    // Format response
    const billingProjects = billingProjectAttorneys.map((bpa) => ({
      project_id: bpa.billing_project.project_id,
      project_name: bpa.billing_project.project_name,
      client_name: bpa.billing_project.client_name,
      base_currency: bpa.billing_project.base_currency,
      role: bpa.role,
      created_at: bpa.created_at,
      bc_attorneys: bpa.billing_project.billing_project_bc_attorney.map((bc) => ({
        staff_id: bc.staff.id,
        name: bc.staff.name,
        position: bc.staff.position,
        role: bc.role,
      })),
      linked_staffing_projects: bpa.billing_project.billing_staffing_project_link
        .map((link) => link.projects)
        .filter((p) => p !== null),
      engagements: bpa.billing_project.billing_engagement.map((eng) => ({
        engagement_id: eng.engagement_id,
        engagement_code: eng.engagement_code,
        engagement_title: eng.engagement_title,
        name: eng.name,
        pending_milestones: eng.billing_milestone.length,
      })),
    }));

    res.json(convertBigIntToNumber({
      staff: {
        id: staff.id,
        name: staff.name,
        position: staff.position,
      },
      total_projects: billingProjects.length,
      billing_projects: billingProjects,
    }));
  } catch (error) {
    logger.error('Get staff billing projects error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
