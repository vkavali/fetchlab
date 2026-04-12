import { Code, Zap } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  type: 'pre-request' | 'test';
}

const PRE_REQUEST_SNIPPETS = [
  { label: 'Set timestamp', code: 'fl.setVariable("timestamp", String(fl.timestamp()));' },
  { label: 'Set UUID', code: 'fl.setVariable("requestId", fl.uuid());' },
  { label: 'Set ISO date', code: 'fl.setVariable("isoDate", fl.isoTimestamp());' },
  { label: 'Set auth header', code: 'fl.setHeader("Authorization", "Bearer " + fl.getVariable("token"));' },
  { label: 'Set content type', code: 'fl.setHeader("Content-Type", "application/json");' },
  { label: 'Random int', code: 'fl.setVariable("randomId", String(fl.randomInt(1, 1000)));' },
];

const TEST_SNIPPETS = [
  { label: 'Status is 200', code: 'fl.test("Status is 200", () => {\n  fl.expect(fl.response.status).toBe(200);\n});' },
  { label: 'Status is 2xx', code: 'fl.test("Status is 2xx", () => {\n  fl.expect(fl.response.status).toBeGreaterThan(199);\n  fl.expect(fl.response.status).toBeLessThan(300);\n});' },
  { label: 'Response time < 500ms', code: 'fl.test("Response time < 500ms", () => {\n  fl.expect(fl.response.time).toBeLessThan(500);\n});' },
  { label: 'Body has property', code: 'fl.test("Body has data", () => {\n  fl.expect(fl.response.body).toHaveProperty("data");\n});' },
  { label: 'Body is array', code: 'fl.test("Response is array", () => {\n  fl.expect(Array.isArray(fl.response.body)).toBe(true);\n});' },
  { label: 'Extract to variable', code: 'fl.setVariable("userId", String(fl.response.body.id));' },
];

export default function ScriptEditor({ value, onChange, type }: Props) {
  const snippets = type === 'pre-request' ? PRE_REQUEST_SNIPPETS : TEST_SNIPPETS;

  const insertSnippet = (code: string) => {
    onChange(value ? value + '\n\n' + code : code);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-accent-400" />
          <span className="text-xs font-medium text-gray-400">
            {type === 'pre-request' ? 'Pre-request Script' : 'Test Script'}
          </span>
        </div>
      </div>

      {/* Quick insert snippets */}
      <div className="flex flex-wrap gap-1">
        {snippets.map(s => (
          <button
            key={s.label}
            onClick={() => insertSnippet(s.code)}
            className="px-2 py-0.5 rounded text-[10px] bg-gray-800/50 text-gray-500 hover:text-brand-400 hover:bg-gray-800 transition-colors"
          >
            + {s.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={type === 'pre-request'
          ? '// Runs before the request is sent\n// Use fl.setHeader(), fl.setVariable(), fl.setBody()\n// fl.timestamp(), fl.uuid(), fl.base64Encode()'
          : '// Runs after the response is received\n// Use fl.test("name", () => { ... })\n// fl.expect(value).toBe(), .toContain(), .toHaveProperty()\n// fl.response.status, fl.response.body, fl.response.headers'
        }
        className="w-full h-40 bg-gray-800/30 border border-gray-800 rounded-lg px-4 py-3 text-xs text-gray-200 font-mono resize-y focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 leading-relaxed"
        spellCheck={false}
      />

      <p className="text-[9px] text-gray-600">
        <Zap size={8} className="inline" /> Scripts run in a sandbox. Use <code className="text-gray-500">fl.*</code> API. Console output appears in the Tests tab.
      </p>
    </div>
  );
}
