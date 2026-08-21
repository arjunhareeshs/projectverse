import { prisma } from '../../shared/database';

export interface RiskInput {
  percentTimeElapsed: number;       // 0 - 100
  percentMilestonesDone: number;    // 0 - 100
  logComplianceRate: number;        // 0 - 1 (logs submitted / expected days)
  commitVelocityTrend: number;      // -1 to 1 (recent vs baseline change ratio)
  openFlagSeverity: number;          // 0 - 1 (normalized open flag severity score)
  contributionGini: number;         // 0 - 1 (fairness Gini coefficient)
}

export interface RiskResult {
  score: number;
  band: 'GREEN' | 'AMBER' | 'RED';
  drivers: string[];
  components: {
    slippage: number;
    logNonCompliance: number;
    commitDrop: number;
    flagSeverity: number;
    contributionImbalance: number;
  };
}

export const RISK_WEIGHTS = {
  slip: 0.30,
  logs: 0.25,
  commits: 0.15,
  flags: 0.20,
  fairness: 0.10,
} as const;

// Matches RISK_WEIGHTS / the band cutoffs below — getActiveRiskModel() below
// auto-seeds RiskModelVersion v1 from these exact constants on first use. If
// these constants are ever retuned, create a NEW RiskModelVersion row rather
// than editing v1 in place, so historical ProjectRiskScore rows stay
// reproducible against the model version that actually produced them.
export const RISK_BAND_THRESHOLDS = { amber: 33, red: 66 } as const;

export type RiskDriverKey =
  | 'MILESTONE_SLIPPAGE'
  | 'LOG_NONCOMPLIANCE'
  | 'OPEN_FLAGS'
  | 'COMMIT_DECLINE'
  | 'CONTRIBUTION_IMBALANCE';

