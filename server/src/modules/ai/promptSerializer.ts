import { z } from 'zod';
import { ChatMessage } from './llm.service';

// ─── 10-Field Rubric Schemas (0 to 10 scale each) ────────────────────────────

export const StudentScore10Schema = z.object({
  userId: z.string(), // Alias M1/M2 during LLM inference, de-aliased to CUID
  regNo: z.string().optional(),
  // 5 On-Project Marks (0-10)
  scopeAlignmentScore: z.number().int().min(0).max(10),
  technicalComplexityScore: z.number().int().min(0).max(10),
  milestoneCompletionScore: z.number().int().min(0).max(10),
  commitAuthenticityScore: z.number().int().min(0).max(10),
  riskMitigationScore: z.number().int().min(0).max(10),
  // 5 Out-of-Project / Discipline Marks (0-10)
  taskPunctualityScore: z.number().int().min(0).max(10),
  dailyLogDiligenceScore: z.number().int().min(0).max(10),
  taskOwnershipScore: z.number().int().min(0).max(10),
  teamCollaborationScore: z.number().int().min(0).max(10),
  growthInnovationScore: z.number().int().min(0).max(10),
  totalMarks: z.number().int().min(0).max(100),
  relativeTeamRank: z.number().int().min(1).optional(),
  qualitativeStrengths: z.array(z.string()).default([]),
  qualitativeGrowthAreas: z.array(z.string()).default([]),
  personalizedActionPlan: z.string().default(''),
});

export const TeamScore10Schema = z.object({
  workDistributionEquity: z.number().int().min(0).max(10),
  milestoneVelocity: z.number().int().min(0).max(10),
  blockerResolutionSpeed: z.number().int().min(0).max(10),
  interMemberCollaboration: z.number().int().min(0).max(10),
  teamCommitCadence: z.number().int().min(0).max(10),
  sharedDocumentation: z.number().int().min(0).max(10),
  technicalConsistency: z.number().int().min(0).max(10),
  timelineDiscipline: z.number().int().min(0).max(10),
  peerReviewParticipation: z.number().int().min(0).max(10),
  collectiveOutputQuality: z.number().int().min(0).max(10),
  totalTeamMarks: z.number().int().min(0).max(100),
  teamSynergyLevel: z.enum(['HIGH', 'BALANCED', 'IMBALANCED', 'CRITICAL']).default('BALANCED'),
  bottlenecks: z.array(z.string()).default([]),
  teamFeedback: z.string().default(''),
});

export const ProjectScore10Schema = z.object({
  scopeAlignment: z.number().int().min(0).max(10),
  architectureRobustness: z.number().int().min(0).max(10),
  hardwareSoftwareProgress: z.number().int().min(0).max(10),
  deliverablesReadiness: z.number().int().min(0).max(10),
  authenticityConfidence: z.number().int().min(0).max(10),
  plagiarismSafety: z.number().int().min(0).max(10),
  testCoverageVerification: z.number().int().min(0).max(10),
  standardsCompliance: z.number().int().min(0).max(10),
  innovationDifferentiation: z.number().int().min(0).max(10),
  publicationFeasibility: z.number().int().min(0).max(10),
  totalProjectMarks: z.number().int().min(0).max(100),
  projectHealthBand: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_ATTENTION', 'AT_RISK', 'CRITICAL']).default('GOOD'),
  keyMilestonesAchieved: z.array(z.string()).default([]),
  criticalRisks: z.array(z.string()).default([]),
});

export const EvaluationCategoryScoreSchema = z.object({
  score: z.number().min(0).max(100),
  notes: z.string().default(''),
  evidence: z.record(z.string(), z.any()).optional(),
});

export const EvaluationMemberScoreSchema = z.object({
  userId: z.string(),
  score: z.number().min(0).max(100),
  notes: z.string().default(''),
});

