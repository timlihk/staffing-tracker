import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, projectController.getAllProjects);
router.get('/categories', authenticate, projectController.getProjectCategories);
router.get('/:id', authenticate, projectController.getProjectById);
router.post('/', authenticate, authorize('admin', 'editor'), projectController.createProject);
router.put('/:id', authenticate, authorize('admin', 'editor'), projectController.updateProject);
router.delete('/:id', authenticate, authorize('admin'), projectController.deleteProject);

export default router;
