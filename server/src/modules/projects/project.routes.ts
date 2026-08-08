import { Router } from 'express';
import { projectController } from './project.controller';
import { catalogController } from './project.catalog.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// All project routes are protected
router.use(authGuard);

router.get('/active', projectController.getActiveProjects);
router.post('/catalog/session/start', catalogController.startCatalogSession);
router.get('/catalog/readiness', catalogController.getReadiness);
router.get('/catalog/tree', catalogController.getCatalogTree);
router.get('/catalog', catalogController.getCatalog);
router.get('/catalog/:id', catalogController.getCatalogById);
router.post('/catalog/:id/check-approach', catalogController.checkApproachUniqueness);
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

// Note: project-feature CRUD lives at /api/lifecycle/:projectId/features — it's the
// complete, audited implementation (AI re-scoring via rescoreFeature + ProjectLogEvent
// history). See lifecycle.routes.ts / lifecycle.controller.ts.

// Reviews
router.post('/:projectId/reviews', projectController.addProjectReview);
// Withdrawal
router.post('/:projectId/withdraw', projectController.withdrawProject);

export const projectRoutes = router;

