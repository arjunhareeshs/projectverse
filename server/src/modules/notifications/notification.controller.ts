import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { notificationService } from './notification.service';

export const notificationController = {
  async getNotifications(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const notifications = await notificationService.getNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch notifications' });
    }
  },

  async markRead(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const id = req.params['id'] as string;
      await notificationService.markRead(user.id, id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification read:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update notification' });
    }
  },

  async markAllRead(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      await notificationService.markAllRead(user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications read:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update notifications' });
    }
  },

  async createNotification(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!title || !body) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Title and body are required' });
      }

      const notification = await notificationService.createForUser(user.id, title, body);
      res.status(StatusCodes.CREATED).json(notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create notification' });
    }
  },

  async createDeadlineAlert(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const notification = await notificationService.createNearestDeadlineAlert(user.id);
      if (!notification) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'No upcoming task deadlines found' });
      }
      res.status(StatusCodes.CREATED).json(notification);
    } catch (error) {
      console.error('Error creating deadline alert:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create deadline alert' });
    }
  },
};
