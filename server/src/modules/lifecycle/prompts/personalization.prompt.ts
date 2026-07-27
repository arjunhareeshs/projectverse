import { ChatMessage } from '../../ai/llm.service';

export function buildPersonalizationPrompt(newProjectCtx: any, similarProjects: any[]): ChatMessage[] {
  const systemPrompt = `A new project resembles existing projects in the catalog. Preserve the core objective but introduce meaningful variation in one or more of: problem scope, target users, dataset, deployment environment, algorithms, sensors, hardware platform, performance goals, evaluation methodology, features, constraints, experimental setup, testing strategy.
At least 30–40% of the execution scope must genuinely differ while remaining academically valid. Wording-only differences are forbidden — the execution path must differ.

Return ONLY JSON:
{
  "dimensionsToVary": ["dataset", "deployment", "algorithms"],
  "directives": ["Use synthetic IoT sensor stream instead of public CSV dataset", ...],
  "summaryOfSimilarProjects": "Brief summary of how this differs from previous projects"
}`;

  const userPrompt = `New Project Title: ${newProjectCtx.title}
Category: ${newProjectCtx.category}
Technologies: ${newProjectCtx.technologies.join(', ')}

Similar Existing Projects Execution Plans:
${JSON.stringify(similarProjects, null, 2)}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
