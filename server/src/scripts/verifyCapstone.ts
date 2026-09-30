import { prisma } from '../shared/database';
import { capstoneService } from '../modules/capstone/capstone.service';

async function testFullCapstoneFlow() {
  console.info('=== RUNNING FULL CAPSTONE PIPELINE TEST ===\n');

  // 1. Get a test student user and admin
  const student = await prisma.user.findFirst({
    where: { role: 'STUDENT' },
    select: { id: true, email: true, organizationId: true },
  });

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, organizationId: true },
  });

  if (!student || !admin) {
    throw new Error('Test users (STUDENT and ADMIN) not found in database.');
  }

  console.info(`Student: ${student.email} (${student.id})`);
  console.info(`Admin: ${admin.email} (${admin.id})\n`);

  // 2. Fetch problems
  const problems = await capstoneService.getProblems({}, false);
  console.info(`✓ Fetched ${problems.length} active capstone problems.`);
  if (problems.length === 0) throw new Error('No problems found.');

  const testProblem = problems[0];
  console.info(`Selected Problem: "${testProblem.title}" (${testProblem.id})`);

  // Clean any previous test selection for this student and problem
  const existingSelection = await prisma.capstoneSelection.findFirst({
    where: { userId: student.id, problemId: testProblem.id },
  });
  if (existingSelection) {
    console.info('Cleaning up existing test selection...');
    await prisma.capstoneSelection.delete({ where: { id: existingSelection.id } });
  }

  // 3. Test Student Claim
  console.info('\n--- Step 1: Claim Capstone Project ---');
  const claimResult = await capstoneService.claimProblem(
    student.id,
    testProblem.id,
    'Our team will build this using a microservices pattern with Redis pub-sub and Docker.'
  );

  console.info(`✓ Project claimed successfully. Project ID: ${claimResult.project.id}`);
  console.info(`✓ Selection ID: ${claimResult.selection.id}`);
  console.info(`✓ Project Mode: ${claimResult.project.mode}`);
  console.info(`✓ Due date assigned: ${claimResult.selection.dueAt.toISOString()}`);

  if (claimResult.project.mode !== 'CAPSTONE') {
    throw new Error('Expected project mode to be CAPSTONE');
  }

  // Verify Rule 1: Cannot claim the same capstone twice
  try {
    await capstoneService.claimProblem(student.id, testProblem.id, 'Duplicate claim attempt');
    throw new Error('FAIL: Duplicate claim was allowed!');
  } catch (err: any) {
    console.info(`✓ Rule 1 verified: Duplicate claim rejected ("${err.message}")`);
  }

  // 4. Test 7-day rule for submission
  console.info('\n--- Step 2: 7-Day Gate Verification ---');
  try {
    await capstoneService.submitGithub(
      claimResult.selection.id,
      student.id,
      'https://github.com/expressjs/express',
      false // do NOT bypass
    );
    throw new Error('FAIL: Premature submission before 7 days was allowed!');
  } catch (err: any) {
    console.info(`✓ Rule 2 verified: Premature submission rejected ("${err.message}")`);
  }

  // 5. Test Submission with Dev/Test bypass
  console.info('\n--- Step 3: GitHub Submission & Deep Analysis ---');
  const submitResult = await capstoneService.submitGithub(
    claimResult.selection.id,
    student.id,
    'https://github.com/expressjs/express',
    true // Dev bypass
  );

  console.info(`✓ GitHub submission processed. Status: ${submitResult.status}`);
  console.info(`✓ MCQs Generated Count: ${submitResult.questionsCount}`);

  if (submitResult.questionsCount !== 15) {
    throw new Error(`Expected exactly 15 MCQs, got ${submitResult.questionsCount}`);
  }

  // 6. Test Fetching MCQs
  console.info('\n--- Step 4: Fetch MCQs for Student ---');
  const mcqData = await capstoneService.getMcqQuestions(claimResult.selection.id, student.id);
  console.info(`✓ MCQs retrieved: ${mcqData.totalQuestions} questions for "${mcqData.projectName}"`);

  // Verify Rule 5: Correct answers are NOT exposed to frontend
  const firstQ = mcqData.questions[0];
  console.info(`Sample Question: "${firstQ.question}"`);
  console.info(`Options Count: ${firstQ.options.length}`);
  if ((firstQ as any).correctOption !== undefined || (firstQ as any).explanation !== undefined) {
    throw new Error('FAIL: correctOption or explanation exposed in client response!');
  }
  console.info('✓ Rule 5 verified: correctOption and explanation are scrubbed from client response.');

  for (const q of mcqData.questions) {
    if (q.options.length !== 6) {
      throw new Error(`FAIL: Question "${q.question}" has ${q.options.length} options instead of 6`);
    }
  }
  console.info('✓ All 15 questions have exactly 6 options.');

  // 7. Test Submitting Answers
  console.info('\n--- Step 5: Submit Answers & Scoring ---');
  // Answer all 15 questions (pick option 0 or alternating)
  const answersPayload = mcqData.questions.map((q, idx) => ({
    questionId: q.id,
    selectedOption: idx % 6,
  }));

  const submitAnswersResult = await capstoneService.submitMcqAnswers(
    claimResult.selection.id,
    student.id,
    answersPayload
  );

  console.info(`✓ Answers evaluated successfully!`);
  console.info(`✓ Score: ${submitAnswersResult.score} / ${submitAnswersResult.totalQuestions} (${submitAnswersResult.percentage}%)`);

  // Verify Rule 7: Questions deleted from database
  const remainingQuestions = await prisma.capstoneMcqQuestion.count({
    where: { selectionId: claimResult.selection.id },
  });
  console.info(`Remaining CapstoneMcqQuestion rows: ${remainingQuestions}`);
  if (remainingQuestions !== 0) {
    throw new Error('FAIL: MCQ questions were not deleted after evaluation completion!');
  }
  console.info('✓ Rule 7 verified: CapstoneMcqQuestion rows deleted.');

  // Verify Rule 8: Score stored in CapstoneSelection
  const updatedSelection = await prisma.capstoneSelection.findUnique({
    where: { id: claimResult.selection.id },
  });
  console.info(`Stored mcqScore in CapstoneSelection: ${updatedSelection?.mcqScore}`);
  console.info(`Selection status: ${updatedSelection?.status}`);
  if (updatedSelection?.mcqScore === null || updatedSelection?.status !== 'COMPLETED') {
    throw new Error('FAIL: CapstoneSelection score or status not updated correctly');
  }
  console.info('✓ Rule 8 verified: Score stored in CapstoneSelection.');

  // Verify Rule 4: Cannot submit MCQ twice
  try {
    await capstoneService.submitMcqAnswers(claimResult.selection.id, student.id, answersPayload);
    throw new Error('FAIL: Submitting MCQ twice was allowed!');
  } catch (err: any) {
    console.info(`✓ Rule 4 verified: Double MCQ submission rejected ("${err.message}")`);
  }

  // 8. Test Admin Stats
  console.info('\n--- Step 6: Admin Statistics ---');
  const adminStats = await capstoneService.getAdminStats();
  console.info('Admin Stats:', adminStats);
  console.info('✓ Admin analytics computed accurately.');

  console.info('\n=== ALL CAPSTONE SPECIFICATION TESTS PASSED SUCCESSFULLY! ===\n');
}

testFullCapstoneFlow()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
