import type { RequestConfig, HttpMethod, KeyValue } from '../types';
import { generateId } from './helpers';

/**
 * Parse a cURL command string into a RequestConfig.
 * Handles: -X METHOD, -H headers, -d/--data body, --data-raw,
 * -u user:pass, -b cookies, query params, and quoted strings.
 */
export function parseCurl(input: string): Partial<RequestConfig> | null {
  const trimmed = input.trim();
  if (!trimmed.toLowerCase().startsWith('curl')) return null;

  // Normalize multiline (backslash continuations)
  const normalized = trimmed.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ');

  const tokens = tokenize(normalized);
  if (tokens.length < 2) return null;

  let method: HttpMethod = 'GET';
  let url = '';
  const headers: KeyValue[] = [];
  let bodyContent = '';
  let bodyType: 'none' | 'json' | 'raw' | 'x-www-form-urlencoded' = 'none';
  let username = '';
  let password = '';

  let i = 1; // skip 'curl'
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      i++;
      if (i < tokens.length) {
        method = tokens[i].toUpperCase() as HttpMethod;
      }
    } else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const headerStr = unquote(tokens[i]);
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          headers.push({
            id: generateId(),
            key: headerStr.substring(0, colonIdx).trim(),
            value: headerStr.substring(colonIdx + 1).trim(),
            enabled: true,
          });
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      i++;
      if (i < tokens.length) {
        bodyContent = unquote(tokens[i]);
        if (method === 'GET') method = 'POST';
        // Detect JSON
        try {
          JSON.parse(bodyContent);
          bodyType = 'json';
        } catch {
          if (bodyContent.includes('=') && !bodyContent.includes('{')) {
            bodyType = 'x-www-form-urlencoded';
          } else {
            bodyType = 'raw';
          }
        }
      }
    } else if (token === '-u' || token === '--user') {
      i++;
      if (i < tokens.length) {
        const parts = unquote(tokens[i]).split(':');
        username = parts[0] || '';
        password = parts.slice(1).join(':') || '';
      }
    } else if (token === '-b' || token === '--cookie') {
      i++;
      if (i < tokens.length) {
        headers.push({
          id: generateId(),
          key: 'Cookie',
          value: unquote(tokens[i]),
          enabled: true,
        });
      }
    } else if (token === '-A' || token === '--user-agent') {
      i++;
      if (i < tokens.length) {
        headers.push({
          id: generateId(),
          key: 'User-Agent',
          value: unquote(tokens[i]),
          enabled: true,
        });
      }
    } else if (
      token === '--compressed' || token === '-s' || token === '--silent' ||
      token === '-S' || token === '--show-error' || token === '-k' ||
      token === '--insecure' || token === '-L' || token === '--location' ||
      token === '-v' || token === '--verbose' || token === '-i'
    ) {
      // Skip flags with no arguments
    } else if (token === '-o' || token === '--output' || token === '--connect-timeout' || token === '--max-time') {
      i++; // Skip flag + value
    } else if (!token.startsWith('-')) {
      // This is the URL
      url = unquote(token);
    }

    i++;
  }

  // Parse query params from URL
  const params: KeyValue[] = [];
  if (url.includes('?')) {
    const [baseUrl, queryString] = url.split('?', 2);
    url = baseUrl;
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params.push({ id: generateId(), key, value, enabled: true });
    });
  }

  // Build body formData for url-encoded
  const formData: KeyValue[] = [];
  if (bodyType === 'x-www-form-urlencoded') {
    const sp = new URLSearchParams(bodyContent);
    sp.forEach((value, key) => {
      formData.push({ id: generateId(), key, value, enabled: true });
    });
  }

  // Build the result
  const result: Partial<RequestConfig> = {
    method,
    url,
    headers: headers.length > 0 ? headers : [{ id: generateId(), key: '', value: '', enabled: true }],
    params: params.length > 0 ? params : [{ id: generateId(), key: '', value: '', enabled: true }],
    body: {
      type: bodyType,
      content: bodyType === 'json' || bodyType === 'raw' ? bodyContent : '',
      formData: formData.length > 0 ? formData : [],
    },
  };

  if (username) {
    result.auth = {
      type: 'basic',
      basic: { username, password },
    };
  }

  // Auto-name from URL
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    result.name = pathParts.length > 0
      ? `${method} /${pathParts.join('/')}`
      : `${method} ${urlObj.hostname}`;
  } catch {
    result.name = `${method} request`;
  }

  return result;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && input[i] === ' ') i++;
    if (i >= input.length) break;

    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i];
      i++;
      let token = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          token += input[i];
        } else {
          token += input[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else {
      let token = '';
      while (i < input.length && input[i] !== ' ') {
        token += input[i];
        i++;
      }
      tokens.push(token);
    }
  }
  return tokens;
}

function unquote(s: string): string {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}
