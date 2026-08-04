import assert from 'assert';
import { test, describe } from 'node:test';
import { tokenizeText, lightStem } from '../overlap/tokenize';
import { buildTfIdfModel, cosineSimilarity } from '../overlap/tfidf';
import { evaluateStandoutGate, type GateEvaluationInput } from '../standout/gate';

describe('Tokenization & Stemming', () => {
  test('stems common English suffixes', () => {
    assert.strictEqual(lightStem('developing'), 'develop');
    assert.strictEqual(lightStem('technologies'), 'technology');
  });

  test('filters English stopwords and academic boilerplate', () => {
    const tokens = tokenizeText('The proposed system is using artificial intelligence for detection');
    assert.ok(!tokens.includes('the'));
    assert.ok(!tokens.includes('system'));
    assert.ok(!tokens.includes('using'));
    assert.ok(tokens.some((t) => t.includes('artifici') || t.includes('intellig') || t.includes('detect')));
  });
});

describe('TF-IDF & Cosine Similarity', () => {
  test('computes cosine 1.0 for identical documents', () => {
    const docTokens = new Map<string, string[]>([
      ['doc1', ['artifici', 'intellig', 'sensor', 'network']],
      ['doc2', ['artifici', 'intellig', 'sensor', 'network']],
    ]);
    const model = buildTfIdfModel(docTokens);
    const v1 = model.vectors.get('doc1')!;
    const v2 = model.vectors.get('doc2')!;
    const sim = cosineSimilarity(v1, v2);
    assert.ok(Math.abs(sim - 1.0) < 0.001);
  });

  test('computes cosine 0.0 for completely disjoint documents', () => {
    const docTokens = new Map<string, string[]>([
      ['doc1', ['artifici', 'intellig', 'sensor']],
      ['doc2', ['blockchain', 'cryptography', 'ledger']],
    ]);
    const model = buildTfIdfModel(docTokens);
    const v1 = model.vectors.get('doc1')!;
    const v2 = model.vectors.get('doc2')!;
    const sim = cosineSimilarity(v1, v2);
    assert.strictEqual(sim, 0.0);
  });

  test('handles empty or stopword-only documents without error', () => {
    const docTokens = new Map<string, string[]>([
      ['doc1', []],
      ['doc2', ['artifici', 'intellig']],
    ]);
    const model = buildTfIdfModel(docTokens);
    const v1 = model.vectors.get('doc1')!;
    const v2 = model.vectors.get('doc2')!;
    const sim = cosineSimilarity(v1, v2);
    assert.strictEqual(sim, 0.0);
  });
});

describe('Standout Hard Gate (Deterministic Rules)', () => {
  const baseInput: GateEvaluationInput = {
    projectId: 'test-p1',
    reports: [
      {
        cycle: 1,
        overallScore: 80,
        plagiarismRisk: 'LOW',
        suspiciousBehaviour: [],
        isFallback: false,
        perMemberParticipation: [
          { memberId: 'u1', score: 85 },
          { memberId: 'u2', score: 80 },
        ],
      },
      {
        cycle: 2,
        overallScore: 82,
        plagiarismRisk: 'LOW',
        suspiciousBehaviour: [],
        isFallback: false,
        perMemberParticipation: [
          { memberId: 'u1', score: 85 },
          { memberId: 'u2', score: 80 },
        ],
      },
      {
        cycle: 3,
        overallScore: 85,
        plagiarismRisk: 'LOW',
        suspiciousBehaviour: [],
        isFallback: false,
        perMemberParticipation: [
          { memberId: 'u1', score: 90 },
          { memberId: 'u2', score: 85 },
        ],
      },
    ],
    authenticityScore: 88,
    github: {
      linked: true,
      commitCount: 50,
      contributorCount: 2,
      distinctIsoWeeks: 4,
    },
    hasSevereOverlapFlag: false,
  };

  test('passes project with 3 strong, consistent, clean cycles and good GitHub activity', () => {
    const res = evaluateStandoutGate(baseInput);
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.failedReasons.length, 0);
    assert.ok(res.evidenceScore > 75);
  });

  test('rejects single high-score cycle (needs >= 3 cycles)', () => {
    const singleCycleInput: GateEvaluationInput = {
      ...baseInput,
      reports: [baseInput.reports[0]],
    };
    const res = evaluateStandoutGate(singleCycleInput);
    assert.strictEqual(res.passed, false);
    assert.ok(res.failedReasons.some((r) => r.includes('Insufficient evaluation history')));
  });

  test('rejects project with consistency drop below threshold (e.g. 85/85/60)', () => {
    const inconsistentInput: GateEvaluationInput = {
      ...baseInput,
      reports: [
        { ...baseInput.reports[0], overallScore: 85 },
        { ...baseInput.reports[1], overallScore: 85 },
        { ...baseInput.reports[2], overallScore: 60 },
      ],
    };
    const res = evaluateStandoutGate(inconsistentInput);
    assert.strictEqual(res.passed, false);
    assert.ok(res.failedReasons.some((r) => r.includes('lowest cycle score')));
  });

  test('rejects project with HIGH plagiarism risk', () => {
    const plagiarismInput: GateEvaluationInput = {
      ...baseInput,
      reports: [
        baseInput.reports[0],
        baseInput.reports[1],
        { ...baseInput.reports[2], plagiarismRisk: 'HIGH' },
      ],
    };
    const res = evaluateStandoutGate(plagiarismInput);
    assert.strictEqual(res.passed, false);
    assert.ok(res.failedReasons.some((r) => r.includes('HIGH plagiarism risk')));
  });

  test('rejects project with low team member participation (e.g. member score = 10)', () => {
    const lowMemberInput: GateEvaluationInput = {
      ...baseInput,
      reports: [
        baseInput.reports[0],
        baseInput.reports[1],
        {
          ...baseInput.reports[2],
          perMemberParticipation: [
            { memberId: 'u1', score: 90 },
            { memberId: 'u2', score: 10 },
          ],
        },
      ],
    };
    const res = evaluateStandoutGate(lowMemberInput);
    assert.strictEqual(res.passed, false);
    assert.ok(res.failedReasons.some((r) => r.includes('Uneven team contribution')));
  });
});
