import { prisma } from '../../shared/database';
import { median, percentileRank, stdev, zScore } from '../../shared/statistics';

// Below this population size a percentile/z-score is not statistically meaningful
// (design doc §17.2 M-5) — the cohort is too small to say where a value sits.
export const MIN_COHORT_SIZE = 5;

export interface BenchmarkContext {
  value: number;
  cohortMedian: number;
  percentile: number;
  zScore: number;
  isOutlier: boolean;
  anomalyType?: 'HIGH_OUTLIER' | 'LOW_OUTLIER';
  /**
   * True when `population` had fewer than MIN_COHORT_SIZE members. Callers must
   * suppress percentile/outlier badges when this is true instead of rendering a
   * fabricated "average performer" verdict — this field is the fix for the
   * defect where an empty cohort silently returned percentile: 50, zScore: 0.
   */
  insufficientData: boolean;
}

/**
 * Wraps a single metric value within a cohort population distribution.
 * Implements relative anomaly detection (deviates by zScore > 1.96 or < -1.96).
 *
 * Returns `insufficientData: true` (with the raw value as a neutral placeholder,
 * never a confident-looking percentile) when the population is too small to be
 * statistically meaningful. Callers MUST check this flag before displaying the
 * percentile/outlier fields.
 */
export function wrapBenchmark(value: number, population: number[]): BenchmarkContext {
  if (population.length < MIN_COHORT_SIZE) {
    return {
      value,
      cohortMedian: value,
      percentile: 50,
      zScore: 0,
      isOutlier: false,
      insufficientData: true,
    };
  }

  const cohortMedian = median(population);
  const percentile = percentileRank(value, population);
  const z = zScore(value, population);
  const isOutlier = Math.abs(z) >= 1.96;

  let anomalyType: BenchmarkContext['anomalyType'] = undefined;
  if (isOutlier) {
    anomalyType = z > 0 ? 'HIGH_OUTLIER' : 'LOW_OUTLIER';
  }

  return {
    value,
    cohortMedian: Number(cohortMedian.toFixed(2)),
    percentile,
    zScore: z,
    isOutlier,
    anomalyType,
    insufficientData: false,
  };
}

/**
 * Computes and persists the population distribution behind a cohort's benchmark
 * for one metric definition, so two requests reading the same percentile in the
 * same window get the same number (the distribution is stored, not recomputed
 * per read). Idempotent per (organizationId, definitionId, cohortKey, periodStart)
 * via the schema's unique constraint — safe to re-run.
 */
export async function persistCohortBenchmark(params: {
  organizationId: string;
  definitionId: string;
  cohortKey: string;
  periodStart: Date;
  periodEnd: Date;
  population: number[];
  computeRunId?: string;
}) {
  const { organizationId, definitionId, cohortKey, periodStart, periodEnd, population, computeRunId } = params;
  const insufficientData = population.length < MIN_COHORT_SIZE;
  const safePopulation = population.length > 0 ? population : [0];

  const sorted = [...safePopulation].sort((a, b) => a - b);
  const mean = safePopulation.reduce((a, b) => a + b, 0) / safePopulation.length;
  const p = (pct: number) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
    return sorted[idx];
  };

  return prisma.cohortBenchmark.upsert({
    where: {
      organizationId_definitionId_cohortKey_periodStart: {
        organizationId,
        definitionId,
        cohortKey,
        periodStart,
      },
    },
    create: {
      organizationId,
      definitionId,
      cohortKey,
      periodStart,
      periodEnd,
      populationSize: population.length,
      median: median(safePopulation),
      mean,
      stdDev: stdev(safePopulation),
      p25: p(25),
      p75: p(75),
      p90: p(90),
      insufficientData,
      computeRunId,
    },
    update: {
      periodEnd,
      populationSize: population.length,
      median: median(safePopulation),
      mean,
      stdDev: stdev(safePopulation),
      p25: p(25),
      p75: p(75),
      p90: p(90),
      insufficientData,
      computeRunId,
      computedAt: new Date(),
    },
  });
}
