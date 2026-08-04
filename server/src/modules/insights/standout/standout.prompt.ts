import { z } from 'zod';

export const standoutAnalysisSchema = z.object({
  verdict: z.enum(['NOT_YET', 'PROMISING', 'STARTUP_WORTHY']),
  confidence: z.number().min(0).max(100),
  oneLinePitch: z.string(),
  marketProblem: z.string(),
  differentiator: z.string(),
  defensibility: z.string(),
  targetMarket: z.string(),
  evidenceHighlights: z.array(z.string()),
  risks: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export type StandoutAnalysisResult = z.infer<typeof standoutAnalysisSchema>;

export interface ProjectStandoutBrief {
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
  useCases: string[] | null;
  expectedMetrics: any[] | null;
  technologies: string[];
  similarProducts: string[];
  publicationPotential: string | null;
  evaluations: Array<{
    cycle: number;
    overallScore: number;
    mentorFeedback: string | null;
  }>;
  github: {
    repoLink: string | null;
    commitCount: number;
    contributorCount: number;
    stars: number;
  };
}

export function buildStandoutPrompt(brief: ProjectStandoutBrief): { system: string; user: string } {
  const system = `You are an expert venture capitalist, startup accelerator director, and technical evaluator.
You are evaluating a student project that has ALREADY cleared rigorous deterministic execution gates (sustained high scores across multiple evaluation cycles, verified GitHub activity, and clean authenticity/plagiarism checks).

Your job is strictly to evaluate:
1. Novelty & Innovation: Is this genuine innovation vs competent but standard course work?
2. Market Problem & Target Market: Is there real commercial or social demand?
3. Defensibility & Differentiators: What makes this unique and hard to copy?
4. Readiness: Is it PROMISING or genuinely STARTUP_WORTHY?

Crucial instructions:
- Return 'STARTUP_WORTHY' only for projects with clear commercial potential, strong defensibility, and outstanding sustained execution.
- Return 'PROMISING' for high-quality projects with strong potential that require further market validation or product refinement.
- Return 'NOT_YET' for competent-but-derivative or purely academic projects.
- Return raw valid JSON matching the specified schema. No markdown wrapping or preamble.`;

  const user = `Project Details for Evaluation:
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
Similar Existing Products: ${brief.similarProducts.join(', ') || 'N/A'}
Publication Potential: ${brief.publicationPotential || 'N/A'}

GitHub Metrics:
Repo: ${brief.github.repoLink || 'Linked'}
Commits: ${brief.github.commitCount} | Contributors: ${brief.github.contributorCount} | Stars: ${brief.github.stars}

Evaluation Cycle Trajectory:
${brief.evaluations.map((e) => `Cycle ${e.cycle}: Score ${e.overallScore}/100 | Feedback: ${e.mentorFeedback || 'N/A'}`).join('\n')}`;

  return { system, user };
}
