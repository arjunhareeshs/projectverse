/**
 * Statistical primitives for cohort metrics, benchmark calculations,
 * and concentration measurements.
 */

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentileRank(value: number, population: number[]): number {
  if (population.length === 0) return 50;
  const below = population.filter((x) => x < value).length;
  const equal = population.filter((x) => x === value).length;
  const rank = ((below + 0.5 * equal) / population.length) * 100;
  return Math.round(Math.max(0, Math.min(100, rank)));
}

export function stdev(xs: number[]): number {
  if (xs.length <= 1) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / xs.length;
  return Math.sqrt(variance);
}

export function zScore(value: number, population: number[]): number {
  if (population.length === 0) return 0;
  const mean = population.reduce((a, b) => a + b, 0) / population.length;
  const sd = stdev(population);
  if (sd === 0) return 0;
  const score = (value - mean) / sd;
  return Number(score.toFixed(2));
}

/**
 * Herfindahl–Hirschman Index (HHI) of demand concentration.
 * Used for catalog demand analysis (I5).
 * Range: 0 to 1 (close to 1 = extreme concentration / herding on few statements).
 */
export function concentrationHHI(selectionCounts: number[]): number {
  const total = selectionCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const hhi = selectionCounts.reduce((acc, c) => acc + Math.pow(c / total, 2), 0);
  return Number(hhi.toFixed(4));
}
