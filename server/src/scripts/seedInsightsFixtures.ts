import { prisma } from '../shared/database';

export async function seedInsightsFixtures() {
  console.log('[Seed] Seeding insights test fixtures...');

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Test Organization' },
    });
  }

  // 1. Create Teams
  const teamAlpha = await prisma.team.upsert({
    where: { groupCode: 'GRP-ALPHA' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Team Alpha (Face Rec)',
      domain: 'Artificial Intelligence',
      groupCode: 'GRP-ALPHA',
    },
  });

  const teamBeta = await prisma.team.upsert({
    where: { groupCode: 'GRP-BETA' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Team Beta (Attendance AI)',
      domain: 'Artificial Intelligence',
      groupCode: 'GRP-BETA',
    },
  });

  const teamGamma = await prisma.team.upsert({
    where: { groupCode: 'GRP-GAMMA' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Team Gamma (Vision Pass)',
      domain: 'Artificial Intelligence',
      groupCode: 'GRP-GAMMA',
    },
  });

  const teamDeltaControl = await prisma.team.upsert({
    where: { groupCode: 'GRP-DELTA' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Team Delta (Drone Soil Sensor)',
      domain: 'IoT & Hardware',
      groupCode: 'GRP-DELTA',
    },
  });

  const teamEpsilonStandout = await prisma.team.upsert({
    where: { groupCode: 'GRP-EPSILON' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Team Epsilon (Quantum Cryptography)',
      domain: 'Cybersecurity',
      groupCode: 'GRP-EPSILON',
    },
  });

  const teamZetaSpike = await prisma.team.upsert({
    where: { groupCode: 'GRP-ZETA' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Team Zeta (Flash In The Pan)',
      domain: 'Web Development',
      groupCode: 'GRP-ZETA',
    },
  });

  // 2. Create Projects
  const projAlpha = await prisma.project.upsert({
    where: { problemId: 'H-TEST-01' },
    update: {
      problemStatement: 'Automate student classroom attendance using OpenCV face detection, deep learning embeddings, and automated notification logs.',
      objective: 'Build real-time facial recognition camera system for automated attendance tracking, report generation, and student verification.',
      soul: 'Real-time facial recognition attendance system for university classrooms.',
      technologies: ['Python', 'OpenCV', 'PyTorch', 'FastAPI', 'React'],
      hardwareComponents: ['Camera Module', 'Raspberry Pi 4'],
    },
    create: {
      organizationId: org.id,
      teamId: teamAlpha.id,
      problemId: 'H-TEST-01',
      name: 'Facial Recognition Attendance System',
      domain: 'Artificial Intelligence',
      problemStatement: 'Automate student classroom attendance using OpenCV face detection, deep learning embeddings, and automated notification logs.',
      objective: 'Build real-time facial recognition camera system for automated attendance tracking, report generation, and student verification.',
      soul: 'Real-time facial recognition attendance system for university classrooms.',
      technologies: ['Python', 'OpenCV', 'PyTorch', 'FastAPI', 'React'],
      hardwareComponents: ['Camera Module', 'Raspberry Pi 4'],
      innovation: 'Multi-camera spatial feature extraction for anti-spoofing.',
      targetUsers: 'University professors and administrators.',
      differentiationApproach: 'Liveness detection with blink frequency analysis.',
    },
  });

  const projBeta = await prisma.project.upsert({
    where: { problemId: 'H-TEST-02' },
    update: {
      problemStatement: 'Automate student classroom attendance using OpenCV face detection, deep learning embeddings, and automated notification logs.',
      objective: 'Build real-time facial recognition camera system for automated attendance tracking, report generation, and student verification.',
      soul: 'Real-time facial recognition attendance system for university classrooms.',
      technologies: ['Python', 'OpenCV', 'PyTorch', 'FastAPI', 'React'],
      hardwareComponents: ['Camera Module', 'Raspberry Pi 4'],
    },
    create: {
      organizationId: org.id,
      teamId: teamBeta.id,
      problemId: 'H-TEST-02',
      name: 'AI Facial Attendance Tracker',
      domain: 'Artificial Intelligence',
      problemStatement: 'Automate student classroom attendance using OpenCV face detection, deep learning embeddings, and automated notification logs.',
      objective: 'Build real-time facial recognition camera system for automated attendance tracking, report generation, and student verification.',
      soul: 'Real-time facial recognition attendance system for university classrooms.',
      technologies: ['Python', 'OpenCV', 'PyTorch', 'FastAPI', 'React'],
      hardwareComponents: ['Camera Module', 'Raspberry Pi 4'],
      innovation: 'Edge computing camera module for instant verification.',
      targetUsers: 'Schools and educational institutions.',
      differentiationApproach: 'Raspberry Pi edge inference integration.',
    },
  });

  const projGamma = await prisma.project.upsert({
    where: { problemId: 'H-TEST-03' },
    update: {
      problemStatement: 'Automate student classroom attendance using OpenCV face detection, deep learning embeddings, and automated notification logs.',
      objective: 'Build real-time facial recognition camera system for automated attendance tracking, report generation, and student verification.',
      soul: 'Real-time facial recognition attendance system for university classrooms.',
      technologies: ['Python', 'OpenCV', 'PyTorch', 'FastAPI', 'React'],
      hardwareComponents: ['Camera Module', 'Raspberry Pi 4'],
    },
    create: {
      organizationId: org.id,
      teamId: teamGamma.id,
      problemId: 'H-TEST-03',
      name: 'Vision-Based Student Attendance Pass',
      domain: 'Artificial Intelligence',
      problemStatement: 'Automate student classroom attendance using OpenCV face detection, deep learning embeddings, and automated notification logs.',
      objective: 'Build real-time facial recognition camera system for automated attendance tracking, report generation, and student verification.',
      soul: 'Real-time facial recognition attendance system for university classrooms.',
      technologies: ['Python', 'OpenCV', 'PyTorch', 'FastAPI', 'React'],
      hardwareComponents: ['Camera Module', 'Raspberry Pi 4'],
      innovation: 'Infrared night vision camera support.',
      targetUsers: 'Lecture hall instructors.',
      differentiationApproach: 'Infrared illumination setup for low-light rooms.',
    },
  });

  const projControl = await prisma.project.upsert({
    where: { problemId: 'H-TEST-04' },
    update: {},
    create: {
      organizationId: org.id,
      teamId: teamDeltaControl.id,
      problemId: 'H-TEST-04',
      name: 'Autonomous Agro-Drone Soil Moisture Sensor',
      domain: 'IoT & Hardware',
      problemStatement: 'Precision agriculture drone mapping soil nitrogen and moisture content using spectral sensors.',
      objective: 'Build autonomous quadcopter with multispectral sensor payload for field moisture mapping.',
      soul: 'Multispectral drone mapping for precision soil nutrient analysis.',
      technologies: ['C++', 'PX4', 'ROS2', 'LoRaWAN', 'PostGIS'],
      innovation: 'Real-time multispectral NDVI calculation during flight.',
      targetUsers: 'Commercial farmers and agricultural researchers.',
    },
  });

  const projStandout = await prisma.project.upsert({
    where: { problemId: 'H-TEST-05' },
    update: {},
    create: {
      organizationId: org.id,
      teamId: teamEpsilonStandout.id,
      problemId: 'H-TEST-05',
      name: 'Post-Quantum Lattice Cryptographic Vault',
      domain: 'Cybersecurity',
      problemStatement: 'Legacy enterprise encryption protocols are vulnerable to upcoming quantum decryption capabilities.',
      objective: 'Implement NIST-standardized Kyber and Dilithium lattice cryptography in a zero-trust storage engine.',
      soul: 'NIST-grade post-quantum lattice cryptographic vault for enterprise data.',
      technologies: ['Rust', 'WebAssembly', 'Kyber', 'Dilithium', 'gRPC'],
      innovation: 'Zero-knowledge lattice key encapsulation for multi-tenant cloud architectures.',
      targetUsers: 'Financial institutions, defense contractors, and enterprise security officers.',
      expectedImpact: 'Prevents retroactive decryption of intercepted high-value communications.',
      similarProducts: ['Standard RSA-4096', 'Traditional ECC'],
      publicationPotential: 'Targeting IEEE Symposium on Security and Privacy.',
    },
  });

  const projSpike = await prisma.project.upsert({
    where: { problemId: 'H-TEST-06' },
    update: {},
    create: {
      organizationId: org.id,
      teamId: teamZetaSpike.id,
      problemId: 'H-TEST-06',
      name: 'Flashy Todo App Extraordinaire',
      domain: 'Web Development',
      problemStatement: 'Simple task list application with sleek animations.',
      soul: 'A todo app with flashy UI transitions.',
      technologies: ['React', 'CSS'],
    },
  });

  // 3. Evaluation Reports for Standout Project (4 clean, consistent cycles: 82, 85, 88, 90)
  const standoutCycles = [
    { cycle: 1, overallScore: 82 },
    { cycle: 2, overallScore: 85 },
    { cycle: 3, overallScore: 88 },
    { cycle: 4, overallScore: 90 },
  ];

  for (const c of standoutCycles) {
    await prisma.evaluationReport.upsert({
      where: { projectId_cycle: { projectId: projStandout.id, cycle: c.cycle } },
      update: {},
      create: {
        projectId: projStandout.id,
        cycle: c.cycle,
        periodStart: new Date(Date.now() - (60 - c.cycle * 15) * 86400000),
        periodEnd: new Date(Date.now() - (45 - c.cycle * 15) * 86400000),
        content: {
          overallScore: c.overallScore,
          plagiarismRisk: 'LOW',
          suspiciousBehaviour: [],
          authenticityConfidence: { score: 92 },
          memberParticipation: {
            perMember: [
              { memberId: 'm1', score: 85 },
              { memberId: 'm2', score: 85 },
            ],
          },
          mentorFeedback: `Cycle ${c.cycle} execution exceeded milestone expectations with robust performance.`,
        },
      },
    });
  }

  // GitHub Repo for Standout Project
  const githubRepo = await prisma.githubRepository.upsert({
    where: { owner_repository: { owner: 'epsilon-org', repository: 'quantum-vault' } },
    update: {},
    create: {
      projectId: projStandout.id,
      owner: 'epsilon-org',
      repository: 'quantum-vault',
      description: 'Post-Quantum Lattice Cryptographic Vault in Rust',
      commitCount: 85,
      contributorCount: 3,
      language: 'Rust',
      topics: ['cryptography', 'post-quantum', 'rust', 'security'],
    },
  });

  // Create GitHub commits across 4 distinct weeks
  const now = Date.now();
  for (let w = 1; w <= 4; w++) {
    for (let c = 1; c <= 10; c++) {
      await prisma.githubCommit.upsert({
        where: { repositoryId_sha: { repositoryId: githubRepo.id, sha: `sha-w${w}-c${c}` } },
        update: {},
        create: {
          repositoryId: githubRepo.id,
          sha: `sha-w${w}-c${c}`,
          author: c % 2 === 0 ? 'alice' : 'bob',
          message: `Feature commit ${c} for milestone ${w}`,
          date: new Date(now - (35 - w * 7) * 86400000),
        },
      });
    }
  }

  // 4. Evaluation Report for Spike Project (1 single 95 cycle)
  await prisma.evaluationReport.upsert({
    where: { projectId_cycle: { projectId: projSpike.id, cycle: 1 } },
    update: {},
    create: {
      projectId: projSpike.id,
      cycle: 1,
      periodStart: new Date(Date.now() - 15 * 86400000),
      periodEnd: new Date(),
      content: {
        overallScore: 95,
        plagiarismRisk: 'LOW',
        suspiciousBehaviour: [],
        authenticityConfidence: { score: 80 },
        memberParticipation: { perMember: [{ memberId: 'm1', score: 95 }] },
      },
    },
  });

  console.log('[Seed] Insights test fixtures successfully seeded!');
}

if (require.main === module) {
  seedInsightsFixtures().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
