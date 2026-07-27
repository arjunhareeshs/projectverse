import { prisma } from '../../../shared/database';
import { chat, chatJSON, isLlmConfigured } from '../../ai/llm.service';
import { projectLogService } from '../projectLog.service';
import { buildMentorNarrationPrompt, buildMentorAskPrompt } from '../prompts/mentor.prompt';

export class MentorEngine {
  private narrationCache: Map<string, { timestamp: number; data: any }> = new Map();

  async getMentorStatus(projectId: string) {
    const mentorCtx: any = await projectLogService.getContext(projectId, 'mentor');
    const now = new Date();

    // 1. Compute Deterministic Signals
    const activeFlagTypes = new Set<string>();
    const raisedFlagData: Array<{ id: string; type: string; message: string }> = [];

    // Flag: DELAY
    mentorCtx.milestones.forEach((m: any) => {
      if (m.dueDate && new Date(m.dueDate) < now && m.status !== 'DONE') {
        const flagId = `delay-${m.id}`;
        activeFlagTypes.add(flagId);
        raisedFlagData.push({
          id: flagId,
          type: 'DELAY',
          message: `Milestone "${m.name}" is past due (${m.dueDate}) and not marked DONE.`,
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
        });
      }
    });

    // Flag: MISSING_DEPENDENCY (simple heuristic dependency rule)
    const packageStatuses: Record<string, string> = {};
    mentorCtx.workPackages.forEach((wp: any) => {
      packageStatuses[wp.name.toLowerCase()] = wp.status;
    });

    mentorCtx.workPackages.forEach((wp: any) => {
      const name = wp.name.toLowerCase();
      if (wp.status === 'IN_PROGRESS') {
        if (name.includes('deploy') && packageStatuses['backend'] === 'NOT_STARTED') {
          const flagId = `dep-${wp.id}`;
          activeFlagTypes.add(flagId);
          raisedFlagData.push({
            id: flagId,
            type: 'MISSING_DEPENDENCY',
            message: `Work package "${wp.name}" is IN_PROGRESS while prerequisite "Backend" is NOT_STARTED.`,
          });
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
        const flagId = `overload-${uid}`;
        activeFlagTypes.add(flagId);
        raisedFlagData.push({
          id: flagId,
          type: 'OVERLOAD',
          message: `Team member "${memberName}" is assigned over 50% (${Math.round(memberPercentageAlloc[uid])}%) of total work package allocation.`,
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

    if (percentTimeElapsed - percentMsDone > 25) {
      const flagId = 'timeline-risk-lag';
      activeFlagTypes.add(flagId);
      raisedFlagData.push({
        id: flagId,
        type: 'TIMELINE_RISK',
        message: `Project timeline risk: ${percentTimeElapsed}% time elapsed but only ${percentMsDone}% of milestones completed.`,
      });
    }

    // Flag: TECH_DRIFT
    const lastEval = mentorCtx.recentEvaluations?.slice(-1)[0];
    if (lastEval && lastEval.authenticity < 60) {
      const flagId = 'tech-drift-eval';
      activeFlagTypes.add(flagId);
      raisedFlagData.push({
        id: flagId,
        type: 'TECH_DRIFT',
        message: `Latest 15-day evaluation flagged technical inconsistency / authenticity confidence score below 60%.`,
      });
    }

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

    // 3. Narration cache (6 hour cache)
    const cached = this.narrationCache.get(projectId);
    if (cached && now.getTime() - cached.timestamp < 6 * 60 * 60 * 1000) {
      return {
        flags: raisedFlagData,
        ...cached.data,
        learningSuggestions: mentorCtx.skills?.gaps || [],
      };
    }

    let narration: any;
    if (!isLlmConfigured()) {
      narration = {
        onTimeEstimate: percentTimeElapsed - percentMsDone > 20 ? 'AT_RISK' : 'ON_TRACK',
        summary: `Project is currently ${percentMsDone}% completed with ${raisedFlagData.length} active flags detected.`,
        nextTasks: mentorCtx.team.members.map((m: any) => ({
          userId: m.userId,
          tasks: ['Review work package deliverables', 'Submit today daily work log'],
        })),
      };
    } else {
      const prompt = buildMentorNarrationPrompt(mentorCtx, raisedFlagData);
      const fallback = {
        onTimeEstimate: 'ON_TRACK',
        summary: `Project execution active. ${raisedFlagData.length} flags monitoring status.`,
        nextTasks: mentorCtx.team.members.map((m: any) => ({
          userId: m.userId,
          tasks: ['Update project milestones'],
        })),
      };
      narration = await chatJSON(prompt, fallback);
    }

    if (this.narrationCache.size >= 100) {
      const firstKey = this.narrationCache.keys().next().value;
      if (firstKey) this.narrationCache.delete(firstKey);
    }
    this.narrationCache.set(projectId, { timestamp: now.getTime(), data: narration });

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
    return chat(prompt, fallback);
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

    const normalizedReq = requiredSkills.map((s) => s.toLowerCase());

    const suggestions = students.map((s) => {
      const studentSkills = s.userSkills.map((sk) => sk.skillName.toLowerCase());
      let matchCount = 0;
      normalizedReq.forEach((req) => {
        if (studentSkills.some((sk) => sk.includes(req) || req.includes(sk))) {
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
