import { prisma } from '../../../shared/database';
import { ExecutionDocContent } from '../../../shared/projectLog.types';
import { findSkillGaps, normalizeSkill } from '../../../shared/skillMatch';
import { chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { projectLogService } from '../projectLog.service';
import { buildDocGeneratorPrompt } from '../prompts/docGenerator.prompt';
import { personalizationEngine } from './personalization';
import { renderDocMarkdown } from '../render/docMarkdown';

const CURATED_RESOURCES: Record<string, { topic: string; resource: string; url: string }> = {
  typescript: { topic: 'TypeScript', resource: 'Official TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/' },
  javascript: { topic: 'JavaScript', resource: 'MDN Web Docs - JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
  python: { topic: 'Python', resource: 'Official Python Tutorial', url: 'https://docs.python.org/3/tutorial/' },
  react: { topic: 'React', resource: 'Official React Documentation & Guides', url: 'https://react.dev/learn' },
  node: { topic: 'Node.js', resource: 'Node.js Official Documentation & Guides', url: 'https://nodejs.org/en/docs/' },
  express: { topic: 'Express.js', resource: 'Express Getting Started Guide', url: 'https://expressjs.com/en/starter/installing.html' },
  postgresql: { topic: 'PostgreSQL', resource: 'PostgreSQL Tutorial & Documentation', url: 'https://www.postgresql.org/docs/' },
  mongodb: { topic: 'MongoDB', resource: 'MongoDB University & Manual', url: 'https://www.mongodb.com/docs/' },
  tensorflow: { topic: 'TensorFlow', resource: 'TensorFlow Core Tutorials', url: 'https://www.tensorflow.org/tutorials' },
  pytorch: { topic: 'PyTorch', resource: 'PyTorch Official Tutorials', url: 'https://pytorch.org/tutorials/' },
  docker: { topic: 'Docker', resource: 'Docker Getting Started Guide', url: 'https://docs.docker.com/get-started/' },
  kubernetes: { topic: 'Kubernetes', resource: 'Kubernetes Basics & Tutorials', url: 'https://kubernetes.io/docs/tutorials/' },
};

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
      docContent = await chatJSON<ExecutionDocContent>(prompt, fallback, { feature: 'docGenerator' });

      // Validate work packages percentages
      docContent = this.validateAndNormalizePercentages(docContent, planningCtx.duration.months);
    }

    docContent = this.clampMilestoneWeeks(docContent, planningCtx.duration.months);

    // 4.2 Shared Skill gap analysis
    const memberSkillsMap: Record<string, string[]> = {};
    planningCtx.members.forEach((m: any) => {
      memberSkillsMap[m.userId] = m.skills || [];
    });

    const requiredSkills = docContent.skillsRequired || [];
    const missingGaps = findSkillGaps(requiredSkills, memberSkillsMap);

    // Ensure learningResources contains entries for missing skills (Curated lookup 4.4)
    missingGaps.forEach((gap) => {
      const normSkill = normalizeSkill(gap.skill);
      const curated = CURATED_RESOURCES[normSkill];

      const existsInRes = docContent.learningResources?.some((r) =>
        normalizeSkill(r.topic) === normSkill || r.topic.toLowerCase().includes(gap.skill.toLowerCase()),
      );

      if (!existsInRes) {
        if (!docContent.learningResources) docContent.learningResources = [];

        if (curated) {
          docContent.learningResources.push(curated);
        } else {
          docContent.learningResources.push({
            topic: gap.skill,
            resource: `Search official documentation, freeCodeCamp, or NPTEL tutorials for ${gap.skill}`,
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

  // 4.1 Sort, space, and deduplicate milestone completion weeks
  private clampMilestoneWeeks(doc: ExecutionDocContent, months: number): ExecutionDocContent {
    const totalWeeks = Math.max(1, Math.round(months * 4));
    if (!Array.isArray(doc.milestones) || doc.milestones.length === 0) return doc;

    // Step 1: Clamp within [1, totalWeeks]
    let milestones = doc.milestones.map((m) => ({
      ...m,
      completionWeek: Math.min(Math.max(1, Math.round(m.completionWeek) || totalWeeks), totalWeeks),
    }));

    // Step 2: Sort by completion week ascending
    milestones.sort((a, b) => a.completionWeek - b.completionWeek);

    // Step 3: Check clustering. If max week is in first 40% of duration, space evenly
    const maxWeek = milestones[milestones.length - 1].completionWeek;
    if (maxWeek < totalWeeks * 0.4 && milestones.length > 1) {
      const step = totalWeeks / milestones.length;
      milestones = milestones.map((m, idx) => ({
        ...m,
        completionWeek: Math.min(totalWeeks, Math.max(1, Math.round(step * (idx + 1)))),
      }));
    }

    // Step 4: Deduplicate week collisions by nudging forward
    const usedWeeks = new Set<number>();
    milestones.forEach((m) => {
      while (usedWeeks.has(m.completionWeek) && m.completionWeek < totalWeeks) {
        m.completionWeek++;
      }
      usedWeeks.add(m.completionWeek);
    });

    doc.milestones = milestones;
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
        'Scope inflation during initial module testing.',
      ],
      learningResources: [
        CURATED_RESOURCES.typescript,
        CURATED_RESOURCES.node,
      ],
      successCriteria: [
        'All work packages completed with active daily log validation.',
        'System prototype successfully demonstrates end-to-end functionality.',
      ],
      uniquenessNotes: variation?.summaryOfSimilarProjects || 'Deterministic standard engineering blueprint.',
    };
  }
}

export const docGeneratorEngine = new DocGeneratorEngine();
