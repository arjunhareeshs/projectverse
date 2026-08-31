import assert from 'assert';
import {
  encryptApiKey,
  decryptApiKey,
  fingerprintApiKey,
  maskApiKey,
} from '../apiKeyEncryption.service';
import { isFallbackEligible } from '../providers/provider.interface';
import { ProviderFactory } from '../providers/provider.factory';
import { GroqProvider } from '../providers/groq.provider';
import { NvidiaProvider } from '../providers/nvidia.provider';

export async function runByokTests() {
  console.log('--- Running ProjectVerse BYOK AI System Test Suite ---');

  // 1. Encryption & Decryption Tests
  console.log('1. Testing AES-256-GCM Encryption / Decryption...');
  const testKey = 'gsk_test_api_key_1234567890abcdefABCDEF';
  const encrypted = encryptApiKey(testKey);

  assert.notStrictEqual(encrypted, testKey, 'Encrypted key must not equal plaintext key');
  assert.strictEqual(encrypted.includes(testKey), false, 'Ciphertext must never contain the plain key string');
  assert.strictEqual(encrypted.split(':').length, 3, 'Ciphertext format must be iv:authTag:ciphertext');

  const decrypted = decryptApiKey(encrypted);
  assert.strictEqual(decrypted, testKey, 'Decrypted key must match original plain key');

  // Tamper detection
  const parts = encrypted.split(':');
  const tamperedCiphertext = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}00`;
  assert.throws(
    () => decryptApiKey(tamperedCiphertext),
    /Failed to decrypt API key|authentication tag verification failed/,
    'Tampered ciphertext must fail authentication tag check',
  );

  // 2. Fingerprinting & Masking Tests
  console.log('2. Testing Key Fingerprinting & Masking...');
  const fp1 = fingerprintApiKey(testKey);
  const fp2 = fingerprintApiKey(testKey);
  const fp3 = fingerprintApiKey('different-key-12345');

  assert.strictEqual(fp1, fp2, 'Same key must yield identical fingerprint');
  assert.notStrictEqual(fp1, fp3, 'Different keys must yield different fingerprints');
  assert.strictEqual(fp1.length, 64, 'Fingerprint must be 64-char SHA256 hex string');

  const maskedGroq = maskApiKey('gsk_AbCdEf1234567890');
  assert.strictEqual(maskedGroq, '••••••••7890', 'Masked key must show last 4 chars preceded by bullets');
  assert.strictEqual(maskedGroq.includes('AbCdEf'), false, 'Masked key must not contain raw middle characters');

  const maskedNvidia = maskApiKey('nvapi-0123456789abcdef8F3A');
  assert.strictEqual(maskedNvidia, '••••••••8F3A', 'Masked key must correctly capture last 4 digits');

  // 3. Fallback Eligibility Tests
  console.log('3. Testing Error Classification & Fallback Eligibility...');
  assert.strictEqual(isFallbackEligible({ response: { status: 401 } }), true, '401 Unauthorized must be fallback-eligible');
  assert.strictEqual(isFallbackEligible({ response: { status: 429 } }), true, '429 Rate Limit must be fallback-eligible');
  assert.strictEqual(isFallbackEligible({ response: { status: 502 } }), true, '502 Bad Gateway must be fallback-eligible');
  assert.strictEqual(isFallbackEligible({ response: { status: 503 } }), true, '503 Unavailable must be fallback-eligible');
  assert.strictEqual(isFallbackEligible({ response: { status: 504 } }), true, '504 Gateway Timeout must be fallback-eligible');
  assert.strictEqual(isFallbackEligible({ code: 'ETIMEDOUT' }), true, 'Network timeout must be fallback-eligible');
  assert.strictEqual(isFallbackEligible({ code: 'ECONNREFUSED' }), true, 'Connection refused must be fallback-eligible');

  // Non-eligible error
  assert.strictEqual(isFallbackEligible({ response: { status: 400 } }), false, '400 Bad Request must NOT be fallback-eligible');

  // 4. Provider Factory Tests
  console.log('4. Testing Provider Factory Resolution...');
  const groqProvider = ProviderFactory.getProvider('GROQ');
  assert.strictEqual(groqProvider instanceof GroqProvider, true, 'Factory must return GroqProvider for GROQ');
  assert.strictEqual(groqProvider.providerName, 'GROQ');

  const nvidiaProvider = ProviderFactory.getProvider('NVIDIA');
  assert.strictEqual(nvidiaProvider instanceof NvidiaProvider, true, 'Factory must return NvidiaProvider for NVIDIA');
  assert.strictEqual(nvidiaProvider.providerName, 'NVIDIA');

  // 5. Validation Mock Tests
  console.log('5. Testing Key Validation Format Checks...');
  const emptyVal = await groqProvider.validateKey('');
  assert.strictEqual(emptyVal.valid, false, 'Empty key must fail validation');

  const shortVal = await nvidiaProvider.validateKey('short');
  assert.strictEqual(shortVal.valid, false, 'Too short key must fail validation');

  console.log('All BYOK AI Provider System unit & security tests passed successfully!');
}

if (process.argv[1]?.endsWith('byok.test.ts') || process.argv[1]?.endsWith('byok.test.js')) {
  runByokTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('BYOK Test failed:', err);
      process.exit(1);
    });
}
