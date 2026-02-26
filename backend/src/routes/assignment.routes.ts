import express, { Router } from 'express';
import * as assignmentController from '../controllers/assignment.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  bulkCreateAssignmentsSchema,
  assignmentIdParamSchema,
  assignmentQuerySchema,
} from '../schemas/assignment.schema';

const router = Router();

/**
 * @openapi
 * /assignments:
 *   get:
 *     tags: [Assignments]
 *     summary: Get all assignments
 *     description: Retrieve a list of all project-staff assignments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assignments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, validate(assignmentQuerySchema, 'query'), asyncHandler(assignmentController.getAllAssignments));

/**
 * @openapi
 * /assignments/{id}:
 *   get:
 *     tags: [Assignments]
 *     summary: Get assignment by ID
 *     description: Retrieve detailed information about a specific assignment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     responses:
 *       200:
 *         description: Assignment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Assignment not found
 */
router.get('/:id', authenticate, validate(assignmentIdParamSchema, 'params'), asyncHandler(assignmentController.getAssignmentById));

/**
 * @openapi
 * /assignments:
 *   post:
 *     tags: [Assignments]
 *     summary: Create a new assignment
 *     description: Assign a staff member to a project (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, staffId]
 *             properties:
 *               projectId:
 *                 type: integer
 *                 description: Project ID
 *               staffId:
 *                 type: integer
 *                 description: Staff member ID
 *               jurisdiction:
 *                 type: string
 *                 nullable: true
 *                 description: Jurisdiction for the assignment
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: Assignment start date
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 description: Assignment end date
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Assignment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 */
router.post('/', authenticate, authorize('admin', 'finance', 'editor'), validate(createAssignmentSchema), asyncHandler(assignmentController.createAssignment));

/**
 * @openapi
 * /assignments/bulk:
 *   post:
 *     tags: [Assignments]
 *     summary: Create multiple assignments
 *     description: Bulk create assignments for a project (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignments]
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [projectId, staffId]
 *                   properties:
 *                     projectId:
 *                       type: integer
 *                     staffId:
 *                       type: integer
 *                     jurisdiction:
 *                       type: string
 *                       nullable: true
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                     notes:
 *                       type: string
 *                       nullable: true
 *     responses:
 *       201:
 *         description: Assignments created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 */
router.post(
  '/bulk',
  authenticate,
  authorize('admin', 'finance', 'editor'),
  express.json({ limit: '1mb' }), // Limit bulk assignments to 1MB
  validate(bulkCreateAssignmentsSchema),
  asyncHandler(assignmentController.bulkCreateAssignments)
);

/**
 * @openapi
 * /assignments/{id}:
 *   put:
 *     tags: [Assignments]
 *     summary: Update an assignment
 *     description: Update an existing assignment (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jurisdiction:
 *                 type: string
 *                 nullable: true
 *               startDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               endDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Assignment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Assignment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 *       404:
 *         description: Assignment not found
 */
router.put('/:id', authenticate, authorize('admin', 'finance', 'editor'), validate(assignmentIdParamSchema, 'params'), validate(updateAssignmentSchema), asyncHandler(assignmentController.updateAssignment));

/**
 * @openapi
 * /assignments/{id}:
 *   delete:
 *     tags: [Assignments]
 *     summary: Delete an assignment
 *     description: Remove an assignment (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Assignment ID
 *     responses:
 *       200:
 *         description: Assignment deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 *       404:
 *         description: Assignment not found
 */
router.delete('/:id', authenticate, authorize('admin', 'finance', 'editor'), validate(assignmentIdParamSchema, 'params'), asyncHandler(assignmentController.deleteAssignment));

export default router;
