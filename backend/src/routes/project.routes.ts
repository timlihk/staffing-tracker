import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, projectController.getAllProjects);
router.get('/categories', authenticate, projectController.getProjectCategories);
router.get('/needing-attention', authenticate, projectController.getProjectsNeedingAttention);
router.get('/:id', authenticate, projectController.getProjectById);
router.get('/:id/change-history', authenticate, projectController.getProjectChangeHistory);
router.post('/', authenticate, authorize('admin', 'editor'), projectController.createProject);
router.post('/:id/confirm', authenticate, projectController.confirmProject);
router.put('/:id', authenticate, authorize('admin', 'editor'), projectController.updateProject);
router.delete('/:id', authenticate, authorize('admin'), projectController.deleteProject);

export default router;
