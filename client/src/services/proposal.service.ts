import { api } from './api';

export interface RubricScore {
  score: number; // 0 - 100
  rationale: string;
}

export interface PerspectiveScore {
  score: number; // 0 - 100
  rationale: string;
}

export interface ExtractedFeaturePreview {
  name: string;
  description: string;
  importance: 'High' | 'Medium' | 'Low';
  implementationMethod: string;
  points: number;
  aiRationale: string;
}

export interface HardwareConstraintsPreview {
  componentAvailability: string;
  integrationComplexity: string;
  problemSolutionComplexity: string;
}

export interface ProposalEvaluationResult {
  verdict: 'ACCEPTED' | 'REJECTED' | 'NEEDS_IMPROVEMENT';
  reasons: string[];
  improvementHints: string[];
  rubrics: {
    relevance: RubricScore;
    clarity: RubricScore;
    feasibility: RubricScore;
    novelty: RubricScore;
    expectedOutcome: RubricScore;
    featureCompleteness: RubricScore;
    industryImpact: RubricScore;
  };
  overallScore: number;
  duplicate: {
    isDuplicate: boolean;
    similarProjectId?: string;
    similarProjectTitle?: string;
    similarityScore?: number;
  };
  extracted?: {
    title: string;
    soul: string;
    domain: string;
    sector: string;
    type: 'Software' | 'Hardware' | 'IoT' | 'Hybrid';
    difficultyLevel: string;
    technologies: string[];
    outcomes: string[];
    outOfScope?: string;
    skillsGained?: string[];
    prerequisites?: string[];
  };
  perspectives?: {
    feasibility: PerspectiveScore;
    effectiveness: PerspectiveScore;
    studentPotential: PerspectiveScore;
    businessPotential: PerspectiveScore;
    projectPotential: PerspectiveScore;
  };
  hardwareConstraints?: HardwareConstraintsPreview | null;
  features?: ExtractedFeaturePreview[];
}

export interface ApproachCheckResult {
  uniquenessScore: number; // 0 - 100
  verdict: 'ACCEPT' | 'REJECT';
  overlapsWith?: string;
  reason: string;
  suggestions: string[];
  keywords: string[];
}

export const proposalService = {
  async evaluateProposal(rawText: string): Promise<ProposalEvaluationResult> {
    const res = await api.post('/proposals/evaluate', { rawText });
    return res.data;
  },

  async submitProposal(payload: {
    rawText: string;
    evaluation: ProposalEvaluationResult;
  }) {
    const res = await api.post('/proposals', payload);
    return res.data;
  },

  async checkApproachUniqueness(projectId: string, proposedApproach: string): Promise<ApproachCheckResult> {
    const res = await api.post(`/projects/catalog/${projectId}/check-approach`, { proposedApproach });
    return res.data;
  },

  async selectProjectWithApproach(projectId: string, differentiationApproach: string) {
    const res = await api.post(`/projects/catalog/${projectId}/select`, { differentiationApproach });
    return res.data;
  },
};
