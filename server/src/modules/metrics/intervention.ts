import { prisma } from '../../shared/database';
import type { InterventionKind, InterventionOutcome } from '@prisma/client';

export interface InterventionRecord {
  id: string;
  projectId: string;
  kind: InterventionKind;
  loggedAt: string;
  actorUserId: string;
  followUpDueAt: string;
  riskDelta: number | null;
  outcome: InterventionOutcome;
}

export interface InterventionEffectivenessReport {
  totalInterventions: number;
  measuredInterventions: number;
  pendingInterventions: number;
  averageRiskDelta: number | null;
  successRatePct: number | null;
  byKind: Record<string, { count: number; measuredCount: number; avgRiskDelta: number | null; successRatePct: number | null }>;
}

const FOLLOW_UP_WINDOW_DAYS = 14;

/**
 * Logs a staff intervention against a project and schedules its 14-day
 * follow-up. `baselineRiskScoreId` should be the most recent
 * ProjectRiskScore for the project at the moment of the intervention, if one
 * exists — pass undefined when none has been computed yet; the follow-up job
 * will still run but riskDelta will stay null (INCONCLUSIVE) rather than being
 * measured against a missing baseline.
 */
export async function logIntervention(params: {
  projectId: string;
  organizationId: string;
  actorUserId: string;
  kind: InterventionKind;
  note?: string;
  baselineRiskScoreId?: string;
}) {
  const followUpDueAt = new Date();
  followUpDueAt.setDate(followUpDueAt.getDate() + FOLLOW_UP_WINDOW_DAYS);

  return prisma.intervention.create({
    data: {
      projectId: params.projectId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      kind: params.kind,
      note: params.note,
      baselineRiskScoreId: params.baselineRiskScoreId,
      followUpDueAt,
    },
  });
}

/**
 * Resolves interventions whose 14-day follow-up window has elapsed: attaches
 * the nearest ProjectRiskScore at/after `followUpDueAt` as the follow-up
 * score and computes riskDelta = baseline.score - followUp.score (positive =
 * risk reduced). An intervention with no baseline score, or for which no
 * follow-up score has been computed yet, is marked INCONCLUSIVE rather than
 * defaulted — this is the fix for the bug where a missing score used to be
 * silently replaced with hardcoded 50/40 values (guaranteeing a fake "risk
 * reduced" result on every unmeasured intervention).
 *
 * Intended to run from the nightly metrics scheduler, not per-request.
 */
export async function resolvePendingInterventions(now: Date = new Date()) {
  const due = await prisma.intervention.findMany({
    where: { outcome: 'PENDING', followUpDueAt: { lte: now } },
    include: { baselineRiskScore: true },
  });

  let resolved = 0;
  for (const intervention of due) {
    if (!intervention.baselineRiskScore) {
      await prisma.intervention.update({
        where: { id: intervention.id },
        data: { outcome: 'INCONCLUSIVE' },
      });
      resolved++;
      continue;
    }

    const followUp = await prisma.projectRiskScore.findFirst({
      where: { projectId: intervention.projectId, computedAt: { gte: intervention.followUpDueAt } },
      orderBy: { computedAt: 'asc' },
    });

    if (!followUp) {
      // Follow-up window elapsed but no risk score has been computed since —
      // leave PENDING; the nightly risk job will catch up and a later run of
      // this resolver will complete it. Do NOT fabricate a score here.
      continue;
    }

    const riskDelta = intervention.baselineRiskScore.score - followUp.score;
    const outcome: InterventionOutcome =
      riskDelta > 5 ? 'IMPROVED' : riskDelta < -5 ? 'WORSENED' : 'UNCHANGED';

    await prisma.intervention.update({
      where: { id: intervention.id },
      data: { followUpRiskScoreId: followUp.id, riskDelta, outcome },
    });
    resolved++;
  }

  return { checked: due.length, resolved };
}

/**
 * Summarizes intervention effectiveness by organization, using only measured
 * (non-PENDING, non-INCONCLUSIVE) interventions for the rate/delta averages.
 * Unmeasured interventions are reported separately (`pendingInterventions`)
 * instead of being silently excluded or defaulted into the success rate.
 */
export async function analyzeInterventionEffectiveness(
  organizationId: string,
): Promise<InterventionEffectivenessReport> {
  const interventions = await prisma.intervention.findMany({
    where: { organizationId },
    orderBy: { loggedAt: 'asc' },
  });

  const pendingInterventions = interventions.filter(
    (i) => i.outcome === 'PENDING' || i.outcome === 'INCONCLUSIVE',
  ).length;
  const measured = interventions.filter((i) => i.riskDelta !== null);

  if (measured.length === 0) {
    return {
      totalInterventions: interventions.length,
      measuredInterventions: 0,
      pendingInterventions,
      averageRiskDelta: null,
      successRatePct: null,
      byKind: {},
    };
  }

  const averageRiskDelta =
    measured.reduce((sum, i) => sum + (i.riskDelta as number), 0) / measured.length;
  const successCount = measured.filter((i) => i.outcome === 'IMPROVED').length;
  const successRatePct = (successCount / measured.length) * 100;

  const byKind: InterventionEffectivenessReport['byKind'] = {};
  for (const kind of new Set(interventions.map((i) => i.kind))) {
    const kindMeasured = measured.filter((i) => i.kind === kind);
    const kindAll = interventions.filter((i) => i.kind === kind);
    if (kindMeasured.length === 0) {
      byKind[kind] = { count: kindAll.length, measuredCount: 0, avgRiskDelta: null, successRatePct: null };
      continue;
    }
    const kindSuccess = kindMeasured.filter((i) => i.outcome === 'IMPROVED').length;
    byKind[kind] = {
      count: kindAll.length,
      measuredCount: kindMeasured.length,
      avgRiskDelta: Number(
        (kindMeasured.reduce((sum, i) => sum + (i.riskDelta as number), 0) / kindMeasured.length).toFixed(2),
      ),
      successRatePct: Number(((kindSuccess / kindMeasured.length) * 100).toFixed(1)),
    };
  }

  return {
    totalInterventions: interventions.length,
    measuredInterventions: measured.length,
    pendingInterventions,
    averageRiskDelta: Number(averageRiskDelta.toFixed(2)),
    successRatePct: Number(successRatePct.toFixed(1)),
    byKind,
  };
}
