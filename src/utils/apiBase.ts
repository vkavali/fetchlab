const API_BASE_STORAGE_KEY = 'fetchlab_api_base_url';

function normalizeBase(value: string | null | undefined): string {
  const v = String(value || '').trim();
  if (!v) return '';
  return v.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const envBase = normalizeBase(import.meta.env.VITE_API_BASE_URL);
  if (envBase) return envBase;

  try {
    const saved = normalizeBase(localStorage.getItem(API_BASE_STORAGE_KEY));
    if (saved) return saved;
  } catch { /* ignore */ }

  try {
    if (window.location.hostname.toLowerCase() === 'www.fetchlab.app') {
      return 'https://fetchlab.app';
    }
  } catch { /* ignore */ }

  return '';
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  if (!base || !path.startsWith('/api')) return path;
  return `${base}${path}`;
}
