import { prisma } from '../../shared/database';

/**
 * The one deterministic project-progress calculation.
 *
 * Every surface that shows a project percentage must read it from here — do not
 * recompute task ratios in another service, controller or React component.
 *
 * `Task.status` is an unconstrained String and both 'done' and 'completed' are
 * written by the task module, so both count as complete.
 */
export const DONE_TASK_STATUSES = ['done', 'completed'] as const;

export function isTaskDone(status: string): boolean {
  return (DONE_TASK_STATUSES as readonly string[]).includes(status);
}

export interface ProjectProgress {
  projectId: string;
  /** completedTasks / totalTasks, rounded. 0 when the project has no tasks. */
  percentage: number;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  /**
   * Always null: the Milestone model has no completion field (no status and no
   * completedAt), so milestone adherence cannot be derived without a migration.
   * Kept in the contract so consumers do not invent a value.
   */
  milestoneProgress: null;
  /** Latest of the project's own updatedAt and its most recently updated task. */
  lastActivityAt: Date;
}

type ProgressTask = { status: string; dueDate: Date | null; updatedAt: Date };

function computeProgress(
  projectId: string,
  projectUpdatedAt: Date,
  tasks: ProgressTask[],
  now: Date,
): ProjectProgress {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => isTaskDone(t.status)).length;
  const openTasks = tasks.filter((t) => !isTaskDone(t.status));
  const overdueTasks = openTasks.filter((t) => t.dueDate !== null && t.dueDate < now).length;

  let lastActivityAt = projectUpdatedAt;
  for (const t of tasks) {
    if (t.updatedAt > lastActivityAt) lastActivityAt = t.updatedAt;
  }

  return {
    projectId,
    percentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    totalTasks,
    completedTasks,
    activeTasks: openTasks.length,
    overdueTasks,
    milestoneProgress: null,
    lastActivityAt,
  };
}

export const projectProgressService = {
  /** Progress for a single project. Returns null when the project does not exist. */
  async getProjectProgress(projectId: string): Promise<ProjectProgress | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        updatedAt: true,
        tasks: { select: { status: true, dueDate: true, updatedAt: true } },
      },
    });
    if (!project) return null;

    return computeProgress(project.id, project.updatedAt, project.tasks, new Date());
  },

  /**
   * Batch variant for list pages — one query for many projects instead of N+1.
   * Missing project ids are simply absent from the returned map.
   */
  async getProgressForProjects(projectIds: string[]): Promise<Map<string, ProjectProgress>> {
    const result = new Map<string, ProjectProgress>();
    if (projectIds.length === 0) return result;

    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        updatedAt: true,
        tasks: { select: { status: true, dueDate: true, updatedAt: true } },
      },
    });

    const now = new Date();
    for (const p of projects) {
      result.set(p.id, computeProgress(p.id, p.updatedAt, p.tasks, now));
    }
    return result;
  },
};
