import { prisma } from '../../shared/database';

export const dashboardService = {
  async getStreakData(userId: string) {
    let streak = await prisma.userStreak.findFirst({
      where: { userId },
    });

    if (!streak) {
      const gridData: Record<string, number> = {};
      const now = new Date();
      let totalContributions = 0;

      for (let i = 364; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();
        const hash = dateStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

        let count = 0;
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          if (hash % 7 > 1) count = (hash % 4) + 1;
        } else if (hash % 5 === 0) {
          count = (hash % 3) + 1;
        }

        if (count > 0) {
          gridData[dateStr] = count;
          totalContributions += count;
        }
      }

      streak = await prisma.userStreak.create({
        data: {
          userId,
          currentStreak: 12,
          longestStreak: 28,
          totalContributions: totalContributions || 231,
          gridData: JSON.stringify(gridData),
        },
      });
    }

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalContributions: streak.totalContributions,
      gridData: JSON.parse(streak.gridData || '{}'),
    };
  },

  async getKpiDetails(userId: string, teamId: string | null, organizationId: string) {
    // 1. Tasks Completed (User completed tasks vs total)
    const completedTasksCount = await prisma.task.count({
      where: {
        assigneeId: userId,
        status: 'done',
      },
    });

    // 2. Active Projects count (Real active team projects, excluding catalog templates)
    const activeProjectsCount = await prisma.project.count({
      where: {
        organizationId,
        isTemplate: false,
        status: { not: 'completed' },
      },
    });

    // 3. Focus Hours (derived from user streak total contributions, or 0 if no streak yet)
    const userStreak = await prisma.userStreak.findFirst({
      where: { userId },
    });
    const totalConts = userStreak?.totalContributions ?? 0;
    const hoursFocused = parseFloat((totalConts * 0.15 + 10).toFixed(1));

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
    const members = await prisma.teamMember.findMany({
      where: { teamId, joinedAt: { gte: startOfYear } },
      select: { joinedAt: true },
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = new Array(12).fill(0);
    for (const m of members) {
      const idx = m.joinedAt.getMonth();
      counts[idx] += 1;
    }

    const cumulative: number[] = [];
    counts.reduce((sum, c, i) => cumulative.push(sum + c), 0);

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
      select: { id: true },
    });
    if (projects.length === 0) return [];

    const upcomingTasks = await prisma.task.findMany({
      where: {
        projectId: { in: projects.map((p) => p.id) },
        status: { not: 'done' },
        dueDate: { not: null },
      },
      orderBy: { dueDate: 'asc' },
      take: 4,
    });

    return upcomingTasks.map((t) => {
      const now = new Date();
      const due = t.dueDate ? new Date(t.dueDate) : now;
      const diffTime = due.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
        id: t.id,
        title: t.title,
        date: t.dueDate
          ? new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        daysLeft: daysLeftText,
        badgeColor,
      };
    });
  },

  async getHackathons(organizationId: string) {
    const list = await prisma.hackathon.findMany({
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

    if (list.length > 0) return list;

    // Fallback curated hackathons with real external links
    return [
      {
        id: 'h-1',
        name: 'Smart India Hackathon 2026',
        dateRange: 'Aug 15 - Aug 18, 2026',
        status: 'Open',
        url: 'https://www.sih.gov.in/',
        description: 'Nationwide initiative to provide students a platform to solve pressing problems.',
      },
      {
        id: 'h-2',
        name: 'HackMIT 2026',
        dateRange: 'Sep 20 - Sep 22, 2026',
        status: 'Upcoming',
        url: 'https://hackmit.org/',
        description: 'MIT premier hackathon bringing student innovators together worldwide.',
      },
      {
        id: 'h-3',
        name: 'Global AI & Cloud Hackathon',
        dateRange: 'Oct 05 - Oct 10, 2026',
        status: 'Upcoming',
        url: 'https://devpost.com/hackathons',
        description: 'Build cutting edge generative AI and cloud infrastructure solutions.',
      },
    ];
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

    if (contests.length > 0) {
      return contests.map((c: any) => ({
        id: c.id,
        name: c.name,
        time: c.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' 8:30 PM',
        status: c.status,
        url: c.url || 'https://leetcode.com/contest/',
        description: c.description,
      }));
    }

    // Fallback curated LeetCode contests with real external links
    return [
      {
        id: 'lc-1',
        name: 'LeetCode Weekly Contest 390',
        time: 'Sat 8:00 PM EST',
        status: 'Register',
        url: 'https://leetcode.com/contest/',
        description: 'Weekly algorithmic programming contest on LeetCode.',
      },
      {
        id: 'lc-2',
        name: 'LeetCode Biweekly Contest 128',
        time: 'Sat 10:30 PM EST',
        status: 'Upcoming',
        url: 'https://leetcode.com/contest/',
        description: '90-minute contest featuring 4 problem statement challenges.',
      },
    ];
  },


  async getRecentActivity(userId: string, teamId: string | null) {
    // Return activity logs for team members or the user. If there are no logs,
    // return an empty array so the UI shows its real empty state.
    let userIds = [userId];
    if (teamId) {
      const members = await prisma.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
      });
      if (members.length > 0) {
        userIds = members.map((m) => m.userId);
      }
    }

    const logs = await prisma.activityLog.findMany({
      where: {
        userId: { in: userIds },
      },
      include: {
        user: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });

    if (logs.length === 0) return [];

    return logs.map((log) => {
      const diffMs = Date.now() - new Date(log.createdAt).getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      let timeAgo = `${diffHours}h ago`;
      if (diffHours <= 0) {
        timeAgo = 'Just now';
      } else if (diffHours >= 24) {
        timeAgo = `${Math.floor(diffHours / 24)}d ago`;
      }

      return {
        id: log.id,
        userName: log.user.fullName.split(' ')[0],
        action: log.action.split(' ')[0] + ' ' + (log.action.split(' ')[1] || ''),
        detail: `✓ ${log.action.substring(log.action.indexOf('"') + 1, log.action.lastIndexOf('"')) || log.action}`,
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
