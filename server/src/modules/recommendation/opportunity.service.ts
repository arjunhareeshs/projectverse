import { prisma } from '../../shared/database';
import { chatJSONWithMeta, isLlmConfigured } from '../ai/llm.service';
import { evaluateOpportunityGate, type OpportunityGateInput } from './opportunity.gate';
import {
  buildOpportunityPrompt,
  opportunityResultSchema,
  type OpportunityResult,
  type ProjectOpportunityBrief,
} from './opportunity.prompt';
import { notificationService } from '../notifications/notification.service';

export interface OpportunityMatchingStats {
  evaluatedCount: number;
  passedGateCount: number;
  skippedStaleCount: number;
  createdCount: number;
  updatedCount: number;
  fallbackCount: number;
}

export class OpportunityService {
  /**
   * Main pipeline entry point. Mirrors StandoutService.runStandoutDetection().
   *
   * For every real (non-template) project with a team:
   * 1. Evaluate the opportunity gate (reuses standout gate + context checks).
   * 2. Skip if the cached record is already up-to-date (same lastCycleSeen).
   * 3. Call the LLM with a deterministic fallback if LLM is unconfigured/degraded.
   * 4. Upsert the OpportunityRecommendation row.
   * 5. Notify the team via broadcastToTeam (title prefixed with 🤖 so it reads as AI-originated).
   */
  static async runOpportunityMatching(): Promise<OpportunityMatchingStats> {
    const projects = await prisma.project.findMany({
      where: {
        isTemplate: false,
        teamId: { not: null },
      },
      select: {
        id: true,
        name: true,
        domain: true,
        soul: true,
        problemStatement: true,
        objective: true,
        expectedOutcome: true,
        innovation: true,
        targetUsers: true,
        expectedImpact: true,
        technologies: true,
        publicationPotential: true,
        repoLink: true,
        teamId: true,
        evaluationReports: {
          orderBy: { cycle: 'asc' },
          select: { id: true, cycle: true, content: true },
        },
        githubRepo: {
          select: {
            id: true,
            commitCount: true,
            contributorCount: true,
            commits: { select: { date: true } },
            contributors: { select: { username: true } },
          },
        },
        overlapMembers: {
          select: {
            flag: { select: { status: true, severity: true } },
          },
        },
      },
    });

    const stats: OpportunityMatchingStats = {
      evaluatedCount: 0,
      passedGateCount: 0,
      skippedStaleCount: 0,
      createdCount: 0,
      updatedCount: 0,
      fallbackCount: 0,
    };

    for (const p of projects) {
      stats.evaluatedCount++;

      // ── Extract evaluation report data ──────────────────────────────────────
      const reports = p.evaluationReports.map((r) => {
        const content = r.content as any;
        const perMember = Array.isArray(content?.memberParticipation?.perMember)
          ? content.memberParticipation.perMember.map((m: any) => ({
              memberId: String(m.memberId || m.userId),
              score: Number(m.score || m.contributionScore || 0),
            }))
          : [];

        return {
          cycle: r.cycle,
          overallScore: Number(content?.overallScore || 0),
          plagiarismRisk: (content?.plagiarismRisk || null) as 'LOW' | 'MEDIUM' | 'HIGH' | null,
          suspiciousBehaviour: Array.isArray(content?.suspiciousBehaviour)
            ? content.suspiciousBehaviour
            : [],
          isFallback: Boolean(content?.isFallback),
          perMemberParticipation: perMember,
        };
      });

      // ── Authenticity score ──────────────────────────────────────────────────
      let authenticityScore = 80;
      if (p.evaluationReports.length > 0) {
        const authScores = p.evaluationReports
          .map((r) => Number((r.content as any)?.authenticityConfidence?.score))
          .filter((s) => !isNaN(s) && s > 0);
        if (authScores.length > 0) {
          authenticityScore = authScores.reduce((a, b) => a + b, 0) / authScores.length;
        }
      }

      // ── GitHub metrics ──────────────────────────────────────────────────────
      const linked = Boolean(p.githubRepo);
      const commitCount = p.githubRepo?.commitCount ?? p.githubRepo?.commits?.length ?? 0;
      const contributorCount = p.githubRepo?.contributorCount ?? p.githubRepo?.contributors?.length ?? 0;

      const distinctWeeksSet = new Set<string>();
      if (p.githubRepo?.commits) {
        for (const c of p.githubRepo.commits) {
          if (c.date) {
            const date = new Date(c.date);
            const year = date.getFullYear();
            const oneJan = new Date(year, 0, 1);
            const numberOfDays = Math.floor(
              (date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000),
            );
            const weekNum = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
            distinctWeeksSet.add(`${year}-W${weekNum}`);
          }
        }
      }

      // ── Severe overlap check ────────────────────────────────────────────────
      const hasSevereOverlapFlag = p.overlapMembers.some(
        (m: any) =>
          m.flag.status === 'OPEN' &&
          (m.flag.severity === 'SUBSTANTIAL_OVERLAP' || m.flag.severity === 'NEAR_DUPLICATE'),
      );

      // ── Run opportunity gate ────────────────────────────────────────────────
      const gateInput: OpportunityGateInput = {
        projectId: p.id,
        reports,
        authenticityScore,
        github: {
          linked,
          commitCount,
          contributorCount,
          distinctIsoWeeks: distinctWeeksSet.size,
        },
        hasSevereOverlapFlag,
        domain: p.domain,
        technologies: p.technologies || [],
        problemStatement: p.problemStatement,
      };

      const gateResult = evaluateOpportunityGate(gateInput);

      if (!gateResult.baseGatePassed || !gateResult.hasSearchableContext) {
        console.log(
          `[Recommendation] Project ${p.id} skipped: ${gateResult.skipReasons.slice(0, 2).join('; ')}`,
        );
        continue;
      }

      stats.passedGateCount++;

      // ── Staleness check (same as standout pattern) ──────────────────────────
      const existing = await prisma.opportunityRecommendation.findUnique({
        where: { projectId: p.id },
      });

      if (existing && existing.lastCycleSeen >= gateResult.gate.metrics.lastCycleSeen) {
        stats.skippedStaleCount++;
        continue;
      }

      // ── Build project brief for LLM ─────────────────────────────────────────
      const brief: ProjectOpportunityBrief = {
        projectId: p.id,
        name: p.name,
        domain: p.domain || 'General',
        soul: p.soul,
        problemStatement: p.problemStatement,
        objective: p.objective,
        expectedOutcome: p.expectedOutcome,
        innovation: p.innovation,
        targetUsers: p.targetUsers,
        expectedImpact: p.expectedImpact,
        technologies: p.technologies || [],
        publicationPotential: p.publicationPotential,
        evaluations: p.evaluationReports.map((r) => ({
          cycle: r.cycle,
          overallScore: Number((r.content as any)?.overallScore || 0),
        })),
        github: {
          repoLink: p.repoLink,
          commitCount,
          contributorCount,
        },
        eligibility: gateResult.eligibility,
        evidenceScore: gateResult.gate.evidenceScore,
      };

      // ── LLM call with graceful fallback ────────────────────────────────────
      let result: OpportunityResult;
      let isFallback = false;

      if (isLlmConfigured()) {
        const { system, user } = buildOpportunityPrompt(brief);

        const fallbackResult = OpportunityService.buildFallback(brief, gateResult.gate.evidenceScore);

        const llmRes = await chatJSONWithMeta<OpportunityResult>(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          fallbackResult,
          { schema: opportunityResultSchema, feature: 'opportunity_matching' },
        );

        result = llmRes.data;
        isFallback = llmRes.degraded;
      } else {
        result = OpportunityService.buildFallback(brief, gateResult.gate.evidenceScore);
        isFallback = true;
      }

      // ── Composite opportunity score ─────────────────────────────────────────
      // Weighted blend of sub-scores, gated by eligibility
      const { hackathon, presentation, incubation } = gateResult.eligibility;
      const opportunityScore = Math.round(
        (hackathon ? result.hackathonFit * 0.35 : 0) +
          (presentation ? result.presentationFit * 0.35 : 0) +
          (incubation ? result.incubationFit * 0.30 : 0) +
          // If some dimensions are disabled, redistribute weight to base evidence
          (!hackathon && !incubation ? gateResult.gate.evidenceScore * 0.30 : 0) +
          (!presentation ? gateResult.gate.evidenceScore * 0.35 : 0),
      );

      // ── Upsert record ───────────────────────────────────────────────────────
      const recordData = {
        projectId: p.id,
        teamId: p.teamId,
        opportunityScore: Math.min(100, opportunityScore),
        cyclesEvaluated: gateResult.gate.metrics.cyclesEvaluated,
        lastCycleSeen: gateResult.gate.metrics.lastCycleSeen,
        hackathonFit: result.hackathonFit,
        presentationFit: result.presentationFit,
        incubationFit: result.incubationFit,
        recommendations: result.recommendations as any,
        isFallback,
        // Preserve existing review status on update; 'OPEN' on first creation
        status: existing ? existing.status : 'OPEN',
      };

      let isNewRecord = false;
      if (existing) {
        await prisma.opportunityRecommendation.update({
          where: { id: existing.id },
          data: recordData,
        });
        stats.updatedCount++;
      } else {
        await prisma.opportunityRecommendation.create({ data: recordData });
        stats.createdCount++;
        isNewRecord = true;
      }

      if (isFallback) stats.fallbackCount++;

      // ── Notify team ────────────────────────────────────────────────────────
      // Only send a notification on first creation (or when the team ID is known).
      // On updates the admin can re-check the dashboard.
      if (p.teamId && isNewRecord) {
        const topRec = result.recommendations[0];
        const body = topRec
          ? `Top match: "${topRec.name}" (${topRec.type}) — ${topRec.why}`
          : `Project "${p.name}" has been matched with new external opportunities. Review in the admin portal.`;

        await notificationService.broadcastToTeam(
          p.teamId,
          `🤖 AI Recommendation: Opportunity Match Found for "${p.name}"`,
          body,
        );
      }
    }

    console.log('[Recommendation] Opportunity matching complete:', stats);
    return stats;
  }

