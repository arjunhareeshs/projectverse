import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authGuard } from '../../middleware/authGuard';

const router = Router();

// All dashboard routes are protected
router.use(authGuard);

router.get('/streak', dashboardController.getStreakData);
router.get('/kpis', dashboardController.getKpiMetrics);
router.get('/team-growth', dashboardController.getTeamGrowth);
router.get('/project-activity', dashboardController.getProjectActivity);
router.get('/deadlines', dashboardController.getUpcomingDeadlines);
router.get('/hackathons', dashboardController.getHackathons);
router.get('/leetcode-contests', dashboardController.getLeetCodeContests);
router.get('/recent-activities', dashboardController.getRecentActivities);

export const dashboardRoutes = router;
