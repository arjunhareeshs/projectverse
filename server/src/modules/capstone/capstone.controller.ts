import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { capstoneService, CapstoneServiceError } from './capstone.service';
import { CapstoneAnalysisError } from './capstone.githubAnalysis';

export const capstoneController = {
  async getProblems(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const isAdmin = user?.role === 'ADMIN';
      const { domain, difficulty } = req.query as { domain?: string; difficulty?: string };

      const problems = await capstoneService.getProblems({ domain, difficulty }, isAdmin);
      res.status(StatusCodes.OK).json(problems);
    } catch (error: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: error.message || 'Failed to retrieve capstone problems',
      });
    }
  },

  async createProblem(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { title, problemText, domain, difficulty, technologies, isActive } = req.body;

      const created = await capstoneService.createProblem(
        { title, problemText, domain, difficulty, technologies, isActive },
        user.id,
        user.organizationId
      );

      res.status(StatusCodes.CREATED).json(created);
    } catch (error: any) {
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to create problem statement' });
    }
  },

  async updateProblem(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { title, problemText, domain, difficulty, technologies, isActive } = req.body;

      const updated = await capstoneService.updateProblem(id, {
        title,
        problemText,
        domain,
        difficulty,
        technologies,
        isActive,
      });

      res.status(StatusCodes.OK).json(updated);
    } catch (error: any) {
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to update problem statement' });
    }
  },

  async deleteProblem(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await capstoneService.deleteProblem(id);
      res.status(StatusCodes.OK).json({ success: true, message: 'Problem statement removed or deactivated' });
    } catch (error: any) {
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to delete problem statement' });
    }
  },

  async claimProblem(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const problemId = req.params.problemId as string;
      const { approachText } = req.body;

      const result = await capstoneService.claimProblem(user.id, problemId, approachText);
      res.status(StatusCodes.CREATED).json(result);
    } catch (error: any) {
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to claim capstone project' });
    }
  },

  async getMySelections(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const selections = await capstoneService.getMySelections(user.id);
      res.status(StatusCodes.OK).json(selections);
    } catch (error: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: error.message || 'Failed to retrieve selections',
      });
    }
  },

  async submitGithub(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const selectionId = req.params.selectionId as string;
      const { githubUrl, bypassTimeCheck } = req.body;

      if (!githubUrl?.trim()) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'GitHub repository URL is required' });
      }

      // Only allow bypass if explicitly requested (e.g. testing)
      const isDevBypass = bypassTimeCheck === true || req.query.bypassTimeCheck === 'true';

      const result = await capstoneService.submitGithub(selectionId, user.id, githubUrl.trim(), isDevBypass);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      if (error instanceof CapstoneAnalysisError) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: error.message, code: error.code });
      }
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to analyze repository and generate assessment' });
    }
  },

  async getMcqQuestions(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const selectionId = req.params.selectionId as string;

      const result = await capstoneService.getMcqQuestions(selectionId, user.id);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to retrieve questions' });
    }
  },

  async submitMcqAnswers(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const selectionId = req.params.selectionId as string;
      const { answers } = req.body;

      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Answers array is required' });
      }

      const result = await capstoneService.submitMcqAnswers(selectionId, user.id, answers);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      const status = error instanceof CapstoneServiceError ? error.statusCode : StatusCodes.BAD_REQUEST;
      res.status(status).json({ message: error.message || 'Failed to submit assessment answers' });
    }
  },

  async getAdminStats(_req: Request, res: Response) {
    try {
      const stats = await capstoneService.getAdminStats();
      res.status(StatusCodes.OK).json(stats);
    } catch (error: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: error.message || 'Failed to retrieve admin stats',
      });
    }
  },
};
