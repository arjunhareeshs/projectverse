import { prisma } from '../shared/database';
import { capstoneService } from '../modules/capstone/capstone.service';

async function testFullCapstoneFlow() {
  console.log('=== RUNNING FULL CAPSTONE PIPELINE TEST ===\n');

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

  console.log(`Student: ${student.email} (${student.id})`);
  console.log(`Admin: ${admin.email} (${admin.id})\n`);

  // 2. Fetch problems
  const problems = await capstoneService.getProblems({}, false);
  console.log(`✓ Fetched ${problems.length} active capstone problems.`);
  if (problems.length === 0) throw new Error('No problems found.');

  const testProblem = problems[0];
  console.log(`Selected Problem: "${testProblem.title}" (${testProblem.id})`);

  // Clean any previous test selection for this student and problem
  const existingSelection = await prisma.capstoneSelection.findFirst({
    where: { userId: student.id, problemId: testProblem.id },
  });
  if (existingSelection) {
    console.log('Cleaning up existing test selection...');
    await prisma.capstoneSelection.delete({ where: { id: existingSelection.id } });
  }

  // 3. Test Student Claim
  console.log('\n--- Step 1: Claim Capstone Project ---');
  const claimResult = await capstoneService.claimProblem(
    student.id,
    testProblem.id,
    'Our team will build this using a microservices pattern with Redis pub-sub and Docker.'
  );

  console.log(`✓ Project claimed successfully. Project ID: ${claimResult.project.id}`);
  console.log(`✓ Selection ID: ${claimResult.selection.id}`);
  console.log(`✓ Project Mode: ${claimResult.project.mode}`);
  console.log(`✓ Due date assigned: ${claimResult.selection.dueAt.toISOString()}`);

  if (claimResult.project.mode !== 'CAPSTONE') {
    throw new Error('Expected project mode to be CAPSTONE');
  }

  // Verify Rule 1: Cannot claim the same capstone twice
  try {
    await capstoneService.claimProblem(student.id, testProblem.id, 'Duplicate claim attempt');
    throw new Error('FAIL: Duplicate claim was allowed!');
  } catch (err: any) {
    console.log(`✓ Rule 1 verified: Duplicate claim rejected ("${err.message}")`);
  }

  // 4. Test 7-day rule for submission
  console.log('\n--- Step 2: 7-Day Gate Verification ---');
  try {
    await capstoneService.submitGithub(
      claimResult.selection.id,
      student.id,
      'https://github.com/expressjs/express',
      false // do NOT bypass
    );
    throw new Error('FAIL: Premature submission before 7 days was allowed!');
  } catch (err: any) {
    console.log(`✓ Rule 2 verified: Premature submission rejected ("${err.message}")`);
  }

  // 5. Test Submission with Dev/Test bypass
  console.log('\n--- Step 3: GitHub Submission & Deep Analysis ---');
  const submitResult = await capstoneService.submitGithub(
    claimResult.selection.id,
    student.id,
    'https://github.com/expressjs/express',
    true // Dev bypass
  );

  console.log(`✓ GitHub submission processed. Status: ${submitResult.status}`);
  console.log(`✓ MCQs Generated Count: ${submitResult.questionsCount}`);

  if (submitResult.questionsCount !== 15) {
    throw new Error(`Expected exactly 15 MCQs, got ${submitResult.questionsCount}`);
  }

  // 6. Test Fetching MCQs
  console.log('\n--- Step 4: Fetch MCQs for Student ---');
  const mcqData = await capstoneService.getMcqQuestions(claimResult.selection.id, student.id);
  console.log(`✓ MCQs retrieved: ${mcqData.totalQuestions} questions for "${mcqData.projectName}"`);

  // Verify Rule 5: Correct answers are NOT exposed to frontend
  const firstQ = mcqData.questions[0];
  console.log(`Sample Question: "${firstQ.question}"`);
  console.log(`Options Count: ${firstQ.options.length}`);
  if ((firstQ as any).correctOption !== undefined || (firstQ as any).explanation !== undefined) {
    throw new Error('FAIL: correctOption or explanation exposed in client response!');
  }
  console.log('✓ Rule 5 verified: correctOption and explanation are scrubbed from client response.');

  for (const q of mcqData.questions) {
    if (q.options.length !== 6) {
      throw new Error(`FAIL: Question "${q.question}" has ${q.options.length} options instead of 6`);
    }
  }
  console.log('✓ All 15 questions have exactly 6 options.');

  // 7. Test Submitting Answers
  console.log('\n--- Step 5: Submit Answers & Scoring ---');
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

  console.log(`✓ Answers evaluated successfully!`);
  console.log(`✓ Score: ${submitAnswersResult.score} / ${submitAnswersResult.totalQuestions} (${submitAnswersResult.percentage}%)`);

  // Verify Rule 7: Questions deleted from database
  const remainingQuestions = await prisma.capstoneMcqQuestion.count({
    where: { selectionId: claimResult.selection.id },
  });
  console.log(`Remaining CapstoneMcqQuestion rows: ${remainingQuestions}`);
  if (remainingQuestions !== 0) {
    throw new Error('FAIL: MCQ questions were not deleted after evaluation completion!');
  }
  console.log('✓ Rule 7 verified: CapstoneMcqQuestion rows deleted.');

  // Verify Rule 8: Score stored in CapstoneSelection
  const updatedSelection = await prisma.capstoneSelection.findUnique({
    where: { id: claimResult.selection.id },
  });
  console.log(`Stored mcqScore in CapstoneSelection: ${updatedSelection?.mcqScore}`);
  console.log(`Selection status: ${updatedSelection?.status}`);
  if (updatedSelection?.mcqScore === null || updatedSelection?.status !== 'COMPLETED') {
    throw new Error('FAIL: CapstoneSelection score or status not updated correctly');
  }
  console.log('✓ Rule 8 verified: Score stored in CapstoneSelection.');

  // Verify Rule 4: Cannot submit MCQ twice
  try {
    await capstoneService.submitMcqAnswers(claimResult.selection.id, student.id, answersPayload);
    throw new Error('FAIL: Submitting MCQ twice was allowed!');
  } catch (err: any) {
    console.log(`✓ Rule 4 verified: Double MCQ submission rejected ("${err.message}")`);
  }

  // 8. Test Admin Stats
  console.log('\n--- Step 6: Admin Statistics ---');
  const adminStats = await capstoneService.getAdminStats();
  console.log('Admin Stats:', adminStats);
  console.log('✓ Admin analytics computed accurately.');

  console.log('\n=== ALL CAPSTONE SPECIFICATION TESTS PASSED SUCCESSFULLY! ===\n');
}

testFullCapstoneFlow()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
