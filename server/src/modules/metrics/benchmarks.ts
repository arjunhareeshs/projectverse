import { median, percentileRank, zScore } from '../../shared/statistics';

export interface BenchmarkContext {
  value: number;
  cohortMedian: number;
  percentile: number;
  zScore: number;
  isOutlier: boolean;
  anomalyType?: 'HIGH_OUTLIER' | 'LOW_OUTLIER';
}

/**
 * Wraps a single metric value within a cohort population distribution.
 * Implements V4 relative anomaly detection (deviates by zScore > 1.96 or < -1.96).
 */
export function wrapBenchmark(
  value: number,
  population: number[],
): BenchmarkContext {
  if (population.length === 0) {
    return {
      value,
      cohortMedian: value,
      percentile: 50,
      zScore: 0,
      isOutlier: false,
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
  };
}
