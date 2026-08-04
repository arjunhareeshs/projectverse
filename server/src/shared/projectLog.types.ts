export type ProjectCategory = 'MINI' | 'FINAL_YEAR' | 'RESEARCH';

export interface ProjectLogState {
  version: number;                 // incremented on every write
  projectId: string;
  title: string;
  category: ProjectCategory;
  department?: string;
  createdAt: string;               // ISO
  duration: {
    months: number;
    startDate: string;             // ISO
    endDate: string;               // ISO — recomputed if duration changes
    history: Array<{ at: string; months: number; reason?: string }>;
  };
  team: {
    teamId: string;
    members: Array<{
      userId: string;
      name: string;
      responsibilities: string[];  // work-package ids
      joinedAt: string;
      active: boolean;
    }>;
  };
  technologies: string[];          // decided/declared technologies
  executionDoc: {
    currentVersion: number;        // 0 = not generated yet
    generatedAt?: string;
    uniquenessNotes?: string;      // what Engine 2 varied vs similar projects
  };
  workPackages: Array<{
    id: string;                    // slug, e.g. "backend"
    name: string;
    percentage: number;            // all sum to 100
    assignedTo: string[];          // userIds
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
    dependsOn?: string[];          // package ids this package depends on
  }>;
  milestones: Array<{
    id: string;
    name: string;
    expectedOutput: string;
    dueWeek: number;
    dueDate: string;
    status: 'PENDING' | 'DONE' | 'MISSED';
    history: Array<{ at: string; dueDate: string; reason?: string }>; // deadline updates
  }>;
  skills: {
    required: string[];
    gaps: Array<{ skill: string; missingFor: string[] /* userIds */ }>;
  };
  github?: { repoFullName: string; linkedAt: string };
  evaluations: Array<{             // summary refs only — full reports live in their own table
    cycle: number;
    periodStart: string;
    periodEnd: string;
    authenticity: number;
    plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    overall: number;
    reportId: string;
  }>;
  flags: Array<{                   // raised by AI Mentor, cleared when resolved
    id: string;
    at: string;
    type: 'DELAY' | 'INACTIVE_MEMBER' | 'MISSING_DEPENDENCY' | 'OVERLOAD' | 'TIMELINE_RISK' | 'TECH_DRIFT' | 'PERSISTENT_BLOCKER';
    message: string;
    resolved: boolean;
    severity?: number;             // 0-100 score computed deterministically
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
  | 'MANUAL_NOTE'
  | 'SELECTION_DRAFT'
  | 'SELECTION_VOTE'
  | 'SELECTION_LOCKED'
  | 'BLOCKER_ESCALATED'
  | 'INTERVENTION_LOGGED'
  | 'DELIVERABLE_DRAFTED';

export interface ProjectLogEventPayload {
  type: ProjectLogEventType;
  actorUserId: string | 'SYSTEM' | 'AI';
  data: Record<string, unknown>;   // event-specific; keep small and structured
  note?: string;
}

export interface DailyLogEntry {
  id: string;
  projectId: string;
  userId: string;
  date: string;                    // YYYY-MM-DD, one entry per user per project per day
  workDone: string;                // what was done (required)
  hoursSpent?: number;
  blockers?: string;
  evidenceUrls?: string[];         // commit links, screenshots, files
  createdAt: string;
  updatedAt: string;
}

export interface FeatureAllocationItem {
  id: string;
  name: string;
  description: string;
  importance: 'High' | 'Medium' | 'Low';
  points: number;
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
  objectives: string[];                               // measurable
  deliverables: string[];                             // only applicable items
  workBreakdown: Array<{
    id: string;
    name: string;
    description: string;
    percentage: number;
    dependsOn?: string[];                             // package ids this depends on
  }>;                                                 // 3–5 packages, sum 100
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
  uniquenessNotes?: string;                           // Engine 2 delta description
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

export interface ScoreDetail {
  score: number;
  notes: string;
  evidence?: Record<string, unknown>;
}

export interface EvaluationReportContent {
  cycle: number;
  periodStart: string;
  periodEnd: string;
  scopeAdherence: ScoreDetail;        // /100 each
  technicalProgress: ScoreDetail;
  timelineCompliance: ScoreDetail;
  memberParticipation: ScoreDetail & {
    perMember: Array<{ userId: string; score: number; notes: string; evidence?: Record<string, unknown> }>;
  };
  documentationQuality: ScoreDetail;
  authenticityConfidence: ScoreDetail;
  plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  missingWork: string[];
  suspiciousBehaviour: string[];
  mentorFeedback: string;
  next15DayRecommendations: string[];
  isFallback?: boolean;
  statusNote?: string;
}

export interface PlanningContext {
  projectId: string;
  title: string;
  category: ProjectCategory;
  department?: string;
  duration: ProjectLogState['duration'];
  members: Array<ProjectLogState['team']['members'][number] & { skills: string[] }>;
  technologies: string[];
}

export interface EvaluationContext {
  projectId: string;
  title: string;
  category: ProjectCategory;
  duration: ProjectLogState['duration'];
  team: ProjectLogState['team'];
  workPackages: ProjectLogState['workPackages'];
  milestones: ProjectLogState['milestones'];
  executionDocSummary: { version: number; generatedAt: Date } | null;
  lastEvaluationSummary: ProjectLogState['evaluations'][number] | null;
}

export interface MentorContext {
  projectId: string;
  title: string;
  category: ProjectCategory;
  duration: ProjectLogState['duration'];
  team: ProjectLogState['team'];
  workPackages: ProjectLogState['workPackages'];
  milestones: ProjectLogState['milestones'];
  flags: ProjectLogState['flags'];
  skills: ProjectLogState['skills'];
  recentEvaluations: ProjectLogState['evaluations'];
  activitySummary: { logCountsPerMember: Record<string, number> };
}

export interface AdminContext {
  projectId: string;
  title: string;
  category: ProjectCategory;
  teamId: string;
  percentTimeElapsed: number;
  percentMilestonesDone: number;
  latestEvaluation: ProjectLogState['evaluations'][number] | null;
  openFlagCount: number;
  openFlags: Array<{ type: string; message: string; severity: number }>;
  githubRepo: string | null;
}

