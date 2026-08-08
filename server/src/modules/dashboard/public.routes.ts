import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { dashboardService } from './dashboard.service';

// Public, unauthenticated endpoints used by the landing page. Mounted in
// app.ts *before* the authGuard-protected dashboard routes so the marketing
// surface (Hackathons, Coding Contests) renders without a JWT.
const router = Router();

router.get('/hackathons', async (_req, res) => {
  try {
    const data = await dashboardService.getPublicHackathons();
    res.json(data);
  } catch (error) {
    console.error('Error fetching public hackathons:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch hackathons' });
  }
});

router.get('/leetcode-contests', async (_req, res) => {
  try {
    const data = await dashboardService.getPublicLeetCodeContests();
    res.json(data);
  } catch (error) {
    console.error('Error fetching public LeetCode contests:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch coding contests' });
  }
});

export const publicOpportunitiesRoutes = router;
