import http from 'node:http';
import axios, { AxiosInstance } from 'axios';
import { createApp } from '../app';
import { prisma } from '../shared/database';
import { signAccessToken } from '../config/jwt';
import {
  analyzeCapstoneRepository,
  parseGithubUrl,
  CapstoneAnalysisError,
} from '../modules/capstone/capstone.githubAnalysis';

interface CheckResult {
  step: string;
  passed: boolean;
  details: string;
  error?: any;
}

const results: CheckResult[] = [];

function record(step: string, passed: boolean, details: string, error?: any) {
  results.push({ step, passed, details, error });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${statusStr}] ${step} - ${details}`);
  if (error) {
    console.error('   Error details:', error);
  }
}

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('  STARTING DEEP GITHUB & CAPSTONE FUNCTIONALITY AUDIT');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // PART 1: Direct GitHub Analysis Unit Tests
  // -------------------------------------------------------------
  console.log('--- PART 1: Testing GitHub Analysis Engine ---');

  // 1.1 Invalid URL parsing
  try {
    parseGithubUrl('not-a-url');
    record('1.1 URL Validation - invalid string', false, 'Should have thrown CapstoneAnalysisError');
  } catch (err: any) {
    record(
      '1.1 URL Validation - invalid string',
      err instanceof CapstoneAnalysisError && (err.code === 'INVALID_HOST' || err.code === 'INVALID_URL'),
      `Correctly caught invalid host error: ${err.message}`
    );
  }

  // 1.2 Non-GitHub host parsing
  try {
    parseGithubUrl('https://gitlab.com/owner/repo');
    record('1.2 URL Validation - non-github host', false, 'Should have thrown for gitlab host');
  } catch (err: any) {
    record(
      '1.2 URL Validation - non-github host',
      err instanceof CapstoneAnalysisError && err.code === 'INVALID_HOST',
      `Correctly rejected non-GitHub host: ${err.message}`
    );
  }

  // 1.3 Missing repo path
  try {
    parseGithubUrl('https://github.com/expressjs');
    record('1.3 URL Validation - missing repo', false, 'Should have thrown for missing repo name');
  } catch (err: any) {
    record(
      '1.3 URL Validation - missing repo',
      err instanceof CapstoneAnalysisError && err.code === 'INVALID_PATH',
      `Correctly rejected incomplete path: ${err.message}`
    );
  }

  // 1.4 Valid URL parsing
  try {
    const { owner, repo } = parseGithubUrl('https://github.com/expressjs/express.git');
    record(
      '1.4 URL Validation - valid format',
      owner === 'expressjs' && repo === 'express',
      `Parsed owner="${owner}", repo="${repo}"`
    );
  } catch (err: any) {
    record('1.4 URL Validation - valid format', false, 'Failed to parse valid URL', err);
  }

  // 1.5 Real GitHub Repo Analysis: expressjs/express (A real public GitHub repo)
  console.log('\n--- Analyzing real GitHub repository: expressjs/express ---');
  try {
    const analysis = await analyzeCapstoneRepository('https://github.com/expressjs/express');
    const hasRequiredFields =
      analysis.owner === 'expressjs' &&
      analysis.repo === 'express' &&
      typeof analysis.framework === 'string' &&
      Array.isArray(analysis.majorModules) &&
      analysis.inspectedFiles.length > 0;

    record(
      '1.5 Real GitHub Repo Analysis (expressjs/express)',
      hasRequiredFields,
      `Detected Framework="${analysis.framework}", Architecture="${analysis.architecture}", InspectedFiles=${analysis.inspectedFiles.length}, TotalFiles=${analysis.totalFilesCount}`
    );
  } catch (err: any) {
    record('1.5 Real GitHub Repo Analysis (expressjs/express)', false, 'Failed to analyze real repo', err);
  }

  // 1.6 Non-existent GitHub Repo: Should cleanly catch 404
  console.log('\n--- Analyzing non-existent repository: should return NOT_FOUND ---');
  try {
    await analyzeCapstoneRepository('https://github.com/nonexistentuser000000000001/nonexistentrepo999999999999');
    record('1.6 Non-existent GitHub Repo', false, 'Should have thrown NOT_FOUND error');
  } catch (err: any) {
    record(
      '1.6 Non-existent GitHub Repo',
      err instanceof CapstoneAnalysisError && err.code === 'NOT_FOUND',
      `Correctly caught: ${err.message} (${err.code})`
    );
  }

  // -------------------------------------------------------------
  // PART 2: Database Setup & Test HTTP Server
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Database & Test Server Setup ---');

  const app = createApp();
  const server = http.createServer(app);
  const TEST_PORT = 4220;

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`✓ Test HTTP server listening on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  const api: AxiosInstance = axios.create({
    baseURL: `http://127.0.0.1:${TEST_PORT}/api`,
    validateStatus: () => true,
  });

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Capstone Test University',
      },
    });
  }

  const studentEmail = `capstone.student.${Date.now()}@test.edu`;
  const student = await prisma.user.create({
    data: {
      email: studentEmail,
      fullName: 'Capstone Auditor Student',
      passwordHash: 'dummy_hash',
      role: 'STUDENT',
      organizationId: org.id,
    },
  });

  const adminEmail = `capstone.admin.${Date.now()}@test.edu`;
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      fullName: 'Capstone Auditor Admin',
      passwordHash: 'dummy_hash',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  const studentToken = signAccessToken({
    sub: student.id,
    role: student.role,
    orgId: org.id,
  });

  const adminToken = signAccessToken({
    sub: admin.id,
    role: admin.role,
    orgId: org.id,
  });

  record('2.1 Fixture Setup', !!studentToken && !!adminToken, `Created student=${student.id}, admin=${admin.id}`);

  // Create a dedicated Capstone Problem for this test run
  const testProblem = await prisma.capstoneProblemStatement.create({
    data: {
      organizationId: org.id,
      title: `E-Commerce Microservices Platform [Audit ${Date.now()}]`,
      problemText:
        'Architect a fault-tolerant microservices-based e-commerce platform with event-driven inventory tracking, resilient checkout processing, and distributed tracing.',
      domain: 'Cloud Architecture & Distributed Systems',
      difficulty: 'Hard',
      technologies: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'Redis'],
      isActive: true,
      createdById: admin.id,
    },
  });

  record('2.2 Problem Fixture', !!testProblem.id, `Created problem ID=${testProblem.id}`);

  // -------------------------------------------------------------
  // PART 3: Catalog & Dual-Mode Isolation Verification
  // -------------------------------------------------------------
  console.log('\n--- PART 3: Catalog & Dual-Mode Isolation ---');

  // Normal project catalog must not crash and continue returning standard projects
  const normalRes = await api.get('/projects/catalog', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  record(
    '3.1 Normal Catalog Isolation',
    normalRes.status === 200,
    `Normal catalog returned status ${normalRes.status}`
  );

  // Capstone catalog must return active capstone problems
  const capstoneRes = await api.get('/capstone/problems', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  const problemsList = Array.isArray(capstoneRes.data) ? capstoneRes.data : capstoneRes.data?.data || [];
  const hasOurProblem = problemsList.some((p: any) => p.id === testProblem.id);
  record(
    '3.2 Capstone Catalog Endpoint',
    capstoneRes.status === 200 && hasOurProblem,
    `Capstone catalog returned status 200 and includes newly created problem (total problems: ${problemsList.length})`
  );

  // -------------------------------------------------------------
  // PART 4: Claiming Capstone & Duplicate Protection
  // -------------------------------------------------------------
  console.log('\n--- PART 4: Claiming Capstone Project ---');

  // 4.1 Direct Claim Execution without mandatory approach text
  const claimRes = await api.post(
    `/capstone/${testProblem.id}/claim`,
    {},
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  const claimData = claimRes.data?.data || claimRes.data;
  const selectionId = claimData?.selection?.id;
  const projectId = claimData?.project?.id;

  record(
    '4.1 Direct Claim Execution (No Approach Text Required)',
    claimRes.status === 201 && !!selectionId && !!projectId,
    `Created selectionId=${selectionId}, projectId=${projectId}`
  );

  // 4.3 Verify Project mode is CAPSTONE
  const projectInDb = await prisma.project.findUnique({ where: { id: projectId } });
  record(
    '4.3 Project Mode Verification',
    projectInDb?.mode === 'CAPSTONE',
    `Project mode is strictly "${projectInDb?.mode}"`
  );

  // 4.4 Rule 1: A student cannot claim the same capstone twice
  const duplicateClaimRes = await api.post(
    `/capstone/${testProblem.id}/claim`,
    {
      approachText: 'Second attempt should be rejected.',
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  record(
    '4.4 Rule 1: Duplicate Claim Block',
    duplicateClaimRes.status === 400 && duplicateClaimRes.data?.message?.includes('already claimed'),
    `Rejected duplicate claim with status ${duplicateClaimRes.status}: "${duplicateClaimRes.data?.message}"`
  );

  // 4.5 Verify Student's My Projects list returns the capstone selection
  const myProjectsRes = await api.get('/projects/my', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  const myProjectsList = myProjectsRes.data?.projects || [];
  const myProjItem = myProjectsList.find((p: any) => p.id === projectId);
  record(
    '4.5 My Projects Extended Format',
    myProjectsRes.status === 200 && myProjItem?.mode === 'CAPSTONE' && !!myProjItem?.capstone,
    `Found project in My Projects with mode="CAPSTONE", status="${myProjItem?.capstone?.status}"`
  );

  // -------------------------------------------------------------
  // PART 5: 7-Day Gate & Sequence Security Verification
  // -------------------------------------------------------------
  console.log('\n--- PART 5: 7-Day Timeline & Sequence Constraints ---');

  // 5.1 Rule 3: Cannot attend MCQ before GitHub submission
  const prematureMcqRes = await api.get(`/capstone/${selectionId}/mcq`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  record(
    '5.1 Rule 3: Premature MCQ Attendance Block',
    prematureMcqRes.status === 400 && prematureMcqRes.data?.message?.includes('Please submit your GitHub repository'),
    `Blocked with status ${prematureMcqRes.status}: "${prematureMcqRes.data?.message}"`
  );

  // 5.2 Rule 2: Cannot submit GitHub repo before 7 days without explicit bypass
  const earlySubmitRes = await api.post(
    `/capstone/${selectionId}/submit-github`,
    {
      githubUrl: 'https://github.com/expressjs/express',
      bypassTimeCheck: false,
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  record(
    '5.2 Rule 2: 7-Day Window Enforcement',
    earlySubmitRes.status === 400 && earlySubmitRes.data?.message?.includes('7-day development window'),
    `Blocked early submission with status ${earlySubmitRes.status}: "${earlySubmitRes.data?.message}"`
  );

  // -------------------------------------------------------------
  // PART 6: GitHub Submission & MCQ Generation with Real Analysis
  // -------------------------------------------------------------
  console.log('\n--- PART 6: GitHub Submission & AI MCQ Generation ---');

  // Now submit with bypassTimeCheck: true (simulating completion of the 7-day timeline)
  // using real repo: https://github.com/expressjs/express
  const validSubmitRes = await api.post(
    `/capstone/${selectionId}/submit-github`,
    {
      githubUrl: 'https://github.com/expressjs/express',
      bypassTimeCheck: true,
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  const submitData = validSubmitRes.data?.data || validSubmitRes.data;
  record(
    '6.1 GitHub Submission with Code Analysis',
    validSubmitRes.status === 200 && submitData?.status === 'MCQ_READY',
    `Submission processed. Returned questionsCount=${submitData?.questionsCount}, status=${submitData?.status}`
  );

  // -------------------------------------------------------------
  // PART 7: MCQ Security - Zero Answer Leaks & 15 Questions / 6 Options
  // -------------------------------------------------------------
  console.log('\n--- PART 7: MCQ Security & Structure Audit ---');

  const mcqFetchRes = await api.get(`/capstone/${selectionId}/mcq`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  const mcqData = mcqFetchRes.data?.data || mcqFetchRes.data;
  const fetchedQuestions = mcqData?.questions || [];

  const exactly15Questions = fetchedQuestions.length === 15;
  const allHave6Options = fetchedQuestions.every((q: any) => Array.isArray(q.options) && q.options.length === 6);
  const zeroCorrectOptionLeak = fetchedQuestions.every(
    (q: any) => q.correctOption === undefined && q.explanation === undefined
  );

  record('7.1 Exactly 15 Questions Served', exactly15Questions, `Count = ${fetchedQuestions.length}`);
  record('7.2 All Questions Have Exactly 6 Options', allHave6Options, `6 options verified across all 15 questions`);
  record(
    '7.3 Rule 5: Answers & Explanations Scrubbed From Client',
    zeroCorrectOptionLeak,
    `correctOption & explanation are completely undefined in client response payload`
  );

  // Verify internal DB representation has valid answer keys
  const dbQuestions = await prisma.capstoneMcqQuestion.findMany({
    where: { selectionId },
    orderBy: { createdAt: 'asc' },
  });

  const dbKeysValid =
    dbQuestions.length === 15 &&
    dbQuestions.every((q) => Number.isInteger(q.correctOption) && q.correctOption >= 0 && q.correctOption <= 5);

  record(
    '7.4 Backend DB Question Integrity',
    dbKeysValid,
    `15 questions in DB, correctOption correctly bounded [0, 5]`
  );

  // -------------------------------------------------------------
  // PART 8: MCQ Answering, Scoring, Cleanup & Persistence
  // -------------------------------------------------------------
  console.log('\n--- PART 8: Answering, Scoring & Database Cleanup ---');

  // Incomplete submission test (e.g. only 10 answers)
  const incompleteAnswers = dbQuestions.slice(0, 10).map((q) => ({
    questionId: q.id,
    selectedOption: q.correctOption,
  }));

  const incompleteRes = await api.post(
    `/capstone/${selectionId}/mcq/submit`,
    { answers: incompleteAnswers },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  record(
    '8.1 Incomplete Answers Block',
    incompleteRes.status === 400 && incompleteRes.data?.message?.includes('Please answer all 15 questions'),
    `Blocked with status ${incompleteRes.status}: "${incompleteRes.data?.message}"`
  );

  // Prepare full answers: let's deliberately answer 12 correctly and 3 incorrectly
  const expectedScore = 12;
  const fullAnswers = dbQuestions.map((q, idx) => {
    if (idx < 12) {
      return { questionId: q.id, selectedOption: q.correctOption };
    } else {
      // Pick a wrong option
      const wrongOpt = (q.correctOption + 1) % 6;
      return { questionId: q.id, selectedOption: wrongOpt };
    }
  });

  const mcqSubmitRes = await api.post(
    `/capstone/${selectionId}/mcq/submit`,
    { answers: fullAnswers },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  const submitResult = mcqSubmitRes.data?.data || mcqSubmitRes.data;
  const returnedScore = submitResult?.score;
  const returnedPercentage = submitResult?.percentage;

  record(
    '8.2 MCQ Scoring Engine',
    mcqSubmitRes.status === 200 && returnedScore === expectedScore && returnedPercentage === 80,
    `Returned score=${returnedScore}/15 (${returnedPercentage}%), expected=12/15 (80%)`
  );

  // Rule 7: Delete generated CapstoneMcqQuestion rows after completion
  const remainingQuestionsInDb = await prisma.capstoneMcqQuestion.count({
    where: { selectionId },
  });

  record(
    '8.3 Rule 7: MCQ Question Rows Deleted From DB',
    remainingQuestionsInDb === 0,
    `Remaining questions count in DB = ${remainingQuestionsInDb} (must be 0)`
  );

  // Rule 8: Final score stored permanently in CapstoneSelection
  const updatedSelection = await prisma.capstoneSelection.findUnique({
    where: { id: selectionId },
  });

  record(
    '8.4 Rule 8: Final Score Persisted in CapstoneSelection',
    updatedSelection?.mcqScore === 12 &&
      updatedSelection?.totalQuestions === 15 &&
      updatedSelection?.status === 'COMPLETED' &&
      !!updatedSelection?.completedAt,
    `Stored score=${updatedSelection?.mcqScore}/${updatedSelection?.totalQuestions}, status=${updatedSelection?.status}`
  );

  // Associated Project marked completed
  const updatedProject = await prisma.project.findUnique({
    where: { id: projectId },
  });

  record(
    '8.5 Project Completed Status',
    updatedProject?.status === 'completed',
    `Project status=${updatedProject?.status}`
  );

  // Audit records saved in CapstoneMcqAnswer
  const savedAnswersCount = await prisma.capstoneMcqAnswer.count({
    where: { selectionId },
  });

  record(
    '8.6 Audit Answers Stored in DB',
    savedAnswersCount === 15,
    `Recorded ${savedAnswersCount} individual question responses for historical audit`
  );

  // Rule 4: A student cannot submit MCQ twice
  const resubmitRes = await api.post(
    `/capstone/${selectionId}/mcq/submit`,
    { answers: fullAnswers },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  record(
    '8.7 Rule 4: Prevent Duplicate MCQ Submission',
    resubmitRes.status === 400 && resubmitRes.data?.message?.includes('already'),
    `Blocked duplicate submission with status ${resubmitRes.status}: "${resubmitRes.data?.message}"`
  );

  // Re-attending MCQ after completion should be rejected
  const reattendRes = await api.get(`/capstone/${selectionId}/mcq`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  record(
    '8.8 Block MCQ Retrieval After Completion',
    reattendRes.status === 400 && reattendRes.data?.message?.includes('already been completed'),
    `Blocked retrieval with status ${reattendRes.status}: "${reattendRes.data?.message}"`
  );

  // -------------------------------------------------------------
  // PART 9: Admin Operations & Analytics
  // -------------------------------------------------------------
  console.log('\n--- PART 9: Admin Management & Analytics ---');

  // 9.1 Admin list problems (must include claimCount and avgScore)
  const adminProblemsRes = await api.get('/capstone/problems', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const adminProblemsList = Array.isArray(adminProblemsRes.data) ? adminProblemsRes.data : adminProblemsRes.data?.data || [];
  const adminProblemItem = adminProblemsList.find((p: any) => p.id === testProblem.id);

  record(
    '9.1 Admin List Problems with Metrics',
    adminProblemsRes.status === 200 && adminProblemItem?.stats?.selectionsCount >= 1,
    `Admin problem found with selectionsCount=${adminProblemItem?.stats?.selectionsCount}, avgScore=${adminProblemItem?.stats?.avgScore}`
  );

  // 9.2 Admin Dashboard Stats
  const adminStatsRes = await api.get('/capstone/admin/stats', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const stats = adminStatsRes.data?.data || adminStatsRes.data;
  record(
    '9.2 Admin Stats Aggregation',
    adminStatsRes.status === 200 &&
      typeof stats?.totalProblems === 'number' &&
      typeof stats?.completedCount === 'number' &&
      typeof stats?.avgScore === 'number',
    `Total problems=${stats?.totalProblems}, completed=${stats?.completedCount}, avgScore=${stats?.avgScore}`
  );

  // 9.3 Admin Create Problem
  const newProblemRes = await api.post(
    '/capstone/problems',
    {
      title: `Admin Created Problem [${Date.now()}]`,
      problemText: 'Build a decentralized real-time auction platform with WebSockets and automated bidding bots.',
      domain: 'WebSockets & Realtime',
      difficulty: 'Hard',
      technologies: ['TypeScript', 'Socket.io', 'Redis'],
      isActive: true,
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const createdProblem = newProblemRes.data?.data || newProblemRes.data;
  const createdId = createdProblem?.id;
  record(
    '9.3 Admin Create Problem Statement',
    newProblemRes.status === 201 && !!createdId,
    `Created problem ID=${createdId}`
  );

  // 9.4 Admin Update Problem
  const updateRes = await api.patch(
    `/capstone/problems/${createdId}`,
    {
      difficulty: 'Expert',
      domain: 'Distributed Consensus',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const updatedProblemData = updateRes.data?.data || updateRes.data;
  record(
    '9.4 Admin Update Problem',
    updateRes.status === 200 && updatedProblemData?.difficulty === 'Expert',
    `Updated difficulty to ${updatedProblemData?.difficulty}`
  );

  // 9.5 Admin Toggle Active State
  const toggleRes = await api.patch(
    `/capstone/problems/${createdId}`,
    { isActive: false },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const toggledData = toggleRes.data?.data || toggleRes.data;
  record(
    '9.5 Admin Toggle Active',
    toggleRes.status === 200 && toggledData?.isActive === false,
    `Toggled isActive to ${toggledData?.isActive}`
  );

  // 9.6 Admin Delete Problem
  const deleteRes = await api.delete(`/capstone/problems/${createdId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  record(
    '9.6 Admin Delete Problem',
    deleteRes.status === 200,
    `Deleted problem statement with status ${deleteRes.status}`
  );

  // -------------------------------------------------------------
  // Clean up test user records
  // -------------------------------------------------------------
  try {
    await prisma.capstoneMcqAnswer.deleteMany({ where: { selectionId } });
    await prisma.capstoneSelection.deleteMany({ where: { id: selectionId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.capstoneProblemStatement.deleteMany({ where: { id: testProblem.id } });
    await prisma.user.deleteMany({ where: { id: { in: [student.id, admin.id] } } });
  } catch (cleanErr) {
    console.warn('Post-audit cleanup note:', cleanErr);
  }

  server.close();

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('  AUDIT SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`TOTAL CHECKS: ${total}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log(`SUCCESS RATE: ${Math.round((passed / total) * 100)}%`);

  if (failed > 0) {
    console.log('\nFAILED CHECKS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - [${r.step}]: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL GITHUB & CAPSTONE CHECKS COMPLETED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runComprehensiveAudit().catch((err) => {
  console.error('Unhandled failure in comprehensive audit:', err);
  process.exit(1);
});
