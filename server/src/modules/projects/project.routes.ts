import { Router } from 'express';
import { projectController } from './project.controller';
import { catalogController } from './project.catalog.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// All project routes are protected
router.use(authGuard);

router.get('/active', projectController.getActiveProjects);
router.get('/catalog', catalogController.getCatalog);
router.post('/catalog/:id/select', catalogController.selectProject);
router.get('/', projectController.getProjects);
router.post('/similarity', projectController.analyzeSimilarity);
router.post('/recommend-technology', projectController.recommendTechnology);
router.post('/recommend-catalog', projectController.recommendCatalog);
router.post('/', projectController.createProject);

// Reviews
router.post('/:projectId/reviews', projectController.addProjectReview);
router.get('/:projectId/reviews', projectController.getProjectReviews);

export const projectRoutes = router;
