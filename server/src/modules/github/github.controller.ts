import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { GithubAnalysisError, githubService } from './github.service';

async function assertProjectAccess(userOrgId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: userOrgId } });
  return project;
}

export const githubController = {
  async analyzeProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { projectId, repoLink } = req.body;
      if (!projectId || !repoLink) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'projectId and repoLink are required' });
      }
      const project = await assertProjectAccess(user.organizationId, projectId);
      if (!project) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
      }
      const record = await githubService.analyzeAndLinkProject(projectId, repoLink);
      res.status(StatusCodes.CREATED).json(record);
    } catch (error: any) {
      if (error instanceof GithubAnalysisError) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message, code: error.code });
      }
      console.error('Error analyzing GitHub repository:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to analyze repository' });
    }
  },

  async getProjectGithub(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { projectId } = req.params;
      const project = await assertProjectAccess(user.organizationId, projectId as string);
      if (!project) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
      }
      const record = await githubService.getForProject(projectId as string);
      if (!record) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'No GitHub data linked to this project yet' });
      }
      res.json(record);
    } catch (error: any) {
      if (error instanceof GithubAnalysisError) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message, code: error.code });
      }
      console.error('Error fetching GitHub data:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch GitHub data' });
    }
  },

  async getProjectContributors(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { projectId } = req.params;
      const project = await assertProjectAccess(user.organizationId, projectId as string);
      if (!project) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
      }

      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const stats = await githubService.getRepoContributorStats(projectId as string, { from, to });
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching project contributors:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch contributor stats' });
    }
  },

  async refreshProjectGithub(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { projectId } = req.params;
      const project = await assertProjectAccess(user.organizationId, projectId as string);
      if (!project) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
      }
      const record = await githubService.getForProject(projectId as string, { forceRefresh: true });
      res.json(record);
    } catch (error: any) {
      if (error instanceof GithubAnalysisError) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message, code: error.code });
      }
      console.error('Error refreshing GitHub data:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to refresh GitHub data' });
    }
  },

  async getProjectGithubHistory(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { projectId } = req.params;
      const project = await assertProjectAccess(user.organizationId, projectId as string);
      if (!project) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
      }
      const history = await githubService.getSnapshotHistory(projectId as string);
      res.json(history);
    } catch (error) {
      console.error('Error fetching GitHub snapshot history:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch snapshot history' });
    }
  },

  async getCollegeAnalytics(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const analytics = await githubService.getCollegeAnalytics(user.organizationId);
      res.json(analytics);
    } catch (error) {
      console.error('Error computing GitHub college analytics:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to compute analytics' });
    }
  },
};
