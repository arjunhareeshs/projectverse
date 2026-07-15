import { PrismaClient, RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'password123';

async function main() {
  console.log('🌱 Seeding exact AI Core teams from screenshot...');

  // Ensure organization exists
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'BITSathy PBL Program' },
    });
  }
  const orgId = org.id;

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Helper to ensure user exists
  const ensureUser = async (email: string, fullName: string, regNo: string, domain: string) => {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName,
          regNo,
          passwordHash,
          role: RoleType.STUDENT,
          organizationId: orgId,
          ssgDomain: domain,
          ssgEnrolled: true,
          groupRegistered: true,
          rewardPoints: 90,
          activityPoints: 50,
        },
      });
    }
    return user;
  };

  // 1. Team Pulse 2
  console.log('- Seeding Team Pulse 2...');
  const mia = await ensureUser('mia.k@projectverse.com', 'Mia K.', 'PV2404', 'AI Core');
  const ana = await ensureUser('ana.y@projectverse.com', 'Ana Y.', 'PV2405', 'AI Core');
  const riya = await ensureUser('riya.p@projectverse.com', 'Riya P.', 'PV2406', 'AI Core');

  let teamPulse2 = await prisma.team.findFirst({ where: { name: 'Team Pulse 2' } });
  if (teamPulse2) {
    // Delete existing dependencies for clean seed
    await prisma.groupRanking.deleteMany({ where: { teamId: teamPulse2.id } }).catch(() => null);
    await prisma.project.deleteMany({ where: { teamId: teamPulse2.id } }).catch(() => null);
    await prisma.adminAchievement.deleteMany({ where: { teamId: teamPulse2.id } }).catch(() => null);
    await prisma.teamMember.deleteMany({ where: { teamId: teamPulse2.id } }).catch(() => null);
    await prisma.team.delete({ where: { id: teamPulse2.id } });
  }

  teamPulse2 = await prisma.team.create({
    data: {
      organizationId: orgId,
      name: 'Team Pulse 2',
      description: 'Vector search over departmental docs',
      domain: 'AI Core',
      groupCode: 'GP-PULSE2',
      groupLevel: 'Level 2',
      maxMembers: 6,
      leadId: mia.id,
      members: {
        connect: [{ id: mia.id }, { id: ana.id }, { id: riya.id }],
      },
    },
  });

  await prisma.teamMember.createMany({
    data: [
      { teamId: teamPulse2.id, userId: mia.id, roleLabel: 'Captain' },
      { teamId: teamPulse2.id, userId: ana.id, roleLabel: 'Member' },
      { teamId: teamPulse2.id, userId: riya.id, roleLabel: 'Member' },
    ],
  });

  await prisma.groupRanking.create({
    data: {
      teamId: teamPulse2.id,
      rank: 1,
      totalPoints: 660,
    },
  });

  await prisma.project.create({
    data: {
      organizationId: orgId,
      teamId: teamPulse2.id,
      name: 'Vector search over departmental docs',
      description: 'Vector search over departmental docs',
      status: 'at-risk',
    },
  });

  // Achievements
  await prisma.adminAchievement.createMany({
    data: [
      {
        title: 'Hackathon SF25 Winner',
        description: 'First prize at SF25 Hackathon',
        type: 'team',
        teamId: teamPulse2.id,
        points: 40,
      },
      {
        title: 'Best Poster',
        description: 'Best project presentation poster',
        type: 'team',
        teamId: teamPulse2.id,
        points: 26,
      },
    ],
  });

  // 2. Team Alpha 2
  console.log('- Seeding Team Alpha 2...');
  const john = await ensureUser('john.d@projectverse.com', 'John D.', 'PV2407', 'AI Core');
  const lisa = await ensureUser('lisa.m@projectverse.com', 'Lisa M.', 'PV2408', 'AI Core');
  const kev = await ensureUser('kev.s@projectverse.com', 'Kev S.', 'PV2409', 'AI Core');

  let teamAlpha2 = await prisma.team.findFirst({ where: { name: 'Team Alpha 2' } });
  if (teamAlpha2) {
    await prisma.groupRanking.deleteMany({ where: { teamId: teamAlpha2.id } }).catch(() => null);
    await prisma.project.deleteMany({ where: { teamId: teamAlpha2.id } }).catch(() => null);
    await prisma.teamMember.deleteMany({ where: { teamId: teamAlpha2.id } }).catch(() => null);
    await prisma.team.delete({ where: { id: teamAlpha2.id } });
  }

  teamAlpha2 = await prisma.team.create({
    data: {
      organizationId: orgId,
      name: 'Team Alpha 2',
      description: 'Low bandwidth image compression at the edge',
      domain: 'AI Core',
      groupCode: 'GP-ALPHA2',
      groupLevel: 'Level 2',
      maxMembers: 6,
      leadId: john.id,
      members: {
        connect: [{ id: john.id }, { id: lisa.id }, { id: kev.id }],
      },
    },
  });

  await prisma.teamMember.createMany({
    data: [
      { teamId: teamAlpha2.id, userId: john.id, roleLabel: 'Captain' },
      { teamId: teamAlpha2.id, userId: lisa.id, roleLabel: 'Member' },
      { teamId: teamAlpha2.id, userId: kev.id, roleLabel: 'Member' },
    ],
  });

  await prisma.groupRanking.create({
    data: {
      teamId: teamAlpha2.id,
      rank: 2,
      totalPoints: 640,
    },
  });

  await prisma.project.create({
    data: {
      organizationId: orgId,
      teamId: teamAlpha2.id,
      name: 'Low bandwidth image compression at the edge',
      description: 'Low bandwidth image compression at the edge',
      status: 'completed',
    },
  });

  // 3. Team Pulse 1
  console.log('- Seeding Team Pulse 1...');
  const sarah = await ensureUser('sarah.j@projectverse.com', 'Sarah J.', 'PV2410', 'AI Core');
  const mike = await ensureUser('mike.t@projectverse.com', 'Mike T.', 'PV2411', 'AI Core');
  const ben = await ensureUser('ben.c@projectverse.com', 'Ben C.', 'PV2412', 'AI Core');

  let teamPulse1 = await prisma.team.findFirst({ where: { name: 'Team Pulse 1' } });
  if (teamPulse1) {
    await prisma.groupRanking.deleteMany({ where: { teamId: teamPulse1.id } }).catch(() => null);
    await prisma.project.deleteMany({ where: { teamId: teamPulse1.id } }).catch(() => null);
    await prisma.teamMember.deleteMany({ where: { teamId: teamPulse1.id } }).catch(() => null);
    await prisma.team.delete({ where: { id: teamPulse1.id } });
  }

  teamPulse1 = await prisma.team.create({
    data: {
      organizationId: orgId,
      name: 'Team Pulse 1',
      description: 'Federated learning for hospital scans',
      domain: 'AI Core',
      groupCode: 'GP-PULSE1',
      groupLevel: 'Level 1',
      maxMembers: 6,
      leadId: sarah.id,
      members: {
        connect: [{ id: sarah.id }, { id: mike.id }, { id: ben.id }],
      },
    },
  });

  await prisma.teamMember.createMany({
    data: [
      { teamId: teamPulse1.id, userId: sarah.id, roleLabel: 'Captain' },
      { teamId: teamPulse1.id, userId: mike.id, roleLabel: 'Member' },
      { teamId: teamPulse1.id, userId: ben.id, roleLabel: 'Member' },
    ],
  });

  await prisma.groupRanking.create({
    data: {
      teamId: teamPulse1.id,
      rank: 3,
      totalPoints: 620,
    },
  });

  await prisma.project.create({
    data: {
      organizationId: orgId,
      teamId: teamPulse1.id,
      name: 'Federated learning for hospital scans',
      description: 'Federated learning for hospital scans',
      status: 'on-track',
    },
  });

  // 4. Team Alpha 1
  console.log('- Seeding Team Alpha 1...');
  const amy = await ensureUser('amy.w@projectverse.com', 'Amy W.', 'PV2413', 'AI Core');
  const tom = await ensureUser('tom.h@projectverse.com', 'Tom H.', 'PV2414', 'AI Core');
  const zoe = await ensureUser('zoe.l@projectverse.com', 'Zoe L.', 'PV2415', 'AI Core');

  let teamAlpha1 = await prisma.team.findFirst({ where: { name: 'Team Alpha 1' } });
  if (teamAlpha1) {
    await prisma.groupRanking.deleteMany({ where: { teamId: teamAlpha1.id } }).catch(() => null);
    await prisma.project.deleteMany({ where: { teamId: teamAlpha1.id } }).catch(() => null);
    await prisma.teamMember.deleteMany({ where: { teamId: teamAlpha1.id } }).catch(() => null);
    await prisma.team.delete({ where: { id: teamAlpha1.id } });
  }

  teamAlpha1 = await prisma.team.create({
    data: {
      organizationId: orgId,
      name: 'Team Alpha 1',
      description: 'Realtime speech translation for classrooms',
      domain: 'AI Core',
      groupCode: 'GP-ALPHA1',
      groupLevel: 'Level 1',
      maxMembers: 6,
      leadId: amy.id,
      members: {
        connect: [{ id: amy.id }, { id: tom.id }, { id: zoe.id }],
      },
    },
  });

  await prisma.teamMember.createMany({
    data: [
      { teamId: teamAlpha1.id, userId: amy.id, roleLabel: 'Captain' },
      { teamId: teamAlpha1.id, userId: tom.id, roleLabel: 'Member' },
      { teamId: teamAlpha1.id, userId: zoe.id, roleLabel: 'Member' },
    ],
  });

  await prisma.groupRanking.create({
    data: {
      teamId: teamAlpha1.id,
      rank: 4,
      totalPoints: 600,
    },
  });

  await prisma.project.create({
    data: {
      organizationId: orgId,
      teamId: teamAlpha1.id,
      name: 'Realtime speech translation for classrooms',
      description: 'Realtime speech translation for classrooms',
      status: 'on-track',
    },
  });

  console.log('✅ Seeding exact AI Core teams completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
