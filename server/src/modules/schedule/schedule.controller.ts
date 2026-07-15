import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { scheduleService } from './schedule.service';
import type { AuthenticatedRequest } from '../../middleware/authGuard';

export const scheduleController = {
  async getEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const events = await scheduleService.getEvents(userId);
      res.json(events);
    } catch (error) {
      console.error('Error fetching schedule events:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch schedule events' });
    }
  },

  async createEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const { title, date, timeString, hour, duration, room, color } = req.body;
      if (!title || !date || hour === undefined || duration === undefined) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Title, date, hour, and duration are required' });
      }

      const event = await scheduleService.createEvent(userId, {
        title,
        date,
        timeString: timeString || '',
        hour: Number(hour),
        duration: Number(duration),
        room: room || '',
        color: color || '',
      });

      res.status(StatusCodes.CREATED).json(event);
    } catch (error) {
      console.error('Error creating schedule event:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create schedule event' });
    }
  },

  async deleteEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const eventId = req.params.id as string;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      if (!eventId) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Event ID is required' });
      }

      await scheduleService.deleteEvent(userId, eventId);
      res.status(StatusCodes.OK).json({ message: 'Event deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting schedule event:', error);
      if (error.message?.includes('not found')) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to delete schedule event' });
    }
  },
};