export const EvaluationReportSchema = z.object({
  cycle: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  // 10-Field Tri-Level Rubrics
  studentScores10: z.array(StudentScore10Schema).default([]),
  teamScores10: TeamScore10Schema.optional(),
  projectScores10: ProjectScore10Schema.optional(),
  // Category-level rollups for UI backward compatibility
  scopeAdherence: EvaluationCategoryScoreSchema,
  technicalProgress: EvaluationCategoryScoreSchema,
  timelineCompliance: EvaluationCategoryScoreSchema,
  memberParticipation: z.object({
    score: z.number().min(0).max(100),
    notes: z.string().default(''),
    perMember: z.array(EvaluationMemberScoreSchema).default([]),
    evidence: z.record(z.string(), z.any()).optional(),
  }),
  documentationQuality: EvaluationCategoryScoreSchema,
  authenticityConfidence: EvaluationCategoryScoreSchema,
  plagiarismRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  missingWork: z.array(z.string()).default([]),
  suspiciousBehaviour: z.array(z.string()).default([]),
  mentorFeedback: z.string().default(''),
  next15DayRecommendations: z.array(z.string()).default([]),
  isFallback: z.boolean().optional(),
});

export type EvaluationReportParsed = z.infer<typeof EvaluationReportSchema>;

export interface SerializedEvaluationContext {
  prompt: ChatMessage[];
  aliasToUserId: Map<string, string>;
  userIdToAlias: Map<string, string>;
}

export interface RawEvaluationInput {
  cycle: number;
  periodStart: string;
  periodEnd: string;
  evalContext: {
    title: string;
    category?: string;
    workPackages?: Array<{ id: string; name: string; percentage?: number; assignedTo?: string[]; status?: string }>;
    milestones?: Array<{ id?: string; name: string; expectedOutput?: string; dueWeek?: number; status?: string }>;
    team: {
      teamId?: string;
      members: Array<{ userId: string; regNo?: string | null; name?: string; responsibilities?: string[]; active?: boolean }>;
    };
  };
  logsGroupedByMember: Record<string, { entryCount: number; logs: Array<{ date: string; workDone: string; hours?: number }> }>;
  githubCommits: Array<{ sha: string; linkedUserId?: string | null; author?: string; message?: string; date: Date | string; isMerge?: boolean }>;
  previousCycleMarks?: {
    students?: Record<string, Record<string, number>>; // userId -> 10 marks (clean marks only, NO text appended)
    team?: Record<string, number>; // team 10 marks
    project?: Record<string, number>; // project 10 marks
    overallScore?: number;
  } | null;
  previousEval?: any;
  suspiciousPairs: Array<{ userId: string; date: string; similarityPercent: number }>;
}

/**
 * Serializes evaluation context into a leak-free LLM prompt with 10-field rubrics (0-10 each).
 */
