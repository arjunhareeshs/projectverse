import { prisma } from '../../shared/database';
import { giniCoefficient } from '../../shared/fairness';

export interface MemberWorkload {
  userId: string;
  name: string;
  role: string;
  open: number;
  inProgress: number;
  done: number;
  totalAssigned: number;
}

export interface WorkloadDistribution {
  members: MemberWorkload[];
  imbalanceGini: number; // 0 (even) -> 1 (imbalanced)
  status: 'BALANCED' | 'MODERATE_IMBALANCE' | 'HIGH_IMBALANCE';
}

export async function teamWorkload(projectId: string): Promise<WorkloadDistribution> {
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, fullName: true },
      },
    },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      assigneeId: true,
      status: true,
    },
  });

  const memberMap = new Map<string, MemberWorkload>();

  for (const pm of projectMembers) {
    memberMap.set(pm.userId, {
      userId: pm.userId,
      name: pm.user.fullName,
      role: pm.role,
      open: 0,
      inProgress: 0,
      done: 0,
      totalAssigned: 0,
    });
  }

  for (const t of tasks) {
    if (t.assigneeId && memberMap.has(t.assigneeId)) {
      const entry = memberMap.get(t.assigneeId)!;
      entry.totalAssigned += 1;
      const statusUpper = String(t.status).toUpperCase();
      if (statusUpper === 'DONE' || statusUpper === 'COMPLETED') {
        entry.done += 1;
      } else if (statusUpper === 'IN_PROGRESS' || statusUpper === 'DOING') {
        entry.inProgress += 1;
      } else {
        entry.open += 1;
      }
    }
  }

  const members = Array.from(memberMap.values());
  const activeLoadCounts = members.map((m) => m.open + m.inProgress);
  const imbalanceGini = giniCoefficient(activeLoadCounts);

  const status: WorkloadDistribution['status'] =
    imbalanceGini >= 0.5 ? 'HIGH_IMBALANCE' : imbalanceGini >= 0.3 ? 'MODERATE_IMBALANCE' : 'BALANCED';

  return { members, imbalanceGini, status };
}
