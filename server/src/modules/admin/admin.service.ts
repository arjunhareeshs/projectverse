import { prisma } from '../../shared/database';
import * as XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import { RankingService, type TeamRankingResult, type StudentRankingResult } from '../ranking/ranking.service';
import { TtlCache } from '../../shared/ttlCache';
import {
  onboardingFunnel,
  formationHealth,
  cohortSegmentation,
  earlyWarningBoard,
  catalogDemand,
  cohortRoiReport,
} from '../metrics/cohortMetrics';

const analyticsCache = new TtlCache<any>(300000); // 5 min TTL

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalTeams: number;
  totalStudents: number;
  totalAchievements: number;
  avgProgress: number;
}

// ─── Ranking fallbacks (team/student with no computed rank yet) ──────────────

function defaultTeamRanking(teamId: string, fallbackRank: number): TeamRankingResult {
  return {
    teamId,
    score: 0,
    rank: fallbackRank,
    domain: null,
    domainRank: null,
    domainPercentile: null,
    deadlineCompleteness: 0,
    finishment: 0,
    productivity: 0,
    categories: { execution: 0, productivity: 0, quality: 0, collaboration: 0 },
    githubLinked: false,
    plagiarismRisk: null,
    hasActivity: false,
  };
}

function defaultStudentRanking(userId: string, fallbackRank: number): StudentRankingResult {
  return {
    userId,
    score: 0,
    rank: fallbackRank,
    domain: null,
    domainRank: null,
    domainPercentile: null,
    deadlineCompleteness: 0,
    finishment: 0,
    productivity: 0,
    categories: { execution: 0, productivity: 0, quality: 0, collaboration: 0 },
    githubLinked: false,
    hasActivity: false,
  };
}

function rankingToResponseShape(r: TeamRankingResult | StudentRankingResult) {
  return {
    totalPoints: r.score * 10,
    score: r.score,
    rank: r.rank,
    domainRank: r.domainRank,
    domainPercentile: r.domainPercentile,
    deadlineCompleteness: r.deadlineCompleteness,
    finishment: r.finishment,
    productivity: r.productivity,
    categories: r.categories,
    githubLinked: r.githubLinked,
    plagiarismRisk: 'plagiarismRisk' in r ? r.plagiarismRisk : null,
    hasActivity: r.hasActivity,
  };
}

// ─── Admin Service ────────────────────────────────────────────────────────────

export class AdminService {

  // ── Stats ──────────────────────────────────────────────────────────────────

  static async getStats(): Promise<AdminStats> {
    const [totalTeams, totalStudents, totalAchievements, teamRankings] = await Promise.all([
      prisma.team.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.adminAchievement.count(),
      RankingService.getTeamRankings(),
    ]);

    const activeRankings = teamRankings.filter((r) => r.hasActivity);
    const sumScores = activeRankings.reduce((sum, r) => sum + r.score, 0);
    const avgProgress = activeRankings.length > 0 ? Math.round(sumScores / activeRankings.length) : 0;

    return { totalTeams, totalStudents, totalAchievements, avgProgress };
  }

  // ── Student CRUD ───────────────────────────────────────────────────────────

