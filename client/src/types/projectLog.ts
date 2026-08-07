export type ProjectCategory = 'MINI' | 'FINAL_YEAR' | 'RESEARCH';

export interface ProjectLogState {
  version: number; // incremented on every write
  projectId: string;
  title: string;
  category: ProjectCategory;
  department?: string;
  createdAt: string; // ISO
  duration: {
    months: number;
    startDate: string; // ISO
    endDate: string; // ISO
    history: Array<{ at: string; months: number; reason?: string }>;
  };
  team: {
    teamId: string;
    members: Array<{
      userId: string;
      name: string;
      responsibilities: string[]; // work-package ids
      joinedAt: string;
      active: boolean;
    }>;
  };
  technologies: string[];
  executionDoc: {
    currentVersion: number; // 0 = not generated yet
    generatedAt?: string;
    uniquenessNotes?: string;
  };
  workPackages: Array<{
    id: string; // slug, e.g. "backend"
    name: string;
    percentage: number; // all sum to 100
    assignedTo: string[]; // userIds
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  }>;
  milestones: Array<{
    id: string;
    name: string;
    expectedOutput: string;
    dueWeek: number;
    dueDate: string;
    status: 'PENDING' | 'DONE' | 'MISSED';
    history: Array<{ at: string; dueDate: string; reason?: string }>;
  }>;
  skills: {
    required: string[];
    gaps: Array<{ skill: string; missingFor: string[] /* userIds */ }>;
  };
  github?: { repoFullName: string; linkedAt: string };
  evaluations: Array<{
    cycle: number;
    periodStart: string;
    periodEnd: string;
    authenticity: number;
    plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    overall: number;
    reportId: string;
  }>;
  flags: Array<{
    id: string;
    at: string;
    type: 'DELAY' | 'INACTIVE_MEMBER' | 'MISSING_DEPENDENCY' | 'OVERLOAD' | 'TIMELINE_RISK' | 'TECH_DRIFT';
    message: string;
    resolved: boolean;
  }>;
}

export type ProjectLogEventType =
  | 'PROJECT_CREATED'
  | 'CATEGORY_SET'
  | 'MEMBERS_SET'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'DURATION_SET'
  | 'DURATION_CHANGED'
  | 'TECHNOLOGIES_SET'
  | 'DOC_GENERATED'
  | 'DOC_REGENERATED'
  | 'WORK_PACKAGE_ASSIGNED'
  | 'WORK_PACKAGE_STATUS'
  | 'MILESTONE_UPDATED'
  | 'DEADLINE_CHANGED'
  | 'GITHUB_LINKED'
  | 'EVALUATION_ADDED'
  | 'FLAG_RAISED'
  | 'FLAG_RESOLVED'
  | 'MANUAL_NOTE';

export interface ProjectLogEventPayload {
  type: ProjectLogEventType;
  actorUserId: string | 'SYSTEM' | 'AI';
  data: Record<string, unknown>;
  note?: string;
}

export interface DailyLogEntry {
  id: string;
  projectId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  workDone: string;
  hoursSpent?: number;
  blockers?: string;
  evidenceUrls?: string[];
  createdAt: string;
  updatedAt: string;
  userName?: string;
}

export interface FeatureAllocationItem {
  id: string;
  name: string;
  description: string;
  importance: 'High' | 'Medium' | 'Low';
  points: number;
  implementationMethod?: string | null;
  aiRationale?: string | null;
  addedBy?: string;
  status?: 'ACTIVE' | 'REMOVED';
}

export interface PhaseSubmissionItem {
  id: string;
  phaseId: string;
  submittedById: string;
  submissionNote: string;
  evidenceUrls?: string[] | null;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  reviewedById?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface ProjectPhaseItem {
  id: string;
  projectId: string;
  phaseNumber: number;
  title: string;
  expectedDeliverables: string;
  weekTarget: number;
  points: number;
  hardwareNote?: string | null;
  status: 'PLANNED' | 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED';
  submissions?: PhaseSubmissionItem[];
}

export interface PerspectiveScore {
  score: number;
  rationale: string;
}

export interface IdeaPerspectives {
  feasibility: PerspectiveScore;
  effectiveness: PerspectiveScore;
  studentPotential: PerspectiveScore;
  businessPotential: PerspectiveScore;
  projectPotential: PerspectiveScore;
}

export interface HardwareConstraints {
  componentAvailability: string;
  integrationComplexity: string;
  problemSolutionComplexity: string;
}

export interface TeamShareAllocationItem {
  userId: string;
  name: string;
  role: string;
  sharePercent: number;
  rewardPoints: number;
  isLead?: boolean;
}

export interface ExecutionDocContent {
  overview: {
    background: string;
    purpose: string;
    problemStatement: string;
    scope: string;
    expectedOutcome: string;
  };
  objectives: string[];
  deliverables: string[];
  workBreakdown: Array<{
    id: string;
    name: string;
    description: string;
    percentage: number;
  }>;
  skillsRequired: string[];
  milestones: Array<{
    name: string;
    expectedOutput: string;
    completionWeek: number;
    rewardPoints?: number;
    deliverables?: string[];
  }>;
  risks: string[];
  learningResources: Array<{
    topic: string;
    resource: string;
    url?: string;
  }>;
  successCriteria: string[];
  uniquenessNotes?: string;
  // Reward & Execution Allocation System fields
  features?: FeatureAllocationItem[];
  teamShare?: TeamShareAllocationItem[];
  targetUsers?: string;
  keyFeatures?: string[];
  modules?: string[];
  resources?: string[];
  notes?: string;
  status?: string;
  lastUpdated?: string;
}

export interface EvaluationReportContent {
  id: string;
  projectId: string;
  cycle: number;
  periodStart: string;
  periodEnd: string;
  scopeAdherence: { score: number; notes: string };
  technicalProgress: { score: number; notes: string };
  timelineCompliance: { score: number; notes: string };
  memberParticipation: {
    score: number;
    notes: string;
    perMember: Array<{ userId: string; name?: string; score: number; notes: string }>;
  };
  documentationQuality: { score: number; notes: string };
  authenticityConfidence: { score: number; notes: string };
  plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  overallScore: number;
  missingWork: string[];
  suspiciousBehaviour: string[];
  mentorFeedback: string;
  next15DayRecommendations: string[];
  createdAt: string;
}

export interface MentorStatus {
  onTimeEstimate: 'ON_TRACK' | 'AT_RISK' | 'LIKELY_LATE';
  summary: string;
  flags: Array<{
    id: string;
    at: string;
    type: 'DELAY' | 'INACTIVE_MEMBER' | 'MISSING_DEPENDENCY' | 'OVERLOAD' | 'TIMELINE_RISK' | 'TECH_DRIFT';
    message: string;
    resolved: boolean;
  }>;
  suggestedNextTasks: Array<{
    userId: string;
    userName?: string;
    task: string;
  }>;
  learningSuggestions: Array<{
    skill: string;
    missingFor: string[];
    resources: Array<{ topic: string; resource: string; url?: string }>;
  }>;
  available?: boolean;
}

export interface AdminAiAskResponse {
  answer: string;
  projectsUsed: Array<{
    id: string;
    title: string;
    category?: string;
  }>;
  scope: string;
  pinnedContext?: { type: 'team' | 'student'; id: string; name: string } | null;
  degraded?: boolean;
}
