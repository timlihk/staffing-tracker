import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

// Helper functions
const getTopAssignedStaff = async () => {
  const staff = await prisma.staff.findMany({
    where: { status: 'active' },
    include: {
      assignments: {
        where: {
          project: { status: { in: ['Active', 'Slow-down'] } },
        },
      },
    },
  });

  return staff
    .map((member) => ({
      staffId: member.id,
      name: member.name,
      position: member.position,
      projectCount: member.assignments.length,
    }))
    .filter((member) => member.projectCount > 0)
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 5);
};

const getSevenDayTrends = async (sevenDaysAgo: Date) => {
  const [
    newProjects,
    suspendedChanges,
    slowdownChanges,
    resumedChanges,
  ] = await Promise.all([
    // New projects created in last 7 days
    prisma.project.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    // Projects that changed TO suspended in last 7 days
    prisma.projectChangeHistory.count({
      where: {
        fieldName: 'status',
        newValue: 'Suspended',
        changedAt: { gte: sevenDaysAgo },
      },
    }),
    // Projects that changed TO slow-down in last 7 days
    prisma.projectChangeHistory.count({
      where: {
        fieldName: 'status',
        newValue: 'Slow-down',
        changedAt: { gte: sevenDaysAgo },
      },
    }),
    // Projects that changed TO active (resumed) in last 7 days
    prisma.projectChangeHistory.count({
      where: {
        fieldName: 'status',
        newValue: 'Active',
        oldValue: { in: ['Slow-down', 'Suspended'] },
        changedAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return {
    newProjects,
    suspended: suspendedChanges,
    slowdown: slowdownChanges,
    resumed: resumedChanges,
  };
};

export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const windowEnd = new Date();

    // Allow customizable time window (default 30 days)
    const days = parseInt(req.query.days as string) || 30;
    windowEnd.setDate(windowEnd.getDate() + days);

    // Calculate 7 days ago for trends
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Calculate 30 days from now for upcoming filings/listings
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
      totalProjects,
      activeProjects,
      slowdownProjects,
      suspendedProjects,
      totalStaff,
      activeStaff,
      projectsByCategory,
      projectsBySector,
      projectsBySide,
      staffByRole,
      topAssignedStaff,
      pendingConfirmations,
      upcomingFilings30Days,
      upcomingListings30Days,
      upcomingMilestones,
      staffingHeatmap,
      unstaffedMilestones,
      pendingResets,
      recentActivity,
      sevenDayTrends,
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
      prisma.project.groupBy({
        by: ['sector'],
        _count: true,
        where: { status: 'Active', sector: { not: null } },
      }),
      prisma.project.groupBy({
        by: ['side'],
        _count: true,
        where: { status: 'Active', side: { not: null } },
      }),
      prisma.staff.groupBy({
        by: ['position'],
        _count: true,
        where: { status: 'active' },
      }),
      getTopAssignedStaff(),
      prisma.project.count({
        where: {
          OR: [
            { lastConfirmedAt: null },
            { lastConfirmedAt: { lt: sevenDaysAgo } },
          ],
        },
      }),
      prisma.project.count({
        where: {
          filingDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
      prisma.project.count({
        where: {
          listingDate: { gte: now, lte: thirtyDaysFromNow },
        },
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
          lastActivity: true,
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
      getSevenDayTrends(sevenDaysAgo),
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
        pendingConfirmations,
        upcomingFilings30Days,
        upcomingListings30Days,
      },
      projectsByStatus,
      projectsByCategory: projectsByCategory.map((item: any) => ({
        category: item.category,
        count: item._count,
      })),
      projectsBySector: projectsBySector.map((item: any) => ({
        sector: item.sector,
        count: item._count,
      })),
      projectsBySide: projectsBySide.map((item: any) => ({
        side: item.side,
        count: item._count,
      })),
      staffByRole: staffByRole.map((item: any) => ({
        position: item.position,
        count: item._count,
      })),
      topAssignedStaff,
      sevenDayTrends,
      dealRadar: upcomingMilestones,
      staffingHeatmap,
      actionItems: {
        unstaffedMilestones,
        pendingResets: pendingResets.map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
        })),
      },
      recentActivity: recentActivity.map((activity: any) => ({
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
        position: member.position,
        department: member.department,
        totalProjects: member.assignments.length,
        projectsByCategory,
        assignments: member.assignments.map((a) => ({
          project: a.project.name,
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
    const { limit = '50', page = '1', entityType } = req.query;

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    if (entityType) {
      where.entityType = entityType as string;
    }

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        take: limitNum,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { username: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
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

export const getDetailedChangeHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '100', entityType } = req.query;
    const limitNum = parseInt(limit as string);

    if (entityType === 'staff') {
      const changes = await prisma.staffChangeHistory.findMany({
        take: limitNum,
        orderBy: { changedAt: 'desc' },
        include: {
          user: { select: { username: true } },
          staff: { select: { id: true, name: true } },
        },
      });

      res.json({
        data: changes.map((change) => ({
          id: change.id,
          entityType: 'staff',
          entityId: change.staffId,
          entityName: change.staff.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
      });
    } else if (entityType === 'project') {
      const changes = await prisma.projectChangeHistory.findMany({
        take: limitNum,
        orderBy: { changedAt: 'desc' },
        include: {
          user: { select: { username: true } },
          project: { select: { id: true, name: true } },
        },
      });

      res.json({
        data: changes.map((change) => ({
          id: change.id,
          entityType: 'project',
          entityId: change.projectId,
          entityName: change.project.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
      });
    } else {
      // Get both staff and project changes
      const [staffChanges, projectChanges] = await Promise.all([
        prisma.staffChangeHistory.findMany({
          take: Math.floor(limitNum / 2),
          orderBy: { changedAt: 'desc' },
          include: {
            user: { select: { username: true } },
            staff: { select: { id: true, name: true } },
          },
        }),
        prisma.projectChangeHistory.findMany({
          take: Math.floor(limitNum / 2),
          orderBy: { changedAt: 'desc' },
          include: {
            user: { select: { username: true } },
            project: { select: { id: true, name: true } },
          },
        }),
      ]);

      const combined = [
        ...staffChanges.map((change) => ({
          id: `staff-${change.id}`,
          entityType: 'staff' as const,
          entityId: change.staffId,
          entityName: change.staff.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
        ...projectChanges.map((change) => ({
          id: `project-${change.id}`,
          entityType: 'project' as const,
          entityId: change.projectId,
          entityName: change.project.name,
          actionType: change.changeType,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          username: change.user?.username || 'System',
          createdAt: change.changedAt,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ data: combined.slice(0, limitNum) });
    }
  } catch (error) {
    console.error('Get detailed change history error:', error);
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
      side: true,
      filingDate: true,
      listingDate: true,
      assignments: {
        select: {
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
  });

  return projects
    .flatMap((project) => {
      const events: Array<{
        projectId: number;
        projectName: string;
        category: string;
        status: string;
        priority: string | null;
        side: string | null;
        type: 'Filing' | 'Listing';
        date: Date;
        partner: string | null;
        teamMembers: Array<{ id: number; name: string; position: string }>;
      }> = [];

      const leadPartner = project.assignments.find(a => a.staff.name.includes('Partner'))?.staff?.name ??
                          project.assignments[0]?.staff?.name ?? null;

      // Deduplicate team members by staff ID to ensure each person appears only once
      const uniqueStaffMap = new Map<number, { id: number; name: string; position: string }>();
      project.assignments.forEach(a => {
        if (!uniqueStaffMap.has(a.staff.id)) {
          uniqueStaffMap.set(a.staff.id, {
            id: a.staff.id,
            name: a.staff.name,
            position: a.staff.position
          });
        }
      });
      const teamMembers = Array.from(uniqueStaffMap.values());

      if (project.filingDate && project.filingDate >= start && project.filingDate <= end) {
        events.push({
          projectId: project.id,
          projectName: project.name,
          category: project.category,
          status: project.status,
          priority: project.priority,
          side: project.side,
          type: 'Filing',
          date: project.filingDate,
          partner: leadPartner,
          teamMembers,
        });
      }

      if (project.listingDate && project.listingDate >= start && project.listingDate <= end) {
        events.push({
          projectId: project.id,
          projectName: project.name,
          category: project.category,
          status: project.status,
          priority: project.priority,
          side: project.side,
          type: 'Listing',
          date: project.listingDate,
          partner: leadPartner,
          teamMembers,
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
  // Fetch all active staff members and their assignments with upcoming milestones
  const [allStaff, assignments] = await Promise.all([
    prisma.staff.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        position: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.projectAssignment.findMany({
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
            position: true,
          },
        },
        project: {
          select: {
            filingDate: true,
            listingDate: true,
          },
        },
      },
    }),
  ]);

  // Calculate number of periods based on the date range
  // Strategy: Keep columns to ~6 for better UX
  // 30 days = 6 weeks (7-day intervals)
  // 60 days = 6 biweeks (10-day intervals)
  // 90 days = 6 biweeks (15-day intervals)
  // 120 days = 6 periods (20-day intervals)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  let intervalDays: number;
  let numPeriods: number;

  if (daysDiff <= 40) {
    // 30-40 days: weekly view (7-day intervals)
    intervalDays = 7;
    numPeriods = Math.ceil(daysDiff / intervalDays);
  } else if (daysDiff <= 70) {
    // 60 days: biweekly view (10-day intervals, ~6 columns)
    intervalDays = 10;
    numPeriods = Math.ceil(daysDiff / intervalDays);
  } else if (daysDiff <= 100) {
    // 90 days: biweekly+ view (15-day intervals, ~6 columns)
    intervalDays = 15;
    numPeriods = Math.ceil(daysDiff / intervalDays);
  } else {
    // 120+ days: monthly view (20-day intervals, ~6 columns)
    intervalDays = 20;
    numPeriods = Math.ceil(daysDiff / intervalDays);
  }

  // Build period definitions
  interface Period {
    key: string;
    start: Date;
    end: Date;
  }

  const periods: Period[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < numPeriods; i += 1) {
    const periodEnd = new Date(cursor);
    periodEnd.setDate(periodEnd.getDate() + intervalDays - 1);

    // Don't exceed the end date
    if (periodEnd > end) {
      periodEnd.setTime(end.getTime());
    }

    const weekKey = formatWeekKey(cursor, periodEnd);
    periods.push({
      key: weekKey,
      start: new Date(cursor),
      end: new Date(periodEnd),
    });
    cursor.setDate(cursor.getDate() + intervalDays);
  }

  const weeks: string[] = periods.map((p) => p.key);

  // Helper function to find which period a date falls into
  const findPeriodForDate = (date: Date): string | null => {
    for (const period of periods) {
      if (date >= period.start && date <= period.end) {
        return period.key;
      }
    }
    return null;
  };

  const heatmap: Record<number, Record<string, number>> = {};

  assignments.forEach((assignment) => {
    if (!assignment.staff) return;

    const dates: Date[] = [];
    if (assignment.project?.filingDate) dates.push(assignment.project.filingDate);
    if (assignment.project?.listingDate) dates.push(assignment.project.listingDate);

    dates
      .filter((date) => date >= start && date <= end)
      .forEach((date) => {
        const periodKey = findPeriodForDate(date);
        if (periodKey) {
          if (!heatmap[assignment.staff.id]) {
            heatmap[assignment.staff.id] = {};
          }
          heatmap[assignment.staff.id][periodKey] = (heatmap[assignment.staff.id][periodKey] || 0) + 1;
        }
      });
  });

  // Return all active staff members, including those with no assignments (0 milestones)
  return allStaff.map((staff) => ({
    staffId: staff.id,
    name: staff.name,
    position: staff.position,
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
          jurisdiction: true,
          staff: {
            select: {
              position: true,
            },
          },
        },
      },
    },
  });

  return projects
    .map((project) => {
      const needsUSPartner = !project.assignments.some(
        (assignment) => assignment.jurisdiction === 'US Law' && assignment.staff?.position === 'Partner'
      );
      const needsHKPartner = !project.assignments.some(
        (assignment) => assignment.jurisdiction === 'HK Law' && assignment.staff?.position === 'Partner'
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

const formatWeekKey = (date: Date, customEndDate?: Date) => {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = customEndDate
    ? new Date(customEndDate)
    : new Date(startOfWeek);

  if (!customEndDate) {
    endOfWeek.setDate(startOfWeek.getDate() + 6);
  }
  endOfWeek.setHours(23, 59, 59, 999);

  return `${startOfWeek.toISOString().split('T')[0]}_${endOfWeek.toISOString().split('T')[0]}`;
};
