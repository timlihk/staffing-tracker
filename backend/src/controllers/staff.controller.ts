import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { getCached, setCached, invalidateCache, CACHE_KEYS } from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';
import { parseQueryInt, wasValueClamped } from '../utils/queryParsing';
import { StaffWhereInput, ControllerError } from '../types/prisma';
import { Prisma } from '@prisma/client';

export const getAllStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { position, department, status, search } = req.query;

    // Generate cache key based on query parameters
    const cacheKey = CACHE_KEYS.STAFF_LIST(
      `position=${position}&department=${department}&status=${status}&search=${search}`
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

    const staff = await prisma.staff.findMany({
      where,
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

    // Cache the response
    setCached(cacheKey, staff);

    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id, 10);
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
                filingDate: true,
                listingDate: true,
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
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role, department, status, notes } = req.body;

    console.log('[CREATE STAFF] Received data:', { name, email, role, department, status });

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        email,
        position: role,
        department,
        status: status || 'active',
        notes,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'create',
        entityType: 'staff',
        entityId: staff.id,
        description: `Created staff member: ${staff.name}`,
      },
    });

    // Invalidate cache for staff lists
    invalidateCache('staff:list');

    res.status(201).json(staff);
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, status, notes } = req.body;

    console.log('[UPDATE STAFF] Received ID:', id, 'Type:', typeof id);

    const staffId = parseInt(id, 10);
    if (Number.isNaN(staffId)) {
      console.log('[UPDATE STAFF] Invalid ID - returning 400');
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
    if (role) updateData.position = role;
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

    const staff = await prisma.staff.update({
      where: { id: staffId },
      data: updateData,
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'staff',
        entityId: staff.id,
        description: `Updated staff member: ${staff.name}`,
      },
    });

    // Invalidate cache for this staff member and staff lists
    invalidateCache(`staff:detail:${staffId}`);
    invalidateCache('staff:list');

    res.json(staff);
  } catch (error: ControllerError) {
    console.error('Update staff error:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      // Unique constraint violation
      const field = (error as any).meta?.target?.[0] || 'field';
      return res.status(400).json({ error: `This ${field} is already in use by another staff member` });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await prisma.staff.delete({
      where: { id: staffId },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'delete',
        entityType: 'staff',
        entityId: staffId,
        description: `Deleted staff member: ${staff.name}`,
      },
    });

    // Invalidate cache for this staff member and staff lists
    invalidateCache(`staff:detail:${staffId}`);
    invalidateCache('staff:list');

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffWorkload = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staffId = parseInt(id, 10);
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
    console.error('Get staff workload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffChangeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    const staffId = parseInt(id, 10);
    if (Number.isNaN(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    const limitNum = parseQueryInt(limit as string, { default: 100, min: 1, max: 500 });

    if (wasValueClamped(limit as string, limitNum, { max: 500 })) {
      console.warn(`[STAFF_CHANGE_HISTORY] Limit exceeded and clamped to ${limitNum} by user ${req.user?.userId}`);
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
    console.error('Get staff change history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
