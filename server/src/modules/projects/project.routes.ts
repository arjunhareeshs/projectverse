import { Router } from 'express';
import { projectController } from './project.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// All project routes are protected
router.use(authGuard);

router.get('/active', projectController.getActiveProjects);
router.post('/', projectController.createProject);

export const projectRoutes = router;
