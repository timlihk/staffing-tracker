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
    const now = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 60);

    const projectsWithMilestones = await prisma.project.findMany({
      where: {
        OR: [
          { filingDate: { not: null } },
          { listingDate: { not: null } },
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
      },
    });

    const timeline = projectsWithMilestones
      .flatMap((project) => {
        const events: Array<{
          projectId: number;
          projectName: string;
          category: string;
          status: string;
          priority: string | null;
          type: 'Filing' | 'Listing';
          date: Date;
        }> = [];

        if (project.filingDate) {
          events.push({
            projectId: project.id,
            projectName: project.name,
            category: project.category,
            status: project.status,
            priority: project.priority,
            type: 'Filing',
            date: project.filingDate,
          });
        }

        if (project.listingDate) {
          events.push({
            projectId: project.id,
            projectName: project.name,
            category: project.category,
            status: project.status,
            priority: project.priority,
            type: 'Listing',
            date: project.listingDate,
          });
        }

        return events;
      })
      .filter((event) => event.date >= now && event.date <= windowEnd)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 40)
      .map((event) => ({
        ...event,
        date: event.date.toISOString(),
      }));

    const upcomingAssignments = await prisma.projectAssignment.findMany({
      where: {
        project: {
          OR: [
            { filingDate: { gte: now, lte: windowEnd } },
            { listingDate: { gte: now, lte: windowEnd } },
          ],
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
            id: true,
            name: true,
            filingDate: true,
            listingDate: true,
          },
        },
      },
    });

    const busyStaffMap = new Map<
      number,
      {
        staffId: number;
        name: string;
        role: string;
        upcomingProjects: Array<{ projectId: number; projectName: string; date: string; type: 'Filing' | 'Listing' }>;
      }
    >();

    upcomingAssignments.forEach((assignment) => {
      if (!assignment.staff || !assignment.project) return;

      const candidateDates: Array<{ date: Date; type: 'Filing' | 'Listing' }> = [];
      if (assignment.project.filingDate && assignment.project.filingDate >= now && assignment.project.filingDate <= windowEnd) {
        candidateDates.push({ date: assignment.project.filingDate, type: 'Filing' });
      }
      if (assignment.project.listingDate && assignment.project.listingDate >= now && assignment.project.listingDate <= windowEnd) {
        candidateDates.push({ date: assignment.project.listingDate, type: 'Listing' });
      }

      if (candidateDates.length === 0) return;

      candidateDates.sort((a, b) => a.date.getTime() - b.date.getTime());
      const nextMilestone = candidateDates[0];

      if (!busyStaffMap.has(assignment.staff.id)) {
        busyStaffMap.set(assignment.staff.id, {
          staffId: assignment.staff.id,
          name: assignment.staff.name,
          role: assignment.staff.role,
          upcomingProjects: [],
        });
      }

      busyStaffMap.get(assignment.staff.id)!.upcomingProjects.push({
        projectId: assignment.project.id,
        projectName: assignment.project.name,
        date: nextMilestone.date.toISOString(),
        type: nextMilestone.type,
      });
    });

    const busyStaff = Array.from(busyStaffMap.values())
      .map((staff) => ({
        ...staff,
        upcomingProjects: staff.upcomingProjects
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 5),
      }))
      .sort((a, b) => b.upcomingProjects.length - a.upcomingProjects.length)
      .slice(0, 10);

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
      timeline,
      busyStaff,
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
