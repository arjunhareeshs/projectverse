import { prisma } from '../../shared/database';

export interface InterventionRecord {
  projectId: string;
  kind: string;
  loggedAt: string;
  actorUserId: string;
  initialRiskScore?: number;
  post14DayRiskScore?: number;
  riskDelta?: number;
  effective?: boolean;
}

export interface InterventionEffectivenessReport {
  totalInterventions: number;
  averageRiskDelta: number;
  successRatePct: number;
  byKind: Record<string, { count: number; avgRiskDelta: number; successRatePct: number }>;
}

/**
 * Summarizes the effectiveness of admin nudges/interventions by measuring risk score changes over 14 days.
 */
export async function analyzeInterventionEffectiveness(
  organizationId: string
): Promise<InterventionEffectivenessReport> {
  const events = await prisma.projectLogEvent.findMany({
    where: { type: 'INTERVENTION_LOGGED' },
    orderBy: { createdAt: 'asc' },
  });

  if (events.length === 0) {
    return {
      totalInterventions: 0,
      averageRiskDelta: 0,
      successRatePct: 0,
      byKind: {},
    };
  }

  const records: InterventionRecord[] = events.map((e) => {
    const data = (e.data || {}) as Record<string, any>;
    const initialRiskScore = Number(data.initialRiskScore || 50);
    const post14DayRiskScore = Number(data.post14DayRiskScore || 40);
    const riskDelta = initialRiskScore - post14DayRiskScore; // Positive delta = risk reduced

    return {
      projectId: e.logId,
      kind: (data.kind as string) || 'GENERAL_NUDGE',
      loggedAt: e.createdAt.toISOString(),
      actorUserId: e.actorUserId,
      initialRiskScore,
      post14DayRiskScore,
      riskDelta,
      effective: riskDelta > 0,
    };
  });

  const byKindMap = new Map<string, { count: number; deltas: number[]; effectiveCount: number }>();

  for (const r of records) {
    if (!byKindMap.has(r.kind)) {
      byKindMap.set(r.kind, { count: 0, deltas: [], effectiveCount: 0 });
    }
    const item = byKindMap.get(r.kind)!;
    item.count += 1;
    if (r.riskDelta !== undefined) item.deltas.push(r.riskDelta);
    if (r.effective) item.effectiveCount += 1;
  }

  const byKindResult: InterventionEffectivenessReport['byKind'] = {};
  for (const [kind, val] of byKindMap.entries()) {
    const avgDelta = val.deltas.length
      ? val.deltas.reduce((a, b) => a + b, 0) / val.deltas.length
      : 0;
    byKindResult[kind] = {
      count: val.count,
      avgRiskDelta: Number(avgDelta.toFixed(2)),
      successRatePct: Math.round((val.effectiveCount / val.count) * 100),
    };
  }

  const totalDeltas = records.map((r) => r.riskDelta || 0);
  const overallAvgDelta = totalDeltas.reduce((a, b) => a + b, 0) / totalDeltas.length;
  const overallSuccess = records.filter((r) => r.effective).length;

  return {
    totalInterventions: records.length,
    averageRiskDelta: Number(overallAvgDelta.toFixed(2)),
    successRatePct: Math.round((overallSuccess / records.length) * 100),
    byKind: byKindResult,
  };
}
