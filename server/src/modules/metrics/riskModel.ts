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

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function topDrivers(components: RiskResult['components']): string[] {
  const drivers: Array<{ name: string; score: number }> = [
    { name: 'Milestone slippage (behind timeline)', score: components.slippage * RISK_WEIGHTS.slip },
    { name: 'Low daily log compliance rate', score: components.logNonCompliance * RISK_WEIGHTS.logs },
    { name: 'Open project flags / blockers', score: components.flagSeverity * RISK_WEIGHTS.flags },
    { name: 'Declining commit velocity', score: components.commitDrop * RISK_WEIGHTS.commits },
    { name: 'Uneven member contribution distribution', score: components.contributionImbalance * RISK_WEIGHTS.fairness },
  ];

  return drivers
    .sort((a, b) => b.score - a.score)
    .filter((d) => d.score > 0.05)
    .map((d) => `${d.name} (${Math.round(d.score * 100)}% risk weight)`);
}

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
  const band: 'GREEN' | 'AMBER' | 'RED' = score >= 66 ? 'RED' : score >= 33 ? 'AMBER' : 'GREEN';

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
 * Offline calibration harness for V2 backtesting.
 * Replays early-cycle risk inputs against historical final project outcomes.
 */
export function calibrateRiskModel(
  records: Array<{ earlyInput: RiskInput; actuallyFailed: boolean }>,
) {
  if (records.length === 0) {
    return { precision: 0, recall: 0, f1Score: 0, sampleSize: 0, redThreshold: 66 };
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
    redThreshold: 66,
  };
}
