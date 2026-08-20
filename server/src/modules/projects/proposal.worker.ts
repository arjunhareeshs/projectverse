import { prisma } from '../../shared/database';
import { logger } from '../../shared/logger';
import { validateIdea, generatePhasePlan } from '../intelligence/ideaIntelligence.service';
import { IdeaValidation } from '../intelligence/ideaIntelligence.schemas';

/**
 * Proposal analysis runs detached from the HTTP request that started it, so a
 * student can navigate away (or close the tab) mid-analysis without cancelling
 * it. The lifecycle is tracked on ProblemStatementProposal.verdict itself —
 * PENDING while the AI is running, then one of the terminal verdicts — so no
 * separate job table is needed.
 */
export const PROPOSAL_PENDING = 'PENDING';
export const PROPOSAL_FAILED = 'FAILED';

/** A PENDING row older than this was almost certainly orphaned by a restart. */
const STALE_PENDING_MS = 15 * 60 * 1000;

/**
 * Full audit snapshot of why the AI scored/decided what it did — stored in
 * ProblemStatementProposal.scores (Json). Not exposed to students; the read
 * controller only surfaces it to admins.
 */
function buildEvaluationSnapshot(evaluation: IdeaValidation) {
  return {
    overallScore: evaluation.overallScore,
    rubrics: evaluation.rubrics,
    industryRubrics: evaluation.industryRubrics,
    perspectives: evaluation.perspectives,
    hardwareConstraints: evaluation.hardwareConstraints,
    softwareRigor: evaluation.softwareRigor,
    hardFeasibilityBlocker: evaluation.hardFeasibilityBlocker,
    duplicate: evaluation.duplicate,
  };
}

async function persistNormalizedProposalData(proposalId: string, evaluation: IdeaValidation) {
  try {
    // 1. Normalized ProposalScore
    const scoreRecord = await prisma.proposalScore.upsert({
      where: { proposalId },
      create: {
        proposalId,
        overallScore: evaluation.overallScore,
        feasibility: evaluation.perspectives?.feasibility?.score,
        impact: evaluation.perspectives?.projectPotential?.score,
        novelty: evaluation.perspectives?.studentPotential?.score,
        technicalDepth: evaluation.perspectives?.effectiveness?.score,
        clarity: evaluation.rubrics?.clarity?.score,
      },
      update: {
        overallScore: evaluation.overallScore,
        feasibility: evaluation.perspectives?.feasibility?.score,
        impact: evaluation.perspectives?.projectPotential?.score,
        novelty: evaluation.perspectives?.studentPotential?.score,
        technicalDepth: evaluation.perspectives?.effectiveness?.score,
        clarity: evaluation.rubrics?.clarity?.score,
      },
    });

    // 2. Normalized Rubric Scores
    await prisma.proposalRubricScore.deleteMany({ where: { scoreId: scoreRecord.id } });
    const rubricRows: Array<{ scoreId: string; family: string; dimension: string; scoreValue: number; rationale: string | null }> = [];

    if (evaluation.rubrics) {
      for (const [dim, val] of Object.entries(evaluation.rubrics)) {
        if (val && typeof val === 'object' && 'score' in val) {
          rubricRows.push({
            scoreId: scoreRecord.id,
            family: 'RUBRIC',
            dimension: dim,
            scoreValue: Number((val as any).score) || 0,
            rationale: (val as any).rationale || null,
          });
        }
      }
    }

    if (evaluation.perspectives) {
      for (const [dim, val] of Object.entries(evaluation.perspectives)) {
        if (val && typeof val === 'object' && 'score' in val) {
          rubricRows.push({
            scoreId: scoreRecord.id,
            family: 'PERSPECTIVE',
            dimension: dim,
            scoreValue: Number((val as any).score) || 0,
            rationale: (val as any).rationale || null,
          });
        }
      }
    }

    if (rubricRows.length > 0) {
      await prisma.proposalRubricScore.createMany({ data: rubricRows });
    }

    // 3. Normalized ProposalExtraction
    const ext = evaluation.extracted;
    if (ext) {
      const extractionRecord = await prisma.proposalExtraction.upsert({
        where: { proposalId },
        create: {
          proposalId,
          problemStatement: ext.soul || null,
          proposedSolution: ext.title || null,
          targetAudience: null,
          domain: ext.domain || null,
        },
        update: {
          problemStatement: ext.soul || null,
          proposedSolution: ext.title || null,
          targetAudience: null,
          domain: ext.domain || null,
        },
      });

      await prisma.proposalExtractionItem.deleteMany({ where: { extractionId: extractionRecord.id } });
      const extractionItems: Array<{ extractionId: string; kind: string; value: string }> = [];

      (ext.technologies || []).forEach((t: string) => extractionItems.push({ extractionId: extractionRecord.id, kind: 'TECH', value: t }));
      (ext.outcomes || []).forEach((o: string) => extractionItems.push({ extractionId: extractionRecord.id, kind: 'DELIVERABLE', value: o }));
      (ext.skillsGained || []).forEach((s: string) => extractionItems.push({ extractionId: extractionRecord.id, kind: 'SKILL', value: s }));

      if (extractionItems.length > 0) {
        await prisma.proposalExtractionItem.createMany({ data: extractionItems });
      }
    }
  } catch (err: any) {
    logger.warn('Failed to persist normalized proposal data', { proposalId, error: err?.message });
  }
}

