import http from 'node:http';
import axios from 'axios';
import { createApp } from '../app';
import { prisma } from '../shared/database';
import { signAccessToken } from '../config/jwt';

async function runComprehensiveTest() {
  console.log('===============================================================');
  console.log('      STARTING COMPREHENSIVE CAPSTONE SYSTEM AUDIT TEST        ');
  console.log('===============================================================\n');

  let passedChecks = 0;
  let failedChecks = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedChecks++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedChecks++;
    }
  }

  // 1. Start HTTP Server
  const app = createApp();
  const server = http.createServer(app);
  const TEST_PORT = 4199;

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`✓ Test HTTP server started on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  const api = axios.create({
    baseURL: `http://127.0.0.1:${TEST_PORT}/api`,
    validateStatus: () => true, // Don't throw on non-2xx
  });

  try {
    // 2. Fetch or prepare test users
    console.log('\n--- 1. Setting Up Test Accounts & JWT Tokens ---');
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    const studentUser = await prisma.user.findFirst({
      where: { role: 'STUDENT' },
    });

    if (!adminUser || !studentUser) {
      throw new Error('Admin or Student user not found in database.');
    }

    const adminToken = signAccessToken({
      sub: adminUser.id,
      role: adminUser.role,
      orgId: adminUser.organizationId || undefined,
    });

    const studentToken = signAccessToken({
      sub: studentUser.id,
      role: studentUser.role,
      orgId: studentUser.organizationId || undefined,
    });

    const adminAuth = { Authorization: `Bearer ${adminToken}` };
    const studentAuth = { Authorization: `Bearer ${studentToken}` };

    console.log(`  Admin user: ${adminUser.email} (Role: ${adminUser.role})`);
    console.log(`  Student user: ${studentUser.email} (Role: ${studentUser.role})`);

    // 3. Security & Role Guards
    console.log('\n--- 2. Testing Security Guards & Role Authorization ---');
    // 3.1 Unauthorized request
    const unauthRes = await api.get('/capstone/problems');
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401');

    // 3.2 Student attempting admin-only create problem
    const studentForbiddenRes = await api.post(
      '/capstone/problems',
      { title: 'Hacked', problemText: 'Text' },
      { headers: studentAuth }
    );
    assert(studentForbiddenRes.status === 403, 'Student creating problem rejected with 403 Forbidden');

    // 4. Admin Problem CRUD
    console.log('\n--- 3. Testing Admin Problem CRUD ---');
    const newProblemPayload = {
      title: 'Real-Time Edge Telemetry & Anomaly Detector',
      problemText:
        'Build a high-throughput edge telemetry pipeline that ingests sensor data via WebSockets, buffers messages in Redis, applies rolling anomaly detection algorithms, and displays real-time alerts on a dashboard.',
      domain: 'IoT & Cloud Systems',
      difficulty: 'Hard',
      technologies: ['Node.js', 'Redis', 'WebSockets', 'React', 'Docker'],
      isActive: true,
    };

    const createRes = await api.post('/capstone/problems', newProblemPayload, { headers: adminAuth });
    assert(createRes.status === 201, `Admin creates capstone problem (status: ${createRes.status})`);
    const createdProblemId = createRes.data.id;
    assert(Boolean(createdProblemId), `Created problem ID: ${createdProblemId}`);

    // Edit problem
    const editRes = await api.patch(
      `/capstone/problems/${createdProblemId}`,
      { difficulty: 'Medium', title: 'Real-Time Edge Telemetry & Anomaly Detector (v2)' },
      { headers: adminAuth }
    );
    assert(editRes.status === 200, 'Admin edits capstone problem (status: 200)');
    assert(editRes.data.difficulty === 'Medium', 'Difficulty updated to Medium');

    // Admin Stats
    const statsRes = await api.get('/capstone/admin/stats', { headers: adminAuth });
    assert(statsRes.status === 200, 'Admin fetches stats (status: 200)');
    assert(typeof statsRes.data.totalProblems === 'number', `Total problems count: ${statsRes.data.totalProblems}`);

    // 5. Student Problem Listing
    console.log('\n--- 4. Testing Student Catalog & Problem Listing ---');
    const listRes = await api.get('/capstone/problems', { headers: studentAuth });
    assert(listRes.status === 200, 'Student retrieves active problem statements');
    assert(Array.isArray(listRes.data) && listRes.data.length > 0, `Active problems returned: ${listRes.data.length}`);

    // Clean up any existing selection on this problem for student
    await prisma.capstoneSelection.deleteMany({
      where: { userId: studentUser.id, problemId: createdProblemId },
    });

    // 6. Student Project Claim Flow
    console.log('\n--- 5. Testing Student Claim Flow & 7-Day Due Date ---');
    // Short approach text rejection (< 15 chars)
    const shortClaimRes = await api.post(
      `/capstone/${createdProblemId}/claim`,
      { approachText: 'Too short' },
      { headers: studentAuth }
    );
    assert(shortClaimRes.status === 400, 'Claim with approach < 15 chars rejected with 400');

    // Valid claim
    const claimRes = await api.post(
      `/capstone/${createdProblemId}/claim`,
      { approachText: 'We will implement an event-driven architecture using Redis Streams and React.' },
      { headers: studentAuth }
    );
    assert(claimRes.status === 201, `Student claims problem statement (status: ${claimRes.status})`);
    const selection = claimRes.data.selection;
    const project = claimRes.data.project;
    assert(Boolean(selection && selection.id), `Created selection ID: ${selection?.id}`);
    assert(project.mode === 'CAPSTONE', `Project mode is strictly CAPSTONE (value: ${project.mode})`);

    // Verify 7-day due date
    const selectedAt = new Date(selection.selectedAt).getTime();
    const dueAt = new Date(selection.dueAt).getTime();
    const diffDays = Math.round((dueAt - selectedAt) / (1000 * 60 * 60 * 24));
    assert(diffDays === 7, `Due date is exactly +7 days from selection (diff: ${diffDays} days)`);

    // Verify duplicate claim rejected
    const dupClaimRes = await api.post(
      `/capstone/${createdProblemId}/claim`,
      { approachText: 'Attempting to claim again...' },
      { headers: studentAuth }
    );
    assert(dupClaimRes.status === 400, 'Duplicate claim rejected with 400 (Rule 1)');

    // 7. Student Viewing My Selections
    console.log('\n--- 6. Testing Student "My Selections" API ---');
    const mySelectionsRes = await api.get('/capstone/my', { headers: studentAuth });
    assert(mySelectionsRes.status === 200, 'Student retrieves my selections');
    const foundSelection = mySelectionsRes.data.find((s: any) => s.id === selection.id);
    assert(Boolean(foundSelection), 'Claimed selection found in student selections list');
    assert(foundSelection?.status === 'CLAIMED', `Initial selection status is CLAIMED (${foundSelection?.status})`);

    // 8. 7-Day Gate Enforcement for GitHub Submission
    console.log('\n--- 7. Testing 7-Day Gate for Repository Submission ---');
    const prematureSubmitRes = await api.post(
      `/capstone/${selection.id}/submit-github`,
      { githubUrl: 'https://github.com/expressjs/express', bypassTimeCheck: false },
      { headers: studentAuth }
    );
    assert(prematureSubmitRes.status === 400, 'Premature submission before 7 days rejected with 400 (Rule 2)');

    // Invalid GitHub URL test
    const invalidUrlRes = await api.post(
      `/capstone/${selection.id}/submit-github`,
      { githubUrl: 'not-a-valid-url', bypassTimeCheck: true },
      { headers: studentAuth }
    );
    assert(invalidUrlRes.status === 400, 'Invalid GitHub URL rejected with 400');

    // 9. Real GitHub Submission & Deep Analysis
    console.log('\n--- 8. Testing GitHub Submission & Deep Analysis ---');
    console.log('  Submitting public repository: https://github.com/expressjs/express');
    const submitRes = await api.post(
      `/capstone/${selection.id}/submit-github`,
      { githubUrl: 'https://github.com/expressjs/express', bypassTimeCheck: true },
      { headers: studentAuth }
    );
    assert(submitRes.status === 200, `GitHub repository analyzed & submitted (status: ${submitRes.status})`);
    assert(submitRes.data.status === 'MCQ_READY', `Status changed to MCQ_READY (${submitRes.data.status})`);
    assert(submitRes.data.questionsCount === 15, `Generated exactly 15 questions (${submitRes.data.questionsCount})`);

    // 10. Fetching MCQs (Security Check: No Answers Exposed)
    console.log('\n--- 9. Testing MCQ Retrieval & Answer Security ---');
    const mcqRes = await api.get(`/capstone/${selection.id}/mcq`, { headers: studentAuth });
    assert(mcqRes.status === 200, `Student fetches generated MCQs (status: ${mcqRes.status})`);
    const questions = mcqRes.data.questions;
    assert(Array.isArray(questions) && questions.length === 15, `Retrieved ${questions.length} questions`);

    let answersLeaked = false;
    let allHave6Options = true;

    for (const q of questions) {
      if (q.correctOption !== undefined || q.explanation !== undefined) {
        answersLeaked = true;
      }
      if (!Array.isArray(q.options) || q.options.length !== 6) {
        allHave6Options = false;
      }
    }

    assert(!answersLeaked, 'Security check passed: correctOption and explanation are NOT in client response (Rule 5)');
    assert(allHave6Options, 'Every single question has exactly 6 options (Rule 2 of prompt)');

    // 11. Testing Submitting Answers & Server-Side Scoring
    console.log('\n--- 10. Testing MCQ Answer Submission & Server Scoring ---');
    // Incomplete answers rejection
    const incompleteRes = await api.post(
      `/capstone/${selection.id}/mcq/submit`,
      { answers: [{ questionId: questions[0].id, selectedOption: 0 }] },
      { headers: studentAuth }
    );
    assert(incompleteRes.status === 400, 'Incomplete answers (< 15) rejected with 400');

    // Complete answers submission
    const completeAnswersPayload = questions.map((q: any, idx: number) => ({
      questionId: q.id,
      selectedOption: idx % 6,
    }));

    const submitMcqRes = await api.post(
      `/capstone/${selection.id}/mcq/submit`,
      { answers: completeAnswersPayload },
      { headers: studentAuth }
    );
    assert(submitMcqRes.status === 200, `MCQ evaluation scored successfully (status: ${submitMcqRes.status})`);
    assert(typeof submitMcqRes.data.score === 'number', `Calculated score: ${submitMcqRes.data.score}/15`);
    assert(typeof submitMcqRes.data.percentage === 'number', `Calculated accuracy: ${submitMcqRes.data.percentage}%`);

    // Verify questions deleted from DB (Rule 7)
    const dbQuestionsCount = await prisma.capstoneMcqQuestion.count({
      where: { selectionId: selection.id },
    });
    assert(dbQuestionsCount === 0, `MCQ questions deleted from DB upon completion (remaining: ${dbQuestionsCount}) (Rule 7)`);

    // Verify CapstoneSelection status and score persisted (Rule 8)
    const dbSelection = await prisma.capstoneSelection.findUnique({
      where: { id: selection.id },
    });
    assert(dbSelection?.status === 'COMPLETED', `Selection status in DB is COMPLETED (${dbSelection?.status})`);
    assert(dbSelection?.mcqScore !== null && dbSelection?.mcqScore !== undefined, `mcqScore stored in DB (${dbSelection?.mcqScore}) (Rule 8)`);

    // Verify double submission rejected (Rule 4)
    const doubleSubmitRes = await api.post(
      `/capstone/${selection.id}/mcq/submit`,
      { answers: completeAnswersPayload },
      { headers: studentAuth }
    );
    assert(doubleSubmitRes.status === 400, 'Double MCQ submission rejected with 400 (Rule 4)');

    // 12. Testing My Projects API Integration
    console.log('\n--- 11. Testing My Projects API Integration (/api/projects/my) ---');
    const myProjectsRes = await api.get('/projects/my', { headers: studentAuth });
    assert(myProjectsRes.status === 200, 'Student calls /api/projects/my');
    const projectInList = myProjectsRes.data.projects.find((p: any) => p.id === project.id);
    assert(Boolean(projectInList), 'Capstone project appears in /api/projects/my list');
    assert(projectInList?.mode === 'CAPSTONE', `Project mode in list is CAPSTONE (${projectInList?.mode})`);
    assert(Boolean(projectInList?.capstone), 'Capstone selection payload attached to project item');
    assert(projectInList?.capstone?.status === 'COMPLETED', `Capstone status in list is COMPLETED (${projectInList?.capstone?.status})`);
    assert(projectInList?.capstone?.mcqScore === dbSelection?.mcqScore, `MCQ score matches in My Projects item (${projectInList?.capstone?.mcqScore}/15)`);

    // 13. Normal Project Catalog Verification
    console.log('\n--- 12. Verifying Normal Projects Catalog Integrity ---');
    const normalCatalogRes = await api.get('/projects/catalog', { headers: studentAuth });
    assert(normalCatalogRes.status === 200, 'Normal catalog (/api/projects/catalog) returns 200');
    assert(Array.isArray(normalCatalogRes.data), 'Normal catalog returns valid projects list');

    // 14. Admin Cleanup & Soft Delete
    console.log('\n--- 13. Testing Admin Problem Deactivation & Deletion ---');
    const deleteRes = await api.delete(`/capstone/problems/${createdProblemId}`, { headers: adminAuth });
    assert(deleteRes.status === 200, 'Admin deactivates problem statement with existing selections');
    const problemAfterDelete = await prisma.capstoneProblemStatement.findUnique({ where: { id: createdProblemId } });
    assert(problemAfterDelete?.isActive === false, 'Problem marked as isActive: false to preserve relational integrity');

    console.log('\n===============================================================');
    console.log(` AUDIT SUMMARY: ${passedChecks} CHECKS PASSED, ${failedChecks} CHECKS FAILED`);
    console.log('===============================================================\n');

    if (failedChecks > 0) {
      throw new Error(`${failedChecks} checks failed during comprehensive audit.`);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runComprehensiveTest()
  .then(() => {
    console.log('COMPREHENSIVE AUDIT FINISHED WITH 100% PASS RATE.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Audit encountered error:', err);
    process.exit(1);
  });
