import { z } from 'zod';
import type { OpportunityEligibility } from './opportunity.gate';

// ── Output schema (validated by chatJSONWithMeta) ─────────────────────────────

export const opportunityResultSchema = z.object({
  hackathonFit: z.number().min(0).max(100),
  presentationFit: z.number().min(0).max(100),
  incubationFit: z.number().min(0).max(100),
  recommendations: z.array(
    z.object({
      type: z.enum(['HACKATHON', 'PRESENTATION', 'INCUBATION']),
      name: z.string().min(1),
      url: z.string().nullable(),
      why: z.string().min(1),
      deadline: z.string().nullable(),
    }),
  ),
});

export type OpportunityResult = z.infer<typeof opportunityResultSchema>;

// ── Project brief fed into the prompt ─────────────────────────────────────────

export interface ProjectOpportunityBrief {
  projectId: string;
  name: string;
  domain: string;
  soul: string | null;
  problemStatement: string | null;
  objective: string | null;
  expectedOutcome: string | null;
  innovation: string | null;
  targetUsers: string | null;
  expectedImpact: string | null;
  technologies: string[];
  publicationPotential: string | null;
  evaluations: Array<{
    cycle: number;
    overallScore: number;
  }>;
  github: {
    repoLink: string | null;
    commitCount: number;
    contributorCount: number;
  };
  eligibility: OpportunityEligibility;
  evidenceScore: number;
  /** Optional: pre-fetched web search context to inject as live opportunity data */
  searchContext?: string;
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

export function buildOpportunityPrompt(brief: ProjectOpportunityBrief): {
  system: string;
  user: string;
} {
  const enabledCategories: string[] = [];
  if (brief.eligibility.hackathon) enabledCategories.push('HACKATHON');
  if (brief.eligibility.presentation) enabledCategories.push('PRESENTATION');
  if (brief.eligibility.incubation) enabledCategories.push('INCUBATION');

  const system = `You are an expert opportunity matchmaker for high-quality student technical projects.
You have deep knowledge of the current landscape of global and Indian hackathons, academic conference presentation venues (IEEE, ACM, Springer, etc.), and startup incubation/acceleration programs (YC, NASSCOM, MSME, T-Hub, etc.).

This project has ALREADY cleared rigorous quality gates with evidence score ${brief.evidenceScore}/100. Your job is to:
1. Assess how well this project fits each opportunity category (score 0-100).
2. Identify SPECIFIC, CURRENTLY ACTIVE or UPCOMING opportunities by name — not just categories.
3. Use your knowledge of the current date (${new Date().toISOString().slice(0, 10)}) to prioritize upcoming deadlines.
4. Only recommend categories that are enabled for this project: [${enabledCategories.join(', ')}].

Instructions for each opportunity type:
- HACKATHON: Active hackathons on Devfolio, Unstop, MLH, HackerEarth, or major university fest platforms. Match domain and technology stack.
- PRESENTATION: Relevant IEEE/ACM conferences, national seminars, STTP, or faculty/industry demo days where this project can be presented. Consider domain and publication potential.
- INCUBATION: Active cohort applications at IIT/NIT/IIM incubators, NASSCOM 10K, MSME, T-Hub, ISEP, or similar. Only recommend if project has clear commercial angle.

CRITICAL RULES:
- Recommend real, named opportunities — never generic placeholder names like "Hackathon 2024".
- If a category is not in the enabled list [${enabledCategories.join(', ')}], set its fit score to 0 and produce no recommendations for it.
- Return ONLY raw valid JSON matching the schema. No markdown, no preamble, no explanation outside JSON.
- Aim for 2-4 high-confidence recommendations total, not an exhaustive list.
- The "why" field must be 1-2 sentences specific to THIS project's domain and technology.
- The "deadline" field should be "YYYY-MM-DD" format or null if not known with confidence.`;

  const user = `Project Details for Opportunity Matching:
Name: ${brief.name}
Domain: ${brief.domain}
One-Line Essence: ${brief.soul || 'N/A'}
Problem Statement: ${brief.problemStatement || 'N/A'}
Objective: ${brief.objective || 'N/A'}
Expected Outcome: ${brief.expectedOutcome || 'N/A'}
Innovation / Unique Angle: ${brief.innovation || 'N/A'}
Target Users: ${brief.targetUsers || 'N/A'}
Expected Impact: ${brief.expectedImpact || 'N/A'}
Technologies: ${brief.technologies.join(', ') || 'N/A'}
Publication Potential: ${brief.publicationPotential || 'N/A'}

GitHub Metrics:
Repo: ${brief.github.repoLink || 'Linked'}
Commits: ${brief.github.commitCount} | Contributors: ${brief.github.contributorCount}

Evaluation Cycle Trajectory:
${brief.evaluations.map((e) => `Cycle ${e.cycle}: Score ${e.overallScore}/100`).join('\n')}

Opportunity Evidence Score: ${brief.evidenceScore}/100
Enabled Opportunity Categories: ${enabledCategories.join(', ')}
${
  brief.searchContext
    ? `
--- Live Opportunity Context (Web Search Results) ---
${brief.searchContext}
--- End Context ---
`
    : ''
}
Return JSON exactly matching this schema:
{
  "hackathonFit": <0-100 integer>,
  "presentationFit": <0-100 integer>,
  "incubationFit": <0-100 integer>,
  "recommendations": [
    {
      "type": "HACKATHON" | "PRESENTATION" | "INCUBATION",
      "name": "<real opportunity name>",
      "url": "<URL or null>",
      "why": "<1-2 sentence justification specific to this project>",
      "deadline": "<YYYY-MM-DD or null>"
    }
  ]
}`;

  return { system, user };
}
