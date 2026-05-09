import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-gray-100 p-4">
          <div className="max-w-md w-full bg-gray-900 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">!</div>
              <h2 className="text-lg font-bold">Something broke</h2>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              FetchLab hit an unexpected error. Your data is safe — try reloading.
            </p>
            <pre className="text-[11px] text-red-400 bg-gray-950 border border-gray-800 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
              >Reload</button>
              <button
                onClick={this.reset}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm"
              >Try again</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
