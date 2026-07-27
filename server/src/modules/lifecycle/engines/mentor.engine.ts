import { prisma } from '../../../shared/database';
import { hasSkill } from '../../../shared/skillMatch';
import { chat, chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { projectLogService } from '../projectLog.service';
import { buildMentorNarrationPrompt, buildMentorAskPrompt } from '../prompts/mentor.prompt';

export class MentorEngine {
  private narrationCache: Map<string, { timestamp: number; version: number; flagSnapshot: any[]; data: any }> = new Map();

  async getMentorStatus(projectId: string) {
    const mentorCtx: any = await projectLogService.getContext(projectId, 'mentor');
    const now = new Date();

    // 1. Compute Deterministic Signals with Severity Scoring
    const activeFlagTypes = new Set<string>();
    const raisedFlagData: Array<{ id: string; type: string; message: string; severity: number }> = [];

    // Flag: DELAY
    mentorCtx.milestones.forEach((m: any) => {
      if (m.dueDate && new Date(m.dueDate) < now && m.status !== 'DONE') {
        const daysOverdue = Math.max(1, Math.ceil((now.getTime() - new Date(m.dueDate).getTime()) / 86_400_000));
        const severity = Math.min(100, Math.max(15, daysOverdue * 15));
        const flagId = `delay-${m.id}`;
        activeFlagTypes.add(flagId);
        raisedFlagData.push({
          id: flagId,
          type: 'DELAY',
          message: `Milestone "${m.name}" is past due (${m.dueDate}) and not marked DONE.`,
          severity,
        });
      }
    });

    // Flag: INACTIVE_MEMBER
    const activityMap = mentorCtx.activitySummary?.logCountsPerMember || {};
    mentorCtx.team.members.forEach((m: any) => {
      if (m.active && (activityMap[m.userId] || 0) === 0) {
        const flagId = `inactive-${m.userId}`;
        activeFlagTypes.add(flagId);
        raisedFlagData.push({
          id: flagId,
          type: 'INACTIVE_MEMBER',
          message: `Member "${m.name}" has 0 daily logs submitted in the last 15 days.`,
          severity: 60,
        });
      }
    });

    // Flag: MISSING_DEPENDENCY (structured dependsOn OR heuristic fallback)
    const packageStatusesById: Record<string, string> = {};
    const packageStatusesByName: Record<string, string> = {};

    mentorCtx.workPackages.forEach((wp: any) => {
      packageStatusesById[wp.id] = wp.status;
      packageStatusesByName[wp.name.toLowerCase()] = wp.status;
    });

    mentorCtx.workPackages.forEach((wp: any) => {
      if (wp.status === 'IN_PROGRESS') {
        // Structured dependsOn check
        if (Array.isArray(wp.dependsOn) && wp.dependsOn.length > 0) {
          const missingDepIds = wp.dependsOn.filter((depId: string) => packageStatusesById[depId] !== 'DONE');
          if (missingDepIds.length > 0) {
            const flagId = `dep-${wp.id}`;
            activeFlagTypes.add(flagId);
            raisedFlagData.push({
              id: flagId,
              type: 'MISSING_DEPENDENCY',
              message: `Work package "${wp.name}" is IN_PROGRESS while dependent package (${missingDepIds.join(', ')}) is not DONE.`,
              severity: 75,
            });
          }
        } else {
          // Heuristic fallback (e.g., deploy vs backend)
          const name = wp.name.toLowerCase();
          if (name.includes('deploy') && packageStatusesByName['backend'] === 'NOT_STARTED') {
            const flagId = `dep-${wp.id}`;
            activeFlagTypes.add(flagId);
            raisedFlagData.push({
              id: flagId,
              type: 'MISSING_DEPENDENCY',
              message: `Work package "${wp.name}" is IN_PROGRESS while prerequisite "Backend" is NOT_STARTED.`,
              severity: 75,
            });
          }
        }
      }
    });

    // Flag: OVERLOAD
    const memberPercentageAlloc: Record<string, number> = {};
    mentorCtx.workPackages.forEach((wp: any) => {
      const assignees = wp.assignedTo || [];
      if (assignees.length > 0) {
        const share = wp.percentage / assignees.length;
        assignees.forEach((uid: string) => {
          memberPercentageAlloc[uid] = (memberPercentageAlloc[uid] || 0) + share;
        });
      }
    });

    Object.keys(memberPercentageAlloc).forEach((uid) => {
      if (memberPercentageAlloc[uid] > 50) {
        const memberName = mentorCtx.team.members.find((m: any) => m.userId === uid)?.name || uid;
        const overloadPct = Math.round(memberPercentageAlloc[uid]);
        const severity = Math.min(100, Math.max(20, (overloadPct - 50) * 2));
        const flagId = `overload-${uid}`;
        activeFlagTypes.add(flagId);
        raisedFlagData.push({
          id: flagId,
          type: 'OVERLOAD',
          message: `Team member "${memberName}" is assigned over 50% (${overloadPct}%) of total work package allocation.`,
          severity,
        });
      }
    });

    // Flag: TIMELINE_RISK
    const startDate = new Date(mentorCtx.duration.startDate);
    const endDate = new Date(mentorCtx.duration.endDate);
    const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime());
    const elapsed = Math.max(0, now.getTime() - startDate.getTime());
    const percentTimeElapsed = Math.min(100, Math.round((elapsed / totalDuration) * 100));

    const totalMs = mentorCtx.milestones.length || 1;
    const doneMs = mentorCtx.milestones.filter((m: any) => m.status === 'DONE').length;
    const percentMsDone = Math.round((doneMs / totalMs) * 100);
    const timeLag = percentTimeElapsed - percentMsDone;

    if (timeLag > 25) {
      const severity = Math.min(100, timeLag * 2);
      const flagId = 'timeline-risk-lag';
      activeFlagTypes.add(flagId);
      raisedFlagData.push({
        id: flagId,
        type: 'TIMELINE_RISK',
        message: `Project timeline risk: ${percentTimeElapsed}% time elapsed but only ${percentMsDone}% of milestones completed.`,
        severity,
      });
    }

    // Flag: TECH_DRIFT
    const lastEval = mentorCtx.recentEvaluations?.slice(-1)[0];
    if (lastEval && lastEval.authenticity < 60) {
      const severity = Math.min(100, Math.round((60 - lastEval.authenticity) * 2 + 40));
      const flagId = 'tech-drift-eval';
      activeFlagTypes.add(flagId);
      raisedFlagData.push({
        id: flagId,
        type: 'TECH_DRIFT',
        message: `Latest 15-day evaluation flagged technical inconsistency / authenticity confidence score below 60%.`,
        severity,
      });
    }

    // Sort raised flags by severity descending
    raisedFlagData.sort((a, b) => b.severity - a.severity);

    // 2. Diff against state flags and raise/resolve
    const existingFlags = mentorCtx.flags || [];
    for (const flag of raisedFlagData) {
      const existing = existingFlags.find((f: any) => f.id === flag.id);
      if (!existing || existing.resolved) {
        await projectLogService.appendEvent(projectId, {
          type: 'FLAG_RAISED',
          actorUserId: 'AI',
          data: flag,
        });
      }
    }

    for (const f of existingFlags) {
      if (!f.resolved && !activeFlagTypes.has(f.id)) {
        await projectLogService.appendEvent(projectId, {
          type: 'FLAG_RESOLVED',
          actorUserId: 'AI',
          data: { id: f.id },
        });
      }
    }

    // 3. Cache & Delta Trend Evaluation
    const cached = this.narrationCache.get(projectId);
    const currentVersion = mentorCtx.version || 1;

    // Cache hit requires: TTL < 6h AND version matches (event-based cache busting)
    if (
      cached &&
      now.getTime() - cached.timestamp < 6 * 60 * 60 * 1000 &&
      cached.version === currentVersion
    ) {
      return {
        flags: raisedFlagData,
        ...cached.data,
        learningSuggestions: mentorCtx.skills?.gaps || [],
      };
    }

    // Compute flag delta trend vs cached snapshot
    const prevFlags = cached?.flagSnapshot || [];
    const prevIds = new Set(prevFlags.map((f: any) => f.id));
    const currentIds = new Set(raisedFlagData.map((f: any) => f.id));

    const newFlags = raisedFlagData.filter((f) => !prevIds.has(f.id)).length;
    const resolvedFlags = prevFlags.filter((f: any) => !currentIds.has(f.id)).length;
    const worsened = newFlags > resolvedFlags;

    const deltaTrend = { newFlags, resolvedFlags, worsened };

    // 4. Compute Member Candidate Task Recommendations
    const candidateNextTasks = mentorCtx.team.members.map((m: any) => {
      const assignedPackages = mentorCtx.workPackages.filter(
        (wp: any) => Array.isArray(wp.assignedTo) && wp.assignedTo.includes(m.userId),
      );

      const memberFlags = raisedFlagData.filter(
        (f) => f.id.includes(m.userId) || f.message.toLowerCase().includes(m.name.toLowerCase()),
      );

      const candidateTasks: string[] = [];

      if (memberFlags.length > 0) {
        candidateTasks.push(`Address priority flag: ${memberFlags[0].message}`);
      }

      assignedPackages.forEach((wp: any) => {
        if (wp.status === 'NOT_STARTED') {
          candidateTasks.push(`Kick off work package "${wp.name}" (${wp.percentage}% scope)`);
        } else if (wp.status === 'IN_PROGRESS') {
          candidateTasks.push(`Complete active tasks for "${wp.name}"`);
        }
      });

      if (candidateTasks.length === 0) {
        candidateTasks.push('Submit today daily work log and update milestone progress');
      }

      return {
        userId: m.userId,
        candidateTasks: candidateTasks.slice(0, 3),
      };
    });

    let narration: any;
    if (!isLlmConfigured()) {
      narration = {
        onTimeEstimate: percentTimeElapsed - percentMsDone > 20 ? 'AT_RISK' : 'ON_TRACK',
        summary: `Project is currently ${percentMsDone}% completed with ${raisedFlagData.length} active flags detected.`,
        nextTasks: candidateNextTasks.map((c: any) => ({
          userId: c.userId,
          tasks: c.candidateTasks,
        })),
      };
    } else {
      const prompt = buildMentorNarrationPrompt(
        mentorCtx,
        raisedFlagData,
        deltaTrend,
        candidateNextTasks,
      );
      const fallback = {
        onTimeEstimate: 'ON_TRACK',
        summary: `Project execution active. ${raisedFlagData.length} flags monitoring status.`,
        nextTasks: candidateNextTasks.map((c: any) => ({
          userId: c.userId,
          tasks: c.candidateTasks,
        })),
      };
      narration = await chatJSON(prompt, fallback, { feature: 'mentorNarration' });
    }

    if (this.narrationCache.size >= 100) {
      const firstKey = this.narrationCache.keys().next().value;
      if (firstKey) this.narrationCache.delete(firstKey);
    }
    this.narrationCache.set(projectId, {
      timestamp: now.getTime(),
      version: currentVersion,
      flagSnapshot: raisedFlagData,
      data: narration,
    });

    return {
      flags: raisedFlagData,
      ...narration,
      learningSuggestions: mentorCtx.skills?.gaps || [],
    };
  }

  async askMentor(projectId: string, question: string): Promise<string> {
    const mentorCtx = await projectLogService.getContext(projectId, 'mentor');

    if (!isLlmConfigured()) {
      return 'AI mentor service is running in offline mode. Please configure GROQ_API_KEY to enable interactive Q&A.';
    }

    const prompt = buildMentorAskPrompt(mentorCtx, question);
    const fallback = 'I am unable to analyze your query at the moment. Please refer to your approved execution document.';
    return chat(prompt, fallback, { feature: 'mentorAsk' });
  }

  async checkDurationAdvisory(months: number, category?: string, title?: string) {
    const cat = category || 'FINAL_YEAR';
    const bounds: Record<string, { min: number; max: number; standard: string }> = {
      MINI: { min: 1, max: 3, standard: '1–3 months' },
      FINAL_YEAR: { min: 4, max: 6, standard: '4–6 months' },
      RESEARCH: { min: 6, max: 12, standard: '6–12 months' },
    };

    const bound = bounds[cat] || bounds.FINAL_YEAR;
    const available = isLlmConfigured();

    if (months >= bound.min && months <= bound.max) {
      return { ok: true, available, advisory: null };
    }

    let advisoryText = `Proposed duration of ${months} months is outside standard guidelines for a ${cat} project (${bound.standard}).`;
    if (months < bound.min) {
      advisoryText += ` The timeline may be too short to adequately cover all design, testing, and documentation requirements.`;
    } else {
      advisoryText += ` Consider shortening to ${bound.max} months to ensure focused scope and on-time completion.`;
    }

    return {
      ok: false,
      available,
      advisory: advisoryText,
    };
  }

  async suggestMembers(projectId?: string, desiredCount = 4, requiredSkills: string[] = []) {
    const available = isLlmConfigured();

    // Query active students not currently in an active project
    const busyMembers = await prisma.projectMember.findMany({
      where: {
        project: {
          status: { notIn: ['completed', 'archived', 'rejected'] },
        },
      },
      select: { userId: true },
    });

    const busyUserIds = Array.from(new Set(busyMembers.map((m) => m.userId)));

    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        id: { notIn: busyUserIds },
      },
      take: 20,
      include: { userSkills: true },
    });

    const suggestions = students.map((s) => {
      const studentSkills = s.userSkills.map((sk) => sk.skillName);
      let matchCount = 0;
      requiredSkills.forEach((req) => {
        if (hasSkill(req, studentSkills)) {
          matchCount++;
        }
      });

      return {
        userId: s.id,
        name: s.fullName,
        department: s.department || 'Engineering',
        skills: s.userSkills.map((sk) => sk.skillName),
        reason: matchCount > 0
          ? `Matched ${matchCount} requested project skills (${requiredSkills.slice(0, 2).join(', ')})`
          : 'Available engineering student with compatible technical profile.',
        matchCount,
      };
    });

    suggestions.sort((a, b) => b.matchCount - a.matchCount);

    return {
      available,
      suggestions: suggestions.slice(0, desiredCount).map(({ userId, name, skills, reason }) => ({
        userId,
        name,
        skills,
        reason,
      })),
    };
  }
}

export const mentorEngine = new MentorEngine();
