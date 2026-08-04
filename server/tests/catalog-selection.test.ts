import assert from 'assert';
import { availability, MAX_TEAMS_PER_STATEMENT } from '../src/modules/projects/selection.constants';
import { wordOverlapRatio, jaccardSimilarity } from '../src/shared/stringUtils';

function runTests() {
  console.log('Running catalog selection tests...');

  // Test 1
  assert.strictEqual(MAX_TEAMS_PER_STATEMENT, 3, 'MAX_TEAMS_PER_STATEMENT should equal 3');
  console.log('✔ MAX_TEAMS_PER_STATEMENT is 3');

  // Test 2
  const open = availability(0, 3);
  assert.strictEqual(open.slotsLeft, 3);
  assert.strictEqual(open.status, 'OPEN');

  const filling = availability(2, 3);
  assert.strictEqual(filling.slotsLeft, 1);
  assert.strictEqual(filling.status, 'FILLING_FAST');

  const full = availability(3, 3);
  assert.strictEqual(full.slotsLeft, 0);
  assert.strictEqual(full.status, 'FULL');
  console.log('✔ availability helper for standard 3-team limit passed');

  // Test 3
  const customOpen = availability(0, 1);
  assert.strictEqual(customOpen.slotsLeft, 1);
  assert.strictEqual(customOpen.status, 'FILLING_FAST');

  const customFull = availability(1, 1);
  assert.strictEqual(customFull.slotsLeft, 0);
  assert.strictEqual(customFull.status, 'FULL');
  console.log('✔ availability helper for custom 1-team limit passed');

  // Test 4
  const approachA = 'We will build this system using React TypeScript, Node.js Express backend, and PostgreSQL database with Redis caching.';
  const approachB = 'We will build this system using React TypeScript, Node.js Express backend, and PostgreSQL database with Redis caching for fast lookups.';
  const approachC = 'Our team will implement a novel IoT sensor network using MicroPython on ESP32 boards with LoRaWAN wireless telemetry.';

  const highOverlap = wordOverlapRatio(approachA, approachB);
  assert.ok(highOverlap > 0.7, 'High overlap expected');

  const lowOverlap = wordOverlapRatio(approachA, approachC);
  assert.ok(lowOverlap < 0.3, 'Low overlap expected');
  console.log('✔ wordOverlapRatio differentiation check passed');

  // Test 5 — regression: a long, detailed proposal must NOT read as a duplicate of
  // a short catalog title just because it contains that title's words.
  // wordOverlapRatio divides by the smaller word set, so it returned 1.0 here and
  // every thorough proposal was auto-rejected with a score of 45.
  const shortTitle = 'Intelligent Water Management in Smart Cities';
  const longProposal =
    'Predictive water distribution leakage detection and smart maintenance management platform. ' +
    'Urban water distribution networks lose treated water through undetected pipeline leaks, aging ' +
    'infrastructure and delayed maintenance. The platform monitors pipeline conditions using IoT sensor ' +
    'data, detects abnormal flow patterns, predicts leakage locations and gives municipal authorities a ' +
    'real-time operational dashboard built with React, FastAPI, PostgreSQL, PostGIS and ESP32 devices.';

  assert.ok(
    wordOverlapRatio(longProposal, shortTitle) > 0.45,
    'sanity: the old containment metric clears the 0.45 auto-reject threshold on this pair',
  );
  assert.ok(
    jaccardSimilarity(longProposal, shortTitle) < 0.1,
    'jaccardSimilarity must not treat a long proposal as a duplicate of a short title',
  );
  console.log('✔ jaccardSimilarity ignores length-driven containment (score-45 regression)');

  // A genuine near-copy must still be caught.
  assert.ok(
    jaccardSimilarity(longProposal, longProposal + ' Minor extra clause.') > 0.6,
    'jaccardSimilarity must still flag near-identical statements',
  );
  console.log('✔ jaccardSimilarity still catches genuine near-duplicates');

  console.log('All catalog selection tests passed successfully!');
}

runTests();