interface DriverBreakdownEntry {
  key: RiskDriverKey;
  label: string;
  weightedScore: number;
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function driverBreakdown(components: RiskResult['components']): DriverBreakdownEntry[] {
  const entries: DriverBreakdownEntry[] = [
    { key: 'MILESTONE_SLIPPAGE', label: 'Milestone slippage (behind timeline)', weightedScore: components.slippage * RISK_WEIGHTS.slip },
    { key: 'LOG_NONCOMPLIANCE', label: 'Low daily log compliance rate', weightedScore: components.logNonCompliance * RISK_WEIGHTS.logs },
    { key: 'OPEN_FLAGS', label: 'Open project flags / blockers', weightedScore: components.flagSeverity * RISK_WEIGHTS.flags },
    { key: 'COMMIT_DECLINE', label: 'Declining commit velocity', weightedScore: components.commitDrop * RISK_WEIGHTS.commits },
    { key: 'CONTRIBUTION_IMBALANCE', label: 'Uneven member contribution distribution', weightedScore: components.contributionImbalance * RISK_WEIGHTS.fairness },
  ];
  return entries.sort((a, b) => b.weightedScore - a.weightedScore);
}

function topDrivers(components: RiskResult['components']): string[] {
  return driverBreakdown(components)
    .filter((d) => d.weightedScore > 0.05)
    .map((d) => `${d.label} (${Math.round(d.weightedScore * 100)}% risk weight)`);
}

/**
 * Pure risk-scoring function. Deliberately has no side effects and no database
 * access — callers that need the score persisted (for trend analysis, the
 * early-warning board, or intervention effectiveness) must go through
 * `computeAndPersistProjectRisk` below, which wraps this with storage.
 */
export function teamRisk(i: RiskInput): RiskResult {
  const slip = clamp01((i.percentTimeElapsed - i.percentMilestonesDone) / 100);
  const logNonCompliance = clamp01(1 - i.logComplianceRate);
  const commitDrop = clamp01(1 - clamp01((i.commitVelocityTrend + 1) / 2));
  const flagSeverity = clamp01(i.openFlagSeverity);
  const contributionImbalance = clamp01(i.contributionGini);

  const rawScore = 100 * (
    RISK_WEIGHTS.slip * slip +
    RISK_WEIGHTS.logs * logNonCompliance +
    RISK_WEIGHTS.commits * commitDrop +
    RISK_WEIGHTS.flags * flagSeverity +
    RISK_WEIGHTS.fairness * contributionImbalance
  );

  const score = Math.round(rawScore);
  const band: 'GREEN' | 'AMBER' | 'RED' =
    score >= RISK_BAND_THRESHOLDS.red ? 'RED' : score >= RISK_BAND_THRESHOLDS.amber ? 'AMBER' : 'GREEN';

  const components = {
    slippage: Number(slip.toFixed(2)),
    logNonCompliance: Number(logNonCompliance.toFixed(2)),
    commitDrop: Number(commitDrop.toFixed(2)),
    flagSeverity: Number(flagSeverity.toFixed(2)),
    contributionImbalance: Number(contributionImbalance.toFixed(2)),
  };

  const drivers = topDrivers(components);

  return { score, band, drivers, components };
}

/**
 * Offline calibration harness for backtesting.
 * Replays early-cycle risk inputs against historical final project outcomes.
 */
export function calibrateRiskModel(
  records: Array<{ earlyInput: RiskInput; actuallyFailed: boolean }>,
) {
  if (records.length === 0) {
    return { precision: 0, recall: 0, f1Score: 0, sampleSize: 0, redThreshold: RISK_BAND_THRESHOLDS.red };
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const rec of records) {
    const res = teamRisk(rec.earlyInput);
    const predictedRed = res.band === 'RED';

    if (predictedRed && rec.actuallyFailed) truePositives++;
    if (predictedRed && !rec.actuallyFailed) falsePositives++;
    if (!predictedRed && rec.actuallyFailed) falseNegatives++;
  }

  const precision = truePositives + falsePositives > 0
    ? truePositives / (truePositives + falsePositives)
    : 0;

  const recall = truePositives + falseNegatives > 0
    ? truePositives / (truePositives + falseNegatives)
    : 0;

  const f1Score = precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  return {
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f1Score: Number(f1Score.toFixed(2)),
    sampleSize: records.length,
    redThreshold: RISK_BAND_THRESHOLDS.red,
  };
}

/**
 * Returns the RiskModelVersion currently in force. Falls back to seeding v1
 * from RISK_WEIGHTS/RISK_BAND_THRESHOLDS if no version row exists yet, so a
 * fresh environment (or one where the seed script hasn't run) never throws —
 * it just self-heals to the model the pure function already implements.
 *
 * Uses upsert on the unique `version` column rather than a plain create, so
 * two concurrent first-callers (e.g. an admin-triggered compute racing the
 * nightly scheduler on a brand-new environment) don't both try to insert
 * version 1 and have the loser crash on a unique-constraint violation.
 */
export async function getActiveRiskModel() {
  const active = await prisma.riskModelVersion.findFirst({ where: { isActive: true } });
  if (active) return active;

  return prisma.riskModelVersion.upsert({
    where: { version: 1 },
    create: {
      version: 1,
      weightSlip: RISK_WEIGHTS.slip,
      weightLogs: RISK_WEIGHTS.logs,
      weightCommits: RISK_WEIGHTS.commits,
      weightFlags: RISK_WEIGHTS.flags,
      weightFairness: RISK_WEIGHTS.fairness,
      amberThreshold: RISK_BAND_THRESHOLDS.amber,
      redThreshold: RISK_BAND_THRESHOLDS.red,
      isActive: true,
      notes: 'Auto-seeded from the live RISK_WEIGHTS constants at first use.',
    },
    // If version 1 already exists (the race we just lost), it's already the
    // active model from RISK_WEIGHTS — nothing to change on the update path.
    update: {},
  });
}

/**
 * Computes a risk score with `teamRisk` and persists it as a ProjectRiskScore
 * row, carrying the exact inputs, components, and the model version used —
 * so the score stays reproducible and auditable after a recalibration. Also
 * writes the normalized top-driver rows for `ProjectRiskDriver` queries like
 * "what's the most common risk driver this term".
 *
 * Never call `teamRisk` directly when the score needs to be shown as a trend,
 * used by the early-warning board, or referenced by an Intervention — those
 * all depend on this function's persisted output.
 */
export async function computeAndPersistProjectRisk(
  projectId: string,
  input: RiskInput,
  computeRunId?: string,
) {
  const result = teamRisk(input);
  const modelVersion = await getActiveRiskModel();
  const breakdown = driverBreakdown(result.components);

  const riskScore = await prisma.projectRiskScore.create({
    data: {
      projectId,
      modelVersionId: modelVersion.id,
      score: result.score,
      band: result.band,
      percentTimeElapsed: input.percentTimeElapsed,
      percentMilestonesDone: input.percentMilestonesDone,
      logComplianceRate: input.logComplianceRate,
      commitVelocityTrend: input.commitVelocityTrend,
      openFlagSeverity: input.openFlagSeverity,
      contributionGini: input.contributionGini,
      slippage: result.components.slippage,
      logNonCompliance: result.components.logNonCompliance,
      commitDrop: result.components.commitDrop,
      flagSeverity: result.components.flagSeverity,
      contributionImbalance: result.components.contributionImbalance,
      computeRunId,
      drivers: {
        create: breakdown
          .filter((d) => d.weightedScore > 0.05)
          .map((d, idx) => ({
            driverKey: d.key,
            weightPct: Math.round(d.weightedScore * 100),
            rank: idx + 1,
          })),
      },
    },
    include: { drivers: true },
  });

  return { result, riskScore };
}
