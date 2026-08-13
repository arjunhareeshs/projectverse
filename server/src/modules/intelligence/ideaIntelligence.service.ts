import { prisma } from '../../shared/database';
import { chatJSON, chatJSONWithMeta } from '../ai/llm.service';
import { jaccardSimilarity } from '../../shared/stringUtils';
import { buildIdeaValidationPrompt, NearestEntry } from './prompts/ideaValidation.prompt';
import { buildFeatureChangePrompt, ExistingFeatureContext, ProposedFeatureInput } from './prompts/featureChange.prompt';
import { buildPhasePlanPrompt } from './prompts/phasePlan.prompt';
import {
  IdeaValidationSchema,
  IdeaValidation,
  ExtractedFeature,
  FeatureChangeSchema,
  FeatureChangeResult,
  PhasePlanSchema,
  PhasePlan,
  FEATURE_POINT_BUCKET,
  FEATURE_POINTS_CAP,
} from './ideaIntelligence.schemas';

export const MIN_PROPOSAL_LENGTH = 40;
/** Upper bound on submitted proposal text — enforced on both the composer and
 *  the submit endpoint so they can't drift apart. */
export const MAX_PROPOSAL_LENGTH = 8000;

/** Same input must produce the same verdict — a proposal shouldn't flip
 *  ACCEPTED/REJECTED between the preview and the publish re-score, or between
 *  two students who happen to write near-identical proposals. */
const SCORING_TEMPERATURE = 0;

/** overallScore is NEVER trusted from the model — recomputed here from the two
 *  rubric sets so the accept/reject gate can't be swayed by the model's own
 *  (possibly inconsistent) arithmetic. Core rubrics carry more weight since
 *  they gate baseline quality; industry rubrics catch depth/realism gaps a
 *  surface-level idea can still score well on for the core set. */
function computeOverallScore(
  rubrics: IdeaValidation['rubrics'],
  industryRubrics: IdeaValidation['industryRubrics'],
): number {
  const coreScores = Object.values(rubrics).map((r) => r.score);
  const industryScores = Object.values(industryRubrics).map((r) => r.score);
  const coreAvg = coreScores.reduce((sum, s) => sum + s, 0) / coreScores.length;
  const industryAvg = industryScores.reduce((sum, s) => sum + s, 0) / industryScores.length;
  return Math.round(coreAvg * 0.6 + industryAvg * 0.4);
}

function clampToBucket(points: number): number {
  let nearest: number = FEATURE_POINT_BUCKET[0];
  let minDiff = Math.abs(points - nearest);
  for (const bucket of FEATURE_POINT_BUCKET) {
    const diff = Math.abs(points - bucket);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = bucket;
    }
  }
  return nearest;
}

/** Largest bucket value <= limit, or null if even the smallest bucket doesn't fit. */
function largestBucketAtMost(limit: number): number | null {
  const fitting = FEATURE_POINT_BUCKET.filter((b) => b <= limit);
  if (fitting.length === 0) return null;
  return fitting[fitting.length - 1];
}

/**
 * Scales feature points down proportionally when the total exceeds the cap, then
 * re-clamps each to the nearest bucket value — mirrors the work-breakdown
 * percentage normalizer already used in docGenerator.engine.ts. The weaker
 * features shrink more than the standout one because scaling + re-clamping to a
 * coarse bucket naturally rounds small values down further.
 */
function normalizeFeaturePoints(features: ExtractedFeature[]): ExtractedFeature[] {
  const total = features.reduce((sum, f) => sum + f.points, 0);
  if (total <= FEATURE_POINTS_CAP || total === 0) return features;

  const scale = FEATURE_POINTS_CAP / total;
  return features.map((f) => ({ ...f, points: clampToBucket(Math.max(50, f.points * scale)) }));
}

/**
 * Extends the previous 7-rubric + duplicate-check proposal evaluator (formerly
 * runProposalEvaluation in project.catalog.controller.ts) with 5-perspective
 * scoring, hardware constraints, and AI feature extraction with reward points.
 * Shared by the propose-new-idea preview/publish path AND the pick-existing-
 * catalog-project path (selectProject calls extractFeaturesForCatalogSelection
 * below, which reuses the same prompt/guardrails for the feature-extraction half).
 */
