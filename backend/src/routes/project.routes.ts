import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', authenticate, asyncHandler(projectController.getAllProjects));
router.get('/categories', authenticate, asyncHandler(projectController.getProjectCategories));
router.get('/needing-attention', authenticate, asyncHandler(projectController.getProjectsNeedingAttention));
router.get('/:id', authenticate, asyncHandler(projectController.getProjectById));
router.get('/:id/change-history', authenticate, asyncHandler(projectController.getProjectChangeHistory));
router.post('/', authenticate, authorize('admin', 'editor'), asyncHandler(projectController.createProject));
router.post('/:id/confirm', authenticate, asyncHandler(projectController.confirmProject));
router.put('/:id', authenticate, authorize('admin', 'editor'), asyncHandler(projectController.updateProject));
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(projectController.deleteProject));

export default router;
