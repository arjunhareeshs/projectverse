import { prisma } from '../../shared/database';
import { notificationService } from '../notifications/notification.service';

async function notifyTaskAdded(
  projectId: string,
  taskId: string,
  taskTitle: string,
  assigneeId: string | null,
  source: 'board' | 'timeline',
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, teamId: true },
    });
    if (!project) return;

    const surface = source === 'board' ? 'Kanban board' : 'timeline/Gantt chart';

    if (project.teamId) {
      await notificationService.broadcastToTeam(
        project.teamId,
        'New Task Added',
        `"${taskTitle}" was added to the ${surface} for "${project.name}".`,
      );
    }

    if (assigneeId) {
      await notificationService.createForUser(
        assigneeId,
        'Task Assigned',
        `You were assigned "${taskTitle}" in "${project.name}".`,
      );
    }
  } catch (err) {
    console.error(`Failed sending task-added notification for task ${taskId}:`, err);
  }
}

export const taskService = {
  async canAccessProject(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    });
    if (!project) return false;

    if (project.teamId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } });
      if (user?.teamId && user.teamId === project.teamId) return true;
    }

    const membership = await prisma.projectMember.findFirst({ where: { projectId, userId } });
    return !!membership;
  },

  async getTasksByProject(projectId: string) {
    return prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getTasksByOrganization(organizationId: string) {
    const projects = await prisma.project.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    return prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateTaskStatus(taskId: string, status: string) {
    const isDone = status === 'done' || status === 'completed';
    return prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: isDone ? new Date() : null,
      },
    });
  },

  async createTask(data: {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    assigneeId?: string;
    dueDate?: string;
    startDate?: string;
    category?: string;
    progress?: number;
  }) {
    const isDone = data.status === 'done' || data.status === 'completed';
    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description || null,
        priority: data.priority || 'medium',
        status: data.status || 'todo',
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        category: data.category || 'Development',
        progress: data.progress ?? 0,
        completedAt: isDone ? new Date() : null,
      },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await notifyTaskAdded(data.projectId, task.id, task.title, task.assigneeId, 'board');
    return task;
  },

  // ── Gantt-specific methods ─────────────────────────────────────────────────

  async getGanttTasks(organizationId: string) {
    const projects = await prisma.project.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const projectIds = projects.map((p) => p.id);

    return prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  },

  async createGanttTask(data: {
    projectId: string;
    title: string;
    category: string;
    status: string;
    startDate: string;
    dueDate: string;
    progress: number;
    assigneeId?: string;
    description?: string;
  }) {
    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        category: data.category,
        status: data.status,
        startDate: new Date(data.startDate),
        dueDate: new Date(data.dueDate),
        progress: data.progress,
        assigneeId: data.assigneeId || null,
        description: data.description || null,
        priority: 'medium',
        completedAt: data.status === 'completed' || data.status === 'done' ? new Date() : null,
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await notifyTaskAdded(data.projectId, task.id, task.title, task.assigneeId, 'timeline');
    return task;
  },

  async updateGanttTask(taskId: string, data: {
    title?: string;
    category?: string;
    status?: string;
    startDate?: string;
    dueDate?: string;
    progress?: number;
    assigneeId?: string;
  }) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
        ...(data.progress !== undefined && { progress: data.progress }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId || null }),
        completedAt: data.status === 'completed' || data.status === 'done' ? new Date() : undefined,
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });
  },

  async deleteTask(taskId: string) {
    return prisma.task.delete({ where: { id: taskId } });
  },
};
