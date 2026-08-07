import { z } from 'zod';

export const FEATURE_POINT_BUCKET = [50, 100, 150, 200, 250, 300] as const;
export const FEATURE_POINTS_CAP = 1000;

const pointsLiteral = z.union(
  FEATURE_POINT_BUCKET.map((n) => z.literal(n)) as unknown as [
    z.ZodLiteral<number>,
    z.ZodLiteral<number>,
    ...z.ZodLiteral<number>[],
  ],
);

export const PerspectiveScoreSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string(),
});

export const ExtractedFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  importance: z.enum(['High', 'Medium', 'Low']),
  implementationMethod: z.string(),
  points: pointsLiteral,
  aiRationale: z.string(),
});

export const HardwareConstraintsSchema = z.object({
  componentAvailability: z.string(),
  integrationComplexity: z.string(),
  problemSolutionComplexity: z.string(),
});

// The rubric/duplicate/extracted shape from the existing ProposalEvaluationSchema
// (server/src/modules/projects/project.catalog.controller.ts) is composed in here
// rather than imported, since ideaIntelligence.service now OWNS that evaluation —
// project.catalog.controller imports validateIdea from here instead.
export const ProposalEvaluationSchema = z.object({
  verdict: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_IMPROVEMENT']),
  reasons: z.array(z.string()).default([]),
  improvementHints: z.array(z.string()).default([]),
  overallScore: z.number().min(0).max(100),
  rubrics: z.object({
    relevance: z.object({ score: z.number(), rationale: z.string() }),
    clarity: z.object({ score: z.number(), rationale: z.string() }),
    feasibility: z.object({ score: z.number(), rationale: z.string() }),
    novelty: z.object({ score: z.number(), rationale: z.string() }),
    expectedOutcome: z.object({ score: z.number(), rationale: z.string() }),
    featureCompleteness: z.object({ score: z.number(), rationale: z.string() }),
    industryImpact: z.object({ score: z.number(), rationale: z.string() }),
  }),
  duplicate: z.object({
    isDuplicate: z.boolean(),
    similarProjectId: z.string().optional(),
    similarProjectTitle: z.string().optional(),
    similarityScore: z.number().optional(),
  }),
  extracted: z.object({
    title: z.string(),
    soul: z.string(),
    domain: z.string(),
    sector: z.string(),
    type: z.enum(['Software', 'Hardware', 'IoT', 'Hybrid']),
    difficultyLevel: z.string(),
    technologies: z.array(z.string()),
    outcomes: z.array(z.string()),
    outOfScope: z.string().optional(),
    skillsGained: z.array(z.string()).optional(),
    prerequisites: z.array(z.string()).optional(),
  }),
});

export const IdeaValidationSchema = ProposalEvaluationSchema.extend({
  perspectives: z.object({
    feasibility: PerspectiveScoreSchema,
    effectiveness: PerspectiveScoreSchema,
    studentPotential: PerspectiveScoreSchema,
    businessPotential: PerspectiveScoreSchema,
    projectPotential: PerspectiveScoreSchema,
  }),
  hardwareConstraints: HardwareConstraintsSchema.nullable(),
  features: z.array(ExtractedFeatureSchema).min(1).max(8),
});

export type ProposalEvaluation = z.infer<typeof ProposalEvaluationSchema>;
export type IdeaValidation = z.infer<typeof IdeaValidationSchema>;
export type ExtractedFeature = z.infer<typeof ExtractedFeatureSchema>;
export type PerspectiveScore = z.infer<typeof PerspectiveScoreSchema>;
export type HardwareConstraints = z.infer<typeof HardwareConstraintsSchema>;

export const FeatureChangeSchema = z.object({
  points: pointsLiteral,
  importance: z.enum(['High', 'Medium', 'Low']),
  aiRationale: z.string(),
  duplicateOfFeatureId: z.string().nullable(),
});
export type FeatureChangeResult = z.infer<typeof FeatureChangeSchema>;

export const PhasePlanSchema = z.object({
  phases: z
    .array(
      z.object({
        phaseNumber: z.number().int().min(1).max(4),
        title: z.string(),
        weekTarget: z.number().int().min(1),
        expectedDeliverables: z.string(),
        points: z.number().int().min(50),
        hardwareNote: z.string().nullable(),
      }),
    )
    .length(4),
});
export type PhasePlan = z.infer<typeof PhasePlanSchema>;
