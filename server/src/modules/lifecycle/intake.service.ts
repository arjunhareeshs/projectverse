import { prisma } from '../../shared/database';
import { projectLogService } from './projectLog.service';

export class IntakeService {
  async handleIntakeStep(
    projectId: string,
    actorUserId: string,
    stepData:
      | { step: 'members'; memberUserIds: string[] }
      | { step: 'duration'; months: number; startDate?: string }
      | { step: 'technologies'; technologies: string[] },
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: true },
    });
    if (!project) throw new Error(`Project ${projectId} not found`);

    switch (stepData.step) {
      case 'members': {
        const memberUserIds = stepData.memberUserIds || [];
        let users: Array<{ id: string; fullName: string; role: string }> = [];

        if (memberUserIds.length > 0) {
          users = await prisma.user.findMany({
            where: { id: { in: memberUserIds } },
            select: { id: true, fullName: true, role: true },
          });
        }

        const members = users.map((u) => ({ userId: u.id, name: u.fullName }));

        // Sync with TeamMember rows if project has a team
        if (project.teamId && memberUserIds.length > 0) {
          const currentTeamMembers = await prisma.teamMember.findMany({
            where: { teamId: project.teamId },
          });
          const currentIds = new Set(currentTeamMembers.map((tm) => tm.userId));

          // Add missing members
          for (const uid of memberUserIds) {
            if (!currentIds.has(uid)) {
              await prisma.teamMember.create({
                data: {
                  teamId: project.teamId,
                  userId: uid,
                  roleLabel: 'Member',
                },
              });
            }
          }
        }

        return projectLogService.appendEvent(projectId, {
          type: 'MEMBERS_SET',
          actorUserId,
          data: { members },
        });
      }

      case 'duration': {
        if (stepData.months < 1 || stepData.months > 18) {
          throw new Error('Project duration must be between 1 and 18 months.');
        }
        return projectLogService.appendEvent(projectId, {
          type: 'DURATION_SET',
          actorUserId,
          data: { months: stepData.months, startDate: stepData.startDate },
        });
      }

      case 'technologies': {
        return projectLogService.appendEvent(projectId, {
          type: 'TECHNOLOGIES_SET',
          actorUserId,
          data: { technologies: stepData.technologies },
        });
      }

      default: {
        throw new Error('Invalid intake step');
      }
    }
  }
}

export const intakeService = new IntakeService();
