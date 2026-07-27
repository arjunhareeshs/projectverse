import { prisma } from '../../shared/database';
import {
  ProjectLogState,
  ProjectLogEventPayload,
  ProjectCategory,
  PlanningContext,
  EvaluationContext,
  MentorContext,
  AdminContext,
} from '../../shared/projectLog.types';
import { applyEvent } from './projectLog.reducer';

export class ProjectLogService {
  async initLog(
    projectId: string,
    seed: {
      title: string;
      category?: ProjectCategory;
      teamId?: string;
      durationMonths?: number;
      startDate?: string;
    },
  ): Promise<ProjectLogState> {
    const existing = await prisma.projectLog.findUnique({
      where: { projectId },
    });

    if (existing) {
      return existing.state as unknown as ProjectLogState;
    }

    const now = new Date().toISOString();
    const months = seed.durationMonths || 6;
    const startIso = seed.startDate || now;
    const startDate = new Date(startIso);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    let teamMembers: Array<{ userId: string; name: string; responsibilities: string[]; joinedAt: string; active: boolean }> = [];
    if (seed.teamId) {
      const dbMembers = await prisma.teamMember.findMany({
        where: { teamId: seed.teamId },
        include: { user: true },
      });
      teamMembers = dbMembers.map((m) => ({
        userId: m.userId,
        name: m.user.fullName,
        responsibilities: [],
        joinedAt: m.joinedAt.toISOString(),
        active: true,
      }));
    }

    const initialState: ProjectLogState = {
      version: 0,
      projectId,
      title: seed.title,
      category: seed.category || 'FINAL_YEAR',
      createdAt: now,
      duration: {
        months,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        history: [{ at: now, months }],
      },
      team: {
        teamId: seed.teamId || '',
        members: teamMembers,
      },
      technologies: [],
      executionDoc: {
        currentVersion: 0,
      },
      workPackages: [],
      milestones: [],
      skills: {
        required: [],
        gaps: [],
      },
      evaluations: [],
      flags: [],
    };

    const created = await prisma.projectLog.create({
      data: {
        projectId,
        version: 0,
        state: initialState as any,
      },
    });

    return created.state as unknown as ProjectLogState;
  }

  async getState(projectId: string): Promise<ProjectLogState | null> {
    const row = await prisma.projectLog.findUnique({
      where: { projectId },
    });
    if (!row) return null;
    return row.state as unknown as ProjectLogState;
  }

  async appendEvent(
    projectId: string,
    eventPayload: ProjectLogEventPayload,
    retry = true,
  ): Promise<ProjectLogState> {
    let logRow = await prisma.projectLog.findUnique({
      where: { projectId },
    });

    if (!logRow) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      await this.initLog(projectId, {
        title: project.name,
        category: (project.category as ProjectCategory) || 'FINAL_YEAR',
        teamId: project.teamId || undefined,
      });
      logRow = (await prisma.projectLog.findUnique({
        where: { projectId },
      }))!;
    }

    const currentState = logRow.state as unknown as ProjectLogState;
    const nextVersion = logRow.version + 1;
    const nextState = applyEvent(currentState, eventPayload);
    nextState.version = nextVersion;

