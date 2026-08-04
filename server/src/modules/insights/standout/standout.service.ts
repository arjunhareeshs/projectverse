import { prisma } from '../../../shared/database';
import { chatJSONWithMeta, isLlmConfigured } from '../../ai/llm.service';
import { evaluateStandoutGate, type GateEvaluationInput } from './gate';
import { buildStandoutPrompt, standoutAnalysisSchema, type StandoutAnalysisResult, type ProjectStandoutBrief } from './standout.prompt';

export class StandoutService {
  static async runStandoutDetection(): Promise<{ evaluatedCount: number; passedGateCount: number; standoutsCreated: number; standoutsUpdated: number }> {
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
        useCases: true,
        expectedMetrics: true,
        technologies: true,
        similarProducts: true,
        publicationPotential: true,
        differentiationApproach: true,
        repoLink: true,
        teamId: true,
        team: { select: { id: true, domain: true, name: true } },
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

    let evaluatedCount = 0;
    let passedGateCount = 0;
    let standoutsCreated = 0;
    let standoutsUpdated = 0;

    for (const p of projects) {
      evaluatedCount++;

      // Extract evaluation reports
      const reports = p.evaluationReports.map((r) => {
        const content = r.content as any;
        const perMember = Array.isArray(content?.memberParticipation?.perMember)
          ? content.memberParticipation.perMember.map((m: any) => ({
              memberId: String(m.memberId || m.userId),
              score: Number(m.score || m.contributionScore || 0),
            }))
          : [];

        const overallScore = Number(content?.overallScore || 0);
        const plagiarismRisk = content?.plagiarismRisk || null;
        const suspiciousBehaviour = Array.isArray(content?.suspiciousBehaviour) ? content.suspiciousBehaviour : [];
        const isFallback = Boolean(content?.isFallback);

        return {
          cycle: r.cycle,
          overallScore,
          plagiarismRisk,
          suspiciousBehaviour,
          isFallback,
          perMemberParticipation: perMember,
        };
      });

      // Calculate authenticity score (mean of evaluation content authenticityConfidence or default 80)
      let authenticityScore = 80;
      if (p.evaluationReports.length > 0) {
        const authScores = p.evaluationReports
          .map((r) => Number((r.content as any)?.authenticityConfidence?.score))
          .filter((s) => !isNaN(s) && s > 0);
        if (authScores.length > 0) {
          authenticityScore = authScores.reduce((a: number, b: number) => a + b, 0) / authScores.length;
        }
      }

      // Extract GitHub metrics
      const linked = Boolean(p.githubRepo);
      const commitCount = p.githubRepo?.commitCount || p.githubRepo?.commits?.length || 0;
      const contributorCount = p.githubRepo?.contributorCount || p.githubRepo?.contributors?.length || 0;

      // Count distinct ISO weeks for GitHub commits
      const distinctWeeksSet = new Set<string>();
      if (p.githubRepo?.commits) {
        for (const c of p.githubRepo.commits) {
          if (c.date) {
            const date = new Date(c.date);
            const year = date.getFullYear();
            const oneJan = new Date(year, 0, 1);
            const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
            const resultWeek = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
            distinctWeeksSet.add(`${year}-W${resultWeek}`);
          }
        }
      }

      // Check severe overlap flags
      const hasSevereOverlapFlag = p.overlapMembers.some(
        (m: any) =>
          m.flag.status === 'OPEN' &&
          (m.flag.severity === 'SUBSTANTIAL_OVERLAP' || m.flag.severity === 'NEAR_DUPLICATE')
      );

      const gateInput: GateEvaluationInput = {
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
      };

      const gateResult = evaluateStandoutGate(gateInput);
      if (!gateResult.passed) continue;

      passedGateCount++;

      // Check existing StandoutProject record
      const existingStandout = await prisma.standoutProject.findUnique({
        where: { projectId: p.id },
      });

      if (existingStandout && existingStandout.lastCycleSeen >= gateResult.metrics.lastCycleSeen) {
        // Up to date
        continue;
      }

      // Prepare project brief for LLM
      const brief: ProjectStandoutBrief = {
        projectId: p.id,
        name: p.name,
        domain: p.domain || p.team?.domain || 'General',
        soul: p.soul,
        problemStatement: p.problemStatement,
        objective: p.objective,
        expectedOutcome: p.expectedOutcome,
        innovation: p.innovation,
        targetUsers: p.targetUsers,
        expectedImpact: p.expectedImpact,
        useCases: (p.useCases as string[]) || null,
        expectedMetrics: (p.expectedMetrics as any[]) || null,
        technologies: p.technologies || [],
        similarProducts: p.similarProducts || [],
        publicationPotential: p.publicationPotential,
        evaluations: p.evaluationReports.map((r) => ({
          cycle: r.cycle,
          overallScore: Number((r.content as any)?.overallScore || 0),
          mentorFeedback: (r.content as any)?.mentorFeedback || null,
        })),
        github: {
          repoLink: p.repoLink,
          commitCount,
          contributorCount,
          stars: 0,
        },
      };

      let analysis: StandoutAnalysisResult;
      let isFallback = false;

      if (isLlmConfigured()) {
        const { system, user } = buildStandoutPrompt(brief);
        const fallbackVal: StandoutAnalysisResult = {
          verdict: gateResult.evidenceScore >= 85 ? 'STARTUP_WORTHY' : 'PROMISING',
          confidence: 75,
          oneLinePitch: p.soul || p.name,
          marketProblem: p.problemStatement || 'Market problem scoping in progress.',
          differentiator: p.innovation || p.differentiationApproach || 'High sustained technical execution.',
          defensibility: 'Sustained execution track record and verified code repository.',
          targetMarket: p.targetUsers || 'Target market defined by project domain.',
          evidenceHighlights: [
            `Sustained quality score of ${gateResult.metrics.avgScore.toFixed(1)} across ${gateResult.metrics.cyclesEvaluated} evaluation cycles.`,
            `Verified GitHub repository with ${commitCount} commits across ${distinctWeeksSet.size} active weeks.`,
          ],
          risks: ['Market competition and go-to-market execution risk.'],
          nextSteps: ['Conduct customer interviews to validate demand.', 'Prepare product demo for stakeholders.'],
        };

        const llmRes = await chatJSONWithMeta<StandoutAnalysisResult>(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          fallbackVal,
          { schema: standoutAnalysisSchema, feature: 'standout_adjudication' }
        );

        analysis = llmRes.data;
        isFallback = llmRes.degraded;
      } else {
        isFallback = true;
        analysis = {
          verdict: gateResult.evidenceScore >= 85 ? 'STARTUP_WORTHY' : 'PROMISING',
          confidence: 70,
          oneLinePitch: p.soul || p.name,
          marketProblem: p.problemStatement || 'Market problem statement.',
          differentiator: p.innovation || 'Verified high performance execution.',
          defensibility: 'High sustained cycle scores and GitHub commit activity.',
          targetMarket: p.targetUsers || 'Industry domain users.',
          evidenceHighlights: [
            `Cleared deterministic gate with evidence score ${gateResult.evidenceScore}/100.`,
            `Maintained min score of ${gateResult.metrics.minScore} across all cycles.`,
          ],
          risks: ['LLM key not configured; narrative analysis generated from deterministic metrics.'],
          nextSteps: ['Validate value proposition with domain experts.'],
        };
      }

      if (analysis.verdict === 'NOT_YET') {
        if (existingStandout) {
          await prisma.standoutProject.update({
            where: { id: existingStandout.id },
            data: { status: 'DISMISSED' },
          });
        }
        continue;
      }

      const standoutData = {
        projectId: p.id,
        teamId: p.teamId,
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        evidenceScore: gateResult.evidenceScore,
        cyclesEvaluated: gateResult.metrics.cyclesEvaluated,
        avgScore: gateResult.metrics.avgScore,
        minScore: gateResult.metrics.minScore,
        trendDelta: gateResult.metrics.trendDelta,
        lastCycleSeen: gateResult.metrics.lastCycleSeen,
        oneLinePitch: analysis.oneLinePitch,
        marketProblem: analysis.marketProblem,
        differentiator: analysis.differentiator,
        defensibility: analysis.defensibility,
        targetMarket: analysis.targetMarket,
        evidenceHighlights: analysis.evidenceHighlights,
        risks: analysis.risks,
        nextSteps: analysis.nextSteps,
        isFallback,
        status: existingStandout ? existingStandout.status : 'OPEN',
      };

      if (existingStandout) {
        await prisma.standoutProject.update({
          where: { id: existingStandout.id },
          data: standoutData,
        });
        standoutsUpdated++;
      } else {
        await prisma.standoutProject.create({
          data: standoutData,
        });
        standoutsCreated++;
      }
    }

    return { evaluatedCount, passedGateCount, standoutsCreated, standoutsUpdated };
  }
}
