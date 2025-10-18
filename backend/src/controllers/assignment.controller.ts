import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma, { invalidateCache, CACHE_KEYS } from '../utils/prisma';
import { AssignmentWhereInput, ControllerError } from '../types/prisma';

export const getAllAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, staffId } = req.query;

    const where: AssignmentWhereInput = {};

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

    // Use transaction to ensure atomicity
    const assignment = await prisma.$transaction(async (tx) => {
      // Create assignment
      const newAssignment = await tx.projectAssignment.create({
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
      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: 'assign',
          entityType: 'assignment',
          entityId: newAssignment.id,
          description: `Assigned ${staff.name} to ${project.name}`,
        },
      });

      // Track assignment change on project side
      await tx.projectChangeHistory.create({
        data: {
          projectId,
          fieldName: 'assignment',
          oldValue: null,
          newValue: `${staff.name} (${staff.position})${jurisdiction ? ` - ${jurisdiction}` : ''}`,
          changeType: 'assignment_added',
          changedBy: req.user?.userId,
        },
      });

      // Track assignment change on staff side
      await tx.staffChangeHistory.create({
        data: {
          staffId,
          fieldName: 'assignment',
          oldValue: null,
          newValue: `${staff.name} (${staff.position})${jurisdiction ? ` - ${jurisdiction}` : ''}`,
          changeType: 'assignment_added',
          changedBy: req.user?.userId,
        },
      });

      return newAssignment;
    });

    // Invalidate caches for affected project, staff, and lists
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(projectId));
    invalidateCache(CACHE_KEYS.STAFF_DETAIL(staffId));
    invalidateCache(`project:change-history:v2:${projectId}`); // All limits for this project
    invalidateCache('projects:list');
    invalidateCache('staff:list');
    invalidateCache('dashboard:summary');

    res.status(201).json(assignment);
  } catch (error: ControllerError) {
    console.error('Create assignment error:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
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

    // Use transaction to ensure atomicity
    const assignment = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.projectAssignment.update({
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
      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: 'update',
          entityType: 'assignment',
          entityId: updatedAssignment.id,
          description: `Updated assignment: ${updatedAssignment.staff.name} on ${updatedAssignment.project.name}`,
        },
      });

      // Note: We do NOT write to projectChangeHistory/staffChangeHistory for updates
      // because updates only modify jurisdiction/dates/notes, NOT team composition.
      // Team composition changes (assignment_added/assignment_removed) only happen
      // in create/delete operations. This prevents false "team changed" alerts
      // when users simply update assignment details.

      return updatedAssignment;
    });

    // Invalidate caches for affected project, staff, and lists
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(assignment.projectId));
    invalidateCache(CACHE_KEYS.STAFF_DETAIL(assignment.staffId));
    invalidateCache('projects:list');
    invalidateCache('staff:list');
    invalidateCache('dashboard:summary');

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

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete assignment
      await tx.projectAssignment.delete({
        where: { id: assignmentId },
      });

      const assignmentDetails = `${assignment.staff.name} (${assignment.staff.position})${assignment.jurisdiction ? ` - ${assignment.jurisdiction}` : ''}`;

      // Track assignment removal on project side
      await tx.projectChangeHistory.create({
        data: {
          projectId: assignment.projectId,
          fieldName: 'assignment',
          oldValue: assignmentDetails,
          newValue: null,
          changeType: 'assignment_removed',
          changedBy: req.user?.userId,
        },
      });

      // Track assignment removal on staff side
      await tx.staffChangeHistory.create({
        data: {
          staffId: assignment.staffId,
          fieldName: 'assignment',
          oldValue: assignmentDetails,
          newValue: null,
          changeType: 'assignment_removed',
          changedBy: req.user?.userId,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: req.user?.userId,
          actionType: 'delete',
          entityType: 'assignment',
          entityId: assignmentId,
          description: `Removed ${assignment.staff.name} from ${assignment.project.name}`,
        },
      });
    });

    // Invalidate caches for affected project, staff, and lists
    invalidateCache(CACHE_KEYS.PROJECT_DETAIL(assignment.projectId));
    invalidateCache(CACHE_KEYS.STAFF_DETAIL(assignment.staffId));
    invalidateCache(`project:change-history:v2:${assignment.projectId}`); // All limits for this project
    invalidateCache('projects:list');
    invalidateCache('staff:list');
    invalidateCache('dashboard:summary');

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
    const affectedProjectIds = new Set<number>();
    const affectedStaffIds = new Set<number>();

    // Validate all assignments first
    const validatedAssignments: Array<{
      index: number;
      projectId: number;
      staffId: number;
      jurisdiction?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }> = [];

    for (let i = 0; i < assignments.length; i++) {
      const assignmentData = assignments[i];
      const {
        projectId,
        staffId,
        jurisdiction,
        startDate,
        endDate,
        notes,
      } = assignmentData;

      // Validate and coerce IDs
      const hasProjectId = projectId !== undefined && projectId !== null && projectId !== '';
      const hasStaffId = staffId !== undefined && staffId !== null && staffId !== '';

      if (!hasProjectId || !hasStaffId) {
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

      validatedAssignments.push({
        index: i,
        projectId: parsedProjectId,
        staffId: parsedStaffId,
        jurisdiction,
        startDate,
        endDate,
        notes,
      });
    }

    // Create all assignments in a transaction with change tracking
    for (const assignmentData of validatedAssignments) {
      try {
        const assignment = await prisma.$transaction(async (tx) => {
          // Fetch project and staff details for change history
          const [project, staff] = await Promise.all([
            tx.project.findUnique({ where: { id: assignmentData.projectId } }),
            tx.staff.findUnique({ where: { id: assignmentData.staffId } }),
          ]);

          if (!project || !staff) {
            throw new Error('Project or staff not found');
          }

          // Create assignment
          const newAssignment = await tx.projectAssignment.create({
            data: {
              projectId: assignmentData.projectId,
              staffId: assignmentData.staffId,
              jurisdiction: assignmentData.jurisdiction,
              startDate: assignmentData.startDate ? new Date(assignmentData.startDate) : null,
              endDate: assignmentData.endDate ? new Date(assignmentData.endDate) : null,
              notes: assignmentData.notes,
            },
            include: {
              project: true,
              staff: true,
            },
          });

          // Track assignment change on project side
          await tx.projectChangeHistory.create({
            data: {
              projectId: assignmentData.projectId,
              fieldName: 'assignment',
              oldValue: null,
              newValue: `${staff.name} (${staff.position})${assignmentData.jurisdiction ? ` - ${assignmentData.jurisdiction}` : ''}`,
              changeType: 'assignment_added',
              changedBy: req.user?.userId,
            },
          });

          // Track assignment change on staff side
          await tx.staffChangeHistory.create({
            data: {
              staffId: assignmentData.staffId,
              fieldName: 'assignment',
              oldValue: null,
              newValue: `${staff.name} (${staff.position})${assignmentData.jurisdiction ? ` - ${assignmentData.jurisdiction}` : ''}`,
              changeType: 'assignment_added',
              changedBy: req.user?.userId,
            },
          });

          return newAssignment;
        });

        createdAssignments.push(assignment);
        affectedProjectIds.add(assignmentData.projectId);
        affectedStaffIds.add(assignmentData.staffId);
      } catch (error: ControllerError) {
        // Handle known errors gracefully to allow partial success
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          errors.push({ index: assignmentData.index, error: 'Duplicate assignment' });
        } else if (error instanceof Error && error.message === 'Project or staff not found') {
          errors.push({ index: assignmentData.index, error: 'Project or staff not found' });
        } else {
          // Re-throw unexpected errors
          throw error;
        }
      }
    }

    // If no assignments were created, return 400 with errors
    if (createdAssignments.length === 0) {
      return res.status(400).json({
        error: 'No assignments were created',
        errors,
      });
    }

    // Log bulk activity
    await prisma.activityLog.create({
      data: {
        userId: req.user?.userId,
        actionType: 'assign',
        entityType: 'assignment',
        description: `Bulk created ${createdAssignments.length} assignments`,
      },
    });

    // Invalidate caches for all affected projects and staff
    affectedProjectIds.forEach(projectId => {
      invalidateCache(CACHE_KEYS.PROJECT_DETAIL(projectId));
      invalidateCache(`project:change-history:v2:${projectId}`); // All limits for this project
    });
    affectedStaffIds.forEach(staffId => {
      invalidateCache(CACHE_KEYS.STAFF_DETAIL(staffId));
    });
    invalidateCache('projects:list');
    invalidateCache('staff:list');
    invalidateCache('dashboard:summary');

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