async function generateProblemId(prefix: 'H' | 'S' | 'HS') {
  const existing = await prisma.project.findMany({
    where: { problemId: { startsWith: prefix } },
    select: { problemId: true },
  });
  let max = 0;
  for (const e of existing) {
    const num = parseInt((e.problemId || '').replace(prefix, ''), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function typeToPrefix(type: string): 'H' | 'S' | 'HS' {
  if (type === 'Hardware' || type === 'IoT') return 'H';
  if (type === 'Hardware & Software' || type === 'Hybrid' || type === 'Combination') return 'HS';
  return 'S';
}

/**
 * Scores one PENDING proposal and, if accepted, publishes the catalog template
 * for it. Terminal state is always written to the proposal row — including on
 * failure — so a student is never left watching a spinner forever.
 */
export async function runProposalAnalysis(proposalId: string): Promise<void> {
  const proposal = await prisma.problemStatementProposal.findUnique({
    where: { id: proposalId },
    select: { id: true, rawText: true, verdict: true, submitterId: true },
  });

  if (!proposal) {
    logger.warn(`[proposalWorker] Proposal ${proposalId} no longer exists — skipping.`);
    return;
  }

  // Guards against a stale-recovery sweep racing the original in-process run.
  if (proposal.verdict !== PROPOSAL_PENDING) {
    return;
  }

  try {
    const submitter = await prisma.user.findUnique({
      where: { id: proposal.submitterId },
      select: { organizationId: true },
    });

    if (!submitter?.organizationId) {
      throw new Error('Submitter is no longer attached to an organization.');
    }

    const evaluation = await validateIdea(proposal.rawText);

    if (evaluation.verdict !== 'ACCEPTED') {
      // Rejections stay on record so repeat/duplicate submissions are auditable.
      await prisma.problemStatementProposal.update({
        where: { id: proposal.id },
        data: {
          scores: buildEvaluationSnapshot(evaluation),
          verdict: evaluation.verdict,
          reasons: evaluation.reasons,
          improvementHints: evaluation.improvementHints,
          duplicateOfId: evaluation.duplicate?.similarProjectId || null,
          extracted: evaluation.extracted,
        },
      });

      await persistNormalizedProposalData(proposal.id, evaluation);
      return;
    }

    const extracted = evaluation.extracted;
    const problemId = await generateProblemId(typeToPrefix(extracted.type || 'Software'));

    const featureTotal = evaluation.features.reduce((sum, f) => sum + f.points, 0);
    const weeks = 14;
    const phasePlan = await generatePhasePlan({
      problemStatement: proposal.rawText,
      projectType: extracted.type || 'Software',
      featureTotal,
      weeks,
    });

    // Publish the catalog entry and mark the proposal accepted together
    await prisma.$transaction(async (tx) => {
      const publishedProject = await tx.project.create({
        data: {
          organizationId: submitter.organizationId as string,
          name: extracted.title || proposal.rawText.slice(0, 50),
          shortName: extracted.title || proposal.rawText.slice(0, 30),
          soul: extracted.soul || proposal.rawText.slice(0, 120),
          problemStatement: proposal.rawText,
          description: proposal.rawText,
          domain: extracted.domain || 'Engineering',
          sector: extracted.sector || 'General',
          type: extracted.type || 'Software',
          difficultyLevel: String(extracted.difficultyLevel || '3'),
          technologies: extracted.technologies || [],
          deliverables: extracted.outcomes || [],
          outOfScope: extracted.outOfScope || null,
          skillsGained: extracted.skillsGained || [],
          prerequisites: extracted.prerequisites || [],
          problemId,
          status: 'CATALOG',
          isTemplate: true,
          maxTeams: 1, // Restricted to single team slot for proposed statements
        },
      });

      // Normalized ProjectDeliverable rows
      if (Array.isArray(extracted.outcomes) && extracted.outcomes.length > 0) {
        await tx.projectDeliverable.createMany({
          data: extracted.outcomes.map((text: string, idx: number) => ({
            projectId: publishedProject.id,
            text,
            order: idx,
          })),
        });
      }

      await tx.problemStatementProposal.update({
        where: { id: proposal.id },
        data: {
          scores: buildEvaluationSnapshot(evaluation),
          verdict: evaluation.verdict,
          reasons: evaluation.reasons,
          improvementHints: evaluation.improvementHints,
          duplicateOfId: evaluation.duplicate?.similarProjectId || null,
          extracted,
          publishedProjectId: publishedProject.id,
        },
      });

      if (evaluation.features.length > 0) {
        await tx.projectFeature.createMany({
          data: evaluation.features.map((f) => ({
            projectId: publishedProject.id,
            name: f.name,
            description: f.description,
            importance: f.importance,
            implementationMethod: f.implementationMethod,
            points: f.points,
            aiRationale: f.aiRationale,
            addedBy: 'AI',
          })),
        });
      }

      await tx.projectPhase.createMany({
        data: phasePlan.map((p) => ({
          projectId: publishedProject.id,
          phaseNumber: p.phaseNumber,
          title: p.title,
          expectedDeliverables: p.expectedDeliverables,
          weekTarget: p.weekTarget,
          points: p.points,
          hardwareNote: p.hardwareNote,
        })),
      });
    });

    await persistNormalizedProposalData(proposal.id, evaluation);
  } catch (error: any) {
    logger.error(`[proposalWorker] Analysis failed for proposal ${proposalId}: ${error?.message}`);
    await prisma.problemStatementProposal
      .update({
        where: { id: proposalId },
        data: {
          verdict: PROPOSAL_FAILED,
          reasons: ['Analysis could not be completed. Please submit your proposal again.'],
        },
      })
      .catch(() => undefined);
  }
}

/**
 * Fire-and-forget entry point used by the submit endpoint. Deliberately not
 * awaited by the request handler — that is the whole point of the detached run.
 */
export function queueProposalAnalysis(proposalId: string): void {
  void runProposalAnalysis(proposalId).catch((error) => {
    logger.error(`[proposalWorker] Unhandled analysis error for ${proposalId}: ${error?.message}`);
  });
}

/**
 * An in-process worker does not survive a restart: any proposal still PENDING
 * when the process died would spin forever on the student's screen. Called at
 * boot, this re-queues recent ones and fails the rest.
 */
export async function recoverStalePendingProposals(): Promise<void> {
  try {
    const pending = await prisma.problemStatementProposal.findMany({
      where: { verdict: PROPOSAL_PENDING },
      select: { id: true, createdAt: true },
    });

    if (pending.length === 0) return;

    const cutoff = Date.now() - STALE_PENDING_MS;
    const requeue = pending.filter((p) => p.createdAt.getTime() >= cutoff);
    const abandoned = pending.filter((p) => p.createdAt.getTime() < cutoff);

    if (abandoned.length > 0) {
      await prisma.problemStatementProposal.updateMany({
        where: { id: { in: abandoned.map((p) => p.id) } },
        data: {
          verdict: PROPOSAL_FAILED,
          reasons: ['Analysis was interrupted by a server restart. Please submit your proposal again.'],
        },
      });
    }

    requeue.forEach((p) => queueProposalAnalysis(p.id));

    logger.info(
      `[proposalWorker] Recovered ${pending.length} pending proposal(s): ` +
        `${requeue.length} re-queued, ${abandoned.length} failed as stale.`,
    );
  } catch (error: any) {
    logger.error(`[proposalWorker] Stale-proposal recovery failed: ${error?.message}`);
  }
}
