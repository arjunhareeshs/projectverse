import { prisma } from '../../shared/database';

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

  async createMockNotification(userId: string, title: string, body: string) {
    return prisma.notification.create({
      data: {
        userId,
        title,
        body,
      },
    });
  },

  async createForUser(userId: string, title: string, body: string) {
    return prisma.notification.create({
      data: { userId, title, body },
    });
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

    return { created: result.count, teamId };
  },
};

