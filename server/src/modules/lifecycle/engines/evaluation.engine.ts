import { prisma } from '../../../shared/database';
import { wordOverlapRatio } from '../../../shared/stringUtils';
import { EvaluationReportContent } from '../../../shared/projectLog.types';
import { chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { projectLogService } from '../projectLog.service';
import { dailyLogService } from '../dailyLog.service';
import { notificationService } from '../../notifications/notification.service';
import {
  serializeEvaluationPrompt,
  dealiasEvaluationReport,
  EvaluationReportSchema,
} from '../../ai/promptSerializer';
import { persistAuthenticityAudit } from '../../metrics/authenticity';

export class EvaluationEngine {
  async runEvaluationCycle(projectId: string, cycleNumber?: number): Promise<any> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true, category: true, name: true },
    });
    const organizationId = project?.organizationId || undefined;

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

    let lowEffortCount = 0;
    const memberSelfSim: Record<string, number> = {};

    logs.forEach((l) => {
      if (!logsGroupedByMember[l.userId]) {
        logsGroupedByMember[l.userId] = { entryCount: 0, totalHours: 0, logs: [] };
      }
      logsGroupedByMember[l.userId].entryCount++;
      logsGroupedByMember[l.userId].totalHours += l.hoursSpent || 0;

      // Low-effort detector: < 8 words
      const words = l.workDone.trim().split(/\s+/).filter(Boolean);
      if (words.length < 8) {
        lowEffortCount++;
      }

      // Cap log text for prompt efficiency
      logsGroupedByMember[l.userId].logs.push({
        date: l.date,
        workDone: l.workDone.slice(0, 150),
        hours: l.hoursSpent,
      });
    });

    // 3.1 Self-similarity detector per member (copying own logs day-over-day)
    evalCtx.team.members.forEach((m: any) => {
      const mLogs = logs.filter((l) => l.userId === m.userId);
      let maxSelfSim = 0;
      if (mLogs.length > 1) {
        for (let i = 0; i < mLogs.length - 1; i++) {
          for (let j = i + 1; j < mLogs.length; j++) {
            const ratio = wordOverlapRatio(mLogs[i].workDone, mLogs[j].workDone);
            if (ratio > maxSelfSim) maxSelfSim = ratio;
          }
        }
      }
      memberSelfSim[m.userId] = Math.round(maxSelfSim * 100);
    });

    // GitHub evidence if linked (real commit history query)
    let githubCommits: Array<{ sha: string; author: string; authorLogin?: string | null; authorEmail?: string | null; linkedUserId?: string | null; message: string; date: Date; isMerge?: boolean }> = [];
    const ghRepo = await prisma.githubRepository.findUnique({
      where: { projectId },
      include: {
        commits: {
          where: {
            date: { gte: periodStart, lte: periodEnd },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (ghRepo) {
      githubCommits = ghRepo.commits.map((c) => ({
        sha: c.sha.substring(0, 7),
        author: c.author,
        authorLogin: c.authorLogin,
        authorEmail: c.authorEmail,
        linkedUserId: c.linkedUserId,
        message: c.message,
        date: c.date,
        isMerge: c.isMerge,
      }));
    }

    // 3.2 Commit-Log correlation check
    const commitDates = new Set(
      githubCommits.map((c) => new Date(c.date).toISOString().split('T')[0]),
    );
    const implRegex = /(implement|build|fix|create|add|develop|code|refactor|write|test|setup)/i;
    let unverifiedImplDays = 0;

    logs.forEach((l) => {
      if (implRegex.test(l.workDone) && !commitDates.has(l.date)) {
        unverifiedImplDays++;
      }
    });

    // Cross-team text similarity — strictly scoped to the same organization and ordered deterministically
    const otherLogs = await prisma.dailyWorkLog.findMany({
      where: {
        projectId: { not: projectId },
        ...(organizationId ? { project: { organizationId } } : {}),
        date: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { workDone: true, projectId: true, userId: true, date: true },
    });

    const suspiciousPairs: Array<{ userId: string; date: string; similarityPercent: number }> = [];
    let maxOverlapFound = 0;

    for (const myLog of logs) {
      for (const other of otherLogs) {
        const ratio = wordOverlapRatio(myLog.workDone, other.workDone);
        if (ratio > maxOverlapFound) maxOverlapFound = ratio;
        if (ratio > 0.7) {
          suspiciousPairs.push({
            userId: myLog.userId,
            date: myLog.date,
            similarityPercent: Math.round(ratio * 100),
          });
        }
      }
    }

    // Attach real student registration numbers (regNo) for official records
    const teamUserIds = evalCtx.team.members.map((m: any) => m.userId);
    const userRecords = await prisma.user.findMany({
      where: { id: { in: teamUserIds } },
      select: { id: true, regNo: true, fullName: true },
    });
    const regNoMap = new Map<string, string>();
    userRecords.forEach((u) => {
      if (u.regNo) regNoMap.set(u.id, u.regNo);
    });
    evalCtx.team.members.forEach((m: any) => {
      m.regNo = regNoMap.get(m.userId) || m.userId;
    });

    // Query Previous Cycle's Exact 10 Numerical Marks (Clean Baseline — Zero Raw Text Appended)
    let previousCycleMarks: any = null;
    let prevStudentsMap = new Map<string, any>();
    let prevTeamRecord: any = null;
    let prevProjectRecord: any = null;

    if (targetCycle > 1) {
      const [prevStudents, prevTeam, prevProject] = await Promise.all([
        prisma.studentCycleScore10.findMany({
          where: { projectId, cycle: targetCycle - 1 },
        }),
        prisma.teamCycleScore10.findFirst({
          where: { projectId, cycle: targetCycle - 1 },
        }),
        prisma.projectCycleScore10.findFirst({
          where: { projectId, cycle: targetCycle - 1 },
        }),
      ]);

      prevStudents.forEach((ps) => prevStudentsMap.set(ps.userId, ps));
      prevTeamRecord = prevTeam;
      prevProjectRecord = prevProject;

      if (prevStudents.length > 0 || prevTeam || prevProject) {
        const studentMarksMap: Record<string, any> = {};
        prevStudents.forEach((ps) => {
          studentMarksMap[ps.userId] = {
            scopeAlignment: ps.scopeAlignmentScore,
            technicalComplexity: ps.technicalComplexityScore,
            milestoneCompletion: ps.milestoneCompletionScore,
            commitAuthenticity: ps.commitAuthenticityScore,
            riskMitigation: ps.riskMitigationScore,
            taskPunctuality: ps.taskPunctualityScore,
            dailyLogDiligence: ps.dailyLogDiligenceScore,
            taskOwnership: ps.taskOwnershipScore,
            teamCollaboration: ps.teamCollaborationScore,
            growthInnovation: ps.growthInnovationScore,
            total: ps.totalMarks,
          };
        });

        previousCycleMarks = {
          students: studentMarksMap,
          team: prevTeam ? {
            workDistributionEquity: prevTeam.workDistributionEquity,
            milestoneVelocity: prevTeam.milestoneVelocity,
            blockerResolutionSpeed: prevTeam.blockerResolutionSpeed,
            interMemberCollaboration: prevTeam.interMemberCollaboration,
            teamCommitCadence: prevTeam.teamCommitCadence,
            sharedDocumentation: prevTeam.sharedDocumentation,
            technicalConsistency: prevTeam.technicalConsistency,
            timelineDiscipline: prevTeam.timelineDiscipline,
            peerReviewParticipation: prevTeam.peerReviewParticipation,
            collectiveOutputQuality: prevTeam.collectiveOutputQuality,
            total: prevTeam.totalTeamMarks,
          } : null,
          project: prevProject ? {
            scopeAlignment: prevProject.scopeAlignment,
            architectureRobustness: prevProject.architectureRobustness,
            hardwareSoftwareProgress: prevProject.hardwareSoftwareProgress,
            deliverablesReadiness: prevProject.deliverablesReadiness,
            authenticityConfidence: prevProject.authenticityConfidence,
            plagiarismSafety: prevProject.plagiarismSafety,
            testCoverageVerification: prevProject.testCoverageVerification,
            standardsCompliance: prevProject.standardsCompliance,
            innovationDifferentiation: prevProject.innovationDifferentiation,
            publicationFeasibility: prevProject.publicationFeasibility,
            total: prevProject.totalProjectMarks,
          } : null,
        };
      }
    }

    // Build leak-free serialized LLM payload with 10-field rubrics
    const { prompt, aliasToUserId } = serializeEvaluationPrompt({
      cycle: targetCycle,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      evalContext: evalCtx,
      logsGroupedByMember,
      githubCommits,
      previousCycleMarks,
      previousEval: evalCtx.lastEvaluationSummary,
      suspiciousPairs,
    });

    let rawLlmParsed: any = null;
    let reportContent: EvaluationReportContent;
    const isFallback = !isLlmConfigured();

    if (isFallback) {
      reportContent = this.getFallbackReport(targetCycle, periodStart.toISOString(), periodEnd.toISOString(), logsGroupedByMember);
    } else {
      const fallback = this.getFallbackReport(targetCycle, periodStart.toISOString(), periodEnd.toISOString(), logsGroupedByMember);
      const rawLlmReport = await chatJSON<any>(prompt, fallback, { feature: 'evaluation' });
      // De-alias member scores back to actual database userIds
      const dealiased = dealiasEvaluationReport(rawLlmReport, aliasToUserId);
      // Validate schema
      const parseResult = EvaluationReportSchema.safeParse(dealiased);
      if (parseResult.success) {
        rawLlmParsed = parseResult.data;
        reportContent = parseResult.data as unknown as EvaluationReportContent;
      } else {
        reportContent = fallback;
      }
    }

    // Apply Deterministic Guardrails

    // Member log participation guardrail + Contradiction Guardrail (3.4)
    evalCtx.team.members.forEach((m: any) => {
      const stats = logsGroupedByMember[m.userId];
      const memberScoreObj = reportContent.memberParticipation?.perMember?.find((pm) => pm.userId === m.userId);

      if (!stats || stats.entryCount === 0) {
        if (memberScoreObj) {
          memberScoreObj.score = Math.min(memberScoreObj.score, 20);
          memberScoreObj.notes = (memberScoreObj.notes || '') + ' (Forced <=20: 0 daily logs submitted).';
        }
      }

      // 3.4 Contradiction Guardrail: 0 commits & 0 logs but high technical/scope score
      const memberCommits = githubCommits.filter((c) => c.linkedUserId === m.userId);
      if (stats?.entryCount === 0 && memberCommits.length === 0) {
        if (reportContent.technicalProgress.score > 60) {
          reportContent.technicalProgress.score = 20;
          reportContent.technicalProgress.notes += ' (Capped to 20: unsupported by commit/log evidence)';
        }
        if (reportContent.scopeAdherence.score > 60) {
          reportContent.scopeAdherence.score = 20;
          reportContent.scopeAdherence.notes += ' (Capped to 20: unsupported by commit/log evidence)';
        }
      }

      // Self-similarity note
      if (memberSelfSim[m.userId] > 80) {
        reportContent.suspiciousBehaviour.push(
          `Member ${m.name || m.userId} exhibits high self-similarity (${memberSelfSim[m.userId]}%) across daily logs.`,
        );
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

    if (unverifiedImplDays > 0) {
      reportContent.technicalProgress.notes += ` (${unverifiedImplDays} daily log claims of code work had zero corresponding GitHub commits).`;
    }

    // Plagiarism precedence override
    if (maxOverlapFound > 0.85) {
      reportContent.plagiarismRisk = 'HIGH';
      reportContent.suspiciousBehaviour.push(`High text similarity (${Math.round(maxOverlapFound * 100)}%) detected with other project work logs.`);
    } else if (maxOverlapFound > 0.7) {
      if (reportContent.plagiarismRisk === 'LOW') reportContent.plagiarismRisk = 'MEDIUM';
    }

    // Attach Score Evidence Receipts
    const totalLogs = logs.length;
    const totalCommits = githubCommits.length;

    reportContent.scopeAdherence.evidence = { totalLogs, milestoneCount: evalCtx.milestones?.length || 0 };
    reportContent.technicalProgress.evidence = { totalCommits, unverifiedImplDays };
    reportContent.timelineCompliance.evidence = { daysElapsed, targetCycle };
    reportContent.memberParticipation.evidence = { totalLogs, memberCount: evalCtx.team?.members?.length || 1 };
    reportContent.documentationQuality.evidence = { totalLogs, lowEffortCount };
    reportContent.authenticityConfidence.evidence = { maxOverlapFound: Math.round(maxOverlapFound * 100), memberSelfSim };

    // Category-Weighted Average Score
    const weightsByCategory: Record<string, Record<string, number>> = {
      RESEARCH: {
        technicalProgress: 0.25,
        authenticityConfidence: 0.25,
        scopeAdherence: 0.20,
        documentationQuality: 0.15,
        memberParticipation: 0.10,
        timelineCompliance: 0.05,
      },
      MINI: {
        timelineCompliance: 0.25,
        memberParticipation: 0.25,
        scopeAdherence: 0.20,
        technicalProgress: 0.15,
        documentationQuality: 0.10,
        authenticityConfidence: 0.05,
      },
      FINAL_YEAR: {
        scopeAdherence: 0.20,
        technicalProgress: 0.20,
        timelineCompliance: 0.20,
        memberParticipation: 0.15,
        documentationQuality: 0.12,
        authenticityConfidence: 0.13,
      },
    };

    const cat = evalCtx.category || 'FINAL_YEAR';
    const weights = weightsByCategory[cat] || weightsByCategory.FINAL_YEAR;

    const weightedScore =
      reportContent.scopeAdherence.score * weights.scopeAdherence +
      reportContent.technicalProgress.score * weights.technicalProgress +
      reportContent.timelineCompliance.score * weights.timelineCompliance +
      reportContent.memberParticipation.score * weights.memberParticipation +
      reportContent.documentationQuality.score * weights.documentationQuality +
      reportContent.authenticityConfidence.score * weights.authenticityConfidence;

    const overallScore = Math.round(weightedScore);

    // Save or update EvaluationReport with normalized columns
    const reportRecord = await prisma.evaluationReport.upsert({
      where: {
        projectId_cycle: { projectId, cycle: targetCycle },
      },
      create: {
        projectId,
        cycle: targetCycle,
        periodStart,
        periodEnd,
        overallScore,
        plagiarismRisk: reportContent.plagiarismRisk,
        isFallback,
        statusNote: isFallback ? 'Evaluated in offline fallback mode' : 'AI evaluation verified',
        mentorFeedback: reportContent.mentorFeedback,
        content: reportContent as any,
      },
      update: {
        periodStart,
        periodEnd,
        overallScore,
        plagiarismRisk: reportContent.plagiarismRisk,
        isFallback,
        statusNote: isFallback ? 'Evaluated in offline fallback mode' : 'AI evaluation verified',
        mentorFeedback: reportContent.mentorFeedback,
        content: reportContent as any,
      },
    });

    // Persist 10-Field Project Marks (ProjectCycleScore10)
    const p10 = rawLlmParsed?.projectScores10;
    const projectTotalMarks = p10?.totalProjectMarks ?? overallScore;
    const prevProjTotal = prevProjectRecord?.totalProjectMarks ?? null;
    const projDelta = prevProjTotal != null ? projectTotalMarks - prevProjTotal : null;

    await prisma.projectCycleScore10.upsert({
      where: { projectId_cycle: { projectId, cycle: targetCycle } },
      create: {
        projectId,
        reportId: reportRecord.id,
        cycle: targetCycle,
        periodStart,
        periodEnd,
        scopeAlignment: p10?.scopeAlignment ?? Math.min(10, Math.round(reportContent.scopeAdherence.score / 10)),
        architectureRobustness: p10?.architectureRobustness ?? Math.min(10, Math.round(reportContent.technicalProgress.score / 10)),
        hardwareSoftwareProgress: p10?.hardwareSoftwareProgress ?? Math.min(10, Math.round(reportContent.technicalProgress.score / 10)),
        deliverablesReadiness: p10?.deliverablesReadiness ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10)),
        authenticityConfidence: p10?.authenticityConfidence ?? Math.min(10, Math.round(reportContent.authenticityConfidence.score / 10)),
        plagiarismSafety: p10?.plagiarismSafety ?? (reportContent.plagiarismRisk === 'HIGH' ? 2 : reportContent.plagiarismRisk === 'MEDIUM' ? 6 : 9),
        testCoverageVerification: p10?.testCoverageVerification ?? 7,
        standardsCompliance: p10?.standardsCompliance ?? 8,
        innovationDifferentiation: p10?.innovationDifferentiation ?? 7,
        publicationFeasibility: p10?.publicationFeasibility ?? 7,
        totalProjectMarks: projectTotalMarks,
        projectHealthBand: p10?.projectHealthBand ?? (overallScore >= 75 ? 'GOOD' : overallScore >= 60 ? 'NEEDS_ATTENTION' : 'AT_RISK'),
        previousCycleTotalMarks: prevProjTotal,
        trajectoryDelta: projDelta,
        keyMilestonesAchieved: p10?.keyMilestonesAchieved ?? [],
        criticalRisks: p10?.criticalRisks ?? [],
      },
      update: {
        reportId: reportRecord.id,
        periodStart,
        periodEnd,
        scopeAlignment: p10?.scopeAlignment ?? Math.min(10, Math.round(reportContent.scopeAdherence.score / 10)),
        architectureRobustness: p10?.architectureRobustness ?? Math.min(10, Math.round(reportContent.technicalProgress.score / 10)),
        hardwareSoftwareProgress: p10?.hardwareSoftwareProgress ?? Math.min(10, Math.round(reportContent.technicalProgress.score / 10)),
        deliverablesReadiness: p10?.deliverablesReadiness ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10)),
        authenticityConfidence: p10?.authenticityConfidence ?? Math.min(10, Math.round(reportContent.authenticityConfidence.score / 10)),
        plagiarismSafety: p10?.plagiarismSafety ?? (reportContent.plagiarismRisk === 'HIGH' ? 2 : reportContent.plagiarismRisk === 'MEDIUM' ? 6 : 9),
        testCoverageVerification: p10?.testCoverageVerification ?? 7,
        standardsCompliance: p10?.standardsCompliance ?? 8,
        innovationDifferentiation: p10?.innovationDifferentiation ?? 7,
        publicationFeasibility: p10?.publicationFeasibility ?? 7,
        totalProjectMarks: projectTotalMarks,
        projectHealthBand: p10?.projectHealthBand ?? (overallScore >= 75 ? 'GOOD' : overallScore >= 60 ? 'NEEDS_ATTENTION' : 'AT_RISK'),
        previousCycleTotalMarks: prevProjTotal,
        trajectoryDelta: projDelta,
        keyMilestonesAchieved: p10?.keyMilestonesAchieved ?? [],
        criticalRisks: p10?.criticalRisks ?? [],
      },
    });

    // Persist 10-Field Team Marks (TeamCycleScore10)
    if (evalCtx.team?.teamId) {
      const t10 = rawLlmParsed?.teamScores10;
      const teamTotal = t10?.totalTeamMarks ?? overallScore;
      const prevTeamTotal = prevTeamRecord?.totalTeamMarks ?? null;
      const teamDelta = prevTeamTotal != null ? teamTotal - prevTeamTotal : null;

      await prisma.teamCycleScore10.upsert({
        where: { teamId_projectId_cycle: { teamId: evalCtx.team.teamId, projectId, cycle: targetCycle } },
        create: {
          teamId: evalCtx.team.teamId,
          projectId,
          reportId: reportRecord.id,
          cycle: targetCycle,
          periodStart,
          periodEnd,
          workDistributionEquity: t10?.workDistributionEquity ?? 8,
          milestoneVelocity: t10?.milestoneVelocity ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10)),
          blockerResolutionSpeed: t10?.blockerResolutionSpeed ?? 7,
          interMemberCollaboration: t10?.interMemberCollaboration ?? Math.min(10, Math.round(reportContent.memberParticipation.score / 10)),
          teamCommitCadence: t10?.teamCommitCadence ?? (totalCommits > 5 ? 8 : 4),
          sharedDocumentation: t10?.sharedDocumentation ?? Math.min(10, Math.round(reportContent.documentationQuality.score / 10)),
          technicalConsistency: t10?.technicalConsistency ?? 8,
          timelineDiscipline: t10?.timelineDiscipline ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10)),
          peerReviewParticipation: t10?.peerReviewParticipation ?? 7,
          collectiveOutputQuality: t10?.collectiveOutputQuality ?? Math.min(10, Math.round(overallScore / 10)),
          totalTeamMarks: teamTotal,
          teamSynergyLevel: t10?.teamSynergyLevel ?? 'BALANCED',
          previousCycleTotalMarks: prevTeamTotal,
          deltaMarks: teamDelta,
          bottlenecks: t10?.bottlenecks ?? [],
          teamFeedback: t10?.teamFeedback ?? reportContent.mentorFeedback,
        },
        update: {
          reportId: reportRecord.id,
          periodStart,
          periodEnd,
          workDistributionEquity: t10?.workDistributionEquity ?? 8,
          milestoneVelocity: t10?.milestoneVelocity ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10)),
          blockerResolutionSpeed: t10?.blockerResolutionSpeed ?? 7,
          interMemberCollaboration: t10?.interMemberCollaboration ?? Math.min(10, Math.round(reportContent.memberParticipation.score / 10)),
          teamCommitCadence: t10?.teamCommitCadence ?? (totalCommits > 5 ? 8 : 4),
          sharedDocumentation: t10?.sharedDocumentation ?? Math.min(10, Math.round(reportContent.documentationQuality.score / 10)),
          technicalConsistency: t10?.technicalConsistency ?? 8,
          timelineDiscipline: t10?.timelineDiscipline ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10)),
          peerReviewParticipation: t10?.peerReviewParticipation ?? 7,
          collectiveOutputQuality: t10?.collectiveOutputQuality ?? Math.min(10, Math.round(overallScore / 10)),
          totalTeamMarks: teamTotal,
          teamSynergyLevel: t10?.teamSynergyLevel ?? 'BALANCED',
          previousCycleTotalMarks: prevTeamTotal,
          deltaMarks: teamDelta,
          bottlenecks: t10?.bottlenecks ?? [],
          teamFeedback: t10?.teamFeedback ?? reportContent.mentorFeedback,
        },
      });

      // Dispatch Rich Team Notification
      await notificationService.createRichTeamEvaluationNotification({
        teamId: evalCtx.team.teamId,
        projectId,
        projectName: project?.name || 'Project',
        cycle: targetCycle,
        totalTeamMarks: teamTotal,
        synergyLevel: t10?.teamSynergyLevel || 'BALANCED',
        deltaMarks: teamDelta,
        feedback: t10?.teamFeedback || reportContent.mentorFeedback,
      });
    }

    // Persist 10-Field Student Marks (StudentCycleScore10) with Registration Number (regNo)
    const studentScoresList = rawLlmParsed?.studentScores10 || [];
    for (const member of evalCtx.team.members) {
      const s10 = studentScoresList.find((s: any) => s.userId === member.userId);
      const studentStats = logsGroupedByMember[member.userId];
      const memberCommits = githubCommits.filter((c) => c.linkedUserId === member.userId);

      const scopeScore = s10?.scopeAlignmentScore ?? Math.min(10, Math.round(reportContent.scopeAdherence.score / 10));
      const techScore = s10?.technicalComplexityScore ?? Math.min(10, Math.round(reportContent.technicalProgress.score / 10));
      const mileScore = s10?.milestoneCompletionScore ?? Math.min(10, Math.round(reportContent.timelineCompliance.score / 10));
      const authScore = s10?.commitAuthenticityScore ?? (memberCommits.length > 0 ? 8 : studentStats?.entryCount > 0 ? 5 : 1);
      const riskScore = s10?.riskMitigationScore ?? 7;
      const puncScore = s10?.taskPunctualityScore ?? (studentStats?.entryCount > 0 ? 8 : 2);
      const logScore = s10?.dailyLogDiligenceScore ?? (studentStats?.entryCount >= 8 ? 9 : studentStats?.entryCount >= 4 ? 6 : studentStats?.entryCount > 0 ? 4 : 0);
      const ownerScore = s10?.taskOwnershipScore ?? (studentStats?.entryCount > 0 ? 8 : 2);
      const collabScore = s10?.teamCollaborationScore ?? 8;
      const growthScore = s10?.growthInnovationScore ?? 7;

      const calculatedTotal = scopeScore + techScore + mileScore + authScore + riskScore + puncScore + logScore + ownerScore + collabScore + growthScore;
      const finalStudentTotal = s10?.totalMarks ?? calculatedTotal;

      const prevStudentRec = prevStudentsMap.get(member.userId);
      const prevStudentTotal = prevStudentRec?.totalMarks ?? null;
      const studentDelta = prevStudentTotal != null ? finalStudentTotal - prevStudentTotal : null;

      const regNo = member.regNo || regNoMap.get(member.userId) || member.userId;

      await prisma.studentCycleScore10.upsert({
        where: {
          userId_projectId_cycle: {
            userId: member.userId,
            projectId,
            cycle: targetCycle,
          },
        },
        create: {
          regNo,
          userId: member.userId,
          projectId,
          teamId: evalCtx.team?.teamId,
          reportId: reportRecord.id,
          cycle: targetCycle,
          periodStart,
          periodEnd,
          scopeAlignmentScore: scopeScore,
          technicalComplexityScore: techScore,
          milestoneCompletionScore: mileScore,
          commitAuthenticityScore: authScore,
          riskMitigationScore: riskScore,
          taskPunctualityScore: puncScore,
          dailyLogDiligenceScore: logScore,
          taskOwnershipScore: ownerScore,
          teamCollaborationScore: collabScore,
          growthInnovationScore: growthScore,
          totalMarks: finalStudentTotal,
          relativeTeamRank: s10?.relativeTeamRank ?? null,
          previousCycleTotalMarks: prevStudentTotal,
          deltaMarks: studentDelta,
          qualitativeStrengths: s10?.qualitativeStrengths ?? [],
          qualitativeGrowthAreas: s10?.qualitativeGrowthAreas ?? [],
          personalizedActionPlan: s10?.personalizedActionPlan ?? reportContent.next15DayRecommendations?.[0] ?? 'Continue submitting verified daily logs.',
        },
        update: {
          regNo,
          reportId: reportRecord.id,
          periodStart,
          periodEnd,
          scopeAlignmentScore: scopeScore,
          technicalComplexityScore: techScore,
          milestoneCompletionScore: mileScore,
          commitAuthenticityScore: authScore,
          riskMitigationScore: riskScore,
          taskPunctualityScore: puncScore,
          dailyLogDiligenceScore: logScore,
          taskOwnershipScore: ownerScore,
          teamCollaborationScore: collabScore,
          growthInnovationScore: growthScore,
          totalMarks: finalStudentTotal,
          relativeTeamRank: s10?.relativeTeamRank ?? null,
          previousCycleTotalMarks: prevStudentTotal,
          deltaMarks: studentDelta,
          qualitativeStrengths: s10?.qualitativeStrengths ?? [],
          qualitativeGrowthAreas: s10?.qualitativeGrowthAreas ?? [],
          personalizedActionPlan: s10?.personalizedActionPlan ?? reportContent.next15DayRecommendations?.[0] ?? 'Continue submitting verified daily logs.',
        },
      });

      // Dispatch Rich Student Scorecard Notification
      await notificationService.createRichStudentEvaluationNotification({
        userId: member.userId,
        projectId,
        projectName: project?.name || 'Project',
        cycle: targetCycle,
        regNo,
        totalMarks: finalStudentTotal,
        deltaMarks: studentDelta,
        rank: s10?.relativeTeamRank,
        marks10: {
          scopeAlignment: scopeScore,
          technicalComplexity: techScore,
          milestoneCompletion: mileScore,
          commitAuthenticity: authScore,
          riskMitigation: riskScore,
          taskPunctuality: puncScore,
          dailyLogDiligence: logScore,
          taskOwnership: ownerScore,
          teamCollaboration: collabScore,
          growthInnovation: growthScore,
        },
        actionPlan: s10?.personalizedActionPlan || reportContent.next15DayRecommendations?.[0],
      });
    }

    // Normalized child records: Category Scores
    const categoryEntries = [
      { category: 'scopeAdherence', score: reportContent.scopeAdherence.score, notes: reportContent.scopeAdherence.notes },
      { category: 'technicalProgress', score: reportContent.technicalProgress.score, notes: reportContent.technicalProgress.notes },
      { category: 'timelineCompliance', score: reportContent.timelineCompliance.score, notes: reportContent.timelineCompliance.notes },
      { category: 'memberParticipation', score: reportContent.memberParticipation.score, notes: reportContent.memberParticipation.notes },
      { category: 'documentationQuality', score: reportContent.documentationQuality.score, notes: reportContent.documentationQuality.notes },
      { category: 'authenticityConfidence', score: reportContent.authenticityConfidence.score, notes: reportContent.authenticityConfidence.notes },
    ];

    for (const ce of categoryEntries) {
      await prisma.evaluationCategoryScore.upsert({
        where: { reportId_category: { reportId: reportRecord.id, category: ce.category } },
        create: { reportId: reportRecord.id, category: ce.category, score: ce.score, notes: ce.notes },
        update: { score: ce.score, notes: ce.notes },
      });
    }

    // Normalized child records: Member Scores
    if (reportContent.memberParticipation?.perMember) {
      for (const pm of reportContent.memberParticipation.perMember) {
        if (!pm.userId) continue;
        await prisma.evaluationMemberScore.upsert({
          where: { reportId_userId: { reportId: reportRecord.id, userId: pm.userId } },
          create: { reportId: reportRecord.id, userId: pm.userId, score: pm.score, notes: pm.notes },
          update: { score: pm.score, notes: pm.notes },
        });
      }
    }

    // Normalized child records: Findings
    await prisma.evaluationFinding.deleteMany({ where: { reportId: reportRecord.id } });
    const findings: Array<{ reportId: string; kind: 'MISSING_WORK' | 'SUSPICIOUS' | 'RECOMMENDATION'; text: string }> = [];

    (reportContent.missingWork || []).forEach((text) => findings.push({ reportId: reportRecord.id, kind: 'MISSING_WORK', text }));
    (reportContent.suspiciousBehaviour || []).forEach((text) => findings.push({ reportId: reportRecord.id, kind: 'SUSPICIOUS', text }));
    (reportContent.next15DayRecommendations || []).forEach((text) => findings.push({ reportId: reportRecord.id, kind: 'RECOMMENDATION', text }));

    if (findings.length > 0) {
      await prisma.evaluationFinding.createMany({ data: findings });
    }

    // Normalized child records: Evidence
    await prisma.evaluationEvidence.deleteMany({ where: { reportId: reportRecord.id } });
    const evidenceRows: Array<{ reportId: string; category: string; key: string; value: string }> = [];

    const categoriesWithEvidence = ['scopeAdherence', 'technicalProgress', 'timelineCompliance', 'memberParticipation', 'documentationQuality', 'authenticityConfidence'] as const;
    for (const catName of categoriesWithEvidence) {
      const evObj = (reportContent as any)[catName]?.evidence;
      if (evObj && typeof evObj === 'object') {
        for (const [k, v] of Object.entries(evObj)) {
          evidenceRows.push({
            reportId: reportRecord.id,
            category: catName,
            key: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          });
        }
      }
    }

    if (evidenceRows.length > 0) {
      await prisma.evaluationEvidence.createMany({ data: evidenceRows });
    }

    // Best-effort: persist the cross-source authenticity audit for this cycle
    try {
      await persistAuthenticityAudit(
        projectId,
        { periodStart, periodEnd },
        { evaluationReportId: reportRecord.id },
      );
    } catch (auditErr) {
      console.error(`[EvaluationEngine] Authenticity audit persistence failed for project ${projectId} (non-fatal):`, auditErr);
    }

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
      score: logsGrouped[uid].entryCount > 0 ? 50 : 0,
      notes: logsGrouped[uid].entryCount > 0 ? `${logsGrouped[uid].entryCount} entries logged. (UNVERIFIED — AI Unavailable)` : 'No entries logged.',
    }));

    return {
      cycle,
      periodStart,
      periodEnd,
      scopeAdherence: { score: 0, notes: 'UNVERIFIED — AI evaluation service unavailable.' },
      technicalProgress: { score: 0, notes: 'UNVERIFIED — AI evaluation service unavailable.' },
      timelineCompliance: { score: 0, notes: 'UNVERIFIED — AI evaluation service unavailable.' },
      memberParticipation: {
        score: 0,
        notes: 'UNVERIFIED — Baseline member participation based on raw log counts.',
        perMember,
      },
      documentationQuality: { score: 0, notes: 'UNVERIFIED — AI evaluation service unavailable.' },
      authenticityConfidence: { score: 0, notes: 'UNVERIFIED — AI evaluation service unavailable.' },
      plagiarismRisk: 'LOW',
      missingWork: ['AI evaluation service was offline during this cycle; subjective scores set to unverified.'],
      suspiciousBehaviour: [],
      mentorFeedback: `Cycle #${cycle} evaluation run in fallback mode. Continue submitting daily logs and linking commits for the next cycle.`,
      next15DayRecommendations: [
        'Maintain daily log submissions for every team member.',
        'Push code commits regularly to linked GitHub repository.',
      ],
      isFallback: true,
    };
  }
}

export const evaluationEngine = new EvaluationEngine();

