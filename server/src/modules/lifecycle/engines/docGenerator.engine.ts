import { prisma } from '../../../shared/database';
import { ExecutionDocContent } from '../../../shared/projectLog.types';
import { chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { projectLogService } from '../projectLog.service';
import { buildDocGeneratorPrompt } from '../prompts/docGenerator.prompt';
import { personalizationEngine } from './personalization';
import { renderDocMarkdown } from '../render/docMarkdown';
import { renderDocPdfBuffer } from '../render/docPdf';

export class DocGeneratorEngine {
  async generateDocument(projectId: string, actorUserId: string) {
    const planningCtx: any = await projectLogService.getContext(projectId, 'planning');

    if (!planningCtx.members || planningCtx.members.length === 0) {
      throw new Error('Precondition failed: Project must have at least 1 team member assigned before document generation.');
    }
    if (!planningCtx.duration || !planningCtx.duration.months) {
      throw new Error('Precondition failed: Project duration must be set before document generation.');
    }

    const variation = await personalizationEngine.getVariationDirectives(projectId, planningCtx);

    let docContent: ExecutionDocContent;
    let isFallback = false;

    if (!isLlmConfigured()) {
      docContent = this.getFallbackDocument(planningCtx, variation);
      isFallback = true;
    } else {
      const prompt = buildDocGeneratorPrompt(planningCtx, variation);
      const fallback = this.getFallbackDocument(planningCtx, variation);
      docContent = await chatJSON<ExecutionDocContent>(prompt, fallback);

      // Validate work packages percentages
      docContent = this.validateAndNormalizePercentages(docContent, planningCtx.duration.months);
    }

    docContent = this.clampMilestoneWeeks(docContent, planningCtx.duration.months);

    // Skills gap analysis
    const teamSkills = new Set<string>();
    planningCtx.members.forEach((m: any) => {
      (m.skills || []).forEach((s: string) => teamSkills.add(s.toLowerCase().trim()));
    });

    const requiredSkills = docContent.skillsRequired || [];
    const missingGaps: Array<{ skill: string; missingFor: string[] }> = [];

    requiredSkills.forEach((reqSkill) => {
      const normalizedReq = reqSkill.toLowerCase().trim();
      const hasSkill = Array.from(teamSkills).some((ts) => ts.includes(normalizedReq) || normalizedReq.includes(ts));

      if (!hasSkill) {
        const missingUserIds = planningCtx.members.map((m: any) => m.userId);
        missingGaps.push({ skill: reqSkill, missingFor: missingUserIds });

        // Ensure learningResources contains entry for missing skill
        const existsInRes = docContent.learningResources.some((r) => r.topic.toLowerCase().includes(normalizedReq));
        if (!existsInRes) {
          docContent.learningResources.push({
            topic: reqSkill,
            resource: `Search official documentation, freeCodeCamp, or NPTEL tutorials for ${reqSkill}`,
          });
        }
      }
    });

    // Render markdown
    const markdown = renderDocMarkdown(docContent, planningCtx.title);

    // Save ExecutionDocument
    const currentDoc = await prisma.executionDocument.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    const version = (currentDoc?.version || 0) + 1;

    const savedDoc = await prisma.executionDocument.create({
      data: {
        projectId,
        version,
        content: docContent as any,
        markdown,
      },
    });

    // Append log event
    await projectLogService.appendEvent(projectId, {
      type: version > 1 ? 'DOC_REGENERATED' : 'DOC_GENERATED',
      actorUserId,
      data: {
        version,
        workPackages: docContent.workBreakdown,
        milestones: docContent.milestones,
        skillsRequired: docContent.skillsRequired,
        gaps: missingGaps,
        uniquenessNotes: docContent.uniquenessNotes || variation?.summaryOfSimilarProjects,
      },
    });

    return {
      version,
      content: docContent,
      markdown,
      generatedAt: savedDoc.createdAt,
      fallback: isFallback,
    };
  }

  private validateAndNormalizePercentages(doc: ExecutionDocContent, months: number): ExecutionDocContent {
    if (!doc.workBreakdown || !Array.isArray(doc.workBreakdown) || doc.workBreakdown.length === 0) {
      return this.getFallbackDocument({ duration: { months }, title: 'Project' }, null);
    }

    let sum = doc.workBreakdown.reduce((acc, wp) => acc + (Number(wp.percentage) || 0), 0);
    if (sum !== 100 && Math.abs(sum - 100) <= 5) {
      // Normalize
      const factor = 100 / sum;
      let newSum = 0;
      doc.workBreakdown.forEach((wp, idx) => {
        if (idx === doc.workBreakdown.length - 1) {
          wp.percentage = 100 - newSum;
        } else {
          wp.percentage = Math.round(wp.percentage * factor);
          newSum += wp.percentage;
        }
      });
    }

    return doc;
  }

  private clampMilestoneWeeks(doc: ExecutionDocContent, months: number): ExecutionDocContent {
    const totalWeeks = Math.max(1, Math.round(months * 4));
    if (!Array.isArray(doc.milestones)) return doc;
    doc.milestones = doc.milestones.map((m) => ({
      ...m,
      completionWeek: Math.min(Math.max(1, Math.round(m.completionWeek) || totalWeeks), totalWeeks),
    }));
    return doc;
  }

  private getFallbackDocument(planningCtx: any, variation: any): ExecutionDocContent {
    const months = planningCtx.duration?.months || 6;
    const totalWeeks = months * 4;

    return {
      overview: {
        background: `System execution blueprint for ${planningCtx.title || 'Academic Project'}.`,
        purpose: 'Provide a structured 6-month undergraduate implementation pathway.',
        problemStatement: `Designing and executing a robust solution for ${planningCtx.title}.`,
        scope: 'Software / Hardware system design, development, integration, testing, and deployment.',
        expectedOutcome: 'A fully functional prototype with complete technical documentation.',
      },
      objectives: [
        'Complete system requirement analysis and architecture design.',
        'Implement core modules according to work package allocation.',
        'Validate performance metrics and produce evaluation documentation.',
      ],
      deliverables: [
        'Source code repository with technical documentation.',
        'Project execution log and 15-day evaluation reports.',
        'Final project report and prototype demonstration.',
      ],
      workBreakdown: [
        { id: 'req-arch', name: 'Requirements & Architecture', description: 'Domain modeling and initial prototype design.', percentage: 20 },
        { id: 'core-dev', name: 'Core Engine & Feature Development', description: 'Primary component implementation and testing.', percentage: 40 },
        { id: 'integration', name: 'Integration & Testing', description: 'System assembly, testing, and bug fixing.', percentage: 20 },
        { id: 'pm-wbs', name: 'Project Management', description: 'Sprint planning, log verification, and reviews.', percentage: 10 },
        { id: 'doc-ipr', name: 'Documentation & Final Presentation', description: 'Project report preparation and paper submission.', percentage: 10 },
      ],
      skillsRequired: ['TypeScript / Node.js', 'System Architecture', 'Testing & Verification'],
      milestones: [
        { name: 'Architecture Review', expectedOutput: 'Design specification doc', completionWeek: Math.round(totalWeeks * 0.25) },
        { name: 'Core Feature MVP', expectedOutput: 'Working prototype build', completionWeek: Math.round(totalWeeks * 0.5) },
        { name: 'System Integration', expectedOutput: 'Integrated build & test cases', completionWeek: Math.round(totalWeeks * 0.75) },
        { name: 'Final Review & Sign-off', expectedOutput: 'Final report & demo', completionWeek: totalWeeks },
      ],
      risks: [
        'Dependency delays during core integration.',
        'Skill gaps in domain-specific libraries.',
      ],
      learningResources: [
        { topic: 'TypeScript / Node.js', resource: 'Official documentation and tutorials' },
        { topic: 'System Architecture', resource: 'Software Engineering Best Practices guide' },
      ],
      successCriteria: [
        '100% completion of milestone deliverables.',
        'All work packages verified through daily logs and GitHub commits.',
      ],
      uniquenessNotes: variation?.summaryOfSimilarProjects || 'Standard template fallback execution document.',
    };
  }
}

export const docGeneratorEngine = new DocGeneratorEngine();
