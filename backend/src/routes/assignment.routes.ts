import { Router } from 'express';
import * as assignmentController from '../controllers/assignment.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, assignmentController.getAllAssignments);
router.get('/:id', authenticate, assignmentController.getAssignmentById);
router.post('/', authenticate, authorize('admin', 'editor'), assignmentController.createAssignment);
router.post('/bulk', authenticate, authorize('admin', 'editor'), assignmentController.bulkCreateAssignments);
router.put('/:id', authenticate, authorize('admin', 'editor'), assignmentController.updateAssignment);
router.delete('/:id', authenticate, authorize('admin', 'editor'), assignmentController.deleteAssignment);

export default router;
