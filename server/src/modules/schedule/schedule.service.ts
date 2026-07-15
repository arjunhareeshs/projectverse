import { prisma } from '../../shared/database';

export const scheduleService = {
  async getEvents(userId: string) {
    return prisma.scheduleEvent.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  },

  async createEvent(userId: string, data: {
    title: string;
    date: string;
    timeString: string;
    hour: number;
    duration: number;
    room: string;
    color: string;
  }) {
    return prisma.scheduleEvent.create({
      data: {
        userId,
        title: data.title,
        date: data.date,
        timeString: data.timeString,
        hour: data.hour,
        duration: data.duration,
        room: data.room,
        color: data.color,
      },
    });
  },

  async deleteEvent(userId: string, eventId: string) {
    // Verify ownership before delete
    const event = await prisma.scheduleEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!event) {
      throw new Error('Event not found or unauthorized');
    }

    return prisma.scheduleEvent.delete({
      where: { id: eventId },
    });
  },
};
