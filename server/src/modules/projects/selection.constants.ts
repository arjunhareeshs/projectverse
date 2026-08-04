/**
 * Single source of truth for statement catalog capacity and scarcity calculation.
 * Prevents drift between card display and submission checks (G2).
 */
export const MAX_TEAMS_PER_STATEMENT = 3;

/**
 * Jaccard similarity above which two teams' differentiation approaches are
 * considered duplicates. Shared by the AI preview's heuristic fallback
 * (checkApproachUniqueness) and the hard enforcement gate (selectProject) so
 * the two paths can never disagree on where the line is.
 */
export const APPROACH_OVERLAP_THRESHOLD = 0.45;

export interface AvailabilityInfo {
  slotsLeft: number;
  maxTeams: number;
  status: 'FULL' | 'FILLING_FAST' | 'OPEN';
}

export function availability(childCount: number, maxTeams: number = MAX_TEAMS_PER_STATEMENT): AvailabilityInfo {
  const cap = maxTeams ?? MAX_TEAMS_PER_STATEMENT;
  const slotsLeft = Math.max(0, cap - childCount);
  const status: AvailabilityInfo['status'] =
    slotsLeft === 0 ? 'FULL' : slotsLeft <= 1 ? 'FILLING_FAST' : 'OPEN';

  return { slotsLeft, maxTeams: cap, status };
}
