import { ChatMessage } from '../../ai/llm.service';

export function buildEvaluationPrompt(
  cycle: number,
  periodStart: string,
  periodEnd: string,
  evalContext: any,
  logsGrouped: any,
  githubCommits: any,
  previousEval: any,
  suspiciousPairs: any[],
): ChatMessage[] {
  const systemPrompt = `You are an experienced engineering project evaluator. Evaluate whether the work genuinely matches the approved execution plan.
Analyse scope adherence, progress, responsibility match, technical consistency (logged tech vs approved design), timeline consistency, duplicate behaviour, missing work, suspicious behaviour (repeated generic logs, copied wording, no measurable output, unrelated tasks, artificial progress, contradictory entries), authenticity 0–100, plagiarism risk LOW/MEDIUM/HIGH, mentor feedback, next-15-day recommendations, and the six /100 parameter scores.

Return ONLY JSON matching:
{
  "cycle": ${cycle},
  "periodStart": "${periodStart}",
  "periodEnd": "${periodEnd}",
  "scopeAdherence": { "score": 85, "notes": "..." },
  "technicalProgress": { "score": 80, "notes": "..." },
  "timelineCompliance": { "score": 90, "notes": "..." },
  "memberParticipation": {
    "score": 85,
    "notes": "...",
    "perMember": [
      { "userId": "...", "score": 90, "notes": "..." }
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

  const userPrompt = `Project Title: ${evalContext.title}
Category: ${evalContext.category}
Approved Work Packages: ${JSON.stringify(evalContext.workPackages)}
Milestones: ${JSON.stringify(evalContext.milestones)}
Team Members & Assigned Responsibilities: ${JSON.stringify(evalContext.team.members)}

Daily Work Logs in this 15-day period (Grouped by Member):
${JSON.stringify(logsGrouped, null, 2)}

GitHub Commit Evidence (Last 15 days):
${JSON.stringify(githubCommits, null, 2)}

Previous Cycle Summary:
${JSON.stringify(previousEval, null, 2)}

High Similarity / Potential Plagiarism Log Pairs Detected:
${JSON.stringify(suspiciousPairs, null, 2)}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
