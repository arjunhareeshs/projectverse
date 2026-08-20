import { prisma } from '../../shared/database';
import { ProjectLogState } from '../../shared/projectLog.types';
import { logger } from '../../shared/logger';

export async function persistNormalizedProjectLog(
  logId: string,
  state: ProjectLogState,
): Promise<void> {
  try {
    // 1. Duration
    if (state.duration) {
      const sDate = new Date(state.duration.startDate || Date.now());
      const eDate = new Date(state.duration.endDate || Date.now());
      await prisma.projectLogDuration.upsert({
        where: { logId },
        create: {
          logId,
          months: Number(state.duration.months) || 6,
          startDate: sDate,
          endDate: eDate,
        },
        update: {
          months: Number(state.duration.months) || 6,
          startDate: sDate,
          endDate: eDate,
        },
      });

      if (Array.isArray(state.duration.history) && state.duration.history.length > 0) {
        await prisma.projectLogDurationHistory.deleteMany({ where: { logId } });
        await prisma.projectLogDurationHistory.createMany({
          data: state.duration.history.map((h) => ({
            logId,
            at: new Date(h.at || Date.now()),
            months: Number(h.months) || 6,
            reason: h.reason || null,
          })),
        });
      }
    }

    // 2. Members & Responsibilities
    if (state.team && Array.isArray(state.team.members)) {
      await prisma.projectLogMember.deleteMany({ where: { logId } });
      for (const m of state.team.members) {
        const memRecord = await prisma.projectLogMember.create({
          data: {
            logId,
            userId: m.userId,
            name: m.name || 'Member',
            joinedAt: new Date(m.joinedAt || Date.now()),
            active: m.active !== false,
          },
        });

        if (Array.isArray(m.responsibilities) && m.responsibilities.length > 0) {
          await prisma.projectLogMemberResponsibility.createMany({
            data: m.responsibilities.map((wpId) => ({
              memberId: memRecord.id,
              workPackageId: wpId,
            })),
          });
        }
      }
    }

    // 3. Technologies
    if (Array.isArray(state.technologies)) {
      await prisma.projectLogTechnology.deleteMany({ where: { logId } });
      if (state.technologies.length > 0) {
        await prisma.projectLogTechnology.createMany({
          data: state.technologies.map((t) => ({ logId, name: String(t) })),
          skipDuplicates: true,
        });
      }
    }

    // 4. Work Packages
    if (Array.isArray(state.workPackages)) {
      await prisma.projectLogWorkPackage.deleteMany({ where: { logId } });
      if (state.workPackages.length > 0) {
        await prisma.projectLogWorkPackage.createMany({
          data: state.workPackages.map((wp) => ({
            logId,
            slug: wp.id,
            name: wp.name,
            percentage: Number(wp.percentage) || 0,
            status: wp.status || 'NOT_STARTED',
            assignedTo: wp.assignedTo || [],
          })),
          skipDuplicates: true,
        });
      }
    }

    // 5. Milestones & History
    if (Array.isArray(state.milestones)) {
      await prisma.projectLogMilestone.deleteMany({ where: { logId } });
      for (const ms of state.milestones) {
        const msRecord = await prisma.projectLogMilestone.create({
          data: {
            logId,
            milestoneId: ms.id,
            name: ms.name,
            expectedOutput: ms.expectedOutput || null,
            dueWeek: Number(ms.dueWeek) || 1,
            dueDate: new Date(ms.dueDate || Date.now()),
            status: ms.status || 'PENDING',
          },
        });

        if (Array.isArray(ms.history) && ms.history.length > 0) {
          await prisma.projectLogMilestoneHistory.createMany({
            data: ms.history.map((h) => ({
              milestoneId: msRecord.id,
              at: new Date(h.at || Date.now()),
              dueDate: new Date(h.dueDate || Date.now()),
              reason: h.reason || null,
            })),
          });
        }
      }
    }

    // 6. Skills & Gaps
    if (state.skills) {
      if (Array.isArray(state.skills.required)) {
        await prisma.projectLogSkill.deleteMany({ where: { logId } });
        if (state.skills.required.length > 0) {
          await prisma.projectLogSkill.createMany({
            data: state.skills.required.map((sk) => ({ logId, skill: String(sk) })),
            skipDuplicates: true,
          });
        }
      }

      if (Array.isArray(state.skills.gaps)) {
        await prisma.projectLogSkillGap.deleteMany({ where: { logId } });
        if (state.skills.gaps.length > 0) {
          await prisma.projectLogSkillGap.createMany({
            data: state.skills.gaps.map((g) => ({
              logId,
              skill: g.skill,
              missingFor: g.missingFor || [],
            })),
          });
        }
      }
    }

    // 7. Flags
    if (Array.isArray(state.flags)) {
      await prisma.projectLogFlag.deleteMany({ where: { logId } });
      if (state.flags.length > 0) {
        await prisma.projectLogFlag.createMany({
          data: state.flags.map((f) => ({
            logId,
            flagId: f.id,
            at: new Date(f.at || Date.now()),
            type: f.type,
            message: f.message,
            resolved: !!f.resolved,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 8. Evaluations
    if (Array.isArray(state.evaluations)) {
      await prisma.projectLogEvaluationRef.deleteMany({ where: { logId } });
      if (state.evaluations.length > 0) {
        await prisma.projectLogEvaluationRef.createMany({
          data: state.evaluations.map((ev) => ({
            logId,
            cycle: Number(ev.cycle) || 1,
            periodStart: new Date(ev.periodStart || Date.now()),
            periodEnd: new Date(ev.periodEnd || Date.now()),
            authenticity: Number(ev.authenticity) || 0,
            plagiarismRisk: ev.plagiarismRisk || 'LOW',
            overall: Number(ev.overall) || 0,
            reportId: ev.reportId || '',
          })),
          skipDuplicates: true,
        });
      }
    }
  } catch (err: any) {
    logger.warn('Failed to persist normalized project log state', { logId, error: err?.message });
  }
}

export async function persistNormalizedEventFields(
  eventId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    if (!data || typeof data !== 'object') return;
    const fields: Array<{
      eventId: string;
      key: string;
      valueText: string | null;
      valueNum: number | null;
      valueBool: boolean | null;
      valueDate: Date | null;
    }> = [];

    for (const [key, val] of Object.entries(data)) {
      let valueText: string | null = null;
      let valueNum: number | null = null;
      let valueBool: boolean | null = null;
      let valueDate: Date | null = null;

      if (typeof val === 'string') {
        valueText = val.slice(0, 1000);
        if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
          const d = new Date(val);
          if (!Number.isNaN(d.getTime())) valueDate = d;
        }
      } else if (typeof val === 'number') {
        valueNum = val;
      } else if (typeof val === 'boolean') {
        valueBool = val;
      } else if (val instanceof Date) {
        valueDate = val;
      } else if (val !== null && val !== undefined) {
        valueText = JSON.stringify(val).slice(0, 1000);
      }

      fields.push({
        eventId,
        key,
        valueText,
        valueNum,
        valueBool,
        valueDate,
      });
    }

    if (fields.length > 0) {
      await prisma.projectLogEventField.createMany({ data: fields });
    }
  } catch (err: any) {
    logger.warn('Failed to persist normalized event fields', { eventId, error: err?.message });
  }
}
