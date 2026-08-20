import { z } from 'zod';
import { ChatMessage } from './llm.service';

export const EvaluationCategoryScoreSchema = z.object({
  score: z.number().min(0).max(100),
  notes: z.string().default(''),
  evidence: z.record(z.string(), z.any()).optional(),
});

export const EvaluationMemberScoreSchema = z.object({
  userId: z.string(), // May be alias M1/M2 during LLM inference, converted to real userId on return
  score: z.number().min(0).max(100),
  notes: z.string().default(''),
});

export const EvaluationReportSchema = z.object({
  cycle: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
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
      members: Array<{ userId: string; name?: string; responsibilities?: string[]; active?: boolean }>;
    };
  };
  logsGroupedByMember: Record<string, { entryCount: number; logs: Array<{ date: string; workDone: string; hours?: number }> }>;
  githubCommits: Array<{ sha: string; linkedUserId?: string | null; author?: string; message?: string; date: Date | string; isMerge?: boolean }>;
  previousEval: any;
  suspiciousPairs: Array<{ userId: string; date: string; similarityPercent: number }>;
}

/**
 * Serializes evaluation context into a leak-free LLM prompt.
 * Enforces:
 * 1. Alias mapping (no real user names, emails, cuids, or git author strings).
 * 2. Foreign text removal (cross-project plagiarism includes only similarity metrics).
 * 3. Commit anonymization (dateOnly, messageLength, isMerge, member alias).
 */
export function serializeEvaluationPrompt(input: RawEvaluationInput): SerializedEvaluationContext {
  const userIdToAlias = new Map<string, string>();
  const aliasToUserId = new Map<string, string>();

  // Deterministically create alias map (M1, M2, ...)
  input.evalContext.team.members.forEach((m, idx) => {
    const alias = `M${idx + 1}`;
    userIdToAlias.set(m.userId, alias);
    aliasToUserId.set(alias, m.userId);
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
    responsibilities: m.responsibilities || [],
    active: m.active !== false,
  }));

  // Anonymized daily logs
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

  const systemPrompt = `You are an experienced engineering project evaluator. Evaluate whether the work genuinely matches the approved execution plan.
Analyse scope adherence, progress, responsibility match, technical consistency (logged tech vs approved design), timeline consistency, duplicate behaviour, missing work, suspicious behaviour (repeated generic logs, copied wording, no measurable output, unrelated tasks, artificial progress, contradictory entries), authenticity 0–100, plagiarism risk LOW/MEDIUM/HIGH, mentor feedback, next-15-day recommendations, and the six /100 parameter scores.

Team members are identified by aliases (M1, M2, etc.).

Return ONLY JSON matching:
{
  "cycle": ${input.cycle},
  "periodStart": "${input.periodStart}",
  "periodEnd": "${input.periodEnd}",
  "scopeAdherence": { "score": 85, "notes": "..." },
  "technicalProgress": { "score": 80, "notes": "..." },
  "timelineCompliance": { "score": 90, "notes": "..." },
  "memberParticipation": {
    "score": 85,
    "notes": "...",
    "perMember": [
      { "userId": "M1", "score": 90, "notes": "..." }
    ]
  },
  "documentationQuality": { "score": 80, "notes": "..." },
  "authenticityConfidence": { "score": 90, "notes": "..." },
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

Previous Cycle Summary:
${JSON.stringify(input.previousEval || {}, null, 2)}

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
 * De-aliases the LLM response mapping M1, M2 back to actual userIds.
 */
export function dealiasEvaluationReport(
  report: any,
  aliasToUserId: Map<string, string>,
): any {
  if (!report || !report.memberParticipation || !Array.isArray(report.memberParticipation.perMember)) {
    return report;
  }

  const updatedPerMember = report.memberParticipation.perMember.map((pm: any) => {
    const rawId = String(pm.userId || pm.alias || '');
    const realUserId = aliasToUserId.get(rawId) || rawId;
    return {
      ...pm,
      userId: realUserId,
    };
  });

  return {
    ...report,
    memberParticipation: {
      ...report.memberParticipation,
      perMember: updatedPerMember,
    },
  };
}
