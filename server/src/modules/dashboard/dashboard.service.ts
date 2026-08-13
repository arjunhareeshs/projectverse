import { prisma } from '../../shared/database';

export const dashboardService = {
  async getStreakData(userId: string) {
    // Real contribution grid derived from the user's own daily work logs —
    // one log entry for a given calendar date counts as one contribution day.
    const since = new Date();
    since.setDate(since.getDate() - 364);
    since.setHours(0, 0, 0, 0);

    const logs = await prisma.dailyWorkLog.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true },
      orderBy: { date: 'asc' },
    });

    const gridData: Record<string, number> = {};
    for (const log of logs) {
      const dateStr = log.date.toISOString().split('T')[0];
      gridData[dateStr] = (gridData[dateStr] ?? 0) + 1;
    }

    const sortedDates = Object.keys(gridData).sort();

    let longestStreak = 0;
    let runLength = 0;
    let prevDate: Date | null = null;
    for (const dateStr of sortedDates) {
      const current = new Date(dateStr);
      runLength = prevDate && current.getTime() - prevDate.getTime() === 86400000 ? runLength + 1 : 1;
      longestStreak = Math.max(longestStreak, runLength);
      prevDate = current;
    }

    let currentStreak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (gridData[cursor.toISOString().split('T')[0]]) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      currentStreak,
      longestStreak,
      totalContributions: sortedDates.length,
      gridData,
    };
  },

  async getKpiDetails(userId: string, teamId: string | null) {
    // 1. Tasks Completed (User completed tasks vs total)
    const completedTasksCount = await prisma.task.count({
      where: {
        assigneeId: userId,
        status: 'done',
      },
    });

    // 2. Active Projects count (projects this specific member is actually on, not org-wide)
    const activeProjectsCount = await prisma.project.count({
      where: {
        isTemplate: false,
        status: { not: 'completed' },
        members: { some: { userId } },
      },
    });

    // 3. Focus Hours (real sum of logged hours from the user's daily work logs, 0 if none)
    const hoursAgg = await prisma.dailyWorkLog.aggregate({
      where: { userId },
      _sum: { hoursSpent: true },
    });
    const hoursFocused = parseFloat((hoursAgg._sum.hoursSpent ?? 0).toFixed(1));

    // 4. Pending Tasks count
    const pendingTasksCount = await prisma.task.count({
      where: {
        assigneeId: userId,
        status: { not: 'done' },
      },
    });

    // 5. Team Members count (real DB count, or 0 if no team)
    let teamMembersCount = 0;
    if (teamId) {
      teamMembersCount = await prisma.teamMember.count({
        where: { teamId },
      });
    }

    return {
      tasksCompleted: {
        value: completedTasksCount,
        change: '+0%',
        trendUp: true,
        sparkline: [0, 0, 0, 0, 0, 0, completedTasksCount],
      },
      projectsActive: {
        value: activeProjectsCount,
        change: '+0',
        trendUp: true,
        sparkline: [0, 0, 0, 0, 0, 0, activeProjectsCount],
      },
      hoursFocused: {
        value: `${hoursFocused}h`,
        change: '+0%',
        trendUp: true,
        sparkline: [0, 0, 0, 0, 0, 0, hoursFocused],
      },
      pendingTasks: {
        value: pendingTasksCount,
        change: '0%',
        trendUp: false,
        sparkline: [0, 0, 0, 0, 0, 0, pendingTasksCount],
      },
      teamMembers: {
        value: teamMembersCount,
        change: '+0',
        trendUp: true,
        sparkline: [0, 0, 0, 0, 0, 0, teamMembersCount],
      },
    };
  },

  async getTeamGrowth(teamId: string | null) {
    if (!teamId) return [];

    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = new Array(12).fill(0);

    // Composite growth signal: new projects taken on + reward points earned +
    // GitHub commits pushed by the team this year, one "growth event" each.
    const [teamProjects, members] = await Promise.all([
      prisma.project.findMany({
        where: { teamId, isTemplate: false },
        select: { id: true, createdAt: true },
      }),
      prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } }),
    ]);

    for (const p of teamProjects) {
      if (p.createdAt >= startOfYear) counts[p.createdAt.getMonth()] += 1;
    }

    const memberIds = members.map((m) => m.userId);
    if (memberIds.length > 0) {
      const rewards = await prisma.rewardTransaction.findMany({
        where: { userId: { in: memberIds }, createdAt: { gte: startOfYear } },
        select: { createdAt: true },
      });
      for (const r of rewards) counts[r.createdAt.getMonth()] += 1;
    }

    const repos = await prisma.githubRepository.findMany({
      where: { projectId: { in: teamProjects.map((p) => p.id) } },
      select: { id: true },
    });
    if (repos.length > 0) {
      const commits = await prisma.githubCommit.findMany({
        where: { repositoryId: { in: repos.map((r) => r.id) }, date: { gte: startOfYear } },
        select: { date: true },
      });
      for (const c of commits) counts[c.date.getMonth()] += 1;
    }

    let running = 0;
    const cumulative = counts.map((c) => (running += c));

    return monthNames.map((month, i) => ({ month, count: cumulative[i] }));
  },

  async getProjectActivity(teamId: string | null) {
    if (!teamId) {
      return { total: 0, completed: 0, inProgress: 0, onHold: 0, todo: 0 };
    }

    const projects = await prisma.project.findMany({
      where: { teamId, isTemplate: false },
      select: { id: true },
    });

    if (projects.length === 0) {
      return { total: 0, completed: 0, inProgress: 0, onHold: 0, todo: 0 };
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
    });

    const completed = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const onHold = Math.max(0, tasks.length - (completed + inProgress + todo));

    return {
      total: tasks.length,
      completed,
      inProgress,
      onHold,
      todo,
    };
  },

  async getUpcomingDeadlines(teamId: string | null) {
    if (!teamId) return [];

    const projects = await prisma.project.findMany({
      where: { teamId, isTemplate: false },
      select: { id: true, createdAt: true },
    });
    if (projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const projectCreatedAt = new Map(projects.map((p) => [p.id, p.createdAt]));

    // Deadlines are pulled from all three places a due date can come from:
    // kanban task due dates, explicit timeline milestones, and gantt-style
    // execution phases (whose target date is the project start + weekTarget).
    const [tasks, milestones, phases] = await Promise.all([
      prisma.task.findMany({
        where: { projectId: { in: projectIds }, status: { not: 'done' }, dueDate: { not: null } },
        select: { id: true, title: true, dueDate: true },
      }),
      prisma.milestone.findMany({
        where: { projectId: { in: projectIds }, dueDate: { not: null } },
        select: { id: true, title: true, dueDate: true },
      }),
      prisma.projectPhase.findMany({
        where: { projectId: { in: projectIds }, status: { not: 'APPROVED' } },
        select: { id: true, title: true, weekTarget: true, projectId: true },
      }),
    ]);

    const items: { id: string; title: string; dueDate: Date }[] = [];

    for (const t of tasks) items.push({ id: t.id, title: t.title, dueDate: t.dueDate as Date });
    for (const m of milestones) items.push({ id: m.id, title: m.title, dueDate: m.dueDate as Date });
    for (const p of phases) {
      const anchor = projectCreatedAt.get(p.projectId);
      if (!anchor) continue;
      items.push({
        id: p.id,
        title: `Phase: ${p.title}`,
        dueDate: new Date(anchor.getTime() + p.weekTarget * 7 * 86400000),
      });
    }

    items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return items.slice(0, 4).map((item) => {
      const now = new Date();
      const diffDays = Math.ceil((item.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let daysLeftText = `${diffDays} days left`;
      let badgeColor = 'green';
      if (diffDays <= 0) {
        daysLeftText = 'Overdue';
        badgeColor = 'red';
      } else if (diffDays <= 3) {
        badgeColor = 'red';
      } else if (diffDays <= 7) {
        badgeColor = 'yellow';
      }

      return {
        id: item.id,
        title: item.title,
        date: item.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        daysLeft: daysLeftText,
        badgeColor,
      };
    });
  },

  async getHackathons(organizationId: string) {
    return prisma.hackathon.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        dateRange: true,
        status: true,
        url: true,
        description: true,
      },
    });
  },

  async getLeetCodeContests(organizationId: string) {
    const contests = await prisma.leetCodeContest.findMany({
      where: { organizationId },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        name: true,
        startTime: true,
        status: true,
        url: true,
        description: true,
      },
    });

    return contests.map((c: any) => ({
      id: c.id,
      name: c.name,
      time: c.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' 8:30 PM',
      status: c.status,
      url: c.url || 'https://leetcode.com/contest/',
      description: c.description,
    }));
  },


  async getRecentActivity(userId: string, teamId: string | null) {
    // Sourced from real kanban board movement (Task) and phase/timeline
    // submissions (PhaseSubmission) — the two things that actually generate
    // activity in this app — rather than a generic log table nothing writes to.
    let projectIds: string[];
    if (teamId) {
      const projects = await prisma.project.findMany({
        where: { teamId, isTemplate: false },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    } else {
      const memberships = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      projectIds = memberships.map((m) => m.projectId);
    }

    if (projectIds.length === 0) return [];

    const statusLabel: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
    const submissionLabel: Record<string, string> = {
      PENDING: 'submitted phase',
      APPROVED: 'had phase approved',
      CHANGES_REQUESTED: 'got change requests on phase',
    };

    const [recentTasks, recentSubmissions] = await Promise.all([
      prisma.task.findMany({
        where: { projectId: { in: projectIds } },
        include: { assignee: { select: { fullName: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      prisma.phaseSubmission.findMany({
        where: { projectId: { in: projectIds } },
        include: { submittedBy: { select: { fullName: true } }, phase: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ]);

    const items: { id: string; userName: string; action: string; detail: string; at: Date }[] = [];

    for (const t of recentTasks) {
      items.push({
        id: `task-${t.id}`,
        userName: t.assignee?.fullName?.split(' ')[0] || 'Unassigned',
        action: `moved task to ${statusLabel[t.status] || t.status}`,
        detail: `✓ ${t.title}`,
        at: t.updatedAt,
      });
    }
    for (const s of recentSubmissions) {
      items.push({
        id: `phase-${s.id}`,
        userName: s.submittedBy.fullName.split(' ')[0],
        action: submissionLabel[s.status] || 'updated phase',
        detail: `✓ ${s.phase.title}`,
        at: s.createdAt,
      });
    }

    items.sort((a, b) => b.at.getTime() - a.at.getTime());

    return items.slice(0, 4).map((item) => {
      const diffMs = Date.now() - item.at.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      let timeAgo = `${diffHours}h ago`;
      if (diffHours <= 0) {
        timeAgo = 'Just now';
      } else if (diffHours >= 24) {
        timeAgo = `${Math.floor(diffHours / 24)}d ago`;
      }

      return {
        id: item.id,
        userName: item.userName,
        action: item.action,
        detail: item.detail,
        timeAgo,
      };
    });
  },

  // ── Public (unauthenticated) endpoints used by the landing page ────────────

  /**
   * Returns the curated list of hackathons visible on the public landing page.
   * Pulls from the first organization in the DB (seeded demo content). Safe to
   * expose — only returns the marketing-facing fields.
   */
  async getPublicHackathons() {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    if (!org) return [];
    return prisma.hackathon.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        dateRange: true,
        status: true,
        url: true,
        description: true,
      },
    });
  },

  /**
   * Returns the curated list of LeetCode-style contests visible on the public
   * landing page. Same scope as the hackathons — pulls from the first org.
   */
  async getPublicLeetCodeContests() {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    if (!org) return [];
    const contests = await prisma.leetCodeContest.findMany({
      where: { organizationId: org.id },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        name: true,
        startTime: true,
        status: true,
        url: true,
        description: true,
      },
    });
    return contests.map((c: any) => ({
      id: c.id,
      name: c.name,
      time: c.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' 8:30 PM',
      status: c.status,
      url: c.url,
      description: c.description,
    }));
  },
};
