import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-foreground">משהו השתבש</h1>
            <p className="text-muted-foreground">
              {this.state.error?.message || "אירעה שגיאה בלתי צפויה."}
            </p>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
              טען מחדש
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
