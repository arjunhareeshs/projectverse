import { prisma } from './database';

/**
 * Centralized project/team authorization.
 *
 * Never trust a projectId or teamId supplied by the frontend — every project- or
 * team-scoped endpoint must resolve access through these helpers using the
 * authenticated user id from `req.user`.
 *
 * Team membership is defined by the `User.teamId` scalar (the `Team.members`
 * relation). `TeamMember` rows are NOT consulted here.
 */

export type AccessDenial = 'NOT_FOUND' | 'FORBIDDEN';

export type AccessCheck =
  | { allowed: true }
  | { allowed: false; reason: AccessDenial };

const ELEVATED_ROLES = new Set(['ADMIN', 'FACULTY']);

/**
 * A user may access a team when they are an active member of it (User.teamId),
 * lead it, or hold an elevated org role. Cross-organization access is never allowed.
 */
export async function checkTeamAccess(userId: string, teamId: string): Promise<AccessCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true, teamId: true, role: true },
  });
  if (!user) return { allowed: false, reason: 'FORBIDDEN' };

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, organizationId: true, leadId: true },
  });
  // Outside the caller's organization is reported as not-found so team ids are
  // not enumerable across organizations.
  if (!team || team.organizationId !== user.organizationId) {
    return { allowed: false, reason: 'NOT_FOUND' };
  }

  if (ELEVATED_ROLES.has(user.role)) return { allowed: true };
  if (team.leadId === user.id) return { allowed: true };
  if (user.teamId === team.id) return { allowed: true };

  return { allowed: false, reason: 'FORBIDDEN' };
}

/**
 * A user may access a project when they are a ProjectMember of it, or an active
 * member of the team that owns it (or collaborates on it), or hold an elevated
 * org role. Cross-organization access is never allowed.
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<AccessCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true, teamId: true, role: true },
  });
  if (!user) return { allowed: false, reason: 'FORBIDDEN' };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true, teamId: true, collaboratingTeamId: true },
  });
  if (!project || project.organizationId !== user.organizationId) {
    return { allowed: false, reason: 'NOT_FOUND' };
  }

  if (ELEVATED_ROLES.has(user.role)) return { allowed: true };

  if (user.teamId && (project.teamId === user.teamId || project.collaboratingTeamId === user.teamId)) {
    return { allowed: true };
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (membership) return { allowed: true };

  return { allowed: false, reason: 'FORBIDDEN' };
}

/** Boolean convenience wrapper for call sites that do not need to distinguish 403 from 404. */
export async function canAccessProject(userId: string, projectId: string): Promise<boolean> {
  return (await checkProjectAccess(userId, projectId)).allowed;
}

/** Boolean convenience wrapper for call sites that do not need to distinguish 403 from 404. */
export async function canAccessTeam(userId: string, teamId: string): Promise<boolean> {
  return (await checkTeamAccess(userId, teamId)).allowed;
}
