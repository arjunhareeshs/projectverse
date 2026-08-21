import { prisma } from '../../shared/database';
import type { CohortReportKind, Prisma } from '@prisma/client';
import { concentrationHHI, zScore } from '../../shared/statistics';
import { availability } from '../projects/selection.constants';
import { teamRisk } from './riskModel';
import { buildRiskInputForProject } from './riskInputBuilder';
import { analyzeInterventionEffectiveness } from './intervention';

export async function onboardingFunnel(organizationId: string) {
  const students = await prisma.user.findMany({
    where: { organizationId, role: 'STUDENT' },
    select: { id: true, teamId: true, groupRegistered: true, skillsRegistered: true },
  });

  const teams = await prisma.team.findMany({
    where: { organizationId },
    select: { id: true, _count: { select: { teamMembers: true } } },
  });
  const teamSizeMap = new Map(teams.map((t) => [t.id, t._count.teamMembers]));

  const projects = await prisma.project.findMany({
    where: { organizationId, isTemplate: false },
    select: { teamId: true, status: true },
  });
  const selectedTeamSet = new Set(projects.map((p) => p.teamId).filter(Boolean));
  const approvedTeamSet = new Set(
    projects.filter((p) => p.status === 'approved' || p.status === 'active').map((p) => p.teamId).filter(Boolean)
  );

  const stage = {
    total: students.length,
    groupRegistered: students.filter((s) => s.groupRegistered).length,
    skillsRegistered: students.filter((s) => s.skillsRegistered).length,
    inTeam: students.filter((s) => s.teamId).length,
    teamAtMinSize: students.filter((s) => s.teamId && (teamSizeMap.get(s.teamId) ?? 0) >= 2).length,
    selected: students.filter((s) => s.teamId && selectedTeamSet.has(s.teamId)).length,
    approved: students.filter((s) => s.teamId && approvedTeamSet.has(s.teamId)).length,
  };

  const dropoff = {
    unregisteredGroup: stage.total - stage.groupRegistered,
    unregisteredSkills: stage.groupRegistered - stage.skillsRegistered,
    notInTeam: stage.skillsRegistered - stage.inTeam,
    underSizedTeam: stage.inTeam - stage.teamAtMinSize,
    unselectedProject: stage.teamAtMinSize - stage.selected,
    pendingApproval: stage.selected - stage.approved,
  };

  return { stage, dropoff };
}

export async function formationHealth(organizationId: string) {
  const teams = await prisma.team.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      groupCode: true,
      leadId: true,
      maxMembers: true,
      _count: { select: { teamMembers: true, invites: true } },
    },
  });

  const underFilled = teams.filter((t) => t._count.teamMembers < t.maxMembers);
  const captainOnly = teams.filter((t) => t.leadId && t._count.teamMembers <= 1);

  const orphanStudents = await prisma.user.findMany({
    where: { organizationId, role: 'STUDENT', teamId: null },
    select: { id: true, fullName: true, email: true },
  });

  const pendingInvites = await prisma.teamInvite.findMany({
    where: { team: { organizationId }, status: 'pending' },
    select: { id: true, teamId: true, email: true },
  });

  return {
    underFilled: underFilled.map((t) => ({ id: t.id, name: t.name, current: t._count.teamMembers, max: t.maxMembers })),
    captainOnly: captainOnly.map((t) => ({ id: t.id, name: t.name, leadId: t.leadId })),
    orphanStudents,
    pendingInvitesCount: pendingInvites.length,
  };
}

export async function cohortSegmentation(
  organizationId: string,
  dimension: 'department' | 'deptCode' | 'cluster' | 'year' | 'gender' | 'resident' | 'ssgDomain'
) {
  const students = await prisma.user.findMany({
    where: { organizationId, role: 'STUDENT' },
    select: {
      id: true,
      department: true,
      deptCode: true,
      cluster: true,
      year: true,
      gender: true,
      resident: true,
      ssgDomain: true,
      githubUsername: true,
      teamId: true,
    },
  });

  const segmentMap = new Map<string, typeof students>();
  for (const s of students) {
    const rawVal = (s as any)[dimension];
    const key = rawVal ? String(rawVal) : 'Unspecified';
    if (!segmentMap.has(key)) segmentMap.set(key, []);
    segmentMap.get(key)!.push(s);
  }

  const segmentStats: Array<{
    segment: string;
    studentCount: number;
    githubLinkedPct: number;
    inTeamPct: number;
  }> = [];

  for (const [segment, members] of segmentMap.entries()) {
    const total = members.length;
    const githubLinked = members.filter((m) => Boolean(m.githubUsername)).length;
    const inTeam = members.filter((m) => Boolean(m.teamId)).length;

    segmentStats.push({
      segment,
      studentCount: total,
      githubLinkedPct: Math.round((githubLinked / total) * 100),
      inTeamPct: Math.round((inTeam / total) * 100),
    });
  }

  const studentCounts = segmentStats.map((s) => s.studentCount);
  const resultWithZ = segmentStats.map((s) => ({
    ...s,
    zScore: zScore(s.studentCount, studentCounts),
    isOutlier: Math.abs(zScore(s.studentCount, studentCounts)) >= 1.96,
  }));

  return { dimension, segments: resultWithZ };
}

