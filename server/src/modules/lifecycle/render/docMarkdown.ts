import { ExecutionDocContent } from '../../../shared/projectLog.types';

export function renderDocMarkdown(doc: ExecutionDocContent, title: string): string {
  let md = `# Execution Document: ${title}\n\n`;

  if (doc.uniquenessNotes) {
    md += `> **Uniqueness & Scope Variation Notes:**\n> ${doc.uniquenessNotes}\n\n---\n\n`;
  }

  md += `## 1. Overview\n\n`;
  md += `**Background:** ${doc.overview.background}\n\n`;
  md += `**Purpose:** ${doc.overview.purpose}\n\n`;
  md += `**Problem Statement:** ${doc.overview.problemStatement}\n\n`;
  md += `**Scope:** ${doc.overview.scope}\n\n`;
  md += `**Expected Outcome:** ${doc.overview.expectedOutcome}\n\n`;

  md += `## 2. Measurable Objectives\n\n`;
  doc.objectives.forEach((obj, idx) => {
    md += `${idx + 1}. ${obj}\n`;
  });
  md += `\n`;

  md += `## 3. Project Deliverables\n\n`;
  doc.deliverables.forEach((del) => {
    md += `- ${del}\n`;
  });
  md += `\n`;

  md += `## 4. Work Breakdown Structure (WBS)\n\n`;
  md += `| ID | Package Name | Percentage | Description |\n`;
  md += `|---|---|---|---|\n`;
  doc.workBreakdown.forEach((wb) => {
    md += `| \`${wb.id}\` | ${wb.name} | ${wb.percentage}% | ${wb.description} |\n`;
  });
  md += `\n`;

  md += `## 5. Required Skills\n\n`;
  doc.skillsRequired.forEach((skill) => {
    md += `- ${skill}\n`;
  });
  md += `\n`;

  md += `## 6. Milestones & Schedule\n\n`;
  md += `| Milestone | Expected Output | Completion Week |\n`;
  md += `|---|---|---|\n`;
  doc.milestones.forEach((m) => {
    md += `| ${m.name} | ${m.expectedOutput} | Week ${m.completionWeek} |\n`;
  });
  md += `\n`;

  md += `## 7. Risk Management\n\n`;
  doc.risks.forEach((risk) => {
    md += `- ${risk}\n`;
  });
  md += `\n`;

  md += `## 8. Learning Resources\n\n`;
  doc.learningResources.forEach((res) => {
    md += `- **${res.topic}:** ${res.resource}${res.url ? ` ([Link](${res.url}))` : ''}\n`;
  });
  md += `\n`;

  md += `## 9. Success Criteria\n\n`;
  doc.successCriteria.forEach((crit) => {
    md += `- ${crit}\n`;
  });
  md += `\n`;

  return md;
}
