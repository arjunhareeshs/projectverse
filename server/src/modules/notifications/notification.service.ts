import crypto from 'crypto';
import { prisma } from '../../shared/database';
import { getIoInstance } from '../../infrastructure/socket';
import { chatJSON, isLlmConfigured } from '../ai/llm.service';

export interface NotificationCooldownOptions {
  type?: string;
  refId?: string;
  status?: string;
  cooldownMinutes?: number; // default 1440 (24h)
}

export const notificationService = {
  /**
   * Generates a deterministic deduplication fingerprint for notification throttling.
   */
  generateFingerprint(userId: string, title: string, refId?: string, periodKey?: string): string {
    const payload = [userId, title, refId || '', periodKey || ''].join(':');
    return crypto.createHash('sha256').update(payload).digest('hex');
  },

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

    return notificationService.createForUserWithCooldown(
      userId,
      'Upcoming Deadline',
      `"${task.title}" is ${whenText}.`,
      { type: 'TASK_DEADLINE', refId: task.id, cooldownMinutes: 720 },
    );
  },

  async createForUser(
    userId: string,
    title: string,
    body: string,
    opts?: { type?: string; refId?: string; status?: string },
  ) {
    const notification = await prisma.notification.create({
      data: { userId, title, body, type: opts?.type, refId: opts?.refId, status: opts?.status },
    });

    try {
      const io = getIoInstance();
      io.to(`user:${userId}`).emit('notification', notification);
    } catch (e) {
      console.error('Socket emission failed:', e);
    }

    return notification;
  },

  /**
   * Creates a notification only if an identical notification was not dispatched
   * to this user within the specified cooldown window.
   */
  async createForUserWithCooldown(
    userId: string,
    title: string,
    body: string,
    opts?: NotificationCooldownOptions,
  ) {
    const cooldownMins = opts?.cooldownMinutes ?? 1440; // 24 hours default
    const cutoff = new Date(Date.now() - cooldownMins * 60 * 1000);

    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        title,
        ...(opts?.type ? { type: opts.type } : {}),
        ...(opts?.refId ? { refId: opts.refId } : {}),
        createdAt: { gte: cutoff },
      },
    });

    if (recent) {
      return recent; // Suppressed due to active cooldown window
    }

    return notificationService.createForUser(userId, title, body, opts);
  },

  async syncStatusByRefId(refId: string, status: string) {
    await prisma.notification.updateMany({
      where: { refId, status: 'pending' },
      data: { status, readAt: new Date() },
    });
  },

  async broadcastToTeam(teamId: string, title: string, body: string, opts?: { type?: string; refId?: string }) {
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
        type: opts?.type,
        refId: opts?.refId,
      })),
      skipDuplicates: true,
    });

    try {
      const io = getIoInstance();
      memberships.forEach((m) => {
        io.to(`user:${m.userId}`).emit('notification', { title, body, userId: m.userId, type: opts?.type });
      });
    } catch (e) {
      console.error('Socket emission failed:', e);
    }

    return { created: result.count, teamId };
  },

  /**
   * Generates and dispatches an AI-enriched or deterministic fallback alert
   * when project risk enters AMBER or RED band.
   */
  async createAiRiskNotification(params: {
    projectId: string;
    teamId?: string | null;
    projectName: string;
    riskScore: number;
    riskBand: 'GREEN' | 'AMBER' | 'RED';
    topDrivers: string[];
  }) {
    if (params.riskBand === 'GREEN') return;

    const isRed = params.riskBand === 'RED';
    const fallbackTitle = isRed
      ? `Critical Risk Alert: ${params.projectName}`
      : `Risk Warning: ${params.projectName}`;
    
    const fallbackBody = isRed
      ? `Project risk reached RED (${params.riskScore}/100). Primary drivers: ${params.topDrivers.slice(0, 2).join(', ') || 'Milestone slippage'}. Immediate intervention recommended.`
      : `Project risk entered AMBER (${params.riskScore}/100). Top drivers: ${params.topDrivers.slice(0, 2).join(', ') || 'Activity lag'}.`;

    let title = fallbackTitle;
    let body = fallbackBody;

    if (isLlmConfigured()) {
      try {
        const prompt = [
          {
            role: 'system' as const,
            content: 'You are an engineering project risk analyst. Generate a concise 1-2 sentence alert for a high-risk student project. Do NOT invent metrics. Base response strictly on the supplied facts.',
          },
          {
            role: 'user' as const,
            content: JSON.stringify({
              project: params.projectName,
              riskScore: params.riskScore,
              band: params.riskBand,
              topDrivers: params.topDrivers,
            }),
          },
        ];

        const aiResponse = await chatJSON<{ title?: string; message?: string }>(
          prompt,
          { title: fallbackTitle, message: fallbackBody },
          { feature: 'risk_notification' },
        );

        if (aiResponse?.title) title = aiResponse.title;
        if (aiResponse?.message) body = aiResponse.message;
      } catch (err) {
        console.warn('[NotificationService] AI Risk Notification generation failed, using fallback:', err);
      }
    }

    // Broadcast to team members with 24h cooldown
    if (params.teamId) {
      await notificationService.broadcastToTeam(
        params.teamId,
        title,
        body,
        { type: `RISK_${params.riskBand}`, refId: params.projectId },
      );
    }
  },

  /**
   * Generates and dispatches an AI-enriched or deterministic fallback alert
   * when a persistent blocker (>= 3 days) is detected.
   */
  async createAiBlockerNotification(params: {
    projectId: string;
    teamId?: string | null;
    projectName: string;
    blockerSummary: string;
    recurrenceCount: number;
    userId: string;
  }) {
    const fallbackTitle = `Persistent Blocker Escalation (${params.recurrenceCount} days)`;
    const fallbackBody = `A blocker has persisted for ${params.recurrenceCount} days in "${params.projectName}": "${params.blockerSummary}".`;

    let title = fallbackTitle;
    let body = fallbackBody;

    if (isLlmConfigured()) {
      try {
        const prompt = [
          {
            role: 'system' as const,
            content: 'You are a technical mentor. Summarize this recurring blocker concisely into a title and a 1-sentence action recommendation. Return JSON with "title" and "actionableSummary".',
          },
          {
            role: 'user' as const,
            content: JSON.stringify({
              project: params.projectName,
              blocker: params.blockerSummary,
              daysRecurred: params.recurrenceCount,
            }),
          },
        ];

        const aiResponse = await chatJSON<{ title?: string; actionableSummary?: string }>(
          prompt,
          { title: fallbackTitle, actionableSummary: fallbackBody },
          { feature: 'blocker_notification' },
        );

        if (aiResponse?.title) title = aiResponse.title;
        if (aiResponse?.actionableSummary) body = aiResponse.actionableSummary;
      } catch (err) {
        console.warn('[NotificationService] AI Blocker Notification generation failed, using fallback:', err);
      }
    }

    // Send to the student and broadcast to the team
    await notificationService.createForUserWithCooldown(
      params.userId,
      title,
      body,
      { type: 'BLOCKER_ESCALATED', refId: params.projectId, cooldownMinutes: 1440 },
    );

    if (params.teamId) {
      await notificationService.broadcastToTeam(
        params.teamId,
        title,
        body,
        { type: 'BLOCKER_ESCALATED', refId: params.projectId },
      );
    }
  },

  /**
   * Generates a rich, non-generic 15-day evaluation scorecard notification for an individual student.
   * Includes their 10 rubric marks, comparison to prior cycle, team rank, and action plan.
   */
  async createRichStudentEvaluationNotification(params: {
    userId: string;
    projectId: string;
    projectName: string;
    cycle: number;
    regNo: string;
    totalMarks: number;
    deltaMarks?: number | null;
    rank?: number | null;
    marks10: {
      scopeAlignment: number;
      technicalComplexity: number;
      milestoneCompletion: number;
      commitAuthenticity: number;
      riskMitigation: number;
      taskPunctuality: number;
      dailyLogDiligence: number;
      taskOwnership: number;
      teamCollaboration: number;
      growthInnovation: number;
    };
    actionPlan?: string | null;
  }) {
    const deltaStr = params.deltaMarks != null
      ? (params.deltaMarks >= 0 ? ` (+${params.deltaMarks} pts)` : ` (${params.deltaMarks} pts)`)
      : '';
    const title = `15-Day Scorecard (Cycle #${params.cycle}): ${params.totalMarks}/100${deltaStr}`;

    const m = params.marks10;
    const marksSummary = `[On-Project] Scope: ${m.scopeAlignment}/10, Tech: ${m.technicalComplexity}/10, Milestones: ${m.milestoneCompletion}/10, Commits: ${m.commitAuthenticity}/10, Risks: ${m.riskMitigation}/10 | [Discipline] Punctuality: ${m.taskPunctuality}/10, Logs: ${m.dailyLogDiligence}/10, Ownership: ${m.taskOwnership}/10, Collaboration: ${m.teamCollaboration}/10, Growth: ${m.growthInnovation}/10.`;

    const rankStr = params.rank ? ` Team Rank: #${params.rank}.` : '';
    const actionStr = params.actionPlan ? ` Action Plan: ${params.actionPlan}` : '';

    const body = `${params.projectName} [Reg: ${params.regNo}]. Total: ${params.totalMarks}/100.${rankStr}\n${marksSummary}${actionStr}`;

    return notificationService.createForUser(
      params.userId,
      title,
      body,
      { type: 'EVALUATION_STUDENT_SCORECARD', refId: params.projectId },
    );
  },

  /**
   * Generates a rich team dynamics & synergy evaluation notification.
   */
  async createRichTeamEvaluationNotification(params: {
    teamId: string;
    projectId: string;
    projectName: string;
    cycle: number;
    totalTeamMarks: number;
    synergyLevel: string;
    deltaMarks?: number | null;
    feedback?: string | null;
  }) {
    const deltaStr = params.deltaMarks != null
      ? (params.deltaMarks >= 0 ? ` (+${params.deltaMarks} pts)` : ` (${params.deltaMarks} pts)`)
      : '';
    const title = `Team Performance Assessment (Cycle #${params.cycle}): ${params.totalTeamMarks}/100${deltaStr}`;
    const body = `Team Synergy: ${params.synergyLevel} for "${params.projectName}". Score: ${params.totalTeamMarks}/100. ${params.feedback || 'Review your team metrics and milestone velocity in the dashboard.'}`;

    return notificationService.broadcastToTeam(
      params.teamId,
      title,
      body,
      { type: 'EVALUATION_TEAM_SCORECARD', refId: params.projectId },
    );
  },
};


