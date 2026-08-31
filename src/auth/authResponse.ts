export type AuthAction = 'Login' | 'Registration';

export async function parseAuthResponse(res: Response, action: AuthAction): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  let text = '';
  const contentType = res.headers.get('Content-Type') || '';

  try {
    if (contentType.toLowerCase().includes('application/json')) {
      data = await res.json();
    } else {
      text = await res.text();
    }
  } catch {
    // Keep the fallback messages below.
  }

  if (!res.ok) {
    const serverMessage = typeof data.error === 'string'
      ? data.error
      : typeof data.message === 'string'
        ? data.message
        : text.trim();

    if (res.status === 404 || res.status === 405) {
      throw new Error(`${action} unavailable - this page is not connected to the FetchLab API. Open https://fetchlab.app/app or set VITE_API_BASE_URL for split deployments.`);
    }

    if (res.status >= 500) {
      const suffix = serverMessage && !/^<!doctype html/i.test(serverMessage)
        ? ` Server said: ${serverMessage}`
        : '';
      throw new Error(`${action} failed - API server returned ${res.status}.${suffix}`);
    }

    throw new Error(serverMessage || `${action} failed (${res.status})`);
  }

  return data;
}
