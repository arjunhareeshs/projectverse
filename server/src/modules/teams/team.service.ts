import { prisma } from '../../shared/database';
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  regNo: true,
  organizationId: true,
  year: true,
  department: true,
  deptCode: true,
  cluster: true,
  gender: true,
  resident: true,
  learningMode: true,
  ssgEnrolled: true,
  ssgDomain: true,
  groupRegistered: true,
  skillsRegistered: true,
  rewardPoints: true,
  activityPoints: true,
  teamRole: true,
} as const;

export const teamService = {
  async getTeams(organizationId: string) {
    return prisma.team.findMany({
      where: { organizationId },
      include: {
        lead: { select: userSelect },
        members: {
          select: {
            ...userSelect,
            userSkills: true,
          }
        },
        teamMembers: {
          include: {
            user: {
              select: {
                ...userSelect,
                userSkills: true,
              }
            }
          }
        },
        ranking: true,
      },
    });
  },

  async getTeamById(organizationId: string, id: string) {
    return prisma.team.findFirst({
      where: { id, organizationId },
      include: {
        lead: { select: userSelect },
        members: {
          select: {
            ...userSelect,
            userSkills: true,
          }
        },
        teamMembers: {
          include: {
            user: {
              select: {
                ...userSelect,
                userSkills: true,
              }
            }
          }
        },
        projects: {
          include: { tasks: true }
        },
        ranking: true,
      }
    });
  },

  async createTeam(organizationId: string, creatorId: string, creatorRole: string, data: any) {
    const leadId = creatorRole === 'ADMIN' ? (data.leadId || creatorId) : creatorId;
    if (leadId) {
      const leadUser = await prisma.user.findUnique({ where: { id: leadId } });
      if (leadUser?.teamId) {
        throw new Error('You are already part of a team. Leave your current team before creating a new one.');
      }
    }

    const team = await prisma.team.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        domain: data.domain,
        color: data.color || '#7C3AED',
        leadId,
        ...(leadId && {
          members: { connect: { id: leadId } },
          teamMembers: { create: { userId: leadId, roleLabel: 'Team Leader' } },
        }),
      }
    });

    if (leadId) {
      await prisma.user.update({ where: { id: leadId }, data: { teamId: team.id } });
      await prisma.activityLog.create({
        data: { userId: leadId, action: `created the team "${team.name}"`, entityType: 'TEAM', entityId: team.id }
      });
    }

    // Every team gets a default workspace project so Tasks/Projects tabs work immediately.
    await prisma.project.create({
      data: {
        organizationId,
        teamId: team.id,
        name: `${team.name} Workspace`,
        description: data.description,
        status: 'active',
      }
    });

    return team;
  },

  async updateTeam(organizationId: string, id: string, requesterId: string, requesterRole: string, data: any) {
    const team = await prisma.team.findFirst({ where: { id, organizationId } });
    if (!team) throw new Error('Team not found');
    if (requesterRole !== 'ADMIN' && team.leadId !== requesterId) {
      throw new Error('Only the team lead or an admin can edit this team');
    }
    return prisma.team.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        leadId: data.leadId,
        domain: data.domain,
        color: data.color,
        maxMembers: data.maxMembers,
        isPublic: data.isPublic,
        currentProjectLabel: data.currentProjectLabel,
      }
    });
  },

  async addMember(organizationId: string, teamId: string, userId: string, roleLabel: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const existingMembership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!existingMembership) {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (targetUser?.teamId && targetUser.teamId !== teamId) {
        throw new Error('This person is already part of another team. They must leave it before joining this one.');
      }
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { members: { connect: { id: userId } } }
    });
    await prisma.user.update({ where: { id: userId }, data: { teamId } });

    return prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { roleLabel },
      create: { teamId, userId, roleLabel }
    });
  },

  async removeMember(organizationId: string, teamId: string, userId: string, requesterId: string, requesterRole: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId }, include: { teamMembers: true } });
    if (!team) throw new Error('Team not found');

    const isSelf = requesterId === userId;
    const isLeadOrAdmin = requesterRole === 'ADMIN' || team.leadId === requesterId;
    if (!isSelf && !isLeadOrAdmin) {
      throw new Error('Not authorized to remove this member');
    }
    if (isSelf && team.leadId === userId && team.teamMembers.length > 1) {
      throw new Error('Team leads cannot leave while other members remain. Transfer leadership or ask an admin to reassign it first.');
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { members: { disconnect: { id: userId } } }
    });
    await prisma.user.update({ where: { id: userId }, data: { teamId: null } });
    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } }
    }).catch(() => null);

    // Re-evaluate count to prevent parallel exit race conditions
    const remainingMembers = await prisma.teamMember.count({ where: { teamId } });

    // Last member leaving — clean up the now-empty team.
    if (remainingMembers === 0) {
      const ownedProjects = await prisma.project.findMany({ where: { teamId }, select: { id: true } });
      await prisma.task.deleteMany({ where: { projectId: { in: ownedProjects.map(p => p.id) } } });
      await prisma.project.updateMany({ where: { collaboratingTeamId: teamId }, data: { collaboratingTeamId: null } });
      await prisma.project.deleteMany({ where: { teamId } });
      await prisma.teamMessage.deleteMany({ where: { teamId } });
      await prisma.teamInvite.deleteMany({ where: { teamId } });
      await prisma.teamCollaboration.deleteMany({ where: { OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] } });
      await prisma.team.delete({ where: { id: teamId } });
      return { success: true, teamDeleted: true };
    }

    return { success: true, teamDeleted: false };
  },

  async getTeamStats(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId },
      include: {
        projects: { include: { tasks: true } }
      }
    });

    if (!team) throw new Error('Team not found');

    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    const now = new Date();

    team.projects.forEach(p => {
      p.tasks.forEach(t => {
        totalTasks++;
        if (t.status === 'done' || t.status === 'completed') completedTasks++;
        if (t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'completed') overdueTasks++;
      });
    });

    return {
      activeProjects: team.projects.length,
      taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      overdueCount: overdueTasks,
      totalTasks
    };
  },

  /**
   * Computes all 8 leadership coordination metrics from plan.md §2.
   * No schema changes needed beyond what Stage 1 already added.
   */
  async getCoordinationMetrics(organizationId: string, teamId: string) {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    // Fetch team with full relations needed for all metrics
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId },
      include: {
        lead: { select: userSelect },
        members: { select: userSelect },
        teamMembers: { include: { user: { select: userSelect } } },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: { select: userSelect },
                comments: true,
              }
            },
            meetings: true,
            milestones: true,
            sprints: {
              include: { project: { select: { id: true } } }
            }
          }
        }
      }
    });

    if (!team) throw new Error('Team not found');

    const memberIds = team.members.map(m => m.id);
    const captainId = team.leadId;

    // Flatten all tasks across all team projects
    const allTasks = team.projects.flatMap(p => p.tasks);
    const openTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'completed');
    const doneTasks = allTasks.filter(t => t.status === 'done' || t.status === 'completed');

    // ── 1. WORKLOAD BALANCE ──────────────────────────────────────
    const workloadPerMember = team.members.map(member => {
      const memberTasks = allTasks.filter(t => t.assigneeId === member.id);
      const completed = memberTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      const overdue = memberTasks.filter(
        t => t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'completed'
      ).length;
      return {
        memberId: member.id,
        memberName: member.fullName,
        taskCount: memberTasks.length,
        completedCount: completed,
        overdueCount: overdue,
        isHighLoad: false, // computed below
      };
    });

    const avgLoad = memberIds.length > 0
      ? workloadPerMember.reduce((s, m) => s + m.taskCount, 0) / memberIds.length
      : 0;

    workloadPerMember.forEach(m => {
      m.isHighLoad = avgLoad > 0 && m.taskCount > avgLoad * 2;
    });

    // ── 2. DELEGATION RATIO ──────────────────────────────────────
    const captainTasks = allTasks.filter(t => t.assigneeId === captainId).length;
    const captainTaskShare = allTasks.length > 0
      ? (captainTasks / allTasks.length) * 100
      : 0;

    const delegationRatio = [
      { name: 'Captain', value: captainTasks },
      { name: 'Team Members', value: Math.max(0, allTasks.length - captainTasks) },
    ];

    // ── 3. OVERDUE / AGING ───────────────────────────────────────
    const overdueTasks = openTasks
      .filter(t => t.dueDate && t.dueDate < now)
      .map(t => ({
        taskId: t.id,
        title: t.title,
        assignee: t.assignee?.fullName || 'Unassigned',
        daysOverdue: t.dueDate
          ? Math.floor((now.getTime() - t.dueDate.getTime()) / 86_400_000)
          : 0,
        priority: t.priority,
        dueDate: t.dueDate,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // ── 4. TURNAROUND TIME ───────────────────────────────────────
    const completedWithDates = doneTasks.filter(t => t.completedAt);
    const avgTurnaroundDays = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, t) => {
          const days = (t.completedAt!.getTime() - t.createdAt.getTime()) / 86_400_000;
          return sum + days;
        }, 0) / completedWithDates.length
      : null;

    // Turnaround Trend (weekly average for the last 6 weeks)
    const turnaroundTrend = [];
    for (let w = 5; w >= 0; w--) {
      const start = new Date(now.getTime() - (w + 1) * 7 * 86_400_000);
      const end = new Date(now.getTime() - w * 7 * 86_400_000);
      const completedInWeek = doneTasks.filter(
        t => t.completedAt && t.completedAt >= start && t.completedAt < end
      );
      const avg = completedInWeek.length > 0
        ? completedInWeek.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()) / 86_400_000, 0) / completedInWeek.length
        : 0;
      turnaroundTrend.push({
        week: `Wk -${w}`,
        avgDays: Number(avg.toFixed(1)),
      });
    }

    // ── 5. COMMUNICATION FREQUENCY ───────────────────────────────
    const silentTasks = openTasks.filter(t => t.comments.length === 0);

    // Comments per day for last 30 days
    const allComments = allTasks.flatMap(t => t.comments).filter(c => c.createdAt >= thirtyDaysAgo);
    const commentsPerDay: Record<string, number> = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(thirtyDaysAgo.getTime() + d * 86_400_000);
      const key = date.toISOString().split('T')[0];
      commentsPerDay[key] = 0;
    }
    allComments.forEach(c => {
      const key = c.createdAt.toISOString().split('T')[0];
      if (key in commentsPerDay) commentsPerDay[key]++;
    });
    const commentsLast30Days = Object.entries(commentsPerDay).map(([date, count]) => ({ date, count }));

    // ── 6. MEETING CADENCE ───────────────────────────────────────
    const allMeetings = team.projects.flatMap(p => p.meetings);
    const meetingsLast14Days = allMeetings.filter(
      m => m.startsAt && m.startsAt >= fourteenDaysAgo
    ).length;

    // Meeting cadence timeline (weekly meetings vs active projects count over last 4 weeks)
    const meetingCadence = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date(now.getTime() - (w + 1) * 7 * 86_400_000);
      const end = new Date(now.getTime() - w * 7 * 86_400_000);
      const meetingsCount = allMeetings.filter(m => m.startsAt && m.startsAt >= start && m.startsAt < end).length;
      const activeProjs = team.projects.filter(p => p.createdAt < end).length;
      meetingCadence.push({
        week: `Wk -${w}`,
        meetings: meetingsCount,
        projects: activeProjs,
      });
    }

    // ── 7. MILESTONE HIT RATE ────────────────────────────────────
    const allMilestones = team.projects.flatMap(p => p.milestones);
    const dueMilestones = allMilestones.filter(m => m.dueDate && m.dueDate <= now);
    let milestoneHitRate: number | null = null;
    if (dueMilestones.length > 0) {
      let hits = 0;
      for (const milestone of dueMilestones) {
        const proj = team.projects.find(p => p.id === milestone.projectId);
        if (proj) {
          const projCompleted = proj.tasks.filter(
            t => t.completedAt && milestone.dueDate && t.completedAt <= milestone.dueDate
          ).length;
          if (projCompleted / Math.max(proj.tasks.length, 1) >= 0.5) hits++;
        }
      }
      milestoneHitRate = (hits / dueMilestones.length) * 100;
    }

    // Milestone hit rate trend (last 4 months)
    const milestoneTrend = [];
    for (let m = 3; m >= 0; m--) {
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59);
      const milestonesInMonth = allMilestones.filter(ms => ms.dueDate && ms.dueDate >= start && ms.dueDate <= end);
      let hitRate = 100;
      if (milestonesInMonth.length > 0) {
        let hits = 0;
        for (const ms of milestonesInMonth) {
          const proj = team.projects.find(p => p.id === ms.projectId);
          if (proj) {
            const projCompleted = proj.tasks.filter(
              t => t.completedAt && ms.dueDate && t.completedAt <= ms.dueDate
            ).length;
            if (projCompleted / Math.max(proj.tasks.length, 1) >= 0.5) hits++;
          }
        }
        hitRate = (hits / milestonesInMonth.length) * 100;
      }
      milestoneTrend.push({
        month: start.toLocaleString('default', { month: 'short' }),
        hitRate: Math.round(hitRate),
      });
    }

    // ── 8. ENGAGEMENT / ACTIVITY TREND ──────────────────────────
    const recentActivity = await prisma.activityLog.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: sevenDaysAgo },
      },
      select: { userId: true },
    });
    const activeUserIds = new Set(recentActivity.map(a => a.userId));
    const inactiveMembers = team.members
      .filter(m => !activeUserIds.has(m.id))
      .map(m => m.fullName);

    // Engagement Trend per Member (weekly activity count over last 4 weeks)
    const activityLogsLast28Days = await prisma.activityLog.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: new Date(now.getTime() - 28 * 86_400_000) },
      },
      select: { userId: true, createdAt: true },
    });

    const memberEngagement = team.members.map(member => {
      const weeklyActivity = [];
      for (let w = 3; w >= 0; w--) {
        const start = new Date(now.getTime() - (w + 1) * 7 * 86_400_000);
        const end = new Date(now.getTime() - w * 7 * 86_400_000);
        const count = activityLogsLast28Days.filter(
          log => log.userId === member.id && log.createdAt >= start && log.createdAt < end
        ).length;
        weeklyActivity.push({ week: `Wk -${w}`, count });
      }
      return {
        memberName: member.fullName,
        weeklyActivity,
      };
    });

    // ── 9. COMPOSITE HEALTH RADAR SCORE ──────────────────────────
    const highLoadCount = workloadPerMember.filter(m => m.isHighLoad).length;
    const workloadBalanceScore = Math.max(0, 100 - (highLoadCount / Math.max(team.members.length, 1)) * 100);
    const turnaroundSpeedScore = avgTurnaroundDays ? Math.max(0, Math.min(100, Math.round(100 - (avgTurnaroundDays - 2) * 8))) : 100;
    const milestoneHitRateScore = milestoneHitRate != null ? Math.round(milestoneHitRate) : 100;
    const engagementScore = Math.round(100 - (inactiveMembers.length / Math.max(team.members.length, 1)) * 100);
    const completedCount = allTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const taskCompletionScore = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 100;

    const radarScore = [
      { subject: 'Workload Balance', A: workloadBalanceScore, fullMark: 100 },
      { subject: 'Turnaround Speed', A: turnaroundSpeedScore, fullMark: 100 },
      { subject: 'Milestone Hit Rate', A: milestoneHitRateScore, fullMark: 100 },
      { subject: 'Member Engagement', A: engagementScore, fullMark: 100 },
      { subject: 'Task Completion', A: taskCompletionScore, fullMark: 100 },
    ];

    return {
      teamId,
      teamName: team.name,
      captainId,
      captainName: team.lead?.fullName || 'Unknown',
      totalMembers: team.members.length,
      activeProjects: team.projects.length,

      // Workload
      workloadPerMember,
      teamAverageTaskLoad: avgLoad,
      captainTaskShare,

      // Overdue
      overdueTaskCount: overdueTasks.length,
      overdueTaskList: overdueTasks,

      // Turnaround
      avgTurnaroundDays,

      // Communication
      silentTaskCount: silentTasks.length,
      commentsLast30Days,

      // Meetings
      meetingsLast14Days,

      // Milestones
      milestoneHitRate,

      // Engagement
      inactiveMembers,

      // Trends and Charts Data
      turnaroundTrend,
      meetingCadence,
      milestoneTrend,
      delegationRatio,
      memberEngagement,
      radarScore,
    };
  },

  /**
   * Calls ai-service /team-coordination-insights, gets back a narrative,
   * and persists the exchange to AiChat.
   */
  async getAIInsights(organizationId: string, teamId: string, requestingUserId: string) {
    const metrics = await teamService.getCoordinationMetrics(organizationId, teamId);

    const aiPayload = {
      teamName: metrics.teamName,
      captainName: metrics.captainName,
      totalMembers: metrics.totalMembers,
      activeProjects: metrics.activeProjects,
      workloadPerMember: metrics.workloadPerMember.map(m => ({
        memberId: m.memberId,
        memberName: m.memberName,
        taskCount: m.taskCount,
        completedCount: m.completedCount,
        overdueCount: m.overdueCount,
      })),
      teamAverageTaskLoad: metrics.teamAverageTaskLoad,
      captainTaskShare: metrics.captainTaskShare,
      overdueTaskCount: metrics.overdueTaskCount,
      overdueTaskList: metrics.overdueTaskList.slice(0, 5).map(t => ({
        taskId: t.taskId,
        title: t.title,
        assignee: t.assignee,
        daysOverdue: t.daysOverdue,
        priority: t.priority,
      })),
      avgTurnaroundDays: metrics.avgTurnaroundDays,
      silentTaskCount: metrics.silentTaskCount,
      commentsLast30Days: metrics.commentsLast30Days,
      meetingsLast14Days: metrics.meetingsLast14Days,
      milestoneHitRate: metrics.milestoneHitRate,
      inactiveMembers: metrics.inactiveMembers,
      // Trend information for AI context
      turnaroundTrend: metrics.turnaroundTrend,
      meetingCadence: metrics.meetingCadence,
      milestoneTrend: metrics.milestoneTrend,
      delegationRatio: metrics.delegationRatio,
      memberEngagement: metrics.memberEngagement,
      radarScore: metrics.radarScore,
    };

    let aiResult: any;
    try {
      const res = await axios.post(`${AI_SERVICE_URL}/team-coordination-insights`, aiPayload, {
        timeout: 30_000,
      });
      aiResult = res.data;
    } catch (err: any) {
      // AI service down — return metrics with a fallback message
      return {
        metrics,
        insights: {
          summary: 'AI insights unavailable — AI service is offline or unreachable.',
          keyIssues: [],
          recommendations: [],
          provider: 'none',
        },
      };
    }

    // Persist to AiChat
    await prisma.aiChat.create({
      data: {
        userId: requestingUserId,
        prompt: `Team coordination insights for team ${metrics.teamName} (${teamId})`,
        response: aiResult.summary + '\n\nKey issues: ' + aiResult.keyIssues.join('; ') +
                  '\n\nRecommendations: ' + aiResult.recommendations.join('; '),
      }
    });

    return {
      metrics,
      insights: aiResult,
    };
  },

  // ── Candidate Search (invite-by-name/regNo) ─────────────────────

  async searchCandidates(organizationId: string, query: string) {
    if (!query || query.trim().length < 2) return [];
    return prisma.user.findMany({
      where: {
        organizationId,
        role: 'STUDENT',
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { regNo: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, email: true, regNo: true, teamId: true },
      take: 8,
    });
  },

  // ── Invites & Join Requests ───────────────────────────────────

  async getInvites(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');
    return prisma.teamInvite.findMany({
      where: { teamId, status: 'pending' },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async inviteMember(organizationId: string, teamId: string, inviterId: string, inviterRole: string, data: { email: string; roleLabel?: string; message?: string }) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');
    if (inviterRole !== 'ADMIN' && team.leadId !== inviterId) {
      throw new Error('Only the team lead or an admin can invite members');
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser?.teamId && existingUser.teamId !== teamId) {
      throw new Error('This person is already part of another team.');
    }

    return prisma.teamInvite.create({
      data: {
        teamId,
        email: data.email,
        userId: existingUser?.id,
        roleLabel: data.roleLabel || 'Member',
        message: data.message,
        type: 'INVITE',
        invitedBy: inviterId,
        skills: ['HTML', 'CSS', 'JavaScript'],
      },
      include: { user: { select: userSelect } },
    });
  },

  async requestToJoin(organizationId: string, teamId: string, userId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const requester = await prisma.user.findUnique({ where: { id: userId } });
    if (requester?.teamId) {
      throw new Error('You are already part of a team. Leave your current team before requesting to join another.');
    }

    const existing = await prisma.teamInvite.findFirst({
      where: { teamId, userId, status: 'pending', type: 'JOIN_REQUEST' }
    });
    if (existing) return existing;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    return prisma.teamInvite.create({
      data: {
        teamId,
        email: user.email,
        userId,
        roleLabel: 'Member',
        type: 'JOIN_REQUEST',
        invitedBy: userId,
      }
    });
  },

  async respondToInvite(organizationId: string, teamId: string, inviteId: string, action: 'accept' | 'decline', responderId: string, responderRole: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const invite = await prisma.teamInvite.findFirst({ where: { id: inviteId, teamId } });
    if (!invite) throw new Error('Invite not found');

    // A member may accept/decline an invite addressed to them; a lead/admin may action any pending invite (incl. join requests).
    const isOwnInvite = invite.userId === responderId;
    const isLeadOrAdmin = responderRole === 'ADMIN' || team.leadId === responderId;
    if (!isOwnInvite && !isLeadOrAdmin) {
      throw new Error('Not authorized to respond to this invite');
    }

    if (action === 'decline') {
      await prisma.teamInvite.update({ where: { id: inviteId }, data: { status: 'declined' } });
      return { success: true };
    }

    if (!invite.userId) {
      throw new Error('No matching user account found for this email — they must register first');
    }

    await teamService.addMember(organizationId, teamId, invite.userId, invite.roleLabel);
    await prisma.teamInvite.update({ where: { id: inviteId }, data: { status: 'accepted' } });
    await prisma.activityLog.create({
      data: { userId: invite.userId, action: `joined the team "${team.name}"`, entityType: 'TEAM', entityId: teamId }
    });

    return { success: true };
  },

  // ── Chat ──────────────────────────────────────────────────────

  async getMessages(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');
    return prisma.teamMessage.findMany({
      where: { teamId },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async sendMessage(organizationId: string, teamId: string, userId: string, message: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');
    if (!message?.trim()) throw new Error('Message cannot be empty');
    return prisma.teamMessage.create({
      data: { teamId, userId, message: message.trim() },
      include: { user: { select: userSelect } },
    });
  },

  // ── Tasks (Kanban) ────────────────────────────────────────────

  async getTeamTasks(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const projects = await prisma.project.findMany({
      where: { organizationId, OR: [{ teamId }, { collaboratingTeamId: teamId }] },
      include: { tasks: { include: { assignee: { select: userSelect } } } },
    });
    return projects.flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name })));
  },

  async createTeamTask(organizationId: string, teamId: string, creatorUserId: string, data: any) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId }, include: { projects: true } });
    if (!team) throw new Error('Team not found');

    let project = data.projectId
      ? team.projects.find(p => p.id === data.projectId)
      : team.projects[0];

    if (!project) {
      project = await prisma.project.create({
        data: { organizationId, teamId, name: `${team.name} Workspace`, status: 'active' }
      });
    }

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || 'medium',
        status: 'todo',
      },
      include: { assignee: { select: userSelect } }
    });

    await prisma.activityLog.create({
      data: { userId: creatorUserId, action: `created task "${task.title}"`, entityType: 'TASK', entityId: task.id }
    });

    return task;
  },

  async updateTeamTaskStatus(organizationId: string, teamId: string, taskId: string, status: string, actingUserId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, project: { teamId, organizationId } },
      include: { project: true }
    });
    if (!task) throw new Error('Task not found');

    const isDone = status === 'done' || status === 'completed';
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { status, completedAt: isDone ? new Date() : null },
      include: { assignee: { select: userSelect } }
    });

    if (isDone) {
      await prisma.activityLog.create({
        data: { userId: actingUserId, action: `completed task "${task.title}"`, entityType: 'TASK', entityId: task.id }
      });
    }

    return updated;
  },

  // ── Projects ──────────────────────────────────────────────────

  async getTeamProjects(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const projects = await prisma.project.findMany({
      where: { organizationId, OR: [{ teamId }, { collaboratingTeamId: teamId }] },
      include: { tasks: true, team: { select: { id: true, name: true, color: true } }, collaboratingTeam: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(p => {
      const total = p.tasks.length;
      const done = p.tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      return {
        ...p,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        taskCount: total,
        isCollaboration: !!p.collaboratingTeamId,
      };
    });
  },

  async createTeamProject(organizationId: string, teamId: string, creatorUserId: string, data: any) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const project = await prisma.project.create({
      data: {
        organizationId,
        teamId,
        name: data.name,
        description: data.description,
        status: 'active',
      }
    });

    await prisma.activityLog.create({
      data: { userId: creatorUserId, action: `created project "${project.name}"`, entityType: 'PROJECT', entityId: project.id }
    });

    return project;
  },

  // ── Activity Feed ─────────────────────────────────────────────

  async getTeamActivity(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId },
      include: { members: { select: { id: true } } }
    });
    if (!team) throw new Error('Team not found');

    const memberIds = team.members.map(m => m.id);
    return prisma.activityLog.findMany({
      where: { userId: { in: memberIds } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: userSelect } },
    });
  },

  // ── Progress / Velocity ───────────────────────────────────────

  async getTeamProgress(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId },
      include: { projects: { include: { tasks: true } } }
    });
    if (!team) throw new Error('Team not found');

    const allTasks = team.projects.flatMap(p => p.tasks);
    const total = allTasks.length;
    const now = new Date();

    const weeks = [];
    for (let w = 9; w >= 0; w--) {
      const cutoff = new Date(now.getTime() - w * 7 * 86_400_000);
      const completedBy = allTasks.filter(t => t.completedAt && t.completedAt <= cutoff).length;
      weeks.push({
        week: `Wk ${10 - w}`,
        percent: total > 0 ? Math.round((completedBy / total) * 100) : 0,
      });
    }

    return {
      weeks,
      totalTasks: total,
      completedTasks: allTasks.filter(t => t.status === 'done' || t.status === 'completed').length,
    };
  },

  // ── Cross-Domain Team Collaboration ─────────────────────────────

  async getCollaborations(organizationId: string, teamId: string) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) throw new Error('Team not found');

    const teamSelect = { select: { id: true, name: true, domain: true, color: true, leadId: true } };
    const [incoming, outgoing] = await Promise.all([
      prisma.teamCollaboration.findMany({
        where: { toTeamId: teamId },
        include: { fromTeam: teamSelect },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teamCollaboration.findMany({
        where: { fromTeamId: teamId },
        include: { toTeam: teamSelect },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { incoming, outgoing };
  },

  async createCollaboration(organizationId: string, fromTeamId: string, requesterId: string, requesterRole: string, data: { toTeamId: string; projectName?: string; message?: string }) {
    const fromTeam = await prisma.team.findFirst({ where: { id: fromTeamId, organizationId } });
    if (!fromTeam) throw new Error('Team not found');
    if (requesterRole !== 'ADMIN' && fromTeam.leadId !== requesterId) {
      throw new Error('Only the team lead or an admin can request collaboration');
    }
    const toTeam = await prisma.team.findFirst({ where: { id: data.toTeamId, organizationId } });
    if (!toTeam) throw new Error('Target team not found');
    if (toTeam.id === fromTeamId) throw new Error('A team cannot collaborate with itself');

    const existing = await prisma.teamCollaboration.findFirst({
      where: { fromTeamId, toTeamId: data.toTeamId, status: 'pending' }
    });
    if (existing) return existing;

    return prisma.teamCollaboration.create({
      data: {
        fromTeamId,
        toTeamId: data.toTeamId,
        projectName: data.projectName,
        message: data.message,
        requestedBy: requesterId,
      }
    });
  },

  async respondToCollaboration(organizationId: string, collabId: string, action: 'accept' | 'decline', responderId: string, responderRole: string) {
    const collab = await prisma.teamCollaboration.findFirst({
      where: { id: collabId },
      include: { fromTeam: true, toTeam: true }
    });
    if (!collab || collab.toTeam.organizationId !== organizationId) throw new Error('Collaboration request not found');
    if (responderRole !== 'ADMIN' && collab.toTeam.leadId !== responderId) {
      throw new Error('Only the receiving team\'s lead or an admin can respond to this request');
    }

    if (action === 'decline') {
      await prisma.teamCollaboration.update({ where: { id: collabId }, data: { status: 'declined' } });
      return { success: true };
    }

    const project = await prisma.project.create({
      data: {
        organizationId,
        teamId: collab.fromTeamId,
        collaboratingTeamId: collab.toTeamId,
        name: collab.projectName || `${collab.fromTeam.name} × ${collab.toTeam.name}`,
        description: collab.message || `Cross-domain collaboration between ${collab.fromTeam.name} and ${collab.toTeam.name}`,
        status: 'active',
      }
    });
    await prisma.teamCollaboration.update({ where: { id: collabId }, data: { status: 'accepted' } });
    await prisma.activityLog.create({
      data: { userId: responderId, action: `accepted collaboration with "${collab.fromTeam.name}"`, entityType: 'TEAM', entityId: collab.toTeamId }
    });

    return { success: true, project };
  },
};



