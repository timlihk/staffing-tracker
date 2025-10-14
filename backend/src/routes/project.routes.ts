import { Router } from 'express';
import * as projectController from '../controllers/project.controller';
import * as bcAttorneyController from '../controllers/bcAttorney.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { projectSchema, idParamSchema, projectQuerySchema, bcAttorneySchema } from '../schemas/project.schema';

const router = Router();

router.get('/', authenticate, validate(projectQuerySchema, 'query'), asyncHandler(projectController.getAllProjects));
router.get('/categories', authenticate, asyncHandler(projectController.getProjectCategories));
router.get('/needing-attention', authenticate, asyncHandler(projectController.getProjectsNeedingAttention));
router.get('/:id', authenticate, validate(idParamSchema, 'params'), asyncHandler(projectController.getProjectById));
router.get('/:id/change-history', authenticate, validate(idParamSchema, 'params'), asyncHandler(projectController.getProjectChangeHistory));
router.post('/', authenticate, authorize('admin', 'editor'), validate(projectSchema), asyncHandler(projectController.createProject));
router.post('/:id/confirm', authenticate, validate(idParamSchema, 'params'), asyncHandler(projectController.confirmProject));
router.put('/:id', authenticate, authorize('admin', 'editor'), validate(idParamSchema, 'params'), validate(projectSchema), asyncHandler(projectController.updateProject));
router.delete('/:id', authenticate, authorize('admin'), validate(idParamSchema, 'params'), asyncHandler(projectController.deleteProject));

// B&C Attorney routes
router.post('/:id/bc-attorneys', authenticate, authorize('admin', 'editor'), validate(idParamSchema, 'params'), validate(bcAttorneySchema), asyncHandler(bcAttorneyController.addBcAttorney));
router.delete('/:id/bc-attorneys/:staffId', authenticate, authorize('admin', 'editor'), validate(idParamSchema, 'params'), asyncHandler(bcAttorneyController.removeBcAttorney));

export default router;
