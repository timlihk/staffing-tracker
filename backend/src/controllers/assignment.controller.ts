import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

export const getAllAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, staffId } = req.query;

    const where: any = {};

    if (projectId) where.projectId = parseInt(projectId as string);
    if (staffId) where.staffId = parseInt(staffId as string);

    const assignments = await prisma.projectAssignment.findMany({
      where,
      include: {
        project: true,
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAssignmentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.projectAssignment.findUnique({
      where: { id: parseInt(id) },
      include: {
        project: true,
        staff: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId,
      staffId,
      roleInProject,
      jurisdiction,
      allocationPercentage,
      startDate,
      endDate,
      isLead,
      notes,
    } = req.body;

    if (!projectId || !staffId || !roleInProject) {
      return res.status(400).json({ error: 'ProjectId, staffId, and roleInProject are required' });
    }

    // Verify project and staff exist
    const [project, staff] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.staff.findUnique({ where: { id: staffId } }),
    ]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const assignment = await prisma.projectAssignment.create({
      data: {
        projectId,
        staffId,
        roleInProject,
        jurisdiction,
        allocationPercentage: allocationPercentage || 100,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isLead: isLead || false,
        notes,
      },
      include: {
        project: true,
        staff: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'assign',
        entityType: 'assignment',
        entityId: assignment.id,
        description: `Assigned ${staff.name} to ${project.name} as ${roleInProject}`,
      },
    });

    res.status(201).json(assignment);
  } catch (error: any) {
    console.error('Create assignment error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This assignment already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      roleInProject,
      jurisdiction,
      allocationPercentage,
      startDate,
      endDate,
      isLead,
      notes,
    } = req.body;

    const existingAssignment = await prisma.projectAssignment.findUnique({
      where: { id: parseInt(id) },
      include: { project: true, staff: true },
    });

    if (!existingAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = await prisma.projectAssignment.update({
      where: { id: parseInt(id) },
      data: {
        ...(roleInProject && { roleInProject }),
        ...(jurisdiction !== undefined && { jurisdiction }),
        ...(allocationPercentage !== undefined && { allocationPercentage }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isLead !== undefined && { isLead }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        project: true,
        staff: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'update',
        entityType: 'assignment',
        entityId: assignment.id,
        description: `Updated assignment: ${assignment.staff.name} on ${assignment.project.name}`,
      },
    });

    res.json(assignment);
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.projectAssignment.findUnique({
      where: { id: parseInt(id) },
      include: { project: true, staff: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await prisma.projectAssignment.delete({
      where: { id: parseInt(id) },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'delete',
        entityType: 'assignment',
        entityId: parseInt(id),
        description: `Removed ${assignment.staff.name} from ${assignment.project.name}`,
      },
    });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bulkCreateAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'Assignments array is required' });
    }

    const createdAssignments = [];

    for (const assignmentData of assignments) {
      const {
        projectId,
        staffId,
        roleInProject,
        jurisdiction,
        allocationPercentage,
        isLead,
      } = assignmentData;

      if (!projectId || !staffId || !roleInProject) {
        continue; // Skip invalid entries
      }

      try {
        const assignment = await prisma.projectAssignment.create({
          data: {
            projectId,
            staffId,
            roleInProject,
            jurisdiction,
            allocationPercentage: allocationPercentage || 100,
            isLead: isLead || false,
          },
          include: {
            project: true,
            staff: true,
          },
        });

        createdAssignments.push(assignment);
      } catch (error: any) {
        // Skip duplicates
        if (error.code !== 'P2002') {
          throw error;
        }
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'assign',
        entityType: 'assignment',
        description: `Bulk created ${createdAssignments.length} assignments`,
      },
    });

    res.status(201).json({
      count: createdAssignments.length,
      assignments: createdAssignments,
    });
  } catch (error) {
    console.error('Bulk create assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
