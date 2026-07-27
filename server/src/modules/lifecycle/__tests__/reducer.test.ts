import assert from 'node:assert';
import { applyEvent } from '../projectLog.reducer';
import { ProjectLogState } from '../../../shared/projectLog.types';

function createSeedState(): ProjectLogState {
  return {
    version: 0,
    projectId: 'proj-test-1',
    title: 'Smart Irrigation System',
    category: 'MINI',
    createdAt: '2026-01-01T00:00:00.000Z',
    duration: {
      months: 6,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
      history: [],
    },
    team: {
      teamId: 'team-1',
      members: [
        { userId: 'u-1', name: 'Alice', responsibilities: [], joinedAt: '2026-01-01T00:00:00.000Z', active: true },
      ],
    },
    technologies: ['Node.js'],
    executionDoc: { currentVersion: 0 },
    workPackages: [],
    milestones: [],
    skills: { required: [], gaps: [] },
    evaluations: [],
    flags: [],
  };
}

console.log('[ReducerTest] Running reducer tests...');

// Test 1: MEMBERS_SET
let state = createSeedState();
state = applyEvent(state, {
  type: 'MEMBERS_SET',
  actorUserId: 'u-1',
  data: {
    members: [
      { userId: 'u-1', name: 'Alice' },
      { userId: 'u-2', name: 'Bob' },
    ],
  },
});
assert.strictEqual(state.team.members.length, 2);
assert.strictEqual(state.team.members[1].name, 'Bob');

// Test 2: DURATION_CHANGED
state = applyEvent(state, {
  type: 'DURATION_CHANGED',
  actorUserId: 'u-1',
  data: { months: 4, reason: 'Shortened schedule' },
});
assert.strictEqual(state.duration.months, 4);
assert.strictEqual(state.duration.history.length, 1);

// Test 3: TECHNOLOGIES_SET
state = applyEvent(state, {
  type: 'TECHNOLOGIES_SET',
  actorUserId: 'u-1',
  data: { technologies: ['Node.js', 'React', 'PostgreSQL'] },
});
assert.deepStrictEqual(state.technologies, ['Node.js', 'React', 'PostgreSQL']);

// Test 4: DOC_GENERATED
state = applyEvent(state, {
  type: 'DOC_GENERATED',
  actorUserId: 'AI',
  data: {
    version: 1,
    workPackages: [
      { id: 'backend', name: 'Backend API', percentage: 50, assignedTo: ['u-1'], status: 'IN_PROGRESS' },
      { id: 'frontend', name: 'React Dashboard', percentage: 50, assignedTo: ['u-2'], status: 'NOT_STARTED' },
    ],
    milestones: [
      { id: 'm-1', name: 'API MVP', expectedOutput: 'Working endpoints', completionWeek: 4 },
    ],
    skillsRequired: ['Node.js', 'React'],
    gaps: [],
  },
});
assert.strictEqual(state.executionDoc.currentVersion, 1);
assert.strictEqual(state.workPackages.length, 2);
assert.strictEqual(state.milestones.length, 1);

// Test 5: FLAG_RAISED & FLAG_RESOLVED
state = applyEvent(state, {
  type: 'FLAG_RAISED',
  actorUserId: 'AI',
  data: { id: 'flag-delay-1', type: 'DELAY', message: 'Milestone delayed' },
});
assert.strictEqual(state.flags.length, 1);
assert.strictEqual(state.flags[0].resolved, false);

state = applyEvent(state, {
  type: 'FLAG_RESOLVED',
  actorUserId: 'AI',
  data: { id: 'flag-delay-1' },
});
assert.strictEqual(state.flags[0].resolved, true);

// Test 6: Unknown event throws
assert.throws(() => {
  applyEvent(state, { type: 'INVALID_EVENT_TYPE' as any, actorUserId: 'AI', data: {} });
}, /Unknown ProjectLogEventType/);

console.log('[ReducerTest] ALL REDUCER TESTS PASSED SUCCESSFULLY! ✅');
