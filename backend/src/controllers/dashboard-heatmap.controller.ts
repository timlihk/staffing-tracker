import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { parseQueryInt } from '../utils/queryParsing';
import { logger } from '../utils/logger';
import { formatWeekKey } from './dashboard.utils';

/**
 * Build staffing heatmap data for the given date range and milestone type
 * Groups assignments into time periods (weeks/biweeks based on range)
 */
const buildStaffingHeatmap = async (
  start: Date,
  end: Date,
  milestoneType: 'filing' | 'listing' | 'both' = 'both'
) => {
  // Normalize start to start of day and end to end of day
  const adjustedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const adjustedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

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
          OR: milestoneType === 'both' ? [
            { filingDate: { gte: adjustedStart, lte: new Date(adjustedEnd.getFullYear(), adjustedEnd.getMonth(), adjustedEnd.getDate()) } },
            { listingDate: { gte: adjustedStart, lte: new Date(adjustedEnd.getFullYear(), adjustedEnd.getMonth(), adjustedEnd.getDate()) } },
          ] : milestoneType === 'filing' ? [
            { filingDate: { gte: adjustedStart, lte: new Date(adjustedEnd.getFullYear(), adjustedEnd.getMonth(), adjustedEnd.getDate()) } },
          ] : [
            { listingDate: { gte: adjustedStart, lte: new Date(adjustedEnd.getFullYear(), adjustedEnd.getMonth(), adjustedEnd.getDate()) } },
          ],
        },
        staff: {
          status: 'active',
        },
      },
      select: {
        staffId: true,
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
  const daysDiff = Math.ceil((adjustedEnd.getTime() - adjustedStart.getTime()) / (1000 * 60 * 60 * 24));
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
  const cursor = new Date(adjustedStart);
  for (let i = 0; i < numPeriods; i += 1) {
    const periodEnd = new Date(cursor);
    periodEnd.setDate(periodEnd.getDate() + intervalDays - 1);

    // Don't exceed the end date
    if (periodEnd > adjustedEnd) {
      periodEnd.setTime(adjustedEnd.getTime());
    }
    // Ensure period end is end of day
    periodEnd.setHours(23, 59, 59, 999);

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
    if (milestoneType === 'both' || milestoneType === 'filing') {
      if (assignment.project?.filingDate) dates.push(assignment.project.filingDate);
    }
    if (milestoneType === 'both' || milestoneType === 'listing') {
      if (assignment.project?.listingDate) dates.push(assignment.project.listingDate);
    }

    dates
      .filter((date) => date >= adjustedStart && date <= adjustedEnd)
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

/**
 * Get staffing heatmap for visualizing milestone distribution across staff
 * Supports customizable date range and milestone type filtering
 */
export const getStaffingHeatmap = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windowEnd = new Date();

    // Allow customizable time window (default 30 days, min 1, max 365)
    const days = parseQueryInt(req.query.days as string, { default: 30, min: 1, max: 365 });
    windowEnd.setDate(windowEnd.getDate() + days);

    // Allow milestone type filtering (default 'both', options: 'filing', 'listing', 'both')
    const milestoneTypeParam = (req.query.milestoneType as string) || 'both';
    if (!['filing', 'listing', 'both'].includes(milestoneTypeParam)) {
      return res.status(400).json({ error: 'Invalid milestoneType. Must be "filing", "listing", or "both"' });
    }
    const milestoneType = milestoneTypeParam as 'filing' | 'listing' | 'both';

    const staffingHeatmap = await buildStaffingHeatmap(windowStart, windowEnd, milestoneType);

    res.json({ staffingHeatmap });
  } catch (error) {
    logger.error('Get staffing heatmap error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
