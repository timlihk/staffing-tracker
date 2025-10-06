import { Router } from 'express';
import * as assignmentController from '../controllers/assignment.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', authenticate, asyncHandler(assignmentController.getAllAssignments));
router.get('/:id', authenticate, asyncHandler(assignmentController.getAssignmentById));
router.post('/', authenticate, authorize('admin', 'editor'), asyncHandler(assignmentController.createAssignment));
router.post('/bulk', authenticate, authorize('admin', 'editor'), asyncHandler(assignmentController.bulkCreateAssignments));
router.put('/:id', authenticate, authorize('admin', 'editor'), asyncHandler(assignmentController.updateAssignment));
router.delete('/:id', authenticate, authorize('admin', 'editor'), asyncHandler(assignmentController.deleteAssignment));

export default router;