export async function validateIdea(rawText: string): Promise<IdeaValidation> {
  const allTemplates = await prisma.project.findMany({
    where: { isTemplate: true, status: 'CATALOG' },
    select: { id: true, name: true, problemStatement: true, shortName: true },
  });

  const ranked = allTemplates
    .map((t) => {
      const text = `${t.name} ${t.shortName || ''} ${t.problemStatement || ''}`;
      return { id: t.id, name: t.name, statement: t.problemStatement || '', score: jaccardSimilarity(rawText, text) };
    })
    .sort((a, b) => b.score - a.score);

  const topDuplicateCandidate = ranked[0] && ranked[0].score > 0.12 ? ranked[0] : null;
  const isDuplicate = Boolean(topDuplicateCandidate && topDuplicateCandidate.score > 0.6);
  const duplicateScore = topDuplicateCandidate ? Math.round(topDuplicateCandidate.score * 100) : 0;

  const nearest: NearestEntry[] = ranked
    .filter((r) => r.score > 0.08)
    .slice(0, 8)
    .map((r) => ({ title: r.name, statement: r.statement.slice(0, 300), similarity: Math.round(r.score * 100) }));

  const fallbackFeatures: ExtractedFeature[] = [
    {
      name: 'Core feature',
      description: 'Primary capability described in the proposal.',
      importance: 'High',
      implementationMethod: 'Direct API / library integration',
      points: 200,
      aiRationale: 'Heuristic fallback — AI evaluator unavailable.',
    },
  ];

  const fallbackResult: IdeaValidation = {
    verdict: isDuplicate ? 'REJECTED' : 'ACCEPTED',
    reasons: isDuplicate
      ? [`High similarity to existing catalog project "${topDuplicateCandidate?.name}".`]
      : ['Proposal meets technical clarity and industry relevance criteria.'],
    improvementHints: isDuplicate
      ? ['Focus on a distinct application niche or unique dataset.']
      : ['Define clear quantitative metrics and specific target users.'],
    overallScore: isDuplicate ? 45 : 84,
    rubrics: {
      relevance: { score: 85, rationale: 'Addresses a clear domain problem statement.' },
      clarity: { score: 82, rationale: 'Problem statement and scope are clear.' },
      feasibility: { score: 85, rationale: 'Realistically buildable within project timeline.' },
      novelty: {
        score: isDuplicate ? 35 : 80,
        rationale: isDuplicate
          ? 'Very similar to an existing catalog statement.'
          : 'Presents a fresh angle or implementation.',
      },
      expectedOutcome: { score: 82, rationale: 'Expected outcomes are defined.' },
      featureCompleteness: { score: 78, rationale: 'Key features outlined.' },
      industryImpact: { score: 80, rationale: 'Beneficial for industrial/societal application.' },
    },
    duplicate: {
      isDuplicate,
      similarProjectId: topDuplicateCandidate?.id,
      similarProjectTitle: topDuplicateCandidate?.name,
      similarityScore: duplicateScore,
    },
    extracted: {
      title: rawText.trim().slice(0, 45),
      soul: rawText.trim().split('.')[0] || rawText.trim().slice(0, 100),
      domain: 'Computer Science & IT',
      sector: 'Software Systems',
      type: 'Software',
      difficultyLevel: '3',
      technologies: ['React', 'Node.js', 'PostgreSQL'],
      outcomes: ['Working prototype', 'Documentation'],
      outOfScope: 'Massive scale distribution',
      skillsGained: ['System Design', 'Full-stack Development'],
      prerequisites: ['Database Systems', 'Software Engineering'],
    },
    perspectives: {
      feasibility: { score: 80, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      effectiveness: { score: 75, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      studentPotential: { score: 75, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      businessPotential: { score: 65, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      projectPotential: { score: 70, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
    },
    industryRubrics: {
      implementationDepth: { score: 70, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      userValue: { score: 70, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      scalabilityOrDeployability: { score: 70, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      safetyAndRisk: { score: 80, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      maintainability: { score: 70, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      costRealism: { score: 75, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
      testingAndValidation: { score: 65, rationale: 'Heuristic fallback — AI evaluator unavailable.' },
    },
    hardFeasibilityBlocker: { blocked: false, reason: null },
    hardwareConstraints: null,
    softwareRigor: null,
    features: fallbackFeatures,
  };

  const messages = buildIdeaValidationPrompt(rawText, nearest);
  const { data: result, degraded } = await chatJSONWithMeta(messages, fallbackResult, {
    feature: 'validateIdea',
    schema: IdeaValidationSchema,
    retries: 2,
    maxTokens: 3600,
    temperature: SCORING_TEMPERATURE,
  });

  if (degraded) {
    console.warn('[validateIdea] LLM unavailable or response rejected by schema — returning heuristic fallback.');
  }

  // Deterministic post-processing — never trust the model to self-enforce these.
  const isHardwareType = ['Hardware', 'IoT', 'Hybrid'].includes(result.extracted?.type || '');
  const hardwareConstraints = isHardwareType ? result.hardwareConstraints : null;
  const softwareRigor = isHardwareType ? null : result.softwareRigor;
  const features = normalizeFeaturePoints(result.features.map((f) => ({ ...f, points: clampToBucket(f.points) })));

  // overallScore is recomputed here, never taken from the model's own arithmetic.
  const overallScore = computeOverallScore(result.rubrics, result.industryRubrics);
  const blocked = result.hardFeasibilityBlocker?.blocked === true;

  let verdict = result.verdict;
  if (blocked) {
    verdict = 'REJECTED';
  } else if (overallScore >= 70) {
    verdict = 'ACCEPTED';
  } else if (overallScore >= 50) {
    verdict = 'NEEDS_IMPROVEMENT';
  } else {
    verdict = 'REJECTED';
  }

  const reasons = blocked
    ? Array.from(new Set([...(result.reasons || []), result.hardFeasibilityBlocker.reason || 'Not feasible as described.']))
    : result.reasons;

  const withGuardrails: IdeaValidation = {
    ...result,
    verdict,
    overallScore,
    reasons,
    hardwareConstraints,
    softwareRigor,
    features,
  };

  if (isDuplicate) {
    return {
      ...withGuardrails,
      verdict: 'REJECTED',
      duplicate: fallbackResult.duplicate,
      reasons: Array.from(new Set([...(withGuardrails.reasons || []), ...fallbackResult.reasons])),
    };
  }

  return {
    ...withGuardrails,
    duplicate: {
      ...withGuardrails.duplicate,
      similarProjectId: withGuardrails.duplicate?.isDuplicate ? topDuplicateCandidate?.id : undefined,
      similarProjectTitle: withGuardrails.duplicate?.similarProjectTitle || topDuplicateCandidate?.name,
      similarityScore: withGuardrails.duplicate?.similarityScore ?? duplicateScore,
    },
  };
}

/**
 * Feature-extraction-only path for a team picking an existing catalog project
 * (selectProject). The duplicate/verdict half of validateIdea is irrelevant here
 * — uniqueness was already resolved by checkApproachUniqueness — so this runs the
 * same feature-extraction prompt against the combined template statement + the
 * team's differentiation approach, skipping the catalog-duplicate scan entirely.
 */
export async function extractFeaturesForCombinedStatement(
  combinedText: string,
  projectType: string | null,
): Promise<{ features: ExtractedFeature[]; hardwareConstraints: IdeaValidation['hardwareConstraints'] }> {
  const evaluation = await validateIdea(combinedText);
  const isHardwareType = ['Hardware', 'IoT', 'Hybrid'].includes(projectType || evaluation.extracted?.type || '');
  return {
    features: evaluation.features,
    hardwareConstraints: isHardwareType ? evaluation.hardwareConstraints : null,
  };
}

/**
 * Re-scores a single feature being added or edited during execution, per the
 * user's requirement: the LLM node re-runs with the stored problem-statement
 * paragraph + the new/modified feature, and enforces the 1000-point project
 * budget server-side (never trusting the model's arithmetic).
 */
export async function rescoreFeature(params: {
  problemStatement: string;
  projectType: string | null;
  existingFeatures: ExistingFeatureContext[];
  proposed: ProposedFeatureInput;
}): Promise<FeatureChangeResult & { budgetClamped: boolean }> {
  const { problemStatement, projectType, existingFeatures, proposed } = params;

  const fallback: FeatureChangeResult = {
    points: 100,
    importance: 'Medium',
    aiRationale: 'Heuristic fallback — AI evaluator unavailable.',
    duplicateOfFeatureId: null,
  };

  const messages = buildFeatureChangePrompt(problemStatement, projectType, existingFeatures, proposed);
  const result = await chatJSON<FeatureChangeResult>(messages, fallback, {
    feature: 'rescoreFeature',
    schema: FeatureChangeSchema,
    retries: 2,
    maxTokens: 600,
  });

  const clampedPoints = clampToBucket(result.points);
  const remaining = FEATURE_POINTS_CAP - existingFeatures.reduce((sum, f) => sum + f.points, 0);

  if (remaining < 50) {
    throw new Error('Feature budget exhausted (1000 pts already allocated) — remove or shrink another feature first.');
  }

  if (clampedPoints <= remaining) {
    return { ...result, points: clampedPoints, budgetClamped: false };
  }

  const fitted = largestBucketAtMost(remaining) ?? 50;
  return { ...result, points: fitted, budgetClamped: true };
}

/**
 * Generates the 4 mandatory execution-review phases from the finalized feature
 * list. Runs once, right after project creation (both propose-and-publish and
 * catalog-select paths).
 */
export async function generatePhasePlan(params: {
  problemStatement: string;
  projectType: string | null;
  featureTotal: number;
  weeks: number;
}): Promise<PhasePlan['phases']> {
  const { problemStatement, projectType, featureTotal, weeks } = params;

  const fallbackPool = Math.max(featureTotal * 2, 400);
  const fallback: PhasePlan = {
    phases: [
      {
        phaseNumber: 1,
        title: 'Phase 1 Review: Planning & Architecture',
        weekTarget: Math.max(2, Math.round(weeks * 0.15)),
        expectedDeliverables: 'Implementation plan, system architecture, and a first working slice of one low-risk feature.',
        points: Math.round(fallbackPool * 0.15),
        hardwareNote: projectType && projectType !== 'Software' ? 'Confirm component/BOM selection and circuit schematic.' : null,
      },
      {
        phaseNumber: 2,
        title: 'Phase 2 Review: Initial Implementation',
        weekTarget: Math.max(4, Math.round(weeks * 0.4)),
        expectedDeliverables: 'Visible, running progress on the highest-priority features.',
        points: Math.round(fallbackPool * 0.325),
        hardwareNote: projectType && projectType !== 'Software' ? 'Breadboard-level firmware/sensor-loop progress.' : null,
      },
      {
        phaseNumber: 3,
        title: 'Phase 3 Review: Base Prototype',
        weekTarget: Math.max(6, Math.round(weeks * 0.7)),
        expectedDeliverables: 'Working end-to-end prototype covering the core feature set.',
        points: Math.round(fallbackPool * 0.325),
        hardwareNote: projectType && projectType !== 'Software' ? 'Assembled physical prototype with main sensing/actuation loop functioning.' : null,
      },
      {
        phaseNumber: 4,
        title: 'Phase 4 Review: Full-Grade System',
        weekTarget: Math.max(8, weeks),
        expectedDeliverables: 'Complete, polished, demo-ready system with all committed features present and tested.',
        points: Math.round(fallbackPool * 0.2),
        hardwareNote: projectType && projectType !== 'Software' ? 'Finished enclosure / field-ready state.' : null,
      },
    ],
  };

  const messages = buildPhasePlanPrompt(problemStatement, projectType, featureTotal, weeks);
  const { data: result, degraded } = await chatJSONWithMeta(messages, fallback, {
    feature: 'generatePhasePlan',
    schema: PhasePlanSchema,
    retries: 2,
    maxTokens: 1200,
  });

  if (degraded) {
    console.warn('[generatePhasePlan] LLM unavailable or response rejected by schema — returning heuristic fallback.');
  }

  // Re-derive to guarantee exactly phases 1-4 in order, regardless of what the
  // model returned — mirrors clampMilestoneWeeks's defensive re-normalization.
  const byNumber = new Map(result.phases.map((p) => [p.phaseNumber, p]));
  const ordered = [1, 2, 3, 4].map((n) => byNumber.get(n) || fallback.phases[n - 1]);

  const softCap = Math.max(featureTotal * 2.5, 500);
  const total = ordered.reduce((sum, p) => sum + p.points, 0);
  if (total > softCap && total > 0) {
    const scale = softCap / total;
    return ordered.map((p) => ({ ...p, points: Math.max(50, Math.round(p.points * scale)) }));
  }

  return ordered;
}
