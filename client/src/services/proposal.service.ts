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

export interface ProposalListItem {
  id: string;
  verdict: 'ACCEPTED' | 'REJECTED' | 'NEEDS_IMPROVEMENT';
  reasons: string[];
  scores: {
    overallScore: number;
    rubrics: ProposalEvaluationResult['rubrics'];
    perspectives?: ProposalEvaluationResult['perspectives'];
    hardwareConstraints?: ProposalEvaluationResult['hardwareConstraints'];
    duplicate?: ProposalEvaluationResult['duplicate'];
  } | null;
  publishedProjectId: string | null;
  duplicateOfId: string | null;
  createdAt: string;
}

export interface PersistedProposal extends ProposalListItem {
  submitterId: string;
  rawText: string;
  improvementHints: string[];
  extracted: ProposalEvaluationResult['extracted'] | null;
}

export interface ApproachCheckResult {
  uniquenessScore: number; // 0 - 100
  verdict: 'ACCEPT' | 'REJECT';
  overlapsWith?: string;
  reason: string;
  suggestions: string[];
  keywords: string[];
}

/** Adapts a persisted proposal row (submission-time snapshot) into the shape
 * AiEvaluationPanel renders. `features` is omitted — feature reasoning lives
 * on the published project's ProjectFeature rows once accepted, so it's read
 * live from there rather than duplicated into this immutable audit record. */
export function proposalToEvaluationResult(proposal: PersistedProposal): ProposalEvaluationResult {
  return {
    verdict: proposal.verdict,
    reasons: proposal.reasons,
    improvementHints: proposal.improvementHints,
    overallScore: proposal.scores?.overallScore ?? 0,
    rubrics: proposal.scores?.rubrics as ProposalEvaluationResult['rubrics'],
    duplicate: proposal.scores?.duplicate ?? { isDuplicate: false },
    extracted: proposal.extracted || undefined,
    perspectives: proposal.scores?.perspectives,
    hardwareConstraints: proposal.scores?.hardwareConstraints,
  };
}

export const proposalService = {
  async evaluateProposal(rawText: string): Promise<ProposalEvaluationResult> {
    const res = await api.post('/proposals/evaluate', { rawText });
    return res.data;
  },

  async getMyProposals(): Promise<ProposalListItem[]> {
    const res = await api.get('/proposals/mine');
    return res.data.proposals;
  },

  async getProposal(id: string): Promise<PersistedProposal> {
    const res = await api.get(`/proposals/${id}`);
    return res.data.proposal;
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
