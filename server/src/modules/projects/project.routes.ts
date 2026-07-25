import { Router } from 'express';
import { projectController } from './project.controller';
import { catalogController } from './project.catalog.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// All project routes are protected
router.use(authGuard);

router.get('/active', projectController.getActiveProjects);
router.get('/catalog/tree', catalogController.getCatalogTree);
router.get('/catalog', catalogController.getCatalog);
router.post('/catalog/validate-proposal', catalogController.validateProposal);
router.post('/catalog/propose', catalogController.proposeProblemStatement);
router.post('/catalog/mentor', catalogController.mentor);
router.post('/catalog/allocate-team', catalogController.allocateTeam);
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
