import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { projectService } from './project.service';

export const projectController = {
  async getProjects(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const projects = await projectService.getProjects(user.organizationId);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch projects' });
    }
  },

  async getActiveProjects(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const projects = await projectService.getActiveProjects(user.organizationId);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching active projects:', error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to fetch active projects' });
    }
  },

  async createProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const {
        name,
        description,
        domain,
        difficultyLevel,
        type,
        problemStatement,
        objective,
        expectedOutcome,
        technologies,
        requirements,
        innovation,
        teamMembers,
      } = req.body;
      if (!name) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Name is required' });
      }
      const project = await projectService.createProject(user.organizationId, {
        name,
        description,
        status: 'pending_approval',
        domain,
        difficultyLevel,
        type,
        problemStatement,
        objective,
        expectedOutcome,
        technologies,
        requirements,
        innovation,
        userId: user.id,
        teamId: user.teamId,
        teamMembers,
      });
      res.status(StatusCodes.CREATED).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create project' });
    }
  },

  async analyzeSimilarity(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const projectData = req.body;
      const result = await projectService.analyzeSimilarity(projectData);
      res.json(result);
    } catch (error) {
      console.error('Error analyzing similarity:', error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to analyze similarity' });
    }
  },

  async addProjectReview(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user || (user.role !== 'REVIEWER' && user.role !== 'ADMIN')) {
        return res
          .status(StatusCodes.FORBIDDEN)
          .json({ message: 'Only reviewers can add reviews' });
      }
      const { projectId } = req.params;
      const { status, comments, score } = req.body;
      const review = await projectService.addProjectReview(projectId as string, user.id, {
        status,
        comments,
        score,
      });
      res.status(StatusCodes.CREATED).json(review);
    } catch (error) {
      console.error('Error adding project review:', error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to add project review' });
    }
  },

  async getProjectReviews(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const reviews = await projectService.getProjectReviews(projectId as string);
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching project reviews:', error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to fetch project reviews' });
    }
  },

  async recommendTechnology(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const data = req.body;
      if (!data.domain || !data.technicalInterests || !data.careerGoals) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
      }
      const result = await projectService.recommendTechnology(data);
      res.json(result);
    } catch (error) {
      console.error('Error recommending technology:', error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to recommend technology' });
    }
  },

  async recommendCatalog(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const data = req.body;
      const result = await projectService.recommendCatalog(data);
      res.json(result);
    } catch (error) {
      console.error('Error recommending catalog:', error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to recommend catalog' });
    }
  },
};
