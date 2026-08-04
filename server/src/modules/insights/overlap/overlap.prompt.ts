import { z } from 'zod';
import type { ProjectDocument } from './corpus';

export const overlapAnalysisSchema = z.object({
  verdict: z.enum(['DISTINCT', 'PARTIAL_OVERLAP', 'SUBSTANTIAL_OVERLAP', 'NEAR_DUPLICATE']),
  confidence: z.number().min(0).max(100),
  overlappingFeatures: z.array(z.string()),
  sharedTechnologies: z.array(z.string()),
  keyDifferences: z.array(z.string()),
  rationale: z.string(),
  recommendedAction: z.string(),
});

export type OverlapAnalysisResult = z.infer<typeof overlapAnalysisSchema>;

export function buildOverlapPrompt(projects: ProjectDocument[]): { system: string; user: string } {
  const system = `You are a senior AI technical auditor analyzing potential feature and project overlaps among student software and hardware projects.
Your goal is to determine if the given set of projects are building the same thing, partially overlapping in scope/features, or distinct despite sharing similar domains/tools.

Rules:
1. Focus on actual deliverables, problem statements, and feature sets.
2. NEAR_DUPLICATE: The projects are solving the same problem with nearly identical core feature sets and technical approaches.
3. SUBSTANTIAL_OVERLAP: Major core features heavily overlap (over 50% feature parity), though minor angles differ.
4. PARTIAL_OVERLAP: Shared components, libraries, or sub-features (e.g. both have an authentication or notification module), but overall project goals differ.
5. DISTINCT: The projects share technologies or general domain terms, but serve fundamentally different objectives or target users.
6. Provide specific, concise feature names in overlappingFeatures.
7. Return raw valid JSON matching the specified schema. No preamble or markdown fences.`;

  const projectBriefs = projects.map((p, idx) => `--- PROJECT ${idx + 1} ---
ID: ${p.projectId}
Name: ${p.name}
Domain: ${p.domain}
Problem Statement: ${p.problemStatement || 'N/A'}
Objective: ${p.objective || 'N/A'}
Differentiation Approach: ${p.differentiationApproach || 'N/A'}
Technologies: ${p.technologies.join(', ') || 'N/A'}
Hardware Components: ${p.hardwareComponents.join(', ') || 'N/A'}
Work Packages / Milestones: ${[...p.workPackageTitles, ...p.milestoneTitles].join('; ') || 'N/A'}
`).join('\n\n');

  const user = `Analyze the following ${projects.length} projects for overlap and potential duplication:\n\n${projectBriefs}`;

  return { system, user };
}
