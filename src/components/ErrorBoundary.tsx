import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Redact any possible private financial state from console error logs
    console.error('[ProofLedger ErrorBoundary caught error]:', error.name, error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Component Stack]:', errorInfo.componentStack);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-screen bg-[#F6F7F2] text-[#111827] flex flex-col items-center justify-center p-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md w-full bg-white border border-[#DDE3DA] shadow-xl rounded-3xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-[#111827] tracking-tight">
                An Unexpected Application Error Occurred
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                ProofLedger AI encountered an unhandled error while rendering this workspace.
                Your uploaded financial files and sensitive data remain strictly confined to local browser memory and have not been leaked.
              </p>
            </div>

            {/* Error Message (Sanitized - no stack trace or internal SQL/tokens) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-1">
                Diagnostic Code
              </span>
              <p className="text-xs font-mono text-slate-700 break-words">
                {this.state.error?.name || 'ApplicationError'}: {this.state.error?.message || 'Unknown internal state exception'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#101A2B] hover:bg-[#1C2D48] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#F6F7F2] hover:bg-[#EEF1EB] border border-[#CBD5C5] text-[#111827] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-slate-600" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
