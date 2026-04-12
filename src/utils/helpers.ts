export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function getStatusClass(status: number): string {
  if (status < 300) return 'status-2xx';
  if (status < 400) return 'status-3xx';
  if (status < 500) return 'status-4xx';
  return 'status-5xx';
}

export function getMethodClass(method: string): string {
  return `method-${method.toLowerCase()}`;
}

export function syntaxHighlightJson(json: string): string {
  try {
    const obj = JSON.parse(json);
    json = JSON.stringify(obj, null, 2);
  } catch {
    return escapeHtml(json);
  }

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
          return `<span class="${cls}">${escapeHtml(match)}</span>`;
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${escapeHtml(match)}</span>`;
    }
  ).replace(/([{}[\]])/g, '<span class="json-bracket">$1</span>');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function createDefaultRequest(): import('../types').RequestConfig {
  return {
    id: generateId(),
    name: 'New Request',
    method: 'GET',
    url: '',
    params: [{ id: generateId(), key: '', value: '', enabled: true }],
    headers: [{ id: generateId(), key: '', value: '', enabled: true }],
    body: { type: 'none', content: '', formData: [] },
    auth: { type: 'none' },
  };
}

export function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export function generateCodeSnippet(
  request: import('../types').RequestConfig,
  language: 'curl' | 'javascript' | 'python' | 'go'
): string {
  const { method, url, headers, body } = request;
  const enabledHeaders = headers.filter(h => h.enabled && h.key);

  switch (language) {
    case 'curl': {
      let cmd = `curl -X ${method} '${url}'`;
      enabledHeaders.forEach(h => { cmd += ` \\\n  -H '${h.key}: ${h.value}'`; });
      if (body.type === 'json' && body.content) {
        cmd += ` \\\n  -d '${body.content}'`;
      }
      return cmd;
    }
    case 'javascript': {
      let code = `const response = await fetch('${url}', {\n  method: '${method}',`;
      if (enabledHeaders.length > 0) {
        code += `\n  headers: {\n`;
        enabledHeaders.forEach(h => { code += `    '${h.key}': '${h.value}',\n`; });
        code += `  },`;
      }
      if (body.type === 'json' && body.content) {
        code += `\n  body: JSON.stringify(${body.content}),`;
      }
      code += `\n});\n\nconst data = await response.json();\nconsole.log(data);`;
      return code;
    }
    case 'python': {
      let code = `import requests\n\n`;
      code += `response = requests.${method.toLowerCase()}(\n  '${url}',`;
      if (enabledHeaders.length > 0) {
        code += `\n  headers={`;
        enabledHeaders.forEach(h => { code += `\n    '${h.key}': '${h.value}',`; });
        code += `\n  },`;
      }
      if (body.type === 'json' && body.content) {
        code += `\n  json=${body.content},`;
      }
      code += `\n)\n\nprint(response.json())`;
      return code;
    }
    case 'go': {
      let code = `package main\n\nimport (\n  "fmt"\n  "net/http"\n  "io"\n`;
      if (body.type === 'json' && body.content) code += `  "strings"\n`;
      code += `)\n\nfunc main() {\n`;
      if (body.type === 'json' && body.content) {
        code += `  body := strings.NewReader(\`${body.content}\`)\n`;
        code += `  req, _ := http.NewRequest("${method}", "${url}", body)\n`;
      } else {
        code += `  req, _ := http.NewRequest("${method}", "${url}", nil)\n`;
      }
      enabledHeaders.forEach(h => { code += `  req.Header.Set("${h.key}", "${h.value}")\n`; });
      code += `  resp, _ := http.DefaultClient.Do(req)\n  defer resp.Body.Close()\n`;
      code += `  data, _ := io.ReadAll(resp.Body)\n  fmt.Println(string(data))\n}`;
      return code;
    }
  }
}

export function exportToJsonFile(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function requestToShareableJson(request: import('../types').RequestConfig) {
  return {
    _fetchlab: '1.0',
    _type: 'request',
    name: request.name,
    method: request.method,
    url: request.url,
    params: request.params.filter(p => p.key),
    headers: request.headers.filter(h => h.key),
    body: request.body,
    auth: { type: request.auth.type }, // don't share secrets
  };
}

export function collectionToShareableJson(collection: import('../types').Collection) {
  return {
    _fetchlab: '1.0',
    _type: 'collection',
    name: collection.name,
    description: collection.description,
    requests: collection.requests.map(r => requestToShareableJson(r)),
  };
}
