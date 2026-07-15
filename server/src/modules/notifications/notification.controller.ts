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

  async createMockNotification(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });

      const { title, body } = req.body;
      const notification = await notificationService.createMockNotification(
        user.id,
        title || 'New Alert',
        body || 'Someone shared a document with you.'
      );
      res.status(StatusCodes.CREATED).json(notification);
    } catch (error) {
      console.error('Error creating mock notification:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create notification' });
    }
  },
};
