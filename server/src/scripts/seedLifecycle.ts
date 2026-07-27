/**
 * Lifecycle demo seed.
 *
 * Creates a realistic AI-lifecycle project so Parts 2/3 (doc generation,
 * 15-day evaluation, mentor, admin AI) have data to run against. It writes the
 * Project Log through the real `projectLogService` (initLog + append events),
 * so running this also exercises the reducer/transaction path end to end.
 *
 * Idempotent: re-running reuses the same org/users/team/project and only seeds
 * the intake events on a freshly-created log (version 0). Daily logs upsert on
 * (projectId, userId, date).
 *
 *   Run:  npm run seed:lifecycle       (from server/)
 */
import { RoleType } from '@prisma/client';
import { prisma } from '../shared/database';
import { projectLogService } from '../modules/lifecycle/projectLog.service';

// bcrypt hash of "password123" (same convention as seedTeamDemo.ts)
const PASSWORD_HASH = '$2b$10$P9sKqAydXjsvSvRQFdLIRuBUQ46UcYMcZnjCIqgxyAjc/kD7yvRH2';

const DEMO = {
  teamName: 'Lifecycle Demo Team',
  projectName: 'Smart Irrigation Advisor (Lifecycle Demo)',
  members: [
    { email: 'alice.lifecycle@projectverse.com', fullName: 'Alice Demo', roleLabel: 'Captain',
      skills: ['JavaScript', 'React', 'Node.js'] },
    { email: 'bob.lifecycle@projectverse.com', fullName: 'Bob Demo', roleLabel: 'Member',
      skills: ['Python', 'Machine Learning'] },
    { email: 'carol.lifecycle@projectverse.com', fullName: 'Carol Demo', roleLabel: 'Member',
      skills: ['UI/UX', 'Figma'] },
  ],
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function main() {
  console.log('[SeedLifecycle] Starting…');

  // 1. Organization (reuse first, else create)
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'ProjectVerse Institute' } });
    console.log(`[SeedLifecycle] Created organization ${org.name}`);
  }

  // 2. Users (upsert by unique email) + their skills
  const users = [];
  for (const m of DEMO.members) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { fullName: m.fullName, organizationId: org.id },
      create: {
        email: m.email,
        fullName: m.fullName,
        passwordHash: PASSWORD_HASH,
        role: RoleType.STUDENT,
        organizationId: org.id,
        skillsRegistered: true,
      },
    });
    for (const skillName of m.skills) {
      await prisma.userSkill.upsert({
        where: { userId_skillName: { userId: user.id, skillName } },
        update: {},
        create: { userId: user.id, skillName, skillType: 'primary' },
      });
    }
    users.push({ ...user, roleLabel: m.roleLabel });
  }
  const captain = users[0];
  console.log(`[SeedLifecycle] Upserted ${users.length} users with skills`);

  // 3. Team (find by name, else create) + TeamMember rows + User.team link
  let team = await prisma.team.findFirst({ where: { name: DEMO.teamName, organizationId: org.id } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: DEMO.teamName,
        description: 'Demo team for the AI project lifecycle',
        organizationId: org.id,
        leadId: captain.id,
        domain: 'Agriculture',
      },
    });
    console.log(`[SeedLifecycle] Created team ${team.name}`);
  }
  for (const u of users) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: u.id } },
      update: { roleLabel: u.roleLabel },
      create: { teamId: team.id, userId: u.id, roleLabel: u.roleLabel },
    });
    await prisma.user.update({ where: { id: u.id }, data: { teamId: team.id } });
  }

  // 4. Project (find by name+team, else create) with a category set
  let project = await prisma.project.findFirst({ where: { name: DEMO.projectName, teamId: team.id } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        organizationId: org.id,
        teamId: team.id,
        name: DEMO.projectName,
        description: 'Sensor-driven irrigation advisory for smallholder farms.',
        domain: 'Agriculture',
        type: 'Hardware & Software',
        category: 'FINAL_YEAR',
        problemStatement:
          'Smallholder farmers lack affordable, data-driven guidance on when and how much to irrigate.',
        technologies: ['Node.js', 'React', 'PostgreSQL', 'ESP32'],
        status: 'pending_approval',
      },
    });
    console.log(`[SeedLifecycle] Created project ${project.name}`);
  }
  // Project members (idempotent via unique [projectId, userId])
  for (const u of users) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: u.id } },
      update: {},
      create: { projectId: project.id, userId: u.id, role: u.id === captain.id ? RoleType.ADMIN : RoleType.STUDENT },
    });
  }

  // 5. Project Log — go through the real service so the reducer/transaction runs.
  const before = await projectLogService.getState(project.id);
  await projectLogService.initLog(project.id, {
    title: project.name,
    category: 'FINAL_YEAR',
    teamId: team.id,
    durationMonths: 6,
  });

  // Only append the intake event chain on a fresh log (avoid duplicate events
  // on re-runs). A freshly-initialized log is at version 0.
  if (!before) {
    await projectLogService.appendEvent(project.id, {
      type: 'PROJECT_CREATED',
      actorUserId: captain.id,
      data: { title: project.name, category: 'FINAL_YEAR' },
    });
    await projectLogService.appendEvent(project.id, {
      type: 'MEMBERS_SET',
      actorUserId: captain.id,
      data: { members: users.map((u) => ({ userId: u.id, name: u.fullName })) },
    });
    await projectLogService.appendEvent(project.id, {
      type: 'DURATION_SET',
      actorUserId: captain.id,
      data: { months: 6 },
    });
    await projectLogService.appendEvent(project.id, {
      type: 'TECHNOLOGIES_SET',
      actorUserId: captain.id,
      data: { technologies: project.technologies },
    });
    console.log('[SeedLifecycle] Seeded Project Log intake events');
  } else {
    console.log('[SeedLifecycle] Project Log already existed — skipped intake events');
  }

  // 6. Daily work logs — Alice & Bob active across ~10 days, Carol mostly
  // silent (gives the evaluation/mentor engines a realistic participation gap
  // within the 15-day window). Seeds write history directly: the service's
  // 2-day edit-window guard is a user-facing rule, not a data-integrity one.
  const dailyLogs: Array<{ user: (typeof users)[number]; day: number; workDone: string; hours: number; blockers?: string }> = [
    { user: users[0], day: 10, workDone: 'Set up the Express API skeleton and the sensor-ingest endpoint; wired PostgreSQL schema for readings.', hours: 4 },
    { user: users[0], day: 8, workDone: 'Implemented moisture-threshold logic and unit tests for the advisory calculation.', hours: 3.5 },
    { user: users[0], day: 5, workDone: 'Built the React dashboard shell and connected it to the readings API.', hours: 4 },
    { user: users[0], day: 2, workDone: 'Added authentication and per-farm data isolation; wrote integration tests.', hours: 3 },
    { user: users[0], day: 1, workDone: 'Refined the advisory thresholds against field feedback; fixed timezone bug in scheduling.', hours: 2.5 },
    { user: users[1], day: 9, workDone: 'Collected sample soil-moisture datasets and cleaned them for the model.', hours: 3 },
    { user: users[1], day: 6, workDone: 'Trained a first regression model to predict irrigation need; evaluated RMSE.', hours: 5, blockers: 'Need more labelled field data for edge cases.' },
    { user: users[1], day: 3, workDone: 'Exposed the model behind a prediction endpoint and benchmarked latency.', hours: 4 },
    { user: users[2], day: 7, workDone: 'Drafted low-fidelity wireframes for the farmer dashboard.', hours: 1.5 },
  ];
  for (const l of dailyLogs) {
    const date = new Date(isoDaysAgo(l.day));
    await prisma.dailyWorkLog.upsert({
      where: { projectId_userId_date: { projectId: project.id, userId: l.user.id, date } },
      update: { workDone: l.workDone, hoursSpent: l.hours, blockers: l.blockers },
      create: { projectId: project.id, userId: l.user.id, date, workDone: l.workDone, hoursSpent: l.hours, blockers: l.blockers },
    });
  }
  console.log(`[SeedLifecycle] Upserted ${dailyLogs.length} daily work logs (Alice=5, Bob=3, Carol=1)`);

  const state = await projectLogService.getState(project.id);
  console.log('[SeedLifecycle] ✅ Done.');
  console.log(`  Project:   ${project.name}`);
  console.log(`  Project ID: ${project.id}`);
  console.log(`  Log version: ${state?.version}  |  members: ${state?.team.members.length}  |  technologies: ${state?.technologies.join(', ')}`);
  console.log('  Login: alice.lifecycle@projectverse.com / password123');
}

main()
  .catch((e) => {
    console.error('[SeedLifecycle] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