  /**
   * Deterministic fallback for when LLM is unconfigured or the call degrades.
   * Derives sub-scores directly from evidenceScore so the result is at least
   * meaningful and consistent with the gate output.
   */
  private static buildFallback(
    brief: ProjectOpportunityBrief,
    evidenceScore: number,
  ): OpportunityResult {
    const { hackathon, presentation, incubation } = brief.eligibility;

    const hackathonFit = hackathon ? Math.round(evidenceScore * 0.9) : 0;
    const presentationFit = presentation ? Math.round(evidenceScore * 0.85) : 0;
    const incubationFit = incubation ? Math.round(evidenceScore * 0.75) : 0;

    const recommendations: OpportunityResult['recommendations'] = [];

    if (hackathon) {
      recommendations.push({
        type: 'HACKATHON',
        name: 'Smart India Hackathon (SIH)',
        url: 'https://www.sih.gov.in/',
        why: `${brief.domain} projects built with ${brief.technologies.slice(0, 2).join(' and ')} are a strong fit for SIH's national innovation mandate.`,
        deadline: null,
      });
    }

    if (presentation) {
      recommendations.push({
        type: 'PRESENTATION',
        name: 'IEEE International Conference on Electronics, Computing and Communication Technologies (CONECCT)',
        url: 'https://ieee-conecct.org/',
        why: `This project's technical depth in ${brief.domain} makes it well-suited for peer-reviewed IEEE proceedings.`,
        deadline: null,
      });
    }

    if (incubation) {
      recommendations.push({
        type: 'INCUBATION',
        name: 'NASSCOM 10,000 Startups',
        url: 'https://10000startups.com/',
        why: `The project demonstrates sustained technical execution and commercial potential in the ${brief.domain} space, aligning with NASSCOM's startup cohort criteria.`,
        deadline: null,
      });
    }

    return { hackathonFit, presentationFit, incubationFit, recommendations };
  }
}
