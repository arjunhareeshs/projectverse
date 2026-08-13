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

/** Lifecycle of a submitted proposal. PENDING means the AI analysis is still
 *  running server-side; it continues even if the student leaves the page. */
export type ProposalStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'NEEDS_IMPROVEMENT'
  | 'FAILED';

/** Student-facing proposal shape. Deliberately carries no numeric scoring —
 *  the backend only returns rubric/overall scores to admins. */
export interface ProposalListItem {
  id: string;
  title: string;
  status: ProposalStatus;
  reasons: string[];
  improvementHints: string[];
  publishedProjectId: string | null;
  claimed: boolean;
  canClaim: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedProposal extends ProposalListItem {
  rawText: string;
}

export interface ApproachCheckResult {
  uniquenessScore: number; // 0 - 100
  verdict: 'ACCEPT' | 'REJECT';
  overlapsWith?: string;
  reason: string;
  suggestions: string[];
  keywords: string[];
}

export const MIN_PROPOSAL_LENGTH = 40;
export const MAX_PROPOSAL_LENGTH = 8000;

export const proposalService = {
  async getMyProposals(): Promise<ProposalListItem[]> {
    const res = await api.get('/proposals/mine');
    return res.data.proposals;
  },

  async getProposal(id: string): Promise<PersistedProposal> {
    const res = await api.get(`/proposals/${id}`);
    return res.data.proposal;
  },

  /** Submits once and returns immediately — analysis continues server-side,
   *  so the caller polls getProposal(id) for the outcome. */
  async submitProposal(rawText: string): Promise<{ proposalId: string; status: ProposalStatus }> {
    const res = await api.post('/proposals', { rawText });
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
