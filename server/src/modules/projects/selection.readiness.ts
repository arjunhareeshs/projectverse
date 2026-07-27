import { prisma } from '../../shared/database';

export interface ReadinessCheckItem {
  id: 'inTeam' | 'teamSized' | 'skills' | 'group';
  label: string;
  ok: boolean;
  fix: string;
  message: string;
}

export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessCheckItem[];
}

export async function getTeamSelectionReadiness(userId: string): Promise<ReadinessResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true, skillsRegistered: true, groupRegistered: true },
  });

  const team = user?.teamId
    ? await prisma.team.findUnique({
        where: { id: user.teamId },
        select: { maxMembers: true, _count: { select: { teamMembers: true } } },
      })
    : null;

  const MIN_MEMBERS = 2;
  const memberCount = team?._count.teamMembers ?? 0;

  const checks: ReadinessCheckItem[] = [
    {
      id: 'inTeam',
      label: 'Team Membership',
      ok: Boolean(user?.teamId),
      fix: '/teams',
      message: user?.teamId ? 'Belongs to a registered team.' : 'You must join or create a team before selecting a project.',
    },
    {
      id: 'teamSized',
      label: 'Roster Size',
      ok: memberCount >= MIN_MEMBERS,
      fix: '/teams/invite',
      message: memberCount >= MIN_MEMBERS
        ? `Team has ${memberCount} members (minimum ${MIN_MEMBERS}).`
        : `Team must have at least ${MIN_MEMBERS} members (currently ${memberCount}).`,
    },
    {
      id: 'skills',
      label: 'Skills Profile',
      ok: Boolean(user?.skillsRegistered),
      fix: '/profile/skills',
      message: user?.skillsRegistered ? 'Skills profile complete.' : 'Complete your skills profile to enable statement fit calculation.',
    },
    {
      id: 'group',
      label: 'Group Registration',
      ok: Boolean(user?.groupRegistered),
      fix: '/profile/group',
      message: user?.groupRegistered ? 'Group registered.' : 'Select your cohort group/section in your profile.',
    },
  ];

  const ready = checks.every((c) => c.ok);
  return { ready, checks };
}