    try {
      await prisma.$transaction([
        prisma.projectLogEvent.create({
          data: {
            logId: logRow.id,
            seq: nextVersion,
            type: eventPayload.type,
            actorUserId: eventPayload.actorUserId,
            data: eventPayload.data as any,
            note: eventPayload.note,
          },
        }),
        prisma.projectLog.update({
          where: { id: logRow.id },
          data: {
            version: nextVersion,
            state: nextState as any,
          },
        }),
      ]);
      return nextState;
    } catch (err: any) {
      if (retry && err.code === 'P2002') {
        // Optimistic concurrency collision — retry once
        return this.appendEvent(projectId, eventPayload, false);
      }
      throw err;
    }
  }

  async updateWorkPackageStatus(projectId: string, workPackageId: string, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE', actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'WORK_PACKAGE_STATUS',
      actorUserId,
      data: { workPackageId, status },
    });
  }

  async assignWorkPackage(projectId: string, workPackageId: string, assignedTo: string[], actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'WORK_PACKAGE_ASSIGNED',
      actorUserId,
      data: { workPackageId, assignedTo },
    });
  }

  async updateMilestoneStatus(projectId: string, milestoneId: string, status: 'PENDING' | 'DONE' | 'MISSED', actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'MILESTONE_UPDATED',
      actorUserId,
      data: { milestoneId, status },
    });
  }

  async changeDeadline(projectId: string, milestoneId: string, dueDate: string, reason: string | undefined, actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'DEADLINE_CHANGED',
      actorUserId,
      data: { milestoneId, dueDate, reason },
    });
  }

  async resolveFlag(projectId: string, flagId: string, actorUserId: string, note?: string) {
    return this.appendEvent(projectId, {
      type: 'FLAG_RESOLVED',
      actorUserId,
      data: { id: flagId },
      note,
    });
  }

  async addManualNote(projectId: string, note: string, actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'MANUAL_NOTE',
      actorUserId,
      data: { note },
      note,
    });
  }

  async addMember(projectId: string, userId: string, name: string | undefined, actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'MEMBER_ADDED',
      actorUserId,
      data: { userId, name },
    });
  }

  async removeMember(projectId: string, userId: string, actorUserId: string) {
    return this.appendEvent(projectId, {
      type: 'MEMBER_REMOVED',
      actorUserId,
      data: { userId },
    });
  }

  async getEvents(
    projectId: string,
    opts: { cursor?: string; limit?: number; types?: string[] } = {},
  ) {
    const log = await prisma.projectLog.findUnique({
      where: { projectId },
    });
    if (!log) return { events: [], nextCursor: undefined };

    const limit = opts.limit || 20;
    const whereClause: any = { logId: log.id };
    if (opts.types && opts.types.length > 0) {
      whereClause.type = { in: opts.types };
    }
    if (opts.cursor) {
      whereClause.id = { lt: opts.cursor };
    }

    const events = await prisma.projectLogEvent.findMany({
      where: whereClause,
      orderBy: { seq: 'desc' },
      take: limit + 1,
    });

    let nextCursor: string | undefined;
    if (events.length > limit) {
      const nextItem = events.pop();
      nextCursor = nextItem?.id;
    }

    return { events, nextCursor };
  }

  async getContext(projectId: string, view: 'planning'): Promise<PlanningContext>;
  async getContext(projectId: string, view: 'evaluation'): Promise<EvaluationContext>;
  async getContext(projectId: string, view: 'mentor'): Promise<MentorContext>;
  async getContext(projectId: string, view: 'admin'): Promise<AdminContext>;
  async getContext(
    projectId: string,
    view: 'planning' | 'evaluation' | 'mentor' | 'admin',
  ): Promise<any> {
    let state = await this.getState(projectId);
    if (!state) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error(`Project ${projectId} not found`);
      state = await this.initLog(projectId, {
        title: project.name,
        category: (project.category as ProjectCategory) || 'FINAL_YEAR',
        teamId: project.teamId || undefined,
      });
    }

    const memberUserIds = state.team.members.map((m) => m.userId);

    switch (view) {
      case 'planning': {
        const userSkills = await prisma.userSkill.findMany({
          where: { userId: { in: memberUserIds } },
          include: { user: { select: { fullName: true } } },
        });

        const membersWithSkills = state.team.members.map((m) => {
          const skills = userSkills.filter((s) => s.userId === m.userId).map((s) => s.skillName);
          return { ...m, skills };
        });

        return {
          projectId: state.projectId,
          title: state.title,
          category: state.category,
          department: state.department,
          duration: state.duration,
          members: membersWithSkills,
          technologies: state.technologies,
        };
      }

      case 'evaluation': {
        const latestDoc = await prisma.executionDocument.findFirst({
          where: { projectId },
          orderBy: { version: 'desc' },
          select: { version: true, createdAt: true },
        });

        const lastEval = state.evaluations.slice(-1)[0] || null;

        return {
          projectId: state.projectId,
          title: state.title,
          category: state.category,
          duration: state.duration,
          team: state.team,
          workPackages: state.workPackages,
          milestones: state.milestones,
          executionDocSummary: latestDoc ? { version: latestDoc.version, generatedAt: latestDoc.createdAt } : null,
          lastEvaluationSummary: lastEval,
        };
      }

      case 'mentor': {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const logs = await prisma.dailyWorkLog.findMany({
          where: {
            projectId,
            createdAt: { gte: fifteenDaysAgo },
          },
          select: { userId: true, date: true, hoursSpent: true },
        });

        const logCountsPerMember: Record<string, number> = {};
        memberUserIds.forEach((uid) => { logCountsPerMember[uid] = 0; });
        logs.forEach((l) => {
          logCountsPerMember[l.userId] = (logCountsPerMember[l.userId] || 0) + 1;
        });

        return {
          projectId: state.projectId,
          title: state.title,
          category: state.category,
          duration: state.duration,
          team: state.team,
          workPackages: state.workPackages,
          milestones: state.milestones,
          flags: state.flags,
          skills: state.skills,
          recentEvaluations: state.evaluations.slice(-2),
          activitySummary: { logCountsPerMember },
        };
      }

      case 'admin': {
        const startDate = new Date(state.duration.startDate);
        const endDate = new Date(state.duration.endDate);
        const now = new Date();
        const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime());
        const elapsed = Math.max(0, now.getTime() - startDate.getTime());
        const percentTimeElapsed = Math.min(100, Math.round((elapsed / totalDuration) * 100));

        const doneMilestones = state.milestones.filter((m) => m.status === 'DONE').length;
        const totalMilestones = state.milestones.length || 1;
        const percentMilestonesDone = Math.round((doneMilestones / totalMilestones) * 100);

        const openFlags = state.flags.filter((f) => !f.resolved);
        const lastEval = state.evaluations.slice(-1)[0] || null;

        return {
          projectId: state.projectId,
          title: state.title,
          category: state.category,
          teamId: state.team.teamId,
          percentTimeElapsed,
          percentMilestonesDone,
          latestEvaluation: lastEval,
          openFlagCount: openFlags.length,
          openFlags: openFlags.map((f) => ({
            type: f.type,
            message: f.message,
            severity: f.severity || 50,
          })),
          githubRepo: state.github?.repoFullName || null,
        };
      }
    }
  }
}

export const projectLogService = new ProjectLogService();
