import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/primitives";

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a single broken view never blanks the whole app.
 * Also recovers from stale lazy chunks after a deployment by offering a reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const chunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
      return (
        <div className="container page">
          <ErrorState
            title={chunkError ? "A new version is available" : "This page hit a snag"}
            message={chunkError ? "Reload to get the latest version of SynChef." : "Please try again. If it keeps happening, reload the page."}
            onRetry={() => (chunkError ? window.location.reload() : this.setState({ error: null }))}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
