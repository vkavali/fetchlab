const DEVICE_KEY_STORAGE = 'fetchlab_local_vault_key_v1';
const PREFIX = 'v1';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function getOrCreateDeviceKey() {
  const existing = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (existing) return base64ToBytes(existing);
  const key = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(DEVICE_KEY_STORAGE, bytesToBase64(key));
  return key;
}

async function importDeviceKey() {
  return crypto.subtle.importKey('raw', getOrCreateDeviceKey(), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptLocalJson(storageKey: string, value: unknown) {
  if (!crypto?.subtle) throw new Error('Web Crypto is unavailable');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const additionalData = new TextEncoder().encode(storageKey);
  const key = await importDeviceKey();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plaintext);
  return [PREFIX, bytesToBase64(iv), bytesToBase64(new Uint8Array(encrypted))].join(':');
}

export async function decryptLocalJson<T>(storageKey: string, payload: string): Promise<T> {
  if (!crypto?.subtle) throw new Error('Web Crypto is unavailable');
  const [version, ivValue, ciphertextValue, ...rest] = payload.split(':');
  if (version !== PREFIX || !ivValue || !ciphertextValue || rest.length) throw new Error('Invalid local vault payload');
  const key = await importDeviceKey();
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(ivValue),
      additionalData: new TextEncoder().encode(storageKey),
    },
    key,
    base64ToBytes(ciphertextValue),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export async function loadEncryptedLocal<T>(storageKey: string, fallback: T): Promise<T> {
  const payload = localStorage.getItem(storageKey);
  if (!payload) return fallback;
  return decryptLocalJson<T>(storageKey, payload);
}

export async function saveEncryptedLocal(storageKey: string, value: unknown) {
  localStorage.setItem(storageKey, await encryptLocalJson(storageKey, value));
}
