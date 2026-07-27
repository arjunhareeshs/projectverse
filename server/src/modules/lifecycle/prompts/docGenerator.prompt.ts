import { ChatMessage } from '../../ai/llm.service';

export function buildDocGeneratorPrompt(planningContext: any, variationDirectives?: any): ChatMessage[] {
  const systemPrompt = `You are an experienced engineering project mentor with expertise across Computer Science, AI, Mechanical, Electrical, Electronics, Biotechnology, Civil, Chemical, Agriculture, Robotics, IoT and interdisciplinary engineering projects.
Convert the student project title into a practical academic execution plan for a ${planningContext.duration.months}-month undergraduate project.
The document is the execution blueprint, not a topic explanation. Suitable for undergraduates — neither too simple nor too advanced. Focus on execution.

Return ONLY a JSON object matching this exact schema:
{
  "overview": {
    "background": "...",
    "purpose": "...",
    "problemStatement": "...",
    "scope": "...",
    "expectedOutcome": "..."
  },
  "objectives": ["measurable objective 1", "measurable objective 2", ...],
  "deliverables": ["deliverable 1", "deliverable 2", ...],
  "workBreakdown": [
    { "id": "pkg-1", "name": "Work Package 1", "description": "...", "percentage": 30 },
    ... 3 to 5 packages. Must include Project Management (~10%) and Documentation/IPR (~10%). All percentages MUST sum to exactly 100.
  ],
  "skillsRequired": ["Skill 1", "Skill 2", ...],
  "milestones": [
    { "name": "Milestone 1", "expectedOutput": "...", "completionWeek": 4 }
    ... completionWeek values MUST fit inside the total duration of ${planningContext.duration.months * 4} weeks.
  ],
  "risks": ["Risk 1", "Risk 2", ...],
  "learningResources": [
    { "topic": "Topic Name", "resource": "Resource description/link", "url": "optional url" }
  ],
  "successCriteria": ["Criteria 1", "Criteria 2", ...],
  "uniquenessNotes": "Optional description of scope variation"
}`;

  let userPrompt = `Project Title: ${planningContext.title}
Category: ${planningContext.category}
Department: ${planningContext.department || 'Engineering'}
Duration: ${planningContext.duration.months} months (${planningContext.duration.months * 4} weeks)
Decided Technologies: ${planningContext.technologies.join(', ') || 'To be decided'}
Team Members & Skills: ${JSON.stringify(planningContext.members)}`;

  if (variationDirectives) {
    userPrompt += `\n\nVARIATION DIRECTIVES (Apply these unique scope differences):
${JSON.stringify(variationDirectives)}
Be sure to fill "uniquenessNotes" in your output summarizing what differs in this execution plan.`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
