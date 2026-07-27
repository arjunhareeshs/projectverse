import assert from 'node:assert';
import { wordOverlapRatio, isTooSimilar, normalize } from '../../../shared/stringUtils';

// Standalone verification tests using Node assert
export function runPersonalizationTests() {
  // Normalize
  assert.strictEqual(normalize('  Hello   WORLD   '), 'hello world');
  assert.strictEqual(normalize(''), '');

  // Word overlap ratio
  assert.strictEqual(wordOverlapRatio('Smart Attendance System', 'Smart Attendance System'), 1);
  assert.strictEqual(wordOverlapRatio('Blockchain Ledger', 'Quantum Computing'), 0);
  assert.ok(
    wordOverlapRatio('Smart Attendance System Using Facial Recognition', 'Facial Recognition Attendance System') > 0.5,
  );

  // Similarity heuristic
  assert.strictEqual(
    isTooSimilar('Smart Attendance System Using Facial Recognition', 'Smart Attendance System With Facial Recognition'),
    true,
  );
  assert.strictEqual(isTooSimilar('Machine Learning Cancer Detection', 'E-commerce Shopping Platform'), false);
}

if (require.main === module) {
  runPersonalizationTests();
  console.log('Personalization and stringUtils tests passed successfully!');
}
