import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';

export const catalogController = {
  // Get all catalog items with the number of times they've been selected
  async getCatalog(req: Request, res: Response) {
    try {
      const templates = await prisma.project.findMany({
        where: {
          isTemplate: true,
          status: 'CATALOG',
        },
        include: {
          _count: {
            select: { childProjects: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(templates);
    } catch (error) {
      console.error('Error fetching catalog:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Team selects a template to instantiate as their own project
  async selectProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.teamId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Must belong to a team' });
      }

      const { id } = req.params;
      const { teamMembers = [] } = req.body;

      // 1. Validate the template exists
      const template = await prisma.project.findUnique({
        where: { id: id as string },
        include: {
          _count: {
            select: { childProjects: true },
          },
        },
      });

      if (!template || !template.isTemplate) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Catalog project not found' });
      }

      // 2. Validate max capacity (3 to 4 teams)
      const childCount = (template as any)._count?.childProjects || 0;
      if (childCount >= 4) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'Maximum capacity (4 teams) reached for this project' });
      }

      // 3. Ensure this team hasn't already selected it
      const alreadySelected = await prisma.project.findFirst({
        where: {
          parentProjectId: template.id,
          teamId: user.teamId,
        },
      });

      if (alreadySelected) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: 'Your team has already selected this project' });
      }

      // 4. Instantiate the project for this team
      const newProject = await prisma.project.create({
        data: {
          organizationId: template.organizationId,
          teamId: user.teamId,
          parentProjectId: template.id,
          name: template.name,
          description: template.description,
          domain: template.domain,
          difficultyLevel: template.difficultyLevel,
          type: template.type,
          problemStatement: template.problemStatement,
          objective: template.objective,
          expectedOutcome: template.expectedOutcome,
          technologies: template.technologies,
          status: 'pending_approval',
        },
      });

      // 5. Add team members (leader + selected members)
      const projectMembers = [
        { projectId: newProject.id, userId: user.id, role: 'ADMIN' as const },
        ...teamMembers.slice(0, 3).map((memberId: string) => ({
          projectId: newProject.id,
          userId: memberId,
          role: 'STUDENT' as const,
        })),
      ];

      await prisma.projectMember.createMany({
        data: projectMembers,
      });

      res.status(StatusCodes.CREATED).json(newProject);
    } catch (error) {
      console.error('Error selecting project:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },
};
