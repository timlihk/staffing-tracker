import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { trackFieldChanges } from '../utils/changeTracking';

export const getAllStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { role, department, status, search } = req.query;

    const where: any = {};

    if (role) where.position = role;
    if (department) where.department = department;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const staff = await prisma.staff.findMany({
      where,
      include: {
        assignments: {
          include: {
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

    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id: parseInt(id) },
      include: {
        assignments: {
          include: {
            project: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role, department, status, notes } = req.body;

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

    const existingStaff = await prisma.staff.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Build update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email === '' ? null : email;
    if (role) updateData.position = role;
    if (department !== undefined) updateData.department = department === '' ? null : department;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes === '' ? null : notes;

    // Track all field changes
    await trackFieldChanges({
      entityId: parseInt(id),
      entityType: 'staff',
      oldData: existingStaff,
      newData: updateData,
      userId: req.user?.userId,
    });

    const staff = await prisma.staff.update({
      where: { id: parseInt(id) },
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

    res.json(staff);
  } catch (error: any) {
    console.error('Update staff error:', error);
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      return res.status(400).json({ error: `This ${field} is already in use by another staff member` });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id: parseInt(id) },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await prisma.staff.delete({
      where: { id: parseInt(id) },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'delete',
        entityType: 'staff',
        entityId: parseInt(id),
        description: `Deleted staff member: ${staff.name}`,
      },
    });

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStaffWorkload = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id: parseInt(id) },
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

    const projectsByCategory = staff.assignments?.reduce((acc: any, assignment) => {
      const category = assignment.project.category;
      if (!acc[category]) acc[category] = 0;
      acc[category]++;
      return acc;
    }, {}) || {};

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

    const limitNum = parseInt(limit as string);

    const changes = await prisma.staffChangeHistory.findMany({
      where: {
        staffId: parseInt(id),
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
