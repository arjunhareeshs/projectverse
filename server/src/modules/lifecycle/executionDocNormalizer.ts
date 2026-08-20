import { prisma } from '../../shared/database';
import { ExecutionDocContent } from '../../shared/projectLog.types';
import { logger } from '../../shared/logger';

export async function persistExecutionDocNormalized(
  executionDocumentId: string,
  content: ExecutionDocContent,
): Promise<void> {
  try {
    // 1. Overview
    if (content.overview) {
      await prisma.executionDocOverview.upsert({
        where: { executionDocumentId },
        create: {
          executionDocumentId,
          background: content.overview.background || null,
          purpose: content.overview.purpose || null,
          problemStatement: content.overview.problemStatement || null,
          scope: content.overview.scope || null,
          expectedOutcome: content.overview.expectedOutcome || null,
          targetUsers: content.targetUsers || null,
          uniquenessNotes: content.uniquenessNotes || null,
        },
        update: {
          background: content.overview.background || null,
          purpose: content.overview.purpose || null,
          problemStatement: content.overview.problemStatement || null,
          scope: content.overview.scope || null,
          expectedOutcome: content.overview.expectedOutcome || null,
          targetUsers: content.targetUsers || null,
          uniquenessNotes: content.uniquenessNotes || null,
        },
      });
    }

    // 2. Objectives
    if (Array.isArray(content.objectives) && content.objectives.length > 0) {
      await prisma.executionDocObjective.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocObjective.createMany({
        data: content.objectives.map((text, idx) => ({
          executionDocumentId,
          text: String(text),
          order: idx,
        })),
      });
    }

    // 3. Deliverables
    if (Array.isArray(content.deliverables) && content.deliverables.length > 0) {
      await prisma.executionDocDeliverable.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocDeliverable.createMany({
        data: content.deliverables.map((text, idx) => ({
          executionDocumentId,
          text: String(text),
          order: idx,
        })),
      });
    }

    // 4. Risks
    if (Array.isArray(content.risks) && content.risks.length > 0) {
      await prisma.executionDocRisk.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocRisk.createMany({
        data: content.risks.map((text, idx) => ({
          executionDocumentId,
          text: String(text),
          order: idx,
        })),
      });
    }

    // 5. Success Criteria
    if (Array.isArray(content.successCriteria) && content.successCriteria.length > 0) {
      await prisma.executionDocSuccessCriteria.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocSuccessCriteria.createMany({
        data: content.successCriteria.map((text, idx) => ({
          executionDocumentId,
          text: String(text),
          order: idx,
        })),
      });
    }

    // 6. Skills Required
    if (Array.isArray(content.skillsRequired) && content.skillsRequired.length > 0) {
      await prisma.executionDocSkillRequired.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocSkillRequired.createMany({
        data: content.skillsRequired.map((skill, idx) => ({
          executionDocumentId,
          skill: String(skill),
          order: idx,
        })),
      });
    }

    // 7. Work Breakdown / Packages
    if (Array.isArray(content.workBreakdown) && content.workBreakdown.length > 0) {
      await prisma.executionDocWorkPackage.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocWorkPackage.createMany({
        data: content.workBreakdown.map((wp, idx) => ({
          executionDocumentId,
          slug: wp.id || `wp-${idx + 1}`,
          name: wp.name || `Work Package ${idx + 1}`,
          description: wp.description || null,
          percentage: Number(wp.percentage) || 0,
          order: idx,
        })),
      });
    }

    // 8. Milestones
    if (Array.isArray(content.milestones) && content.milestones.length > 0) {
      await prisma.executionDocMilestone.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocMilestone.createMany({
        data: content.milestones.map((m, idx) => ({
          executionDocumentId,
          name: m.name || `Milestone ${idx + 1}`,
          expectedOutput: m.expectedOutput || null,
          completionWeek: Number(m.completionWeek) || idx + 1,
          rewardPoints: Number(m.rewardPoints) || 0,
          order: idx,
        })),
      });
    }

    // 9. Learning Resources
    if (Array.isArray(content.learningResources) && content.learningResources.length > 0) {
      await prisma.executionDocLearningResource.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocLearningResource.createMany({
        data: content.learningResources.map((lr, idx) => ({
          executionDocumentId,
          topic: lr.topic || '',
          resource: lr.resource || '',
          url: lr.url || null,
          order: idx,
        })),
      });
    }

    // 10. Features (Allocation System)
    if (Array.isArray(content.features) && content.features.length > 0) {
      await prisma.executionDocFeature.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocFeature.createMany({
        data: content.features.map((f, idx) => ({
          executionDocumentId,
          name: f.name || `Feature ${idx + 1}`,
          description: f.description || null,
          importance: f.importance || 'Medium',
          points: Number(f.points) || 0,
          implementationMethod: (f as any).implementationMethod || null,
          aiRationale: (f as any).aiRationale || null,
          order: idx,
        })),
      });
    }

    // 11. Team Share (Allocation System)
    if (Array.isArray(content.teamShare) && content.teamShare.length > 0) {
      await prisma.executionDocTeamShare.deleteMany({ where: { executionDocumentId } });
      await prisma.executionDocTeamShare.createMany({
        data: content.teamShare.map((ts, idx) => ({
          executionDocumentId,
          userId: ts.userId || null,
          name: ts.name || 'Member',
          role: ts.role || 'Developer',
          sharePercent: Number(ts.sharePercent) || 0,
          rewardPoints: Number(ts.rewardPoints) || 0,
          isLead: !!ts.isLead,
          order: idx,
        })),
      });
    }
  } catch (err: any) {
    logger.warn('Failed to persist normalized execution document data', { executionDocumentId, error: err?.message });
  }
}
