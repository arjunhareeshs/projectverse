import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16; // 128 bits

function getMasterKey(): Buffer {
  const envKey = process.env.AI_API_KEY_ENCRYPTION_KEY;
  if (envKey && envKey.trim().length >= 32) {
    return crypto.createHash('sha256').update(envKey.trim()).digest();
  }

  // Fallback for development / test environment
  const fallbackSecret =
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    'projectverse-dev-encryption-master-secret-fallback-key-2026';

  return crypto.createHash('sha256').update(fallbackSecret).digest();
}

/**
 * Encrypts an API key using AES-256-GCM authenticated encryption.
 * The output format is `ivHex:authTagHex:ciphertextHex`.
 */
export function encryptApiKey(plainKey: string): string {
  if (!plainKey || typeof plainKey !== 'string' || plainKey.trim().length === 0) {
    throw new Error('Invalid API key provided for encryption');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plainKey.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an encrypted API key and verifies the GCM authentication tag.
 */
export function decryptApiKey(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted payload');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format');
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid IV or auth tag length');
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Failed to decrypt API key: authentication tag verification failed or key is corrupt');
  }
}

/**
 * Computes a secure HMAC-SHA256 fingerprint for deduplication and identity verification.
 */
export function fingerprintApiKey(plainKey: string): string {
  if (!plainKey || typeof plainKey !== 'string') return '';
  const key = getMasterKey();
  return crypto.createHmac('sha256', key).update(plainKey.trim()).digest('hex');
}

/**
 * Masks an API key for safe presentation to the frontend (e.g. ••••••••8F3A).
 * NEVER exposes the raw secret key.
 */
export function maskApiKey(plainKey: string): string {
  if (!plainKey || typeof plainKey !== 'string') return '••••';
  const trimmed = plainKey.trim();
  if (trimmed.length <= 6) {
    return '••••' + trimmed.slice(-2);
  }
  const last4 = trimmed.slice(-4);
  return `••••••••${last4}`;
}
