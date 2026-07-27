import { ProjectLogState, ProjectLogEventPayload } from '../../shared/projectLog.types';

export function applyEvent(state: ProjectLogState, event: ProjectLogEventPayload): ProjectLogState {
  const next: ProjectLogState = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  const now = new Date().toISOString();

  switch (event.type) {
    case 'PROJECT_CREATED': {
      if (event.data.category) {
        next.category = event.data.category as any;
      }
      if (event.data.title) {
        next.title = event.data.title as string;
      }
      break;
    }
    case 'CATEGORY_SET': {
      next.category = (event.data.category as any) || next.category;
      break;
    }
    case 'MEMBERS_SET': {
      const incomingMembers = (event.data.members as Array<{ userId: string; name: string }>) || [];
      const currentMembers = next.team.members || [];
      const incomingUserIds = new Set(incomingMembers.map((m) => m.userId));

      const updatedMembers = currentMembers.map((m) => ({
        ...m,
        active: incomingUserIds.has(m.userId),
      }));

      for (const inc of incomingMembers) {
        const existing = updatedMembers.find((m) => m.userId === inc.userId);
        if (existing) {
          existing.active = true;
          existing.name = inc.name || existing.name;
        } else {
          updatedMembers.push({
            userId: inc.userId,
            name: inc.name,
            responsibilities: [],
            joinedAt: now,
            active: true,
          });
        }
      }
      next.team.members = updatedMembers;
      break;
    }
    case 'MEMBER_ADDED': {
      const userId = event.data.userId as string;
      const name = (event.data.name as string) || 'Member';
      const existing = next.team.members.find((m) => m.userId === userId);
      if (existing) {
        existing.active = true;
        existing.name = name;
      } else {
        next.team.members.push({
          userId,
          name,
          responsibilities: [],
          joinedAt: now,
          active: true,
        });
      }
      break;
    }
    case 'MEMBER_REMOVED': {
      const userId = event.data.userId as string;
      const existing = next.team.members.find((m) => m.userId === userId);
      if (existing) {
        existing.active = false;
      }
      break;
    }
    case 'DURATION_SET':
    case 'DURATION_CHANGED': {
      const months = Number(event.data.months || 6);
      const reason = event.data.reason as string | undefined;
      const startDateStr = (event.data.startDate as string) || next.duration.startDate || now;
      const startDate = new Date(startDateStr);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);

      next.duration = {
        months,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        history: [
          ...(next.duration.history || []),
          { at: now, months, reason },
        ],
      };
      break;
    }
    case 'TECHNOLOGIES_SET': {
      const techs = (event.data.technologies as string[]) || [];
      next.technologies = Array.from(new Set([...techs]));
      break;
    }
    case 'DOC_GENERATED':
    case 'DOC_REGENERATED': {
      const version = Number(event.data.version || (next.executionDoc.currentVersion + 1));
      next.executionDoc = {
        currentVersion: version,
        generatedAt: now,
        uniquenessNotes: event.data.uniquenessNotes as string | undefined,
      };
      if (event.data.workPackages && Array.isArray(event.data.workPackages)) {
        next.workPackages = (event.data.workPackages as any[]).map((wp) => ({
          id: wp.id,
          name: wp.name,
          percentage: wp.percentage,
          assignedTo: wp.assignedTo || [],
          status: wp.status || 'NOT_STARTED',
        }));
      }
      if (event.data.milestones && Array.isArray(event.data.milestones)) {
        next.milestones = (event.data.milestones as any[]).map((m, idx) => {
          const startDate = new Date(next.duration.startDate || now);
          const dueDateObj = new Date(startDate);
          dueDateObj.setDate(dueDateObj.getDate() + (m.completionWeek || m.dueWeek || 1) * 7);
          return {
            id: m.id || `m-${idx + 1}`,
            name: m.name,
            expectedOutput: m.expectedOutput || '',
            dueWeek: m.completionWeek || m.dueWeek || 1,
            dueDate: m.dueDate || dueDateObj.toISOString(),
            status: m.status || 'PENDING',
            history: m.history || [],
          };
        });
      }
      if (event.data.skillsRequired || event.data.gaps) {
        next.skills = {
          required: (event.data.skillsRequired as string[]) || next.skills.required || [],
          gaps: (event.data.gaps as Array<{ skill: string; missingFor: string[] }>) || next.skills.gaps || [],
        };
      }
      break;
    }
    case 'WORK_PACKAGE_ASSIGNED': {
      const wpId = event.data.workPackageId as string;
      const assignedTo = (event.data.assignedTo as string[]) || [];
      const wp = next.workPackages.find((w) => w.id === wpId);
      if (wp) {
        wp.assignedTo = assignedTo;
      }
      // Sync responsibilities in members
      next.team.members.forEach((m) => {
        if (assignedTo.includes(m.userId)) {
          if (!m.responsibilities.includes(wpId)) {
            m.responsibilities.push(wpId);
          }
        } else {
          m.responsibilities = m.responsibilities.filter((r) => r !== wpId);
        }
      });
      break;
    }
    case 'WORK_PACKAGE_STATUS': {
      const wpId = event.data.workPackageId as string;
      const status = event.data.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
      const wp = next.workPackages.find((w) => w.id === wpId);
      if (wp) {
        wp.status = status;
      }
      break;
    }
    case 'MILESTONE_UPDATED': {
      const mId = event.data.milestoneId as string;
      const status = event.data.status as 'PENDING' | 'DONE' | 'MISSED';
      const m = next.milestones.find((item) => item.id === mId);
      if (m) {
        if (status) m.status = status;
      }
      break;
    }
    case 'DEADLINE_CHANGED': {
      const mId = event.data.milestoneId as string;
      const newDueDate = event.data.dueDate as string;
      const reason = event.data.reason as string | undefined;
      const m = next.milestones.find((item) => item.id === mId);
      if (m) {
        m.dueDate = newDueDate;
        m.history.push({ at: now, dueDate: newDueDate, reason });
      }
      break;
    }
    case 'GITHUB_LINKED': {
      next.github = {
        repoFullName: event.data.repoFullName as string,
        linkedAt: now,
      };
      break;
    }
    case 'EVALUATION_ADDED': {
      const evalData = event.data as any;
      next.evaluations.push({
        cycle: evalData.cycle,
        periodStart: evalData.periodStart,
        periodEnd: evalData.periodEnd,
        authenticity: evalData.authenticity,
        plagiarismRisk: evalData.plagiarismRisk,
        overall: evalData.overall,
        reportId: evalData.reportId,
      });
      break;
    }
    case 'FLAG_RAISED': {
      const flagData = event.data as any;
      const existing = next.flags.find((f) => f.id === flagData.id);
      if (existing) {
        existing.resolved = false;
        existing.message = flagData.message || existing.message;
      } else {
        next.flags.push({
          id: flagData.id || `flag-${Date.now()}`,
          at: now,
          type: flagData.type,
          message: flagData.message,
          resolved: false,
        });
      }
      break;
    }
    case 'FLAG_RESOLVED': {
      const flagId = event.data.id as string;
      const f = next.flags.find((flag) => flag.id === flagId);
      if (f) {
        f.resolved = true;
      }
      break;
    }
    case 'MANUAL_NOTE': {
      // Manual note audit event — no state mutation required
      break;
    }
    case 'SELECTION_LOCKED': {
      if (event.data.teamId) {
        next.team.teamId = event.data.teamId as string;
      }
      break;
    }
    case 'BLOCKER_ESCALATED': {
      const flagId = (event.data.id as string) || `blocker-${Date.now()}`;
      const existing = next.flags.find((f) => f.id === flagId);
      if (existing) {
        existing.resolved = false;
        existing.message = (event.data.summary as string) || existing.message;
      } else {
        next.flags.push({
          id: flagId,
          at: now,
          type: 'PERSISTENT_BLOCKER',
          message: (event.data.summary as string) || 'Persistent unresolved blocker',
          resolved: false,
          severity: (event.data.severity as number) || 75,
        });
      }
      break;
    }
    case 'SELECTION_DRAFT':
    case 'SELECTION_VOTE':
    case 'INTERVENTION_LOGGED':
    case 'DELIVERABLE_DRAFTED': {
      // Audit-stream events — no direct state mutation required
      break;
    }
    default: {
      throw new Error(`Unknown ProjectLogEventType: ${(event as any).type}`);
    }
  }

  return next;
}
