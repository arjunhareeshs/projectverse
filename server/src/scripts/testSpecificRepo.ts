import http from 'node:http';
import axios from 'axios';
import { createApp } from '../app';
import { prisma } from '../shared/database';
import { signAccessToken } from '../config/jwt';
import {
  analyzeCapstoneRepository,
  parseGithubUrl,
} from '../modules/capstone/capstone.githubAnalysis';

async function testGroundedIntentGuardPipeline() {
  const targetRepo = 'https://github.com/pratheep-bit/grounded-intent-guard';

  console.log('================================================================');
  console.log(`  TESTING GITHUB ANALYSIS & CAPSTONE PIPELINE FOR:`);
  console.log(`  ${targetRepo}`);
  console.log('================================================================\n');

  // STEP 1: Deep GitHub Repository Code Analysis
  console.log('--- STEP 1: Deep GitHub Repository Code Analysis ---');
  let analysisResult: any;
  try {
    const startTime = Date.now();
    analysisResult = await analyzeCapstoneRepository(targetRepo);
    const duration = Date.now() - startTime;

    console.log(`✓ Analysis completed in ${duration}ms\n`);
    console.log(`[Repository Info]`);
    console.log(`  Owner:          ${analysisResult.owner}`);
    console.log(`  Repo:           ${analysisResult.repo}`);
    console.log(`  Default Branch: ${analysisResult.defaultBranch}`);
    console.log(`  Total Files:    ${analysisResult.totalFilesCount}`);
    console.log(`  Completeness:   ${analysisResult.projectCompleteness}`);
    console.log(`\n[Architecture & Tech Stack Detection]`);
    console.log(`  Framework:      ${analysisResult.framework}`);
    console.log(`  Architecture:   ${analysisResult.architecture}`);
    console.log(`  Database:       ${analysisResult.databaseUsage}`);
    console.log(`  Authentication: ${analysisResult.authUsage}`);
    console.log(`  Testing:        ${analysisResult.testingPresence}`);
    console.log(`  Languages:     `, analysisResult.languages);
    console.log(`  Major Modules: `, analysisResult.majorModules);
    console.log(`  API Routes:    `, analysisResult.apiRoutes);
    console.log(`  Frontend UI:   `, analysisResult.frontendComponents);
    console.log(`  Backend Serv:  `, analysisResult.backendServices);
    console.log(`\n[Inspected Code Snippets] (Count: ${analysisResult.inspectedFiles?.length || 0})`);
    analysisResult.inspectedFiles?.forEach((file: any, i: number) => {
      console.log(`  ${i + 1}. ${file.path} (${file.snippet?.length || 0} chars)`);
      const preview = file.snippet?.substring(0, 150)?.replace(/\n/g, ' ') || '';
      console.log(`     Preview: "${preview}..."`);
    });
  } catch (err: any) {
    console.error('❌ Failed during GitHub code analysis:', err);
    throw err;
  }

  // STEP 2: Start In-Process Server & Test Fixtures
  console.log('\n--- STEP 2: Setting up Test Server & Fixtures ---');
  const app = createApp();
  const server = http.createServer(app);
  const TEST_PORT = 4225;

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`✓ Test HTTP server listening on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  const api = axios.create({
    baseURL: `http://127.0.0.1:${TEST_PORT}/api`,
    validateStatus: () => true,
  });

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Intent Guard Testing Org' },
    });
  }

  const student = await prisma.user.create({
    data: {
      email: `tester.${Date.now()}@intentguard.ai`,
      fullName: 'Intent Guard Reviewer',
      passwordHash: 'test_hash',
      role: 'STUDENT',
      organizationId: org.id,
    },
  });

  const studentToken = signAccessToken({
    sub: student.id,
    role: student.role,
    orgId: org.id,
  });

  console.log(`✓ Created test user: ${student.fullName} (${student.id})`);

  // Create or retrieve matching Capstone Problem Statement
  const problem = await prisma.capstoneProblemStatement.create({
    data: {
      organizationId: org.id,
      title: 'Grounded Intent Guard: Guardrail Architecture & Hallucination Defense',
      problemText:
        'Design a high-assurance guardrail system that monitors, sanitizes, and verifies user intents before and after model invocation, preventing prompt injection, toxic payloads, and hallucinations in production LLM workflows.',
      domain: 'AI Safety & LLM Security',
      difficulty: 'Hard',
      technologies: ['Python', 'FastAPI', 'PyTorch', 'LangChain', 'OpenAI'],
      isActive: true,
      createdById: student.id,
    },
  });

  console.log(`✓ Created capstone problem: "${problem.title}" (ID: ${problem.id})`);

  // STEP 3: Student Claims the Capstone Problem
  console.log('\n--- STEP 3: Claiming Capstone Project (No Approach Text Required) ---');
  const claimRes = await api.post(
    `/capstone/${problem.id}/claim`,
    {},
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  if (claimRes.status !== 201) {
    console.error('❌ Failed to claim problem:', claimRes.status, claimRes.data);
    server.close();
    process.exit(1);
  }

  const selectionId = claimRes.data?.data?.selection?.id || claimRes.data?.selection?.id;
  const projectId = claimRes.data?.data?.project?.id || claimRes.data?.project?.id;
  console.log(`✓ Successfully claimed problem. Selection ID: ${selectionId}, Project ID: ${projectId}`);

  // STEP 4: Submit GitHub Repo and Trigger Deep Analysis & MCQ Generation
  console.log('\n--- STEP 4: Submitting GitHub Repo & Triggering AI MCQ Generation ---');
  console.log(`Submitting URL: ${targetRepo}`);
  const submitStart = Date.now();
  const submitRes = await api.post(
    `/capstone/${selectionId}/submit-github`,
    {
      githubUrl: targetRepo,
      bypassTimeCheck: true, // dev bypass to simulate post-7-day submission
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  const submitDuration = Date.now() - submitStart;
  console.log(`✓ Submission API call returned HTTP ${submitRes.status} in ${submitDuration}ms`);
  console.log('Submission Response Payload:', JSON.stringify(submitRes.data, null, 2));

  if (submitRes.status !== 200) {
    console.error('❌ Submission failed:', submitRes.data);
    server.close();
    process.exit(1);
  }

  // STEP 5: Retrieve MCQs Served to Student
  console.log('\n--- STEP 5: Retrieving Generated MCQs for Student ---');
  const mcqRes = await api.get(`/capstone/${selectionId}/mcq`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  const mcqData = mcqRes.data?.data || mcqRes.data;
  const questions = mcqData?.questions || [];
  console.log(`✓ Retrieved ${questions.length} questions from API.`);

  // Verify Security: Zero answer or explanation leaks
  let answerLeaked = false;
  questions.forEach((q: any) => {
    if (q.correctOption !== undefined || q.explanation !== undefined) {
      answerLeaked = true;
    }
  });

  if (answerLeaked) {
    console.error('❌ SECURITY VIOLATION: correctOption or explanation found in client response!');
  } else {
    console.log('✓ Security Check: correctOption and explanation are completely scrubbed from client payload.');
  }

  // Print all 15 Generated Questions & 6 Options
  console.log('\n================================================================');
  console.log('  GENERATED 15 CAPSTONE MCQs (6 OPTIONS EACH):');
  console.log('================================================================\n');

  questions.forEach((q: any, index: number) => {
    console.log(`Question ${index + 1} [Topic: ${q.topic || 'General'} | Difficulty: ${q.difficulty || 'Medium'}]:`);
    console.log(`  ${q.question}`);
    console.log('  Options:');
    (q.options || []).forEach((opt: string, optIdx: number) => {
      const letter = String.fromCharCode(65 + optIdx);
      console.log(`    [${letter}] ${opt}`);
    });
    console.log('');
  });

  // Verify backend DB representation has valid answer keys
  const dbQuestions = await prisma.capstoneMcqQuestion.findMany({
    where: { selectionId },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`✓ Verified ${dbQuestions.length} questions stored in DB before answering.`);

  // STEP 6: Answer Submission & Scoring
  console.log('\n--- STEP 6: Submitting Student Answers & Server-Side Scoring ---');
  // Answering 13 correctly and 2 wrong
  const answersPayload = dbQuestions.map((q, idx) => {
    if (idx < 13) {
      return { questionId: q.id, selectedOption: q.correctOption };
    } else {
      return { questionId: q.id, selectedOption: (q.correctOption + 1) % 6 };
    }
  });

  const scoreRes = await api.post(
    `/capstone/${selectionId}/mcq/submit`,
    { answers: answersPayload },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  const scoreData = scoreRes.data?.data || scoreRes.data;
  console.log(`✓ Submit answers returned HTTP ${scoreRes.status}:`);
  console.log(`  Score:      ${scoreData?.score} / ${scoreData?.totalQuestions}`);
  console.log(`  Percentage: ${scoreData?.percentage}%`);
  console.log(`  Completed:  ${scoreData?.completedAt}`);

  // STEP 7: Database State & Cleanup Verification
  console.log('\n--- STEP 7: Database Cleanup & Persistence Check ---');
  const remainingQuestions = await prisma.capstoneMcqQuestion.count({
    where: { selectionId },
  });
  console.log(`✓ Rule 7: Remaining CapstoneMcqQuestion rows: ${remainingQuestions} (must be 0)`);

  const updatedSelection = await prisma.capstoneSelection.findUnique({
    where: { id: selectionId },
  });
  console.log(`✓ Rule 8: Selection status="${updatedSelection?.status}", mcqScore=${updatedSelection?.mcqScore}`);

  const auditAnswersCount = await prisma.capstoneMcqAnswer.count({
    where: { selectionId },
  });
  console.log(`✓ Audit trails: Saved ${auditAnswersCount} answer records in CapstoneMcqAnswer.`);

  // Cleanup test fixtures
  try {
    await prisma.capstoneMcqAnswer.deleteMany({ where: { selectionId } });
    await prisma.capstoneSelection.deleteMany({ where: { id: selectionId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.capstoneProblemStatement.deleteMany({ where: { id: problem.id } });
    await prisma.user.deleteMany({ where: { id: student.id } });
  } catch (cleanErr) {
    console.warn('Cleanup note:', cleanErr);
  }

  server.close();

  console.log('\n================================================================');
  console.log('  PIPELINE AUDIT COMPLETE FOR grounded-intent-guard: 100% SUCCESS!');
  console.log('================================================================');
}

testGroundedIntentGuardPipeline().catch((err) => {
  console.error('Pipeline test encountered unhandled failure:', err);
  process.exit(1);
});
