/**
 * Gini coefficient of a non-negative distribution.
 * Range: 0 = perfectly even distribution, -> 1 = extreme inequality (one actor holds all).
 * Used for team contribution fairness calculation (commits, daily logs, tasks per member).
 */
export function giniCoefficient(values: number[]): number {
  const xs = values.filter((v) => v >= 0);
  const n = xs.length;
  if (n === 0) return 0;
  const total = xs.reduce((a, b) => a + b, 0);
  if (total === 0) return 0; // No activity at all -> treat as even, not unfair
  const sorted = [...xs].sort((a, b) => a - b);
  let cumWeighted = 0;
  sorted.forEach((v, i) => {
    cumWeighted += (i + 1) * v;
  });
  const gini = (2 * cumWeighted) / (n * total) - (n + 1) / n;
  return Math.max(0, Math.min(1, Number(gini.toFixed(4))));
}
