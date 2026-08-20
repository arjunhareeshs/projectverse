import assert from 'assert';
import {
  serializeEvaluationPrompt,
  dealiasEvaluationReport,
  EvaluationReportSchema,
  RawEvaluationInput,
} from '../modules/ai/promptSerializer';
import { logger } from '../shared/logger';

async function runPromptSerializerTest() {
  logger.info('Running Leak-Free LLM Boundary Guard Tests...');

  const fixtureInput: RawEvaluationInput = {
    cycle: 1,
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-08-15T00:00:00.000Z',
    evalContext: {
      title: 'Smart Waste Management',
      category: 'FINAL_YEAR',
      workPackages: [
        { id: 'wp-1', name: 'IoT Telemetry', percentage: 50, assignedTo: ['cuid-user-1'], status: 'IN_PROGRESS' },
        { id: 'wp-2', name: 'AI Classification', percentage: 50, assignedTo: ['cuid-user-2'], status: 'IN_PROGRESS' },
      ],
      milestones: [
        { id: 'm-1', name: 'Sensor Architecture', expectedOutput: 'Working prototype', dueWeek: 2, status: 'DONE' },
      ],
      team: {
        teamId: 'cuid-team-1',
        members: [
          { userId: 'cuid-user-1', name: 'Alice Smith (AG1001)', responsibilities: ['wp-1'], active: true },
          { userId: 'cuid-user-2', name: 'Bob Jones (CS2002)', responsibilities: ['wp-2'], active: true },
        ],
      },
    },
    logsGroupedByMember: {
      'cuid-user-1': {
        entryCount: 2,
        logs: [
          { date: '2026-08-05', workDone: 'Implemented MQTT telemetry firmware for ESP32', hours: 4 },
          { date: '2026-08-08', workDone: 'Tested ultrasonic sensor readings across 5 bins', hours: 3 },
        ],
      },
      'cuid-user-2': {
        entryCount: 1,
        logs: [
          { date: '2026-08-06', workDone: 'Trained YOLOv8 model on garbage classification dataset', hours: 5 },
        ],
      },
    },
    githubCommits: [
      {
        sha: 'abc1234567890',
        linkedUserId: 'cuid-user-1',
        author: 'Alice Git <alice@github.com>',
        message: 'Add MQTT broker connection',
        date: new Date('2026-08-05T12:00:00Z'),
        isMerge: false,
      },
      {
        sha: 'def9876543210',
        linkedUserId: 'cuid-user-2',
        author: 'bjones <bob@university.edu>',
        message: 'Add model training script',
        date: new Date('2026-08-06T14:00:00Z'),
        isMerge: false,
      },
    ],
    previousEval: null,
    suspiciousPairs: [
      { userId: 'cuid-user-1', date: '2026-08-05', similarityPercent: 91 },
    ],
  };

  // Test 1: Zero PII and zero CUID leak check
  const { prompt, userIdToAlias, aliasToUserId } = serializeEvaluationPrompt(fixtureInput);

  const userPromptContent = prompt.find((p) => p.role === 'user')?.content || '';
  const systemPromptContent = prompt.find((p) => p.role === 'system')?.content || '';
  const fullPayload = `${systemPromptContent}\n${userPromptContent}`;

  assert.strictEqual(userIdToAlias.get('cuid-user-1'), 'M1');
  assert.strictEqual(userIdToAlias.get('cuid-user-2'), 'M2');
  assert.strictEqual(aliasToUserId.get('M1'), 'cuid-user-1');
  assert.strictEqual(aliasToUserId.get('M2'), 'cuid-user-2');

  // Verify NO real names in serialized prompt
  assert.strictEqual(fullPayload.includes('Alice Smith'), false, 'Should not contain real member name Alice Smith');
  assert.strictEqual(fullPayload.includes('Bob Jones'), false, 'Should not contain real member name Bob Jones');

  // Verify NO real CUIDs in serialized prompt
  assert.strictEqual(fullPayload.includes('cuid-user-1'), false, 'Should not contain real cuid cuid-user-1');
  assert.strictEqual(fullPayload.includes('cuid-user-2'), false, 'Should not contain real cuid cuid-user-2');

  // Verify NO raw author emails or logins
  assert.strictEqual(fullPayload.includes('alice@github.com'), false, 'Should not contain git author email');
  assert.strictEqual(fullPayload.includes('bob@university.edu'), false, 'Should not contain git author email');
  assert.strictEqual(fullPayload.includes('Alice Git'), false, 'Should not contain raw git author name');
  assert.strictEqual(fullPayload.includes('bjones'), false, 'Should not contain raw git author login');

  // Verify aliases are present
  assert.strictEqual(fullPayload.includes('"assignedTo"'), true);
  assert.strictEqual(fullPayload.includes('"M1"'), true);
  assert.strictEqual(fullPayload.includes('"M2"'), true);

  logger.info('✓ Test 1 Passed: Zero PII and zero CUID leaks in serialized prompt.');

  // Test 2: De-aliasing and Zod validation check
  const mockLlmResponse = {
    cycle: 1,
    periodStart: '2026-08-01',
    periodEnd: '2026-08-15',
    scopeAdherence: { score: 85, notes: 'Good scope match' },
    technicalProgress: { score: 80, notes: 'Solid commits' },
    timelineCompliance: { score: 90, notes: 'On schedule' },
    memberParticipation: {
      score: 85,
      notes: 'Both members active',
      perMember: [
        { userId: 'M1', score: 90, notes: 'Great firmware work' },
        { userId: 'M2', score: 80, notes: 'Good model training' },
      ],
    },
    documentationQuality: { score: 75, notes: 'Decent logs' },
    authenticityConfidence: { score: 88, notes: 'Verified commits' },
    plagiarismRisk: 'LOW',
    missingWork: [],
    suspiciousBehaviour: [],
    mentorFeedback: 'Keep up the consistent work.',
    next15DayRecommendations: ['Add integration tests.'],
  };

  const dealiased = dealiasEvaluationReport(mockLlmResponse, aliasToUserId);

  assert.strictEqual(dealiased.memberParticipation.perMember[0].userId, 'cuid-user-1');
  assert.strictEqual(dealiased.memberParticipation.perMember[1].userId, 'cuid-user-2');

  const parsed = EvaluationReportSchema.safeParse(dealiased);
  assert.strictEqual(parsed.success, true, 'Dealiased report must match Zod schema');

  logger.info('✓ Test 2 Passed: De-aliasing and Zod validation work perfectly.');
  logger.info('All Leak-Free LLM Boundary tests passed successfully!');
}

runPromptSerializerTest().catch((e) => {
  logger.error('Prompt serializer test failed:', e);
  process.exit(1);
});
