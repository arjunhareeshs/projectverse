import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { projectService } from './project.service';

export const projectController = {
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
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch active projects' });
    }
  },

  async createProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { name, description, status } = req.body;
      if (!name) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Name is required' });
      }
      const project = await projectService.createProject(user.organizationId, name, description, status);
      res.status(StatusCodes.CREATED).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create project' });
    }
  },
};