export async function earlyWarningBoard(organizationId: string) {
  const projects = await prisma.project.findMany({
    where: { organizationId, isTemplate: false, status: { in: ['active', 'pending_approval', 'planned'] } },
    select: { id: true, name: true, teamId: true },
  });

  const rankings: Array<{
    projectId: string;
    projectName: string;
    riskScore: number;
    riskBand: 'GREEN' | 'AMBER' | 'RED';
    drivers: string[];
  }> = [];

  for (const p of projects) {
    // Real inputs from lifecycle state, daily logs, GitHub commits and task
    // workload — NOT a shared hardcoded RiskInput. See riskInputBuilder.ts:
    // the previous version passed percentTimeElapsed/percentMilestonesDone/
    // commitVelocityTrend/openFlagSeverity/contributionGini as the same fixed
    // constants for every project, so only logComplianceRate genuinely
    // differed between rows on this board.
    const riskInput = await buildRiskInputForProject(p.id);
    const risk = teamRisk(riskInput);

    rankings.push({
      projectId: p.id,
      projectName: p.name,
      riskScore: risk.score,
      riskBand: risk.band,
      drivers: risk.drivers,
    });
  }

  rankings.sort((a, b) => b.riskScore - a.riskScore);
  return { board: rankings, totalActive: projects.length };
}

export async function catalogDemand(organizationId: string) {
  const templates = await prisma.project.findMany({
    where: { organizationId, isTemplate: true, status: 'CATALOG' },
    select: {
      id: true,
      shortName: true,
      name: true,
      domain: true,
      sector: true,
      _count: { select: { childProjects: true } },
    },
  });

  const counts = templates.map((t) => t._count.childProjects);
  const hhi = concentrationHHI(counts);

  const mostChosen = [...templates]
    .sort((a, b) => b._count.childProjects - a._count.childProjects)
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.shortName || t.name, count: t._count.childProjects }));

  const zeroDemandDomains = Array.from(
    new Set(
      templates
        .filter((t) => t._count.childProjects === 0 && t.domain)
        .map((t) => t.domain!)
    )
  );

  const nearFull = templates
    .filter((t) => availability(t._count.childProjects).slotsLeft <= 1)
    .map((t) => ({ id: t.id, name: t.shortName || t.name, slotsLeft: availability(t._count.childProjects).slotsLeft }));

  return {
    concentrationHHI: hhi,
    mostChosen,
    zeroDemandDomains,
    nearFull,
  };
}

export async function cohortRoiReport(organizationId: string) {
  const funnel = await onboardingFunnel(organizationId);
  const demand = await catalogDemand(organizationId);
  const interventions = await analyzeInterventionEffectiveness(organizationId);

  // Real proportion of evaluation reports that were genuine AI evaluations
  // rather than the degraded `isFallback` fallback path — replaces a
  // hardcoded `92` that was returned regardless of actual data.
  const [totalReports, fallbackReports] = await Promise.all([
    prisma.evaluationReport.count({ where: { project: { organizationId } } }),
    prisma.evaluationReport.count({ where: { project: { organizationId }, isFallback: true } }),
  ]);
  const evidenceBackedScorePct = totalReports > 0
    ? Math.round(((totalReports - fallbackReports) / totalReports) * 100)
    : null;

  return {
    onboardingCompletionRatePct: Math.round((funnel.stage.approved / Math.max(1, funnel.stage.total)) * 100),
    catalogDemandHHI: demand.concentrationHHI,
    interventionSuccessRatePct: interventions.successRatePct,
    averageRiskReduction: interventions.averageRiskDelta,
    evidenceBackedScorePct,
    // No dispute-tracking table exists yet (a student contesting a grade is
    // not currently recorded anywhere) — return null rather than a fabricated
    // rate. Add an EvaluationDispute table before surfacing this for real.
    disputeRatePct: null,
  };
}

/**
 * Persists any of the six cohort report payloads above as a
 * CohortMetricSnapshot, keyed to a 24h period bucket so repeated calls within
 * the same day update one row instead of accumulating duplicates. This is
 * additive-only: callers should still use the live return value from the
 * report function for the response, and treat this as a fire-and-forget
 * side effect for trend history and org-wide analytics.
 */
export async function snapshotCohortReport(
  organizationId: string,
  reportKind: CohortReportKind,
  payload: Prisma.InputJsonValue,
  options: { cohortKey?: string; sampleSize?: number; computeRunId?: string } = {},
) {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 1);
  // "" is the "no sub-cohort dimension" sentinel — see the schema comment on
  // CohortMetricSnapshot.cohortKey for why this can't be null.
  const cohortKey = options.cohortKey ?? '';

  return prisma.cohortMetricSnapshot.upsert({
    where: {
      organizationId_reportKind_cohortKey_periodStart: {
        organizationId,
        reportKind,
        cohortKey,
        periodStart,
      },
    },
    create: {
      organizationId,
      reportKind,
      cohortKey,
      periodStart,
      periodEnd,
      payload,
      sampleSize: options.sampleSize ?? 0,
      computeRunId: options.computeRunId,
    },
    update: {
      payload,
      sampleSize: options.sampleSize ?? 0,
      computeRunId: options.computeRunId,
      computedAt: now,
    },
  });
}
