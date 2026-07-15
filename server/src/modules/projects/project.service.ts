import { prisma } from '../../shared/database';

export const projectService = {
  async getActiveProjects(organizationId: string) {
    const projects = await prisma.project.findMany({
      where: {
        organizationId,
      },
      include: {
        team: true,
        tasks: true,
        members: {
          include: {
            user: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform into the format expected by the Dashboard ActiveProjectsList
    return projects.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.status === 'done').length;
      const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      
      // Calculate days left: use the earliest open task due date as a proxy
      const openTasksWithDue = project.tasks.filter(
        (t) => t.dueDate && t.status !== 'done' && t.status !== 'completed'
      );
      const earliestDue = openTasksWithDue.length > 0
        ? openTasksWithDue.reduce((min, t) => t.dueDate! < min ? t.dueDate! : min, openTasksWithDue[0].dueDate!)
        : null;
      const daysLeft = earliestDue
        ? Math.max(0, Math.ceil((earliestDue.getTime() - Date.now()) / 86_400_000))
        : null;

      return {
        id: project.id,
        name: project.name,
        client: project.description || 'Internal',
        teamSize: project.members.length,
        dueDate: earliestDue ? earliestDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date',
        progress,
        daysLeft,
        status: project.status,
        color: 'bg-primary',
        initials: project.name.substring(0, 2).toUpperCase(),
      };
    });
  },

  async createProject(organizationId: string, name: string, description?: string, status: string = 'planned') {
    return prisma.project.create({
      data: {
        organizationId,
        name,
        description,
        status,
      },
    });
  }
};
