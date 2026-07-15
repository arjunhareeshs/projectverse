import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { taskService } from './task.service';

export const taskController = {
  async getTasksByProject(req: Request, res: Response) {
    try {
      const projectId = req.params.projectId as string;
      const tasks = await taskService.getTasksByProject(projectId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch tasks' });
    }
  },

  async getTasksByOrganization(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const tasks = await taskService.getTasksByOrganization(user.organizationId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching org tasks:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch tasks' });
    }
  },

  async updateTaskStatus(req: Request, res: Response) {
    try {
      const taskId = req.params.taskId as string;
      const { status } = req.body;
      const task = await taskService.updateTaskStatus(taskId, status);
      res.json(task);
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update task' });
    }
  },

  async createTask(req: Request, res: Response) {
    try {
      const { projectId, title, description, priority, status, assigneeId, dueDate, startDate, category, progress } = req.body;
      if (!projectId || !title) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'ProjectId and title are required' });
      }
      const task = await taskService.createTask({
        projectId, title, description, priority, status, assigneeId, dueDate, startDate, category, progress,
      });
      res.status(StatusCodes.CREATED).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create task' });
    }
  },

  // ── Gantt endpoints ────────────────────────────────────────────────────────

  async getGanttTasks(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const tasks = await taskService.getGanttTasks(user.organizationId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching gantt tasks:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch gantt tasks' });
    }
  },

  async createGanttTask(req: Request, res: Response) {
    try {
      const { projectId, title, category, status, startDate, dueDate, progress, assigneeId, description } = req.body;
      if (!projectId || !title || !startDate || !dueDate) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'projectId, title, startDate, and dueDate are required' });
      }
      const task = await taskService.createGanttTask({
        projectId, title, category: category || 'Development', status: status || 'todo',
        startDate, dueDate, progress: progress ?? 0, assigneeId, description,
      });
      res.status(StatusCodes.CREATED).json(task);
    } catch (error) {
      console.error('Error creating gantt task:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create gantt task' });
    }
  },

  async updateGanttTask(req: Request, res: Response) {
    try {
      const taskId = req.params.taskId as string;
      const { title, category, status, startDate, dueDate, progress, assigneeId } = req.body;
      const task = await taskService.updateGanttTask(taskId, {
        title, category, status, startDate, dueDate, progress, assigneeId,
      });
      res.json(task);
    } catch (error) {
      console.error('Error updating gantt task:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update gantt task' });
    }
  },

  async deleteTask(req: Request, res: Response) {
    try {
      const taskId = req.params.taskId as string;
      await taskService.deleteTask(taskId);
      res.status(StatusCodes.OK).json({ message: 'Task deleted' });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to delete task' });
    }
  },
};
