import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * Get workload report for all active staff members
 * Shows project assignments grouped by category
 */
export const getWorkloadReport = async (req: AuthRequest, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        position: true,
        department: true,
        assignments: {
          where: {
            project: { status: { in: ['Active', 'Slow-down'] } },
          },
          select: {
            jurisdiction: true,
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
      const projectsByCategory = member.assignments.reduce((acc: Record<string, string[]>, assignment) => {
        const category = assignment.project.category;
        if (!acc[category]) acc[category] = [];
        acc[category].push(assignment.project.name);
        return acc;
      }, {} as Record<string, string[]>);

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
    logger.error('Get workload report error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
