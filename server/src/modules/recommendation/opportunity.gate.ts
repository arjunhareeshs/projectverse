import { evaluateStandoutGate, type GateEvaluationInput, type GateResult } from '../insights/standout/gate';

/**
 * Additional thresholds specific to opportunity matching.
 * The base standout gate thresholds are already enforced by `evaluateStandoutGate`.
 */
export const OPPORTUNITY_THRESHOLDS = {
  /** evidenceScore required to be eligible for hackathon recommendations */
  HACKATHON_EVIDENCE_MIN: 70,
  /** evidenceScore required to be eligible for incubation recommendations */
  INCUBATION_EVIDENCE_MIN: 80,
  /** cycle count required for incubation eligibility */
  INCUBATION_CYCLES_MIN: 4,
  // Presentation only requires passing the base standout gate
} as const;

export interface OpportunityGateInput extends GateEvaluationInput {
  /** Project's domain/category string — must be non-empty to build a useful search query */
  domain: string | null;
  /** List of technologies used — at least one required */
  technologies: string[];
  /** Problem statement text — must be non-empty */
  problemStatement: string | null;
}

export interface OpportunityEligibility {
  hackathon: boolean;
  presentation: boolean;
  incubation: boolean;
}

export interface OpportunityGateResult {
  /** Underlying standout gate result */
  gate: GateResult;
  /** Did the project pass the base standout gate at all? */
  baseGatePassed: boolean;
  /** Is there sufficient project context to build a meaningful search query? */
  hasSearchableContext: boolean;
  /** Per-dimension opportunity eligibility */
  eligibility: OpportunityEligibility;
  /** Human-readable reasons the project was skipped */
  skipReasons: string[];
}

/**
 * Evaluates whether a project is eligible for opportunity matching.
 *
 * Step 1: Run the shared standout gate (quality, authenticity, GitHub, etc.)
 * Step 2: Check that the project has enough context for LLM web-search queries.
 * Step 3: Determine per-dimension eligibility (hackathon / presentation / incubation).
 *
 * A project is only surfaced for opportunity matching if `baseGatePassed` is
 * true AND `hasSearchableContext` is true. Even then, the per-dimension flags
 * determine which opportunity categories are included in the LLM prompt.
 */
export function evaluateOpportunityGate(input: OpportunityGateInput): OpportunityGateResult {
  const gate = evaluateStandoutGate(input);
  const skipReasons: string[] = [...gate.failedReasons];

  // ── Context check ─────────────────────────────────────────────────────────
  const hasDomain = Boolean(input.domain && input.domain.trim().length > 0);
  const hasTechnologies = input.technologies.length > 0;
  const hasProblemStatement = Boolean(input.problemStatement && input.problemStatement.trim().length > 0);
  const hasSearchableContext = hasDomain && hasTechnologies && hasProblemStatement;

  if (!hasSearchableContext) {
    const missing: string[] = [];
    if (!hasDomain) missing.push('domain');
    if (!hasTechnologies) missing.push('technologies');
    if (!hasProblemStatement) missing.push('problemStatement');
    skipReasons.push(`Insufficient project context for opportunity search (missing: ${missing.join(', ')})`);
  }

  // ── Per-dimension eligibility ─────────────────────────────────────────────
  const { evidenceScore, cyclesEvaluated } = {
    evidenceScore: gate.evidenceScore,
    cyclesEvaluated: gate.metrics.cyclesEvaluated,
  };

  const hackathon =
    gate.passed &&
    hasSearchableContext &&
    evidenceScore >= OPPORTUNITY_THRESHOLDS.HACKATHON_EVIDENCE_MIN;

  const presentation = gate.passed && hasSearchableContext;

  const incubation =
    gate.passed &&
    hasSearchableContext &&
    evidenceScore >= OPPORTUNITY_THRESHOLDS.INCUBATION_EVIDENCE_MIN &&
    cyclesEvaluated >= OPPORTUNITY_THRESHOLDS.INCUBATION_CYCLES_MIN;

  return {
    gate,
    baseGatePassed: gate.passed,
    hasSearchableContext,
    eligibility: { hackathon, presentation, incubation },
    skipReasons,
  };
}
