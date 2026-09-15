import { prisma } from '../shared/database';

async function main() {
  console.log('Seeding Capstone Problem Statements...');

  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found to attach capstones.');
    return;
  }

  const sampleProblems = [
    {
      title: 'Distributed Event-Driven Task Queue with Resilient Worker Nodes',
      problemText:
        'Architect and implement a resilient, distributed asynchronous job processing engine. The system must support job scheduling, rate limiting, exponential backoff retries, dead-letter queues, real-time worker node health telemetry, and an administrative dashboard to monitor queue depths and processing throughput.',
      domain: 'Cloud Architecture & Backend',
      difficulty: 'Hard',
      technologies: ['Node.js', 'Redis', 'Docker', 'PostgreSQL', 'TypeScript', 'WebSockets'],
      isActive: true,
    },
    {
      title: 'Zero-Trust Role-Based Access Control (RBAC) Microservice with JWT & Audit Logs',
      problemText:
        'Design a comprehensive authentication and access delegation microservice. Features must include passwordless and multi-factor authentication, granular RBAC permissions with dynamic scope evaluation, cryptographically signed token refresh rotations, rate-limiting against brute force, and an immutable audit event logging pipeline.',
      domain: 'Cybersecurity & Backend',
      difficulty: 'Medium',
      technologies: ['React', 'Express.js', 'PostgreSQL', 'Prisma', 'JWT', 'TailwindCSS'],
      isActive: true,
    },
    {
      title: 'Real-Time Collaborative Document Canvas with Operational Transforms',
      problemText:
        'Develop an interactive real-time multi-user document editor and canvas. The application must handle simultaneous concurrent edits from multiple participants without race conditions, display presence cursors and typing indicators, maintain revision snapshot history, and support offline edits with automatic reconciliation upon reconnection.',
      domain: 'Full-Stack Web',
      difficulty: 'Hard',
      technologies: ['React', 'TypeScript', 'WebSockets', 'TailwindCSS', 'Node.js', 'Redis'],
      isActive: true,
    },
    {
      title: 'Automated Codebase AST Dependency Visualizer & Vulnerability Scanner',
      problemText:
        'Construct a developer tool that ingests full-stack repositories, parses their Abstract Syntax Tree (AST), generates an interactive visual graph of inter-module dependency relationships, flags outdated libraries against security advisory feeds, and calculates maintainability metrics.',
      domain: 'Developer Tooling & AI',
      difficulty: 'Medium',
      technologies: ['TypeScript', 'React', 'D3.js', 'Express.js', 'REST APIs'],
      isActive: true,
    },
  ];

  for (const prob of sampleProblems) {
    const existing = await prisma.capstoneProblemStatement.findFirst({
      where: { title: prob.title, organizationId: org.id },
    });

    if (!existing) {
      await prisma.capstoneProblemStatement.create({
        data: {
          organizationId: org.id,
          title: prob.title,
          problemText: prob.problemText,
          domain: prob.domain,
          difficulty: prob.difficulty,
          technologies: prob.technologies,
          isActive: prob.isActive,
        },
      });
      console.log(`+ Created capstone problem: ${prob.title}`);
    } else {
      console.log(`- Problem already exists: ${prob.title}`);
    }
  }

  console.log('Capstone seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding capstones:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