  static async createStudent(data: {
    fullName: string;
    studentId: string;
    email: string;
    domain: string;
    teamId?: string;
    year?: string;
  }) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { regNo: data.studentId }] },
    });
    if (existing) throw new Error('Student with this email or ID already exists');

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('ProjectVerse@2024', salt);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        regNo: data.studentId,
        passwordHash,
        role: 'STUDENT',
        mustChangePassword: true,
        ssgDomain: data.domain,
        teamId: data.teamId || null,
        year: data.year || null,
      },
    });
    return user;
  }

  static async getStudents(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [students, total, studentRankings] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'STUDENT' },
        skip,
        take: limit,
        include: {
          team: { select: { id: true, name: true, domain: true } },
          userSkills: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      RankingService.getStudentRankings(),
    ]);

    const rankingMap = new Map(studentRankings.map((r) => [r.userId, r]));

    const enrichedStudents = students.map((student) => {
      const liveRank = rankingMap.get(student.id) || defaultStudentRanking(student.id, studentRankings.length + 1);

      return {
        ...student,
        liveRanking: liveRank,
        performanceScore: liveRank.score,
        rank: liveRank.rank,
      };
    });

    return { students: enrichedStudents, total, page, limit };
  }

  // ── Team CRUD ──────────────────────────────────────────────────────────────

  static async createTeam(data: {
    name: string;
    domain: string;
    problemStatement: string;
    projectTitle: string;
    status: string;
    leadEmail?: string;
    organizationId: string;
  }) {
    const org = await prisma.organization.findFirst();
    const orgId = data.organizationId || org?.id;
    if (!orgId) throw new Error('No organization found');

    const lead = data.leadEmail
      ? await prisma.user.findUnique({ where: { email: data.leadEmail } })
      : null;

    const team = await prisma.team.create({
      data: {
        name: data.name,
        domain: data.domain,
        description: data.problemStatement,
        currentProjectLabel: data.projectTitle,
        organizationId: orgId,
        leadId: lead?.id || null,
      },
    });

    // Create project for the team
    await prisma.project.create({
      data: {
        name: data.projectTitle,
        description: data.problemStatement,
        status: data.status || 'planned',
        organizationId: orgId,
        teamId: team.id,
      },
    });

    return team;
  }

  static async getTeams(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [teams, total, teamRankings] = await Promise.all([
      prisma.team.findMany({
        skip,
        take: limit,
        include: {
          members: { select: { id: true, fullName: true, regNo: true } },
          ranking: true,
          projects: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.team.count(),
      RankingService.getTeamRankings(),
    ]);

    const rankingMap = new Map(teamRankings.map((r) => [r.teamId, r]));

    const enrichedTeams = teams.map((team) => {
      const liveRank = rankingMap.get(team.id) || defaultTeamRanking(team.id, teamRankings.length + 1);

      return {
        ...team,
        liveRanking: liveRank,
        ranking: rankingToResponseShape(liveRank),
      };
    });

    return { teams: enrichedTeams, total, page, limit };
  }

  // ── Achievement CRUD ───────────────────────────────────────────────────────

  static async createAchievement(data: {
    title: string;
    description: string;
    type: string; // 'individual' | 'team'
    recipientId?: string;
    teamId?: string;
    points: number;
    date: string;
  }) {
    return await prisma.adminAchievement.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        recipientId: data.recipientId || null,
        teamId: data.teamId || null,
        points: data.points,
        date: new Date(data.date),
      },
    });
  }

  static async getAchievements(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [achievements, total] = await Promise.all([
      prisma.adminAchievement.findMany({
        skip,
        take: limit,
        include: {
          recipient: { select: { id: true, fullName: true, regNo: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.adminAchievement.count(),
    ]);
    return { achievements, total };
  }

  // ── Bulk Upload ────────────────────────────────────────────────────────────

  static async bulkUploadStudents(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('ProjectVerse@2024', salt);

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const email = String(row['Email'] || row['email'] || '').trim();
        const regNo = String(row['Student ID'] || row['RegNo'] || row['reg_no'] || '').trim();
        const fullName = String(row['Full Name'] || row['Name'] || row['name'] || '').trim();
        const domain = String(row['Domain'] || row['domain'] || '').trim();
        const year = String(row['Year'] || row['year'] || '').trim();

        if (!email || !fullName) { results.skipped++; continue; }

        const existing = await prisma.user.findFirst({
          where: { OR: [{ email }, ...(regNo ? [{ regNo }] : [])] },
        });
        if (existing) { results.skipped++; continue; }

        await prisma.user.create({
          data: {
            email,
            fullName,
            regNo: regNo || null,
            passwordHash,
            role: 'STUDENT',
            mustChangePassword: true,
            ssgDomain: domain || null,
            year: year || null,
            organizationId: org.id,
          },
        });
        results.created++;
      } catch (err: any) {
        results.errors.push(err.message);
      }
    }
    return results;
  }

  static async bulkUploadTeams(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const name = String(row['Team Name'] || row['name'] || '').trim();
        const domain = String(row['Domain'] || row['domain'] || '').trim();
        const description = String(row['Problem Statement'] || row['description'] || '').trim();
        const projectTitle = String(row['Project Title'] || row['project'] || '').trim();
        const status = String(row['Status'] || row['status'] || 'planned').trim();

        if (!name) { results.skipped++; continue; }

        const existing = await prisma.team.findFirst({ where: { name } });
        if (existing) { results.skipped++; continue; }

        const team = await prisma.team.create({
          data: {
            name,
            domain,
            description,
            currentProjectLabel: projectTitle,
            organizationId: org.id,
          },
        });

        if (projectTitle) {
          await prisma.project.create({
            data: {
              name: projectTitle,
              description,
              status,
              organizationId: org.id,
              teamId: team.id,
            },
          });
        }
        results.created++;
      } catch (err: any) {
        results.errors.push(err.message);
      }
    }
    return results;
  }

  static async bulkUploadAchievements(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const title = String(row['Title'] || row['title'] || '').trim();
        const description = String(row['Description'] || row['description'] || '').trim();
        const type = String(row['Type'] || row['type'] || 'individual').trim().toLowerCase();
        const recipientRegNo = String(row['Student ID'] || row['reg_no'] || '').trim();
        const teamName = String(row['Team Name'] || row['team'] || '').trim();
        const points = parseInt(row['Points'] || row['points'] || '0');
        const date = row['Date'] || new Date().toISOString();

        if (!title) { results.skipped++; continue; }

        const recipient = recipientRegNo
          ? await prisma.user.findFirst({ where: { regNo: recipientRegNo } })
          : null;
        const team = teamName
          ? await prisma.team.findFirst({ where: { name: teamName } })
          : null;

        await prisma.adminAchievement.create({
          data: {
            title,
            description,
            type,
            recipientId: recipient?.id || null,
            teamId: team?.id || null,
            points: isNaN(points) ? 0 : points,
            date: new Date(date),
          },
        });
        results.created++;
      } catch (err: any) {
        results.errors.push(err.message);
      }
    }
    return results;
  }

  // ── Team Trends ────────────────────────────────────────────────────────────

  static async getTeamTrends() {
    const [teams, teamRankings] = await Promise.all([
      prisma.team.findMany({
        include: {
          ranking: true,
          members: { select: { id: true, fullName: true, regNo: true, ssgDomain: true } },
          projects: { select: { id: true, name: true, description: true, status: true } },
        },
      }),
      RankingService.getTeamRankings(),
    ]);

    const rankingMap = new Map(teamRankings.map((r) => [r.teamId, r]));

    const enrichedTeams = teams.map((team) => {
      const r = rankingMap.get(team.id) || defaultTeamRanking(team.id, teamRankings.length + 1);

      return {
        ...team,
        liveRanking: r,
        ranking: rankingToResponseShape(r),
      };
    });

    // Sort by live score desc
    enrichedTeams.sort((a, b) => b.liveRanking.score - a.liveRanking.score);

    // Domain-wise top teams (top 2 per domain)
    const domainMap: Record<string, typeof enrichedTeams> = {};
    for (const team of enrichedTeams) {
      if (!team.domain) continue;
      if (!domainMap[team.domain]) domainMap[team.domain] = [];
      if (domainMap[team.domain].length < 2) domainMap[team.domain].push(team);
    }

    // Top 10 teams overall
    const top10 = enrichedTeams.slice(0, 10);

    // Unique team projects
    const uniqueProjects = enrichedTeams
      .filter((t) => t.projects.length > 0)
      .map((t) => ({
        ...t.projects[0],
        team: { id: t.id, name: t.name, domain: t.domain },
        progress: t.liveRanking.score,
        status: t.projects[0]?.status || 'planned',
      }));

    return { domainWise: domainMap, top10, uniqueProjects };
  }

  // ── Student Trends ─────────────────────────────────────────────────────────

  static async getStudentTrends() {
    const [students, studentRankings] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'STUDENT' },
        include: {
          team: { select: { id: true, name: true, domain: true } },
          userSkills: { orderBy: { totalPoints: 'desc' }, take: 3 },
        },
      }),
      RankingService.getStudentRankings(),
    ]);

    const rankMap = new Map(studentRankings.map((r) => [r.userId, r]));

    const scored = students.map((s) => {
      const r = rankMap.get(s.id) || defaultStudentRanking(s.id, studentRankings.length + 1);

      return {
        ...s,
        liveRanking: r,
        score: r.score,
        progress: r.score,
        rank: r.rank,
        domain: s.ssgDomain || s.team?.domain || 'General',
        initials: s.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      };
    }).sort((a, b) => b.score - a.score);

    // Domain-wise top 2 students
    const domainMap: Record<string, typeof scored> = {};
    for (const student of scored) {
      const domain = student.domain;
      if (!domainMap[domain]) domainMap[domain] = [];
      if (domainMap[domain].length < 2) domainMap[domain].push(student);
    }

    // Top 10 students
    const top10 = scored.slice(0, 10);

    // Top student projects
    const topWithProjects = scored.filter((s) => s.team).slice(0, 8);

    return { domainWise: domainMap, top10, topProjects: topWithProjects };
  }

  // ── Admin Chat ─────────────────────────────────────────────────────────────

  static async saveAdminChat(userId: string, prompt: string, response: string, sessionId: string) {
    return await prisma.adminChatHistory.create({
      data: { userId, prompt, response, sessionId },
    });
  }

  static async getAdminChatHistory(userId: string) {
    return await prisma.adminChatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async getAdminChatSessions(userId: string) {
    const sessions = await prisma.adminChatHistory.groupBy({
      by: ['sessionId'],
      where: { userId },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    });

    const result = await Promise.all(
      sessions.map(async (s) => {
        const first = await prisma.adminChatHistory.findFirst({
          where: { userId, sessionId: s.sessionId },
          orderBy: { createdAt: 'asc' },
        });
        return {
          sessionId: s.sessionId,
          title: first?.prompt.slice(0, 60) || 'Chat',
          lastAt: s._max.createdAt,
        };
      })
    );
    return result;
  }

  // Context search for chat sidebar
  static async searchContext(query: string) {
    const lq = query.toLowerCase();

    // Detect intent
    const isTeam = lq.includes('team') || lq.includes('group');
    const isStudent = lq.includes('student') || lq.includes('member') || lq.includes('person');
    const domainKeywords = ['ai', 'web', 'mobile', 'iot', 'data science', 'cybersecurity', 'cloud', 'blockchain'];
    const domain = domainKeywords.find(d => lq.includes(d));

    if (isTeam) {
      const where: any = {};
      if (domain) where.domain = { contains: domain, mode: 'insensitive' };

      const teams = await prisma.team.findMany({
        where,
        include: {
          ranking: true,
          members: { select: { id: true, fullName: true, regNo: true } },
          projects: { select: { id: true, name: true, description: true, status: true } },
        },
        take: 10,
      });
      return { type: 'teams', results: teams };
    }

    if (isStudent) {
      const students = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          ...(domain ? { ssgDomain: { contains: domain, mode: 'insensitive' } } : {}),
        },
        include: {
          team: { select: { id: true, name: true, domain: true } },
          userSkills: { orderBy: { totalPoints: 'desc' }, take: 3 },
        },
        orderBy: [{ rewardPoints: 'desc' }, { activityPoints: 'desc' }],
        take: 10,
      });
      return { type: 'students', results: students };
    }

    // Default: search both
    const [teams, students] = await Promise.all([
      prisma.team.findMany({
        take: 5,
        include: { ranking: true, projects: { select: { name: true, status: true }, take: 1 } },
      }),
      prisma.user.findMany({
        where: { role: 'STUDENT' },
        take: 5,
        include: { team: { select: { name: true } } },
        orderBy: { rewardPoints: 'desc' },
      }),
    ]);
    return { type: 'mixed', teams, students };
  }

  // Get team detail
  static async getTeamDetail(teamId: string) {
    const [team, teamRankings, studentRankings] = await Promise.all([
      prisma.team.findUnique({
        where: { id: teamId },
        include: {
          ranking: true,
          members: {
            select: {
              id: true,
              fullName: true,
              regNo: true,
              ssgDomain: true,
              rewardPoints: true,
              activityPoints: true,
              userSkills: { orderBy: { totalPoints: 'desc' }, take: 3 },
            },
          },
          projects: {
            select: { id: true, name: true, description: true, status: true, repoLink: true },
            take: 5,
          },
          achievements: {
            orderBy: { date: 'desc' },
            take: 10,
          },
        },
      }),
      RankingService.getTeamRankings(),
      RankingService.getStudentRankings(),
    ]);

    if (!team) return null;

    const studentRankMap = new Map(studentRankings.map((s) => [s.userId, s]));

    const membersWithRanking = team.members.map((m) => {
      const sr = studentRankMap.get(m.id) || defaultStudentRanking(m.id, studentRankings.length + 1);
      return {
        ...m,
        liveRanking: sr,
        performanceScore: sr.score,
        rank: sr.rank,
      };
    });

    const liveRank = teamRankings.find((r) => r.teamId === team.id) || defaultTeamRanking(team.id, teamRankings.length + 1);

    // Real peers for the "progress vs peers" comparison — other teams in the same domain.
    let domainPeers: Array<{ id: string; name: string; score: number; isCurrent: boolean }> = [];
    if (team.domain) {
      const sameDomain = teamRankings
        .filter((r) => r.domain === team.domain)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
      const peerNames = await prisma.team.findMany({
        where: { id: { in: sameDomain.map((r) => r.teamId) } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(peerNames.map((t) => [t.id, t.name]));
      domainPeers = sameDomain.map((r) => ({
        id: r.teamId,
        name: nameMap.get(r.teamId) || 'Team',
        score: r.score,
        isCurrent: r.teamId === team.id,
      }));
    }

    return {
      ...team,
      members: membersWithRanking,
      liveRanking: liveRank,
      ranking: rankingToResponseShape(liveRank),
      domainPeers,
    };
  }

  // Get student detail
  static async getStudentDetail(studentId: string) {
    const [student, liveRanking] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              domain: true,
              groupCode: true,
              leadId: true,
            },
          },
          userSkills: { orderBy: { totalPoints: 'desc' } },
        },
      }),
      RankingService.getStudentRanking(studentId),
    ]);

    if (!student) return null;

    const rankResult = liveRanking || defaultStudentRanking(student.id, 999);

    return {
      ...student,
      liveRanking: rankResult,
      performanceScore: rankResult.score,
      rank: rankResult.rank,
    };
  }

  // ── Analytics (Compute-on-read with TtlCache) ──────────────────────────────

  static async getFunnelAnalytics(organizationId: string) {
    return analyticsCache.wrap(`funnel:${organizationId}`, () => onboardingFunnel(organizationId));
  }

  static async getFormationHealth(organizationId: string) {
    return analyticsCache.wrap(`formation:${organizationId}`, () => formationHealth(organizationId));
  }

  static async getSegmentationAnalytics(
    organizationId: string,
    dimension: 'department' | 'deptCode' | 'cluster' | 'year' | 'gender' | 'resident' | 'ssgDomain' = 'department'
  ) {
    return analyticsCache.wrap(`seg:${organizationId}:${dimension}`, () => cohortSegmentation(organizationId, dimension));
  }

  static async getEarlyWarningBoard(organizationId: string) {
    return analyticsCache.wrap(`early-warning:${organizationId}`, () => earlyWarningBoard(organizationId), 120000);
  }

  static async getCatalogDemandAnalytics(organizationId: string) {
    return analyticsCache.wrap(`demand:${organizationId}`, () => catalogDemand(organizationId));
  }

  static async getRoiReport(organizationId: string) {
    return analyticsCache.wrap(`roi:${organizationId}`, () => cohortRoiReport(organizationId));
  }
}
