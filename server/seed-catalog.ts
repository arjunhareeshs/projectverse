import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found. Please seed the database first.');
    return;
  }

  // Create a template project
  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'AI-Powered Traffic Management System',
      problemStatement:
        'Traffic congestion in urban areas is a major problem. Build a system that optimizes traffic lights based on real-time camera feeds.',
      domain: 'AI & Machine Learning',
      technologies: ['Python', 'TensorFlow', 'OpenCV', 'Node.js', 'React'],
      status: 'CATALOG',
      isTemplate: true,
    },
  });

  console.log(`Created catalog project: ${project.name} (ID: ${project.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
