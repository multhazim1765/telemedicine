import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, message: "" };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    const safeMessage = error?.message ? String(error.message) : "Unknown runtime error";
    this.setState({ message: safeMessage });
    // Keep an internal console breadcrumb for diagnostics in dev tools.
    console.error("ErrorBoundary caught runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-6 text-center shadow ring-1 ring-red-100">
          <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-600">Please refresh the page. If issue continues, contact support.</p>
          {this.state.message && (
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-red-100 bg-red-50 p-2 text-left text-xs text-red-800">
              {this.state.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
