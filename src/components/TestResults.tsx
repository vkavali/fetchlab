import type { TestResult, ScriptConsoleEntry } from '../types';
import { CheckCircle2, XCircle, Terminal, AlertTriangle } from 'lucide-react';

interface Props {
  tests: TestResult[];
  consoleLogs: ScriptConsoleEntry[];
}

export default function TestResults({ tests, consoleLogs }: Props) {
  const passCount = tests.filter(t => t.passed).length;
  const failCount = tests.filter(t => !t.passed).length;

  return (
    <div className="p-3 space-y-3">
      {/* Summary */}
      {tests.length > 0 && (
        <div className="flex items-center gap-4 p-2 rounded-lg bg-gray-800/30 border border-gray-800">
          <span className="text-xs font-medium text-gray-400">Tests</span>
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 size={12} /> {passCount} passed
          </span>
          {failCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle size={12} /> {failCount} failed
            </span>
          )}
        </div>
      )}

      {/* Test results */}
      {tests.map((test, i) => (
        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${
          test.passed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          {test.passed
            ? <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
            : <XCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${test.passed ? 'text-green-400' : 'text-red-400'}`}>
              {test.name}
            </p>
            {test.error && (
              <p className="text-[10px] text-red-400/70 mt-0.5 font-mono break-all">{test.error}</p>
            )}
          </div>
        </div>
      ))}

      {/* Console output */}
      {consoleLogs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Terminal size={12} className="text-gray-500" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Console</span>
          </div>
          <div className="rounded-lg bg-gray-800/30 border border-gray-800 overflow-hidden">
            {consoleLogs.map((entry, i) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-1.5 text-xs font-mono border-b border-gray-800/50 last:border-0 ${
                entry.type === 'error' ? 'text-red-400 bg-red-500/5' :
                entry.type === 'warn' ? 'text-amber-400 bg-amber-500/5' :
                'text-gray-400'
              }`}>
                {entry.type === 'error' && <XCircle size={10} className="mt-0.5 flex-shrink-0" />}
                {entry.type === 'warn' && <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />}
                <span className="break-all">{entry.args.join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tests.length === 0 && consoleLogs.length === 0 && (
        <div className="text-center py-8">
          <Terminal size={24} className="mx-auto text-gray-700 mb-2" />
          <p className="text-xs text-gray-500">No test results yet</p>
          <p className="text-[10px] text-gray-600 mt-1">Add tests in the Scripts tab, then send a request</p>
        </div>
      )}
    </div>
  );
}
