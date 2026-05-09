import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw && raw.length >= 32) {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      cachedKey = Buffer.from(raw, 'hex');
    } else if (/^[A-Za-z0-9+/=]+$/.test(raw) && Buffer.from(raw, 'base64').length === KEY_LENGTH) {
      cachedKey = Buffer.from(raw, 'base64');
    } else {
      cachedKey = crypto.createHash('sha256').update(raw, 'utf8').digest();
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_ENCRYPTION_KEY must be set (32 bytes hex or base64) in production');
    }
    cachedKey = crypto.createHash('sha256').update('fetchlab-dev-key-do-not-use-in-prod', 'utf8').digest();
  }
  return cachedKey;
}

export function encrypt(plaintext) {
  if (plaintext == null) return null;
  const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload) {
  if (payload == null) return null;
  if (typeof payload !== 'string' || !payload.startsWith('v1:')) {
    return payload;
  }
  const parts = payload.split(':');
  if (parts.length !== 4) throw new Error('Invalid ciphertext format');
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid ciphertext components');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('v1:') && value.split(':').length === 4;
}

export function resetKeyCache() {
  cachedKey = null;
}
