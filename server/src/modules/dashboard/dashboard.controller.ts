import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async getStreakData(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getStreakData(user.id);
      res.json(data);
    } catch (error) {
      console.error('Error fetching streak data:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch streak data' });
    }
  },

  async getKpiMetrics(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const metrics = await dashboardService.getKpiDetails(user.id, user.teamId, user.organizationId);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching KPI metrics:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch KPI metrics' });
    }
  },

  async getTeamGrowth(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getTeamGrowth(user.teamId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching team growth data:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch team growth data' });
    }
  },

  async getProjectActivity(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getProjectActivity(user.teamId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching project activity data:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch project activity data' });
    }
  },

  async getUpcomingDeadlines(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getUpcomingDeadlines(user.teamId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching upcoming deadlines:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch upcoming deadlines' });
    }
  },

  async getHackathons(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getHackathons(user.organizationId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching hackathons:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch hackathons' });
    }
  },

  async getLeetCodeContests(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getLeetCodeContests(user.organizationId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching LeetCode contests:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch LeetCode contests' });
    }
  },

  async getRecentActivities(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const data = await dashboardService.getRecentActivity(user.id, user.teamId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch recent activities' });
    }
  }
};
