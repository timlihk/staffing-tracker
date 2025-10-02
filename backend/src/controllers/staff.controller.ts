import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

export const getAllStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { role, department, status, search } = req.query;

    const where: any = {};

    if (role) where.role = role;
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
          where: {
            project: { status: 'Active' },
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
        role,
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

    const staff = await prisma.staff.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(role && { role }),
        ...(department !== undefined && { department }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
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
  } catch (error) {
    console.error('Update staff error:', error);
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

    const totalAllocation = staff.assignments.reduce(
      (sum, assignment) => sum + assignment.allocationPercentage,
      0
    );

    const projectsByCategory = staff.assignments.reduce((acc: any, assignment) => {
      const category = assignment.project.category;
      if (!acc[category]) acc[category] = 0;
      acc[category]++;
      return acc;
    }, {});

    res.json({
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
      },
      activeProjects: staff.assignments.length,
      totalAllocation,
      isOverAllocated: totalAllocation > 100,
      projectsByCategory,
      assignments: staff.assignments,
    });
  } catch (error) {
    console.error('Get staff workload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
