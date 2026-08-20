import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard';
import { requireRole } from '../../middleware/requireRole';
import { githubController } from './github.controller';

const router = Router();

router.use(authGuard);

router.post('/analyze', githubController.analyzeProject);
router.get('/project/:projectId', githubController.getProjectGithub);
router.get('/project/:projectId/contributors', githubController.getProjectContributors);
router.post('/project/:projectId/refresh', githubController.refreshProjectGithub);
router.get('/project/:projectId/history', githubController.getProjectGithubHistory);

router.get('/college/analytics', requireRole('ADMIN'), githubController.getCollegeAnalytics);

export const githubRoutes = router;
