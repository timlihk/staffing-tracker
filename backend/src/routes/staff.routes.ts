import { Router } from 'express';
import * as staffController from '../controllers/staff.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { createStaffSchema, updateStaffSchema, staffQuerySchema } from '../schemas/staff.schema';

const router = Router();

/**
 * @openapi
 * /staff:
 *   get:
 *     tags: [Staff]
 *     summary: Get all staff members
 *     description: Retrieve a list of all staff members
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of staff members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Staff'
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, validate(staffQuerySchema, 'query'), asyncHandler(staffController.getAllStaff));

/**
 * @openapi
 * /staff/{id}:
 *   get:
 *     tags: [Staff]
 *     summary: Get staff member by ID
 *     description: Retrieve detailed information about a specific staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Staff member details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Staff'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff member not found
 */
router.get('/:id', authenticate, asyncHandler(staffController.getStaffById));

/**
 * @openapi
 * /staff/{id}/workload:
 *   get:
 *     tags: [Staff]
 *     summary: Get staff member workload
 *     description: Retrieve current and historical workload information for a staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Staff workload information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staffId:
 *                   type: integer
 *                 currentProjects:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalProjects:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff member not found
 */
router.get('/:id/workload', authenticate, asyncHandler(staffController.getStaffWorkload));

/**
 * @openapi
 * /staff/{id}/change-history:
 *   get:
 *     tags: [Staff]
 *     summary: Get staff member change history
 *     description: Retrieve the complete change history for a staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Staff change history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   staffId:
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
 *         description: Staff member not found
 */
router.get('/:id/change-history', authenticate, asyncHandler(staffController.getStaffChangeHistory));

/**
 * @openapi
 * /staff/{id}/billing-projects:
 *   get:
 *     tags: [Staff]
 *     summary: Get staff member's billing projects
 *     description: Retrieve all billing projects where the staff member is a B&C attorney, including engagements and linked staffing projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Staff billing projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     position:
 *                       type: string
 *                 total_projects:
 *                   type: integer
 *                 billing_projects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       project_id:
 *                         type: integer
 *                       project_name:
 *                         type: string
 *                       client_name:
 *                         type: string
 *                       base_currency:
 *                         type: string
 *                       role:
 *                         type: string
 *                       bc_attorneys:
 *                         type: array
 *                         items:
 *                           type: object
 *                       linked_staffing_projects:
 *                         type: array
 *                         items:
 *                           type: object
 *                       engagements:
 *                         type: array
 *                         items:
 *                           type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff member not found
 */
router.get('/:id/billing-projects', authenticate, asyncHandler(staffController.getStaffBillingProjects));

/**
 * @openapi
 * /staff:
 *   post:
 *     tags: [Staff]
 *     summary: Create a new staff member
 *     description: Add a new staff member to the system
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, position, status]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *               position:
 *                 type: string
 *                 example: "Senior Associate"
 *               department:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Staff member created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Staff'
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, validate(createStaffSchema), asyncHandler(staffController.createStaff));

/**
 * @openapi
 * /staff/{id}:
 *   put:
 *     tags: [Staff]
 *     summary: Update a staff member
 *     description: Update an existing staff member
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *               position:
 *                 type: string
 *               department:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Staff member updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Staff'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff member not found
 */
router.put('/:id', authenticate, validate(updateStaffSchema), asyncHandler(staffController.updateStaff));

/**
 * @openapi
 * /staff/{id}:
 *   delete:
 *     tags: [Staff]
 *     summary: Delete a staff member
 *     description: Remove a staff member from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Staff ID
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff member not found
 */
router.delete('/:id', authenticate, asyncHandler(staffController.deleteStaff));

export default router;
