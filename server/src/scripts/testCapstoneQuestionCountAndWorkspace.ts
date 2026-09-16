import { prisma } from '../shared/database';
import { capstoneService } from '../modules/capstone/capstone.service';

async function main() {
  console.log('=== TEST: CAPSTONE QUESTION COUNT & WORKSPACE FLOW ===\n');

  // 1. Verify DB Column
  console.log('--- Step 1: Verify questionCount column in DB ---');
  const colInfo: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns 
    WHERE table_name = 'CapstoneProblemStatement' AND column_name = 'questionCount';
  `;
  console.log('DB column info:', colInfo);
  if (colInfo.length === 0) {
    throw new Error('FAIL: questionCount column missing from CapstoneProblemStatement');
  }
  console.log('✓ Verified: questionCount column exists in DB.\n');

  // Find or create test organization and admin user
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin user found');

  let student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  if (!student) {
    student = admin; // fallback
  }

  // 2. Admin creates a problem statement with custom questionCount
  console.log('--- Step 2: Admin creates problem with questionCount = 10 ---');
  const createdProblem = await capstoneService.createProblem(
    {
      title: 'Real-Time Edge Analytics & Event Streaming Engine',
      problemText: 'Build an ultra-low latency event streaming engine processing 50,000 metrics/sec.',
      domain: 'Cloud & Distributed Systems',
      difficulty: 'Hard',
      technologies: ['Node.js', 'Redis', 'WebSockets', 'TypeScript'],
      isActive: true,
      questionCount: 10,
    },
    admin.id,
    org.id
  );

  console.log(`✓ Created problem: "${createdProblem.title}" (ID: ${createdProblem.id})`);
  console.log(`  Stored questionCount: ${createdProblem.questionCount}`);
  if (createdProblem.questionCount !== 10) {
    throw new Error(`FAIL: Expected questionCount 10, got ${createdProblem.questionCount}`);
  }

  // 3. Admin updates questionCount to 12
  console.log('\n--- Step 3: Admin updates problem questionCount to 12 ---');
  const updatedProblem = await capstoneService.updateProblem(createdProblem.id, {
    questionCount: 12,
  });
  console.log(`✓ Updated questionCount: ${updatedProblem.questionCount}`);
  if (updatedProblem.questionCount !== 12) {
    throw new Error(`FAIL: Expected questionCount 12, got ${updatedProblem.questionCount}`);
  }

  // 4. Student claims the Capstone Project
  console.log('\n--- Step 4: Student claims the Capstone Project ---');
  const claimRes = await capstoneService.claimProblem(
    student.id,
    updatedProblem.id,
    'High throughput pipeline utilizing backpressure and worker threads.'
  );

  console.log(`✓ Claimed project: ${claimRes.project.name} (Project ID: ${claimRes.project.id})`);
  console.log(`  Selection totalQuestions: ${claimRes.selection.totalQuestions}`);
  if (claimRes.selection.totalQuestions !== 12) {
    throw new Error(`FAIL: Expected selection totalQuestions to be 12, got ${claimRes.selection.totalQuestions}`);
  }

  // 5. Test getCapstoneByProjectId (Workspace endpoint)
  console.log('\n--- Step 5: Test getCapstoneByProjectId (Workspace view data) ---');
  const workspaceData = await capstoneService.getCapstoneByProjectId(claimRes.project.id, student.id, true);
  if (!workspaceData) {
    throw new Error('FAIL: getCapstoneByProjectId returned null');
  }

  console.log('✓ Workspace data retrieved successfully:');
  console.log(`  isCapstone: ${workspaceData.isCapstone}`);
  console.log(`  Project Name: ${workspaceData.project.name}`);
  console.log(`  Problem Text: ${(workspaceData.problem.problemText || '').slice(0, 50)}...`);
  console.log(`  Days Balance: ${workspaceData.metrics.daysBalance} days`);
  console.log(`  Selection Status: ${workspaceData.selection.status}`);
  console.log(`  Selection Total Questions: ${workspaceData.selection.totalQuestions}`);

  if (workspaceData.metrics.daysBalance !== 7) {
    throw new Error(`FAIL: Expected daysBalance 7, got ${workspaceData.metrics.daysBalance}`);
  }
  if (workspaceData.selection.totalQuestions !== 12) {
    throw new Error(`FAIL: Expected totalQuestions 12, got ${workspaceData.selection.totalQuestions}`);
  }

  // 6. Test submitGithub with dynamic question generation
  console.log('\n--- Step 6: Test submitGithub generates configured 12 questions ---');
  const submitRes = await capstoneService.submitGithub(
    claimRes.selection.id,
    student.id,
    'https://github.com/facebook/react',
    true // bypassTimeCheck
  );

  console.log(`✓ submitGithub result: questionsCount = ${submitRes.questionsCount}, status = ${submitRes.status}`);
  if (submitRes.questionsCount !== 12) {
    throw new Error(`FAIL: Expected exactly 12 generated questions, got ${submitRes.questionsCount}`);
  }

  // Verify questions in DB
  const questionsInDb = await prisma.capstoneMcqQuestion.findMany({
    where: { selectionId: claimRes.selection.id },
  });
  console.log(`✓ Questions saved in DB: ${questionsInDb.length}`);
  if (questionsInDb.length !== 12) {
    throw new Error(`FAIL: Expected 12 questions in DB, got ${questionsInDb.length}`);
  }

  // Verify each question has 6 options
  for (const q of questionsInDb) {
    const opts = q.options as string[];
    if (opts.length !== 6) {
      throw new Error(`FAIL: Question "${q.question}" does not have 6 options (has ${opts.length})`);
    }
  }
  console.log('✓ All 12 questions have exactly 6 options.');

  // Verify workspace data reflects MCQ_READY
  const workspaceDataAfterSubmit = await capstoneService.getCapstoneByProjectId(claimRes.project.id, student.id, true);
  console.log(`✓ Workspace status after submission: ${workspaceDataAfterSubmit?.selection.status}`);
  if (workspaceDataAfterSubmit?.selection.status !== 'MCQ_READY') {
    throw new Error('FAIL: Expected status to be MCQ_READY');
  }

  // 7. Cleanup
  console.log('\n--- Step 7: Cleaning up test records ---');
  await prisma.capstoneMcqQuestion.deleteMany({ where: { selectionId: claimRes.selection.id } });
  await prisma.capstoneSelection.deleteMany({ where: { id: claimRes.selection.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: claimRes.project.id } });
  await prisma.project.deleteMany({ where: { id: claimRes.project.id } });
  await prisma.capstoneProblemStatement.deleteMany({ where: { id: createdProblem.id } });
  console.log('✓ Cleanup complete.');

  console.log('\n=== ALL CAPSTONE QUESTION COUNT & WORKSPACE TESTS PASSED! ===\n');
}

main()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
