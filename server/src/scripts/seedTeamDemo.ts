import { PrismaClient, RoleType } from '@prisma/client';

const PASSWORD_HASH = '$2b$10$P9sKqAydXjsvSvRQFdLIRuBUQ46UcYMcZnjCIqgxyAjc/kD7yvRH2';

const prisma = new PrismaClient();

async function seedTeamDemo() {
  console.log('Seeding Syed Saffridin Demo Team...');
  
  // Ensure we have an organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'ProjectVerse Institute' }
    });
  }

  // Create Captain
  const captain = await prisma.user.create({
    data: {
      email: 'syed.saffridin@projectverse.com',
      fullName: 'Syed Saffridin',
      regNo: 'REGNO_PENDING',
      passwordHash: PASSWORD_HASH,
      role: RoleType.STUDENT,
      organizationId: org.id,
      mustChangePassword: true,
    }
  });

  // Create Members
  const member1 = await prisma.user.create({
    data: {
      email: 'member1@projectverse.com',
      fullName: 'Member 1 (Placeholder)',
      passwordHash: PASSWORD_HASH,
      role: RoleType.STUDENT,
      organizationId: org.id,
    }
  });

  const member2 = await prisma.user.create({
    data: {
      email: 'member2@projectverse.com',
      fullName: 'Member 2 (Placeholder)',
      passwordHash: PASSWORD_HASH,
      role: RoleType.STUDENT,
      organizationId: org.id,
    }
  });

  // Create Team
  const team = await prisma.team.create({
    data: {
      name: 'Falcon Squad (Placeholder)',
      description: 'Working on Problem Statement H00xx',
      organizationId: org.id,
      leadId: captain.id,
      members: {
        connect: [{ id: captain.id }, { id: member1.id }, { id: member2.id }]
      }
    }
  });

  // Create Team Members explicit relations
  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: captain.id, roleLabel: 'Captain' },
      { teamId: team.id, userId: member1.id, roleLabel: 'Member' },
      { teamId: team.id, userId: member2.id, roleLabel: 'Member' }
    ]
  });

  console.log('✅ Demo team seeded successfully!');
  console.log('  Captain: syed.saffridin@projectverse.com / password123');
}

seedTeamDemo()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
