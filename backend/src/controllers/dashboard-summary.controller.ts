import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { getCached, setCached, CACHE_KEYS } from '../utils/prisma';
import { parseQueryInt } from '../utils/queryParsing';
import { logger } from '../utils/logger';
import { findUpcomingMilestones, findUnstaffedMilestones } from './dashboard.utils';

/**
 * Get top 5 staff members by number of active project assignments
 */
export const getTopAssignedStaff = async () => {
  // Optimized query using _count aggregation instead of loading all assignments
  const staff = await prisma.staff.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      position: true,
      _count: {
        select: {
          assignments: {
            where: {
              project: { status: { in: ['Active', 'Slow-down'] } },
            },
          },
        },
      },
    },
  });

  return staff
    .map((member) => ({
      staffId: member.id,
      name: member.name,
      position: member.position,
      projectCount: member._count.assignments,
    }))
    .filter((member) => member.projectCount > 0)
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 5);
};

/**
 * Get 7-day trends for projects (new, suspended, slow-down, resumed)
 */
export const getSevenDayTrends = async (sevenDaysAgo: Date) => {
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

/**
 * Get comprehensive dashboard summary
 * Includes project/staff counts, breakdowns, trends, and action items
 */
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windowEnd = new Date();

    // Allow customizable time window (default 30 days, min 1, max 365)
    const days = parseQueryInt(req.query.days as string, { default: 30, min: 1, max: 365 });
    windowEnd.setDate(windowEnd.getDate() + days);

    // Calculate 7 days ago for trends
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Calculate 30 days from now for upcoming filings/listings
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Generate cache key based on query parameters
    const cacheKey = CACHE_KEYS.DASHBOARD_SUMMARY(
      `days=${days}&userId=${req.user?.userId}`
    );

    // Try to get from cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Combine project status counts into a single aggregated query
    const projectStatusCounts = await prisma.project.groupBy({
      by: ['status'],
      _count: true,
    });

    // Create a lookup map for status counts
    const projectCountByStatus = projectStatusCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const totalProjects = Object.values(projectCountByStatus).reduce((sum, count) => sum + count, 0);
    const activeProjects = projectCountByStatus['Active'] || 0;
    const slowdownProjects = projectCountByStatus['Slow-down'] || 0;
    const suspendedProjects = projectCountByStatus['Suspended'] || 0;
    const closedProjects = projectCountByStatus['Closed'] || 0;
    const terminatedProjects = projectCountByStatus['Terminated'] || 0;

    const [
      staffCounts,
      projectsByCategory,
      projectsBySector,
      projectsBySide,
      staffByRole,
      topAssignedStaff,
      pendingConfirmations,
      upcomingFilings30Days,
      upcomingListings30Days,
      upcomingMilestones,
      unstaffedMilestones,
      pendingResets,
      recentActivity,
      sevenDayTrends,
    ] = await Promise.all([
      // Combine staff counts into a single query with aggregation
      prisma.staff.aggregate({
        _count: { id: true },
        where: {},
      }).then(result => ({ total: result._count.id })).then(async (base) => ({
        ...base,
        active: await prisma.staff.count({ where: { status: 'active' } }),
      })),
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
          filingDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lte: new Date(thirtyDaysFromNow.getFullYear(), thirtyDaysFromNow.getMonth(), thirtyDaysFromNow.getDate())
          },
        },
      }),
      prisma.project.count({
        where: {
          listingDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lte: new Date(thirtyDaysFromNow.getFullYear(), thirtyDaysFromNow.getMonth(), thirtyDaysFromNow.getDate())
          },
        },
      }),
      findUpcomingMilestones(windowStart, windowEnd),
      findUnstaffedMilestones(windowStart, windowEnd),
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

    const totalStaff = staffCounts.total;
    const activeStaff = staffCounts.active;

    const projectsByStatus = [
      { status: 'Active', count: activeProjects },
      { status: 'Slow-down', count: slowdownProjects },
      { status: 'Suspended', count: suspendedProjects },
      { status: 'Closed', count: closedProjects },
      { status: 'Terminated', count: terminatedProjects },
    ];

    const response = {
      summary: {
        totalProjects,
        activeProjects,
        slowdownProjects,
        suspendedProjects,
        closedProjects,
        terminatedProjects,
        totalStaff,
        activeStaff,
        pendingConfirmations,
        upcomingFilings30Days,
        upcomingListings30Days,
      },
      projectsByStatus,
      projectsByCategory: projectsByCategory.map((item) => ({
        category: item.category,
        count: item._count,
      })),
      projectsBySector: projectsBySector.map((item) => ({
        sector: item.sector,
        count: item._count,
      })),
      projectsBySide: projectsBySide.map((item) => ({
        side: item.side,
        count: item._count,
      })),
      staffByRole: staffByRole.map((item) => ({
        position: item.position,
        count: item._count,
      })),
      topAssignedStaff,
      sevenDayTrends,
      dealRadar: upcomingMilestones,
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
    };

    // Cache the response
    setCached(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('Get dashboard summary error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
