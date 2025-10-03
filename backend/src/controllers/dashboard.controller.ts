import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 30);

    const [
      totalProjects,
      activeProjects,
      slowdownProjects,
      suspendedProjects,
      totalStaff,
      activeStaff,
      projectsByCategory,
      upcomingMilestones,
      staffingHeatmap,
      unstaffedMilestones,
      pendingResets,
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
      findUpcomingMilestones(now, windowEnd),
      buildStaffingHeatmap(now, windowEnd),
      findUnstaffedMilestones(now, windowEnd),
      prisma.user.findMany({
        where: { mustResetPassword: true },
        select: {
          id: true,
          username: true,
          role: true,
          email: true,
          lastLogin: true,
        },
        orderBy: { username: 'asc' },
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

    const projectsByStatus = [
      { status: 'Active', count: activeProjects },
      { status: 'Slow-down', count: slowdownProjects },
      { status: 'Suspended', count: suspendedProjects },
    ];

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
      dealRadar: upcomingMilestones,
      staffingHeatmap,
      actionItems: {
        unstaffedMilestones,
        pendingResets: pendingResets.map((user) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
        })),
      },
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
const findUpcomingMilestones = async (start: Date, end: Date) => {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { filingDate: { gte: start, lte: end } },
        { listingDate: { gte: start, lte: end } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
      priority: true,
      filingDate: true,
      listingDate: true,
      assignments: {
        where: {
          roleInProject: 'Partner',
        },
        select: {
          staff: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return projects
    .flatMap((project) => {
      const events: Array<{
        projectId: number;
        projectName: string;
        category: string;
        status: string;
        priority: string | null;
        type: 'Filing' | 'Listing';
        date: Date;
        partner: string | null;
      }> = [];

      const leadPartner = project.assignments[0]?.staff?.name ?? null;

      if (project.filingDate && project.filingDate >= start && project.filingDate <= end) {
        events.push({
          projectId: project.id,
          projectName: project.name,
          category: project.category,
          status: project.status,
          priority: project.priority,
          type: 'Filing',
          date: project.filingDate,
          partner: leadPartner,
        });
      }

      if (project.listingDate && project.listingDate >= start && project.listingDate <= end) {
        events.push({
          projectId: project.id,
          projectName: project.name,
          category: project.category,
          status: project.status,
          priority: project.priority,
          type: 'Listing',
          date: project.listingDate,
          partner: leadPartner,
        });
      }

      return events;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((event) => ({
      ...event,
      date: event.date.toISOString(),
    }));
};

const buildStaffingHeatmap = async (start: Date, end: Date) => {
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      project: {
        OR: [
          { filingDate: { gte: start, lte: end } },
          { listingDate: { gte: start, lte: end } },
        ],
      },
      staff: {
        status: 'active',
      },
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      project: {
        select: {
          filingDate: true,
          listingDate: true,
        },
      },
    },
  });

  const heatmap: Record<number, Record<string, number>> = {};

  assignments.forEach((assignment) => {
    if (!assignment.staff) return;

    const dates: Date[] = [];
    if (assignment.project?.filingDate) dates.push(assignment.project.filingDate);
    if (assignment.project?.listingDate) dates.push(assignment.project.listingDate);

    dates
      .filter((date) => date >= start && date <= end)
      .forEach((date) => {
        const weekKey = formatWeekKey(date);
        if (!heatmap[assignment.staff.id]) {
          heatmap[assignment.staff.id] = {};
        }
        heatmap[assignment.staff.id][weekKey] = (heatmap[assignment.staff.id][weekKey] || 0) + 1;
      });
  });

  const staffMap = new Map<number, { id: number; name: string; role: string }>();
  assignments.forEach((assignment) => {
    if (assignment.staff) {
      staffMap.set(assignment.staff.id, assignment.staff);
    }
  });

  const weeks: string[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 6; i += 1) {
    const weekKey = formatWeekKey(cursor);
    weeks.push(weekKey);
    cursor.setDate(cursor.getDate() + 7);
  }

  return Array.from(staffMap.values()).map((staff) => ({
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    weeks: weeks.map((week) => ({ week, count: heatmap[staff.id]?.[week] || 0 })),
  }));
};

const findUnstaffedMilestones = async (start: Date, end: Date) => {
  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['Active', 'Slow-down'] },
      OR: [
        { filingDate: { gte: start, lte: end } },
        { listingDate: { gte: start, lte: end } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
      filingDate: true,
      listingDate: true,
      assignments: {
        select: {
          roleInProject: true,
          jurisdiction: true,
        },
      },
    },
  });

  return projects
    .map((project) => {
      const needsUSPartner = !project.assignments.some(
        (assignment) => assignment.jurisdiction === 'US Law' && assignment.roleInProject === 'Partner'
      );
      const needsHKPartner = !project.assignments.some(
        (assignment) => assignment.jurisdiction === 'HK Law' && assignment.roleInProject === 'Partner'
      );

      const milestoneDate = project.filingDate || project.listingDate;

      return {
        projectId: project.id,
        projectName: project.name,
        category: project.category,
        status: project.status,
        milestoneDate: milestoneDate ? milestoneDate.toISOString() : null,
        needsUSPartner,
        needsHKPartner,
      };
    })
    .filter((item) => item.needsUSPartner || item.needsHKPartner)
    .sort((a, b) => {
      if (!a.milestoneDate) return 1;
      if (!b.milestoneDate) return -1;
      return new Date(a.milestoneDate).getTime() - new Date(b.milestoneDate).getTime();
    });
};

const formatWeekKey = (date: Date) => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return `${startOfWeek.toISOString().split('T')[0]}_${endOfWeek.toISOString().split('T')[0]}`;
};
