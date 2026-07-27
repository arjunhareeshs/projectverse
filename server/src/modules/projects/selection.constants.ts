/**
 * Single source of truth for statement catalog capacity and scarcity calculation.
 * Prevents drift between card display and submission checks (G2).
 */
export const MAX_TEAMS_PER_STATEMENT = 4;

export interface AvailabilityInfo {
  slotsLeft: number;
  status: 'FULL' | 'FILLING_FAST' | 'OPEN';
}

export function availability(childCount: number): AvailabilityInfo {
  const slotsLeft = Math.max(0, MAX_TEAMS_PER_STATEMENT - childCount);
  const status: AvailabilityInfo['status'] =
    slotsLeft === 0 ? 'FULL' : slotsLeft <= 1 ? 'FILLING_FAST' : 'OPEN';

  return { slotsLeft, status };
}
