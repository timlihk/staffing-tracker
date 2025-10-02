import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    // Get project statistics
    const [
      totalProjects,
      activeProjects,
      slowdownProjects,
      suspendedProjects,
      totalStaff,
      activeStaff,
      projectsByCategory,
      recentActivity,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: 'Active' } }),
      prisma.project.count({ where: { status: 'Slow-down' } }),
      prisma.project.count({ where: { status: 'Suspended' } }),
      prisma.staff.count(),
      prisma.staff.count({ where: { status: 'active' } }),
      prisma.project.groupBy({
        by: ['category'],
        _count: true,
        where: { status: 'Active' },
      }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { username: true },
          },
        },
      }),
    ]);

    // Get projects by status
    const projectsByStatus = [
      { status: 'Active', count: activeProjects },
      { status: 'Slow-down', count: slowdownProjects },
      { status: 'Suspended', count: suspendedProjects },
    ];

    // Get staff workload distribution
    const staffWorkload = await prisma.staff.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        role: true,
        assignments: {
          where: {
            project: { status: { in: ['Active', 'Slow-down'] } },
          },
        },
      },
    });

    const workloadDistribution = staffWorkload.map((staff) => {
      return {
        staffId: staff.id,
        name: staff.name,
        role: staff.role,
        projectCount: staff.assignments.length,
      };
    });

    // Get upcoming projects by timetable (showing active projects with timetable)
    const upcomingDeadlines = await prisma.project.findMany({
      where: {
        status: 'Active',
        timetable: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        category: true,
        timetable: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    res.json({
      summary: {
        totalProjects,
        activeProjects,
        slowdownProjects,
        suspendedProjects,
        totalStaff,
        activeStaff,
      },
      projectsByStatus,
      projectsByCategory: projectsByCategory.map((item) => ({
        category: item.category,
        count: item._count,
      })),
      workloadDistribution,
      upcomingDeadlines,
      recentActivity: recentActivity.map((activity) => ({
        id: activity.id,
        actionType: activity.actionType,
        entityType: activity.entityType,
        description: activity.description,
        username: activity.user?.username || 'System',
        createdAt: activity.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkloadReport = async (req: AuthRequest, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { status: 'active' },
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
      orderBy: { name: 'asc' },
    });

    const report = staff.map((member) => {
      const projectsByCategory = member.assignments.reduce((acc: any, assignment) => {
        const category = assignment.project.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push(assignment.project.name);
        return acc;
      }, {});

      return {
        staffId: member.id,
        name: member.name,
        role: member.role,
        department: member.department,
        totalProjects: member.assignments.length,
        projectsByCategory,
        assignments: member.assignments.map((a) => ({
          project: a.project.name,
          role: a.roleInProject,
          jurisdiction: a.jurisdiction,
        })),
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Get workload report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', page = '1' } = req.query;

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        take: limitNum,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { username: true },
          },
        },
      }),
      prisma.activityLog.count(),
    ]);

    res.json({
      data: activities.map((activity) => ({
        id: activity.id,
        actionType: activity.actionType,
        entityType: activity.entityType,
        entityId: activity.entityId,
        description: activity.description,
        username: activity.user?.username || 'System',
        createdAt: activity.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
