import { prisma } from '../../shared/database';
import { RankingService } from '../ranking/ranking.service';
import { TtlCache } from '../../shared/ttlCache';

const cache = new TtlCache<any>(300000); // 5 minute TTL

export interface EnrichedTopTeam {
  teamId: string;
  name: string;
  domain: string;
  score: number;
  globalRank: number;
  domainRank: number | null;
  domainPercentile: number | null;
  categories: {
    execution: number;
    productivity: number;
    quality: number;
    collaboration: number;
  };
  githubLinked: boolean;
  plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  currentProject: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  members: Array<{
    id: string;
    fullName: string;
    regNo: string | null;
    ssgDomain: string | null;
  }>;
}

export interface EnrichedTopStudent {
  userId: string;
  fullName: string;
  regNo: string | null;
  department: string | null;
  domain: string;
  score: number;
  globalRank: number;
  domainRank: number | null;
  domainPercentile: number | null;
  categories: {
    execution: number;
    productivity: number;
    quality: number;
    collaboration: number;
  };
  githubLinked: boolean;
  team: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  topSkills: Array<{
    skillName: string;
    skillType: string;
    totalPoints: number;
  }>;
}

export interface DomainTeamGroup {
  domain: string;
  displayName: string;
  teams: EnrichedTopTeam[];
}

export interface DomainStudentGroup {
  domain: string;
  displayName: string;
  students: EnrichedTopStudent[];
}

export class TopPerformersService {
  static async getTopTeamsByDomain(limit: number = 5): Promise<DomainTeamGroup[]> {
    const cacheKey = `topTeams:${limit}`;
    return cache.wrap(cacheKey, async () => {
      const allRankings = await RankingService.getTeamRankings();
      const activeRankings = allRankings.filter((r) => r.hasActivity !== false);

      const teamIds = activeRankings.map((r) => r.teamId);
      const teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: {
          id: true,
          name: true,
          domain: true,
          members: {
            select: { id: true, fullName: true, regNo: true, ssgDomain: true },
          },
          projects: {
            select: { id: true, name: true, description: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      const teamMap = new Map(teams.map((t) => [t.id, t]));

      const enriched: EnrichedTopTeam[] = [];
      for (const r of activeRankings) {
        const team = teamMap.get(r.teamId);
        if (!team) continue;

        const domainKey = team.domain?.trim() || '__none__';

        enriched.push({
          teamId: team.id,
          name: team.name,
          domain: domainKey,
          score: r.score,
          globalRank: r.rank,
          domainRank: r.domainRank,
          domainPercentile: r.domainPercentile,
          categories: r.categories,
          githubLinked: r.githubLinked,
          plagiarismRisk: r.plagiarismRisk,
          currentProject: team.projects[0]
            ? {
                id: team.projects[0].id,
                name: team.projects[0].name,
                description: team.projects[0].description,
              }
            : null,
          members: team.members,
        });
      }

      // Group by domain
      const groupsMap = new Map<string, EnrichedTopTeam[]>();
      for (const item of enriched) {
        const list = groupsMap.get(item.domain) || [];
        list.push(item);
        groupsMap.set(item.domain, list);
      }

      const result: DomainTeamGroup[] = [];
      let noneGroup: DomainTeamGroup | null = null;

      for (const [dom, list] of groupsMap.entries()) {
        list.sort((a, b) => b.score - a.score);
        const sliced = list.slice(0, limit);

        const groupObj: DomainTeamGroup = {
          domain: dom,
          displayName: dom === '__none__' ? 'Unassigned domain' : dom,
          teams: sliced,
        };

        if (dom === '__none__') {
          noneGroup = groupObj;
        } else {
          result.push(groupObj);
        }
      }

      result.sort((a, b) => a.displayName.localeCompare(b.displayName));
      if (noneGroup && noneGroup.teams.length > 0) {
        result.push(noneGroup);
      }

      return result;
    });
  }

  static async getTopStudentsByDomain(limit: number = 5): Promise<DomainStudentGroup[]> {
    const cacheKey = `topStudents:${limit}`;
    return cache.wrap(cacheKey, async () => {
      const allRankings = await RankingService.getStudentRankings();
      const activeRankings = allRankings.filter((r) => r.hasActivity !== false);

      const userIds = activeRankings.map((r) => r.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          fullName: true,
          regNo: true,
          department: true,
          ssgDomain: true,
          team: {
            select: { id: true, name: true, domain: true },
          },
          userSkills: {
            select: { skillName: true, skillType: true, totalPoints: true },
            orderBy: { totalPoints: 'desc' },
            take: 3,
          },
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      const enriched: EnrichedTopStudent[] = [];
      for (const r of activeRankings) {
        const u = userMap.get(r.userId);
        if (!u) continue;

        const domainKey = u.ssgDomain?.trim() || u.team?.domain?.trim() || '__none__';

        enriched.push({
          userId: u.id,
          fullName: u.fullName,
          regNo: u.regNo,
          department: u.department,
          domain: domainKey,
          score: r.score,
          globalRank: r.rank,
          domainRank: r.domainRank,
          domainPercentile: r.domainPercentile,
          categories: r.categories,
          githubLinked: r.githubLinked,
          team: u.team,
          topSkills: u.userSkills,
        });
      }

      // Group by domain
      const groupsMap = new Map<string, EnrichedTopStudent[]>();
      for (const item of enriched) {
        const list = groupsMap.get(item.domain) || [];
        list.push(item);
        groupsMap.set(item.domain, list);
      }

      const result: DomainStudentGroup[] = [];
      let noneGroup: DomainStudentGroup | null = null;

      for (const [dom, list] of groupsMap.entries()) {
        list.sort((a, b) => b.score - a.score);
        const sliced = list.slice(0, limit);

        const groupObj: DomainStudentGroup = {
          domain: dom,
          displayName: dom === '__none__' ? 'Unassigned domain' : dom,
          students: sliced,
        };

        if (dom === '__none__') {
          noneGroup = groupObj;
        } else {
          result.push(groupObj);
        }
      }

      result.sort((a, b) => a.displayName.localeCompare(b.displayName));
      if (noneGroup && noneGroup.students.length > 0) {
        result.push(noneGroup);
      }

      return result;
    });
  }
}
