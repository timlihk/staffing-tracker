import prisma from '../utils/prisma';

/**
 * Format a date into a week key string
 * Used by staffing heatmap and upcoming milestones
 */
export const formatWeekKey = (date: Date, customEndDate?: Date) => {
  const startOfWeek = new Date(date);
  // Only adjust to Sunday if we're creating a standard week (no custom end date)
  if (!customEndDate) {
    startOfWeek.setDate(date.getDate() - date.getDay());
  }
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

/**
 * Find upcoming milestones (filing and listing dates) within a date range
 * Used by dashboard summary and staffing heatmap
 */
export const findUpcomingMilestones = async (
  start: Date,
  end: Date,
  milestoneType: 'filing' | 'listing' | 'both' = 'both'
) => {
  // Create date-only versions for comparison (remove time component)
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const projects = await prisma.project.findMany({
    where: {
      OR: milestoneType === 'both' ? [
        { filingDate: { gte: startDateOnly, lte: endDateOnly } },
        { listingDate: { gte: startDateOnly, lte: endDateOnly } },
      ] : milestoneType === 'filing' ? [
        { filingDate: { gte: startDateOnly, lte: endDateOnly } },
      ] : [
        { listingDate: { gte: startDateOnly, lte: endDateOnly } },
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

      const leadPartner = project.assignments.find(a => a.staff.position === 'Partner')?.staff?.name ??
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

      if ((milestoneType === 'both' || milestoneType === 'filing') && project.filingDate) {
        // Use date-only comparison for consistency with the database query
        const filingDateOnly = new Date(project.filingDate.getFullYear(), project.filingDate.getMonth(), project.filingDate.getDate());
        if (filingDateOnly >= startDateOnly && filingDateOnly <= endDateOnly) {
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
      }

      if ((milestoneType === 'both' || milestoneType === 'listing') && project.listingDate) {
        // Use date-only comparison for consistency with the database query
        const listingDateOnly = new Date(project.listingDate.getFullYear(), project.listingDate.getMonth(), project.listingDate.getDate());
        if (listingDateOnly >= startDateOnly && listingDateOnly <= endDateOnly) {
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
      }

      return events;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((event) => ({
      ...event,
      date: event.date.toISOString(),
    }));
};

/**
 * Find unstaffed milestones (projects missing US or HK partners)
 * Used by dashboard summary for action items
 */
export const findUnstaffedMilestones = async (
  start: Date,
  end: Date,
  milestoneType: 'filing' | 'listing' | 'both' = 'both'
) => {
  // Create date-only versions for comparison
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const projects = await prisma.project.findMany({
    where: {
      status: { in: ['Active', 'Slow-down'] },
      OR: milestoneType === 'both' ? [
        { filingDate: { gte: startDateOnly, lte: endDateOnly } },
        { listingDate: { gte: startDateOnly, lte: endDateOnly } },
      ] : milestoneType === 'filing' ? [
        { filingDate: { gte: startDateOnly, lte: endDateOnly } },
      ] : [
        { listingDate: { gte: startDateOnly, lte: endDateOnly } },
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

      // For 'both', pick the earliest upcoming milestone date
      const milestoneDate = milestoneType === 'filing' ? project.filingDate :
                            milestoneType === 'listing' ? project.listingDate :
                            (project.filingDate && project.listingDate
                              ? (project.filingDate < project.listingDate ? project.filingDate : project.listingDate)
                              : project.filingDate || project.listingDate);

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
