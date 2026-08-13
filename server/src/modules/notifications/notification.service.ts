import { prisma } from '../../shared/database';
import { getIoInstance } from '../../infrastructure/socket';

export const notificationService = {
  async getNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async markRead(userId: string, id: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new Error('Notification not found');

    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async createNearestDeadlineAlert(userId: string) {
    const task = await prisma.task.findFirst({
      where: { assigneeId: userId, status: { not: 'done' }, dueDate: { not: null } },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, dueDate: true, projectId: true },
    });

    if (!task) return null;

    const now = new Date();
    const dueDate = task.dueDate as Date;
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const dateText = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const whenText = diffDays < 0 ? `overdue since ${dateText}` : diffDays === 0 ? `due today (${dateText})` : `due ${dateText} (${diffDays} day${diffDays === 1 ? '' : 's'} left)`;

    return notificationService.createForUser(
      userId,
      'Upcoming Deadline',
      `"${task.title}" is ${whenText}.`,
    );
  },

  async createForUser(userId: string, title: string, body: string) {
    const notification = await prisma.notification.create({
      data: { userId, title, body },
    });

    try {
      const io = getIoInstance();
      io.to(`user:${userId}`).emit('notification', notification);
    } catch (e) {
      console.error('Socket emission failed:', e);
    }

    return notification;
  },

  async broadcastToTeam(teamId: string, title: string, body: string) {
    // Fetch all team members from DB
    const memberships = await prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });

    if (!memberships.length) {
      return { created: 0, teamId };
    }

    const result = await prisma.notification.createMany({
      data: memberships.map((m) => ({
        userId: m.userId,
        title,
        body,
      })),
      skipDuplicates: true,
    });

    try {
      const io = getIoInstance();
      memberships.forEach((m) => {
        io.to(`user:${m.userId}`).emit('notification', { title, body, userId: m.userId });
      });
    } catch (e) {
      console.error('Socket emission failed:', e);
    }

    return { created: result.count, teamId };
  },
};
