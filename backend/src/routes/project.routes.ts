import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import * as bcAttorneyController from '../controllers/bcAttorney.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { projectSchema, idParamSchema, projectQuerySchema, bcAttorneySchema } from '../schemas/project.schema';

const router = Router();

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: Get all projects
 *     description: Retrieve a list of all projects with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by project status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by project category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search projects by name
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, validate(projectQuerySchema, 'query'), asyncHandler(projectController.getAllProjects));

/**
 * @openapi
 * /projects/categories:
 *   get:
 *     tags: [Projects]
 *     summary: Get project categories
 *     description: Get a list of all available project categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/categories', authenticate, asyncHandler(projectController.getProjectCategories));

/**
 * @openapi
 * /projects/needing-attention:
 *   get:
 *     tags: [Projects]
 *     summary: Get projects needing attention
 *     description: Retrieve projects that require review or update
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects needing attention
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 */
router.get('/needing-attention', authenticate, asyncHandler(projectController.getProjectsNeedingAttention));

/**
 * @openapi
 * /projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project by ID
 *     description: Retrieve detailed information about a specific project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
router.get('/:id', authenticate, validate(idParamSchema, 'params'), asyncHandler(projectController.getProjectById));

/**
 * @openapi
 * /projects/{id}/change-history:
 *   get:
 *     tags: [Projects]
 *     summary: Get project change history
 *     description: Retrieve the complete change history for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project change history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   projectId:
 *                     type: integer
 *                   changedBy:
 *                     type: string
 *                   changeType:
 *                     type: string
 *                   changes:
 *                     type: object
 *                   changedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
router.get('/:id/change-history', authenticate, validate(idParamSchema, 'params'), asyncHandler(projectController.getProjectChangeHistory));

/**
 * @openapi
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     description: Create a new project (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, status]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Project Alpha"
 *               category:
 *                 type: string
 *                 example: "M&A"
 *               status:
 *                 type: string
 *                 example: "active"
 *               priority:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *               sector:
 *                 type: string
 *                 nullable: true
 *               side:
 *                 type: string
 *                 nullable: true
 *               elStatus:
 *                 type: string
 *                 nullable: true
 *               timetable:
 *                 type: string
 *                 nullable: true
 *               filingDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               listingDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 */
router.post('/', authenticate, authorize('admin', 'editor'), validate(projectSchema), asyncHandler(projectController.createProject));

/**
 * @openapi
 * /projects/{id}/confirm:
 *   post:
 *     tags: [Projects]
 *     summary: Confirm project status
 *     description: Mark a project as confirmed/reviewed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project confirmed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
router.post('/:id/confirm', authenticate, validate(idParamSchema, 'params'), asyncHandler(projectController.confirmProject));

/**
 * @openapi
 * /projects/{id}:
 *   put:
 *     tags: [Projects]
 *     summary: Update a project
 *     description: Update an existing project (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               status:
 *                 type: string
 *               priority:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *               sector:
 *                 type: string
 *                 nullable: true
 *               side:
 *                 type: string
 *                 nullable: true
 *               elStatus:
 *                 type: string
 *                 nullable: true
 *               timetable:
 *                 type: string
 *                 nullable: true
 *               filingDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               listingDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 *       404:
 *         description: Project not found
 */
router.put('/:id', authenticate, authorize('admin', 'editor'), validate(idParamSchema, 'params'), validate(projectSchema), asyncHandler(projectController.updateProject));

/**
 * @openapi
 * /projects/{id}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project
 *     description: Delete a project (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Project not found
 */
router.delete('/:id', authenticate, authorize('admin'), validate(idParamSchema, 'params'), asyncHandler(projectController.deleteProject));

/**
 * @openapi
 * /projects/{id}/bc-attorneys:
 *   post:
 *     tags: [Projects]
 *     summary: Add B&C attorney to project
 *     description: Associate a B&C attorney with a project (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staffId]
 *             properties:
 *               staffId:
 *                 type: integer
 *                 description: ID of the staff member to add as B&C attorney
 *     responses:
 *       201:
 *         description: B&C attorney added successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 *       404:
 *         description: Project or staff member not found
 */
router.post('/:id/bc-attorneys', authenticate, authorize('admin', 'editor'), validate(idParamSchema, 'params'), validate(bcAttorneySchema), asyncHandler(bcAttorneyController.addBcAttorney));

/**
 * @openapi
 * /projects/{id}/bc-attorneys/{staffId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Remove B&C attorney from project
 *     description: Remove a B&C attorney from a project (admin and editor only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: B&C attorney removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin or editor only)
 *       404:
 *         description: Project or B&C attorney association not found
 */
router.delete('/:id/bc-attorneys/:staffId', authenticate, authorize('admin', 'editor'), validate(idParamSchema, 'params'), asyncHandler(bcAttorneyController.removeBcAttorney));

export default router;