export function serializeEvaluationPrompt(input: RawEvaluationInput): SerializedEvaluationContext {
  const userIdToAlias = new Map<string, string>();
  const aliasToUserId = new Map<string, string>();
  const userRegNoMap = new Map<string, string>();

  // Deterministically create alias map (M1, M2, ...)
  input.evalContext.team.members.forEach((m, idx) => {
    const alias = `M${idx + 1}`;
    userIdToAlias.set(m.userId, alias);
    aliasToUserId.set(alias, m.userId);
    userRegNoMap.set(m.userId, m.regNo || `REG_${idx + 1}`);
  });

  // Anonymized work packages
  const anonymizedWorkPackages = (input.evalContext.workPackages || []).map((wp) => ({
    id: wp.id,
    name: wp.name,
    percentage: wp.percentage || 0,
    status: wp.status || 'NOT_STARTED',
    assignedTo: (wp.assignedTo || []).map((uid) => userIdToAlias.get(uid) || 'M_UNASSIGNED'),
  }));

  // Anonymized team members
  const anonymizedMembers = input.evalContext.team.members.map((m) => ({
    alias: userIdToAlias.get(m.userId) || 'M1',
    regNoAlias: userRegNoMap.get(m.userId) || 'REG_1',
    responsibilities: m.responsibilities || [],
    active: m.active !== false,
  }));

  // Anonymized daily logs (truncated to 150 chars per entry)
  const anonymizedLogs: Record<string, { entryCount: number; logs: Array<{ date: string; workDone: string; hours?: number }> }> = {};
  for (const [uid, group] of Object.entries(input.logsGroupedByMember)) {
    const alias = userIdToAlias.get(uid) || 'M_UNKNOWN';
    anonymizedLogs[alias] = {
      entryCount: group.entryCount,
      logs: group.logs.map((l) => ({
        date: l.date,
        workDone: l.workDone.slice(0, 150),
        hours: l.hours,
      })),
    };
  }

  // Anonymized GitHub commits
  const anonymizedCommits = input.githubCommits.map((c) => ({
    authorAlias: c.linkedUserId ? (userIdToAlias.get(c.linkedUserId) || 'M_CONTRIBUTOR') : 'UNLINKED_CONTRIBUTOR',
    dateOnly: new Date(c.date).toISOString().split('T')[0],
    messageLength: (c.message || '').length,
    isMerge: !!c.isMerge,
  }));

  // Anonymized suspicious pairs (NO foreign text)
  const anonymizedSuspicious = input.suspiciousPairs.map((p) => ({
    memberAlias: userIdToAlias.get(p.userId) || 'M1',
    logDate: p.date,
    similarityPercent: Math.round(p.similarityPercent),
    matchScope: 'OTHER_PROJECT_SAME_ORG',
  }));

  // Clean previous cycle marks (ONLY NUMERICAL MARKS, ZERO TEXT APPENDING)
  let anonymizedPreviousMarks: any = null;
  if (input.previousCycleMarks) {
    const prevStudents: Record<string, any> = {};
    if (input.previousCycleMarks.students) {
      for (const [uid, marks] of Object.entries(input.previousCycleMarks.students)) {
        const alias = userIdToAlias.get(uid) || uid;
        prevStudents[alias] = marks;
      }
    }
    anonymizedPreviousMarks = {
      previousCycle: input.cycle - 1,
      students: prevStudents,
      team: input.previousCycleMarks.team || null,
      project: input.previousCycleMarks.project || null,
      previousOverall: input.previousCycleMarks.overallScore || null,
    };
  }

  const systemPrompt = `You are a strict, senior engineering project evaluator. Evaluate whether student work genuinely matches the approved plan across exactly 10 fields per student, 10 fields for the team, and 10 fields for the project.

CRITICAL GRADING RULES (STRICT CALIBRATION — DO NOT CLUSTER SCORES TO 7-9):
1. Every rubric score MUST be an integer from 0 to 10.
2. DO NOT give generic 7–9 marks for everyone. Carefully differentiate performance based on concrete evidence:
   - 0 to 3 (Poor/Failing): Missing daily logs (<4 logs), zero commits during coding work, persistent unresolved blockers (>=3 days), or severe deadline slippage.
   - 4 to 6 (Needs Improvement): Sporadic logging (5-8 logs), few commits, partial task completions, or unverified claims.
   - 7 to 8 (Good/Solid): Consistent logging (9-11 logs), verified commits matching claims, tasks completed on time.
   - 9 to 10 (Exceptional): Flawless logging, daily verified commits, ahead-of-time deliverables, proactive problem solving.
3. For Cycle > 1, evaluate delta progression against the provided PREVIOUS CYCLE MARKS.
4. Total marks per student = sum of their 10 individual marks (0 to 100).
5. Team members are identified by aliases (M1, M2, etc.).

Return ONLY JSON matching:
{
  "cycle": ${input.cycle},
  "periodStart": "${input.periodStart}",
  "periodEnd": "${input.periodEnd}",
  "studentScores10": [
    {
      "userId": "M1",
      "scopeAlignmentScore": 8,
      "technicalComplexityScore": 8,
      "milestoneCompletionScore": 9,
      "commitAuthenticityScore": 7,
      "riskMitigationScore": 8,
      "taskPunctualityScore": 9,
      "dailyLogDiligenceScore": 8,
      "taskOwnershipScore": 8,
      "teamCollaborationScore": 8,
      "growthInnovationScore": 7,
      "totalMarks": 79,
      "relativeTeamRank": 1,
      "qualitativeStrengths": ["Consistent daily commit cadence", "Proactive driver refactoring"],
      "qualitativeGrowthAreas": ["Improve unit test coverage"],
      "personalizedActionPlan": "Maintain regular commits; complete Phase 3 integration testing."
    }
  ],
  "teamScores10": {
    "workDistributionEquity": 8,
    "milestoneVelocity": 8,
    "blockerResolutionSpeed": 7,
    "interMemberCollaboration": 8,
    "teamCommitCadence": 8,
    "sharedDocumentation": 8,
    "technicalConsistency": 8,
    "timelineDiscipline": 8,
    "peerReviewParticipation": 7,
    "collectiveOutputQuality": 8,
    "totalTeamMarks": 78,
    "teamSynergyLevel": "BALANCED",
    "bottlenecks": ["API documentation sync"],
    "teamFeedback": "Strong overall team synergy with minor delays in documentation."
  },
  "projectScores10": {
    "scopeAlignment": 8,
    "architectureRobustness": 8,
    "hardwareSoftwareProgress": 8,
    "deliverablesReadiness": 8,
    "authenticityConfidence": 8,
    "plagiarismSafety": 9,
    "testCoverageVerification": 7,
    "standardsCompliance": 8,
    "innovationDifferentiation": 8,
    "publicationFeasibility": 7,
    "totalProjectMarks": 79,
    "projectHealthBand": "GOOD",
    "keyMilestonesAchieved": ["Milestone 2 firmware integration"],
    "criticalRisks": ["Hardware supply chain lead time"]
  },
  "scopeAdherence": { "score": 80, "notes": "..." },
  "technicalProgress": { "score": 80, "notes": "..." },
  "timelineCompliance": { "score": 80, "notes": "..." },
  "memberParticipation": {
    "score": 80,
    "notes": "...",
    "perMember": [{ "userId": "M1", "score": 80, "notes": "..." }]
  },
  "documentationQuality": { "score": 80, "notes": "..." },
  "authenticityConfidence": { "score": 85, "notes": "..." },
  "plagiarismRisk": "LOW",
  "missingWork": ["..."],
  "suspiciousBehaviour": ["..."],
  "mentorFeedback": "Comprehensive mentor evaluation summary...",
  "next15DayRecommendations": ["Rec 1", "Rec 2"]
}`;

  const userPrompt = `Project Title: ${input.evalContext.title}
Category: ${input.evalContext.category || 'FINAL_YEAR'}
Approved Work Packages: ${JSON.stringify(anonymizedWorkPackages)}
Milestones: ${JSON.stringify(input.evalContext.milestones || [])}
Team Members (by Alias): ${JSON.stringify(anonymizedMembers)}

Daily Work Logs in this 15-day period (Grouped by Member Alias):
${JSON.stringify(anonymizedLogs, null, 2)}

GitHub Commit Evidence (Last 15 days):
${JSON.stringify(anonymizedCommits, null, 2)}

Previous Cycle Benchmark Marks (Clean Historical Baseline — No raw text):
${JSON.stringify(anonymizedPreviousMarks || 'Cycle 1 (Initial cycle, no previous marks)', null, 2)}

Cross-Project Similarity Signals:
${JSON.stringify(anonymizedSuspicious, null, 2)}`;

  return {
    prompt: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    aliasToUserId,
    userIdToAlias,
  };
}

/**
 * De-aliases the LLM response mapping M1, M2 back to actual database userIds.
 */
export function dealiasEvaluationReport(
  report: any,
  aliasToUserId: Map<string, string>,
): any {
  if (!report) return report;

  // De-alias memberParticipation.perMember
  let updatedPerMember = report.memberParticipation?.perMember;
  if (Array.isArray(updatedPerMember)) {
    updatedPerMember = updatedPerMember.map((pm: any) => {
      const rawId = String(pm.userId || pm.alias || '');
      const realUserId = aliasToUserId.get(rawId) || rawId;
      return { ...pm, userId: realUserId };
    });
  }

  // De-alias studentScores10
  let updatedStudentScores10 = report.studentScores10;
  if (Array.isArray(updatedStudentScores10)) {
    updatedStudentScores10 = updatedStudentScores10.map((ss: any) => {
      const rawId = String(ss.userId || ss.alias || '');
      const realUserId = aliasToUserId.get(rawId) || rawId;
      return { ...ss, userId: realUserId };
    });
  }

  return {
    ...report,
    studentScores10: updatedStudentScores10,
    memberParticipation: {
      ...report.memberParticipation,
      perMember: updatedPerMember,
    },
  };
}

