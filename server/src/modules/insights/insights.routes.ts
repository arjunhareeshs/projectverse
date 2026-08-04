import { Router } from 'express';
import { insightsController } from './insights.controller';

const router = Router();

// Top Performers
router.get('/top-teams', insightsController.getTopTeams);
router.get('/top-students', insightsController.getTopStudents);

// Overlaps
router.get('/overlaps', insightsController.getOverlaps);
router.get('/overlaps/:id', insightsController.getOverlapById);
router.patch('/overlaps/:id', insightsController.updateOverlapStatus);

// Standouts
router.get('/standouts', insightsController.getStandouts);
router.get('/standouts/:id', insightsController.getStandoutById);
router.patch('/standouts/:id', insightsController.updateStandoutStatus);

// Management
router.post('/insights/recompute', insightsController.recomputeInsights);
router.get('/insights/status', insightsController.getInsightsStatus);

export const insightsRoutes = router;
