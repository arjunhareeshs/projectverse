/**
 * End-to-end smoke test for the Project Selection Chat feature.
 *
 * Exercises, against a live server (npx tsx src/index.ts):
 *   1. Login as a seeded student with a team.
 *   2. GET  /projects/catalog/tree            (taxonomy)
 *   3. GET  /projects/catalog?type&domain&sector (filtered list)
 *   4. POST /projects/catalog/validate-proposal  (LLM validation - duplicate case)
 *   5. POST /projects/catalog/validate-proposal  (LLM validation - novel case)
 *   6. POST /projects/catalog/propose            (persist new statement)
 *   7. POST /projects/catalog/mentor  mode=chat  (LLM mentor turn)
 *   8. POST /projects/catalog/mentor  mode=report (LLM readiness report)
 *   9. POST /projects/catalog/:id/select         (final selection)
 *
 * Run with: npx tsx tests/project-selection-chat/run.ts
 */
import axios from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000/api';
const LOGIN_IDENTIFIER = process.env.TEST_LOGIN || 'anithak.ag25@bitsathy.ac.in';
const LOGIN_PASSWORD = process.env.TEST_PASSWORD || 'password123';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
    if (detail !== undefined) console.log('     ', JSON.stringify(detail));
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function main() {
  const client = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

  section('0. Server reachability');
  const health = await client.get('/health').catch((e) => e);
  ok('server responds (any status)', !!health && typeof health.status === 'number', health?.message);

  section('1. Login');
  const loginRes = await client.post('/auth/login', {
    identifier: LOGIN_IDENTIFIER,
    password: LOGIN_PASSWORD,
  });
  ok(`login 200 (got ${loginRes.status})`, loginRes.status === 200, loginRes.data);
  const token = loginRes.data?.token;
  ok('received token', typeof token === 'string' && token.length > 10);
  const teamId = loginRes.data?.user?.teamId;
  ok('logged-in user has a teamId', !!teamId, loginRes.data?.user);

  if (!token) {
    console.log('\nCannot continue without an auth token. Aborting.');
    printSummary();
    process.exit(1);
  }

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  section('2. Catalog tree (taxonomy)');
  const treeRes = await client.get('/projects/catalog/tree', auth);
  ok(`tree 200 (got ${treeRes.status})`, treeRes.status === 200, treeRes.data);
  const tree = treeRes.data?.tree;
  ok('tree is a non-empty array', Array.isArray(tree) && tree.length > 0);
  const firstType = tree?.[0];
  ok('tree entries have {type, domains[]}', !!firstType?.type && Array.isArray(firstType?.domains));
  const firstDomain = firstType?.domains?.[0];
  ok(
    'domain entries have {domain, subdomains[]}',
    !!firstDomain?.domain && Array.isArray(firstDomain?.subdomains),
  );

  // Use a known-good combo from the seeded Excel data for deterministic filtering checks.
  const targetType = 'Hardware';
  const targetDomain = 'AgriTech';

  section('3. Filtered catalog list');
  const filteredRes = await client.get('/projects/catalog', {
    ...auth,
    params: { type: targetType, domain: targetDomain },
  });
  ok(`filtered catalog 200 (got ${filteredRes.status})`, filteredRes.status === 200, filteredRes.data);
  const filtered = filteredRes.data;
  ok('filtered catalog is an array', Array.isArray(filtered));
  ok(
    'all results match requested type/domain',
    Array.isArray(filtered) && filtered.every((p: any) => p.type === targetType && p.domain === targetDomain),
    filtered?.slice(0, 3),
  );
  ok('filtered catalog is non-empty for known seed domain', filtered.length > 0);

  const sampleStatement = filtered[0];
  const sampleSector = sampleStatement?.sector;

  section('4. Validate proposal — near-duplicate of an existing statement');
  const dupRes = await client.post(
    '/projects/catalog/validate-proposal',
    {
      type: targetType,
      domain: targetDomain,
      sector: sampleSector,
      proposedStatement: sampleStatement.problemStatement,
    },
    auth,
  );
  ok(`validate (dup) 200 (got ${dupRes.status})`, dupRes.status === 200, dupRes.data);
  ok('duplicate statement correctly flagged invalid/not novel', dupRes.data?.valid === false || dupRes.data?.isNovel === false, dupRes.data);

  section('5. Validate proposal — genuinely novel statement (real LLM call if key present)');
  const novelStatement =
    'Design an autonomous drone-based system that uses multispectral imaging and an ' +
    'on-device ML model to detect early-stage fungal blight in sugarcane fields across ' +
    'a 50-acre farm, generating a georeferenced treatment-priority map for farmers within ' +
    '10 minutes of a flight.';
  const novelRes = await client.post(
    '/projects/catalog/validate-proposal',
    {
      type: targetType,
      domain: targetDomain,
      sector: sampleSector,
      proposedStatement: novelStatement,
    },
    auth,
  );
  ok(`validate (novel) 200 (got ${novelRes.status})`, novelRes.status === 200, novelRes.data);
  ok(
    'response has expected shape',
    typeof novelRes.data?.valid === 'boolean' &&
      typeof novelRes.data?.isNovel === 'boolean' &&
      typeof novelRes.data?.reason === 'string' &&
      typeof novelRes.data?.normalizedStatement === 'string',
    novelRes.data,
  );
  console.log('     LLM reason:', novelRes.data?.reason);

  section('6. Propose — persist a new catalog entry');
  const proposeRes = await client.post(
    '/projects/catalog/propose',
    {
      type: targetType,
      domain: targetDomain,
      sector: sampleSector,
      statement: novelRes.data?.normalizedStatement || novelStatement,
      shortName: novelRes.data?.suggestedShortName || 'Drone Blight Detection',
      difficultyLevel: novelRes.data?.suggestedDifficulty || '3',
    },
    auth,
  );
  ok(`propose 201 (got ${proposeRes.status})`, proposeRes.status === 201, proposeRes.data);
  const created = proposeRes.data;
  ok('created row is a template in CATALOG status', created?.isTemplate === true && created?.status === 'CATALOG');
  ok('created row has a generated problemId', typeof created?.problemId === 'string' && created.problemId.length > 0);
  console.log('     new problemId:', created?.problemId);

  section('7. Verify proposed statement now appears in filtered catalog');
  const refetchRes = await client.get('/projects/catalog', {
    ...auth,
    params: { type: targetType, domain: targetDomain, sector: sampleSector },
  });
  const nowIncluded = (refetchRes.data || []).some((p: any) => p.id === created.id);
  ok('newly proposed statement shows up in the shared catalog immediately', nowIncluded);

  section('8. Mentor chat — opening turn (real LLM call if key present)');
  const mentorStartRes = await client.post(
    '/projects/catalog/mentor',
    { templateId: created.id, history: [], mode: 'chat' },
    auth,
  );
  ok(`mentor chat 200 (got ${mentorStartRes.status})`, mentorStartRes.status === 200, mentorStartRes.data);
  ok('mentor reply is non-empty text', typeof mentorStartRes.data?.reply === 'string' && mentorStartRes.data.reply.length > 5);
  console.log('     mentor said:', mentorStartRes.data?.reply);

  const history = [{ role: 'assistant', content: mentorStartRes.data.reply }];
  const userTurn = {
    role: 'user' as const,
    content:
      'We plan to use a Raspberry Pi with a multispectral camera module, run a lightweight ' +
      'CNN on-device with TFLite, and our quality angle is validating detection accuracy ' +
      'against agronomist-labelled ground truth across three farms.',
  };

  section('9. Mentor chat — follow-up turn');
  const mentorFollowRes = await client.post(
    '/projects/catalog/mentor',
    { templateId: created.id, history, userMessage: userTurn.content, mode: 'chat' },
    auth,
  );
  ok(`mentor follow-up 200 (got ${mentorFollowRes.status})`, mentorFollowRes.status === 200, mentorFollowRes.data);
  ok('follow-up reply is non-empty text', typeof mentorFollowRes.data?.reply === 'string' && mentorFollowRes.data.reply.length > 5);
  console.log('     mentor said:', mentorFollowRes.data?.reply);

  section('9b. Mentor chat — closing turn covering remaining gaps');
  const closingTurn = {
    role: 'user' as const,
    content:
      'Farmers will schedule a flight via a simple mobile app, and receive the georeferenced ' +
      'treatment-priority map as a push notification with an in-app map view within 10 minutes. ' +
      'Unlike the existing Smart Crop Advisory System (general advisory, no imaging) and the ' +
      'Drone ET-sensing project (irrigation-focused, not disease detection), we are uniquely ' +
      'targeting early fungal blight detection specifically. We have an 8-week build window: ' +
      'weeks 1-3 hardware/camera integration, weeks 4-6 on-device model + map generation, weeks ' +
      '7-8 field validation across the three farms. Success metrics: >85% detection accuracy vs ' +
      'agronomist ground truth, and map delivery under 10 minutes per flight. Main risks are ' +
      'weather delaying flights and limited labelled training data, which we will mitigate with ' +
      'data augmentation and a backup flight window.',
  };
  const closingHistory2 = [...history, userTurn, { role: 'assistant' as const, content: mentorFollowRes.data.reply }];
  const closingRes = await client.post(
    '/projects/catalog/mentor',
    { templateId: created.id, history: closingHistory2, userMessage: closingTurn.content, mode: 'chat' },
    auth,
  );
  ok(`mentor closing turn 200 (got ${closingRes.status})`, closingRes.status === 200, closingRes.data);

  section('10. Mentor report — readiness summary');
  const fullHistory = [...closingHistory2, closingTurn, { role: 'assistant', content: closingRes.data?.reply || '' }];
  const reportRes = await client.post(
    '/projects/catalog/mentor',
    { templateId: created.id, history: fullHistory, mode: 'report' },
    auth,
  );
  ok(`mentor report 200 (got ${reportRes.status})`, reportRes.status === 200, reportRes.data);
  ok(
    'report response has expected shape (ready boolean, non-empty report, extracted plan)',
    typeof reportRes.data?.ready === 'boolean' &&
      typeof reportRes.data?.report === 'string' &&
      reportRes.data.report.length > 10 &&
      typeof reportRes.data?.extracted === 'object',
    reportRes.data,
  );
  console.log('     ready:', reportRes.data?.ready);
  console.log('     report:', reportRes.data?.report);

  section('11. Final selection — instantiate project for the team');
  const selectRes = await client.post(`/projects/catalog/${created.id}/select`, { teamMembers: [] }, auth);
  ok(`select 201 (got ${selectRes.status})`, selectRes.status === 201, selectRes.data);
  ok('instantiated project links back to the template', selectRes.data?.parentProjectId === created.id);
  ok('instantiated project is pending_approval', selectRes.data?.status === 'pending_approval');
  ok('instantiated project carries over the problem statement', selectRes.data?.problemStatement === created.problemStatement);

  section('12. Re-selecting the same template with the same team is rejected');
  const reselectRes = await client.post(`/projects/catalog/${created.id}/select`, { teamMembers: [] }, auth);
  ok(`duplicate select rejected with 409 (got ${reselectRes.status})`, reselectRes.status === 409, reselectRes.data);

  printSummary();
  process.exit(fail > 0 ? 1 : 0);
}

function printSummary() {
  console.log('\n' + '='.repeat(50));
  console.log(`\x1b[1mRESULTS: ${pass} passed, ${fail} failed\x1b[0m`);
  if (failures.length > 0) {
    console.log('Failed checks:');
    failures.forEach((f) => console.log('  -', f));
  }
  console.log('='.repeat(50));
}

main().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
