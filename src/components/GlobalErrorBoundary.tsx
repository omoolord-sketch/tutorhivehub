import { Component, type ErrorInfo, type ReactNode } from "react";

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

type GlobalErrorBoundaryState = {
  hasError: boolean;
};

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("TutorHiveHub application error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16 text-ink">
          <section className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-8 shadow-soft">
            <p className="text-sm font-black uppercase text-red-600">Application Error</p>
            <h1 className="mt-3 text-3xl font-black text-navy">Something went wrong</h1>
            <p className="mt-4 leading-7 text-slate-650">
              TutorHiveHub could not load this view. Please refresh the page or contact administration if the problem continues.
            </p>
            <button
              type="button"
              className="mt-6 rounded-md bg-gold px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100 focus:outline-none focus:ring-4 focus:ring-gold/30"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
