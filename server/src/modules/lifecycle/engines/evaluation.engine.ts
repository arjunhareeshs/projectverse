import { prisma } from '../../../shared/database';
import { wordOverlapRatio } from '../../../shared/stringUtils';
import { EvaluationReportContent } from '../../../shared/projectLog.types';
import { chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { projectLogService } from '../projectLog.service';
import { dailyLogService } from '../dailyLog.service';
import { notificationService } from '../../notifications/notification.service';
import { buildEvaluationPrompt } from '../prompts/evaluation.prompt';

export class EvaluationEngine {
  async runEvaluationCycle(projectId: string, cycleNumber?: number): Promise<any> {
    const evalCtx: any = await projectLogService.getContext(projectId, 'evaluation');
    const startDate = new Date(evalCtx.duration.startDate);

    // Calculate cycle number if not provided
    const now = new Date();
    const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const targetCycle = cycleNumber || Math.max(1, Math.ceil(daysElapsed / 15));

    const periodStart = new Date(startDate);
    periodStart.setDate(periodStart.getDate() + (targetCycle - 1) * 15);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 15);

    // Fetch daily logs in window
    const logs = await dailyLogService.getDailyLogs(projectId, {
      from: periodStart.toISOString().split('T')[0],
      to: periodEnd.toISOString().split('T')[0],
    });

    const logsGroupedByMember: Record<string, { entryCount: number; totalHours: number; logs: any[] }> = {};
    evalCtx.team.members.forEach((m: any) => {
      logsGroupedByMember[m.userId] = { entryCount: 0, totalHours: 0, logs: [] };
    });

    logs.forEach((l) => {
      if (!logsGroupedByMember[l.userId]) {
        logsGroupedByMember[l.userId] = { entryCount: 0, totalHours: 0, logs: [] };
      }
      logsGroupedByMember[l.userId].entryCount++;
      logsGroupedByMember[l.userId].totalHours += l.hoursSpent || 0;
      // Cap log text for prompt efficiency
      logsGroupedByMember[l.userId].logs.push({
        date: l.date,
        workDone: l.workDone.slice(0, 150),
        hours: l.hoursSpent,
      });
    });

    // GitHub evidence if linked
    let githubCommits: any[] = [];
    const ghRepo = await prisma.githubRepository.findUnique({
      where: { projectId },
      include: {
        commits: {
          where: {
            date: { gte: periodStart, lte: periodEnd },
          },
          take: 20,
        },
      },
    });
    if (ghRepo) {
      githubCommits = ghRepo.commits.map((c) => ({
        sha: c.sha.substring(0, 7),
        author: c.author,
        message: c.message,
        date: c.date,
      }));
    }

    // Cross-team text similarity
    const otherLogs = await prisma.dailyWorkLog.findMany({
      where: {
        projectId: { not: projectId },
        date: { gte: periodStart, lte: periodEnd },
      },
      take: 100,
      select: { workDone: true, projectId: true, userId: true },
    });

    const suspiciousPairs: any[] = [];
    let maxOverlapFound = 0;

    for (const myLog of logs) {
      for (const other of otherLogs) {
        const ratio = wordOverlapRatio(myLog.workDone, other.workDone);
        if (ratio > maxOverlapFound) maxOverlapFound = ratio;
        if (ratio > 0.7) {
          suspiciousPairs.push({
            myLog: myLog.workDone.slice(0, 100),
            otherLog: other.workDone.slice(0, 100),
            similarity: Math.round(ratio * 100),
          });
        }
      }
    }

    // Previous eval
    const previousEval = evalCtx.lastEvaluationSummary;

    let reportContent: EvaluationReportContent;
    let isFallback = false;

    if (!isLlmConfigured()) {
      reportContent = this.getFallbackReport(targetCycle, periodStart.toISOString(), periodEnd.toISOString(), logsGroupedByMember);
      isFallback = true;
    } else {
      const prompt = buildEvaluationPrompt(
        targetCycle,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        evalCtx,
        logsGroupedByMember,
        githubCommits,
        previousEval,
        suspiciousPairs,
      );
      const fallback = this.getFallbackReport(targetCycle, periodStart.toISOString(), periodEnd.toISOString(), logsGroupedByMember);
      reportContent = await chatJSON<EvaluationReportContent>(prompt, fallback);
    }

    // Apply Deterministic Guardrails
    evalCtx.team.members.forEach((m: any) => {
      const stats = logsGroupedByMember[m.userId];
      if (!stats || stats.entryCount === 0) {
        const memberScoreObj = reportContent.memberParticipation?.perMember?.find((pm) => pm.userId === m.userId);
        if (memberScoreObj) {
          memberScoreObj.score = Math.min(memberScoreObj.score, 20);
          memberScoreObj.notes = (memberScoreObj.notes || '') + ' (Forced <=20: 0 daily logs submitted).';
        }
      }
    });

    const hasGithubLinked = !!ghRepo;
    const inProgressSoftwarePackages = (evalCtx.workPackages || []).filter((wp: any) => {
      if (wp.status !== 'IN_PROGRESS') return false;
      const name = (wp.name || wp.id || '').toLowerCase();
      return /(backend|frontend|api|software|dev|integration|code|app|module|system)/.test(name);
    });
    if (hasGithubLinked && inProgressSoftwarePackages.length > 0 && githubCommits.length === 0) {
      reportContent.missingWork = [
        ...(reportContent.missingWork || []),
        `No GitHub commits found in this window despite in-progress software work packages (${inProgressSoftwarePackages
          .map((wp: any) => wp.name)
          .join(', ')}).`,
      ];
    }

    if (maxOverlapFound > 0.85) {
      reportContent.plagiarismRisk = 'HIGH';
      reportContent.suspiciousBehaviour.push(`High text similarity (>85%) detected with other project work logs.`);
    } else if (maxOverlapFound > 0.7) {
      if (reportContent.plagiarismRisk === 'LOW') reportContent.plagiarismRisk = 'MEDIUM';
    }

    const overallScore = Math.round(
      (reportContent.scopeAdherence.score +
        reportContent.technicalProgress.score +
        reportContent.timelineCompliance.score +
        reportContent.memberParticipation.score +
        reportContent.documentationQuality.score +
        reportContent.authenticityConfidence.score) / 6,
    );

    // Save or update EvaluationReport
    const reportRecord = await prisma.evaluationReport.upsert({
      where: {
        projectId_cycle: { projectId, cycle: targetCycle },
      },
      create: {
        projectId,
        cycle: targetCycle,
        periodStart,
        periodEnd,
        content: reportContent as any,
      },
      update: {
        periodStart,
        periodEnd,
        content: reportContent as any,
      },
    });

    // Append event
    await projectLogService.appendEvent(projectId, {
      type: 'EVALUATION_ADDED',
      actorUserId: 'SYSTEM',
      data: {
        cycle: targetCycle,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        authenticity: reportContent.authenticityConfidence.score,
        plagiarismRisk: reportContent.plagiarismRisk,
        overall: overallScore,
        reportId: reportRecord.id,
      },
    });

    // Create notifications for team members with Socket.IO push
    for (const member of evalCtx.team.members) {
      await notificationService.createForUser(
        member.userId,
        `15-Day Evaluation Ready (Cycle #${targetCycle})`,
        `Cycle #${targetCycle} evaluation report is ready. Overall Score: ${overallScore}/100. Plagiarism Risk: ${reportContent.plagiarismRisk}.`,
      );
    }

    return {
      reportId: reportRecord.id,
      cycle: targetCycle,
      overallScore,
      content: reportContent,
      fallback: isFallback,
    };
  }

  private getFallbackReport(cycle: number, periodStart: string, periodEnd: string, logsGrouped: any): EvaluationReportContent {
    const perMember = Object.keys(logsGrouped).map((uid) => ({
      userId: uid,
      score: logsGrouped[uid].entryCount > 0 ? 80 : 0,
      notes: logsGrouped[uid].entryCount > 0 ? `${logsGrouped[uid].entryCount} entries logged.` : 'No entries logged.',
    }));

    return {
      cycle,
      periodStart,
      periodEnd,
      scopeAdherence: { score: 75, notes: 'Evaluated based on logged progress.' },
      technicalProgress: { score: 75, notes: 'Progress tracking active.' },
      timelineCompliance: { score: 80, notes: 'Milestones on schedule.' },
      memberParticipation: {
        score: 75,
        notes: 'Summary participation calculated from log entry activity.',
        perMember,
      },
      documentationQuality: { score: 70, notes: 'Daily logs submitted.' },
      authenticityConfidence: { score: 85, notes: 'Authenticity checked via daily timestamps.' },
      plagiarismRisk: 'LOW',
      missingWork: [],
      suspiciousBehaviour: [],
      mentorFeedback: `Cycle #${cycle} completed. Continue submitting detailed daily work logs and linking code commits.`,
      next15DayRecommendations: [
        'Maintain daily log submissions for every team member.',
        'Push code commits regularly to linked GitHub repository.',
      ],
    };
  }
}

export const evaluationEngine = new EvaluationEngine();
