import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ErrorBoundary Handled Runtime Notice]:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      this.setState({ hasError: false, error: null });
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      window.location.href = '/';
    }
  };

  private handleGoHome = () => {
    try {
      this.setState({ hasError: false, error: null });
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch {}
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Session Resumed</h2>
              <p className="text-xs text-slate-500 mt-1">
                The application state was safely restored. Click reload or return home to continue.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95"
              >
                <Home className="w-3.5 h-3.5" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
