"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Something went wrong
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {this.state.error?.message ??
                "An unexpected error occurred. Try reloading."}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={this.reset}
                className="text-xs rounded-md px-3 py-1.5 border border-gray-100/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Try again
              </button>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") window.location.reload();
                }}
                className="text-xs rounded-md px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
