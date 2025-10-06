import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

const trackAssignmentChange = async (
  projectId: number,
  staffId: number,
  changeType: 'assignment_added' | 'assignment_removed',
  assignmentDetails: string,
  userId?: number
) => {
  // Track on project side
  await prisma.projectChangeHistory.create({
    data: {
      projectId,
      fieldName: 'assignment',
      oldValue: changeType === 'assignment_added' ? null : assignmentDetails,
      newValue: changeType === 'assignment_added' ? assignmentDetails : null,
      changeType,
      changedBy: userId,
    },
  });

  // Track on staff side
  await prisma.staffChangeHistory.create({
    data: {
      staffId,
      fieldName: 'assignment',
      oldValue: changeType === 'assignment_added' ? null : assignmentDetails,
      newValue: changeType === 'assignment_added' ? assignmentDetails : null,
      changeType,
      changedBy: userId,
    },
  });
};

export const getAllAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, staffId } = req.query;

    const where: any = {};

    if (projectId) {
      const parsedProjectId = parseInt(projectId as string, 10);
      if (Number.isNaN(parsedProjectId)) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      where.projectId = parsedProjectId;
    }
    if (staffId) {
      const parsedStaffId = parseInt(staffId as string, 10);
      if (Number.isNaN(parsedStaffId)) {
        return res.status(400).json({ error: 'Invalid staffId' });
      }
      where.staffId = parsedStaffId;
    }

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

    const assignmentId = parseInt(id, 10);
    if (Number.isNaN(assignmentId)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    const assignment = await prisma.projectAssignment.findUnique({
      where: { id: assignmentId },
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
      jurisdiction,
      startDate,
      endDate,
      notes,
    } = req.body;

    if (!projectId || !staffId) {
      return res.status(400).json({ error: 'ProjectId and staffId are required' });
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
        
        jurisdiction,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
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
        description: `Assigned ${staff.name} to ${project.name}`,
      },
    });

    // Track assignment change
    const assignmentDetails = `${staff.name} (${staff.position})${jurisdiction ? ` - ${jurisdiction}` : ''}`;
    await trackAssignmentChange(
      projectId,
      staffId,
      'assignment_added',
      assignmentDetails,
      req.user?.userId
    );

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
      jurisdiction,
      startDate,
      endDate,
      notes,
    } = req.body;

    const assignmentId = parseInt(id, 10);
    if (Number.isNaN(assignmentId)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    const existingAssignment = await prisma.projectAssignment.findUnique({
      where: { id: assignmentId },
      include: { project: true, staff: true },
    });

    if (!existingAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = await prisma.projectAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(jurisdiction !== undefined && { jurisdiction }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
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

    const assignmentId = parseInt(id, 10);
    if (Number.isNaN(assignmentId)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    const assignment = await prisma.projectAssignment.findUnique({
      where: { id: assignmentId },
      include: { project: true, staff: true },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await prisma.projectAssignment.delete({
      where: { id: assignmentId },
    });

    // Track assignment removal
    const assignmentDetails = `${assignment.staff.name} (${assignment.staff.position})${assignment.jurisdiction ? ` - ${assignment.jurisdiction}` : ''}`;
    await trackAssignmentChange(
      assignment.projectId,
      assignment.staffId,
      'assignment_removed',
      assignmentDetails,
      req.user?.userId
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'delete',
        entityType: 'assignment',
        entityId: assignmentId,
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
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < assignments.length; i++) {
      const assignmentData = assignments[i];
      const {
        projectId,
        staffId,
        jurisdiction,
      } = assignmentData;

      // Validate and coerce IDs
      if (!projectId || !staffId) {
        errors.push({ index: i, error: 'Missing projectId or staffId' });
        continue;
      }

      const parsedProjectId = typeof projectId === 'number' ? projectId : parseInt(String(projectId), 10);
      const parsedStaffId = typeof staffId === 'number' ? staffId : parseInt(String(staffId), 10);

      if (Number.isNaN(parsedProjectId)) {
        errors.push({ index: i, error: 'Invalid projectId' });
        continue;
      }

      if (Number.isNaN(parsedStaffId)) {
        errors.push({ index: i, error: 'Invalid staffId' });
        continue;
      }

      try {
        const assignment = await prisma.projectAssignment.create({
          data: {
            projectId: parsedProjectId,
            staffId: parsedStaffId,
            jurisdiction,
          },
          include: {
            project: true,
            staff: true,
          },
        });

        createdAssignments.push(assignment);
      } catch (error: any) {
        // Skip duplicates
        if (error.code === 'P2002') {
          errors.push({ index: i, error: 'Duplicate assignment' });
        } else {
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
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk create assignments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
