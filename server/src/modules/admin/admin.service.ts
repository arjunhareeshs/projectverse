import { prisma } from '../../shared/database';
import * as XLSX from 'xlsx';
import bcrypt from 'bcrypt';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalTeams: number;
  totalStudents: number;
  totalAchievements: number;
  avgProgress: number;
}

// ─── Admin Service ────────────────────────────────────────────────────────────

export class AdminService {

  // ── Stats ──────────────────────────────────────────────────────────────────

  static async getStats(): Promise<AdminStats> {
    const [totalTeams, totalStudents, totalAchievements, rankings] = await Promise.all([
      prisma.team.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.adminAchievement.count(),
      prisma.groupRanking.findMany({ select: { totalPoints: true } }),
    ]);

    const avgProgress = rankings.length > 0
      ? Math.round(rankings.reduce((sum, r) => sum + r.totalPoints, 0) / rankings.length / 10)
      : 58;

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
    const [students, total] = await Promise.all([
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
    ]);
    return { students, total, page, limit };
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
    const [teams, total] = await Promise.all([
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
    ]);
    return { teams, total, page, limit };
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
    const teams = await prisma.team.findMany({
      include: {
        ranking: true,
        members: { select: { id: true, fullName: true, regNo: true, ssgDomain: true } },
        projects: { select: { id: true, name: true, description: true, status: true } },
      },
      orderBy: { ranking: { totalPoints: 'desc' } },
    });

    // Domain-wise top teams (top 2 per domain)
    const domainMap: Record<string, typeof teams> = {};
    for (const team of teams) {
      if (!team.domain) continue;
      if (!domainMap[team.domain]) domainMap[team.domain] = [];
      if (domainMap[team.domain].length < 2) domainMap[team.domain].push(team);
    }

    // Top 10 teams overall
    const top10 = teams.slice(0, 10);

    // Unique team projects
    const uniqueProjects = teams
      .filter(t => t.projects.length > 0)
      .map(t => ({
        ...t.projects[0],
        team: { id: t.id, name: t.name, domain: t.domain },
        progress: t.ranking ? Math.min(100, Math.round(t.ranking.totalPoints / 10)) : 0,
        status: t.projects[0]?.status || 'planned',
      }));

    return { domainWise: domainMap, top10, uniqueProjects };
  }

  // ── Student Trends ─────────────────────────────────────────────────────────

  static async getStudentTrends() {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: {
        team: { select: { id: true, name: true, domain: true } },
        userSkills: { orderBy: { totalPoints: 'desc' }, take: 3 },
      },
    });

    // Score each student by rewardPoints + activityPoints
    const scored = students.map(s => ({
      ...s,
      score: s.rewardPoints + s.activityPoints,
      progress: Math.min(100, Math.round((s.rewardPoints + s.activityPoints) / 2)),
      domain: s.ssgDomain || s.team?.domain || 'General',
      initials: s.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    })).sort((a, b) => b.score - a.score);

    // Domain-wise top 2 students
    const domainMap: Record<string, typeof scored> = {};
    for (const student of scored) {
      const domain = student.domain;
      if (!domainMap[domain]) domainMap[domain] = [];
      if (domainMap[domain].length < 2) domainMap[domain].push(student);
    }

    // Top 10 students
    const top10 = scored.slice(0, 10);

    // Top student projects - students who have a team with projects
    const topWithProjects = scored
      .filter(s => s.team)
      .slice(0, 8);

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
        orderBy: { ranking: { totalPoints: 'desc' } },
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
        orderBy: { ranking: { totalPoints: 'desc' } },
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

  // Get team detail for chat
  static async getTeamDetail(teamId: string) {
    return await prisma.team.findUnique({
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
          select: { id: true, name: true, description: true, status: true },
          take: 5,
        },
      },
    });
  }

  // Get student detail for chat
  static async getStudentDetail(studentId: string) {
    return await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        team: { select: { id: true, name: true, domain: true } },
        userSkills: { orderBy: { totalPoints: 'desc' } },
      },
    });
  }
}
