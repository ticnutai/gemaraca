import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary${this.props.section ? ` - ${this.props.section}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-destructive/30 bg-destructive/5 gap-3" dir="rtl">
          <AlertTriangle className="h-8 w-8 text-destructive/60" />
          <p className="text-sm text-muted-foreground text-center">
            {this.props.section ? `שגיאה בטעינת ${this.props.section}` : "שגיאה בטעינת הקומפוננטה"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            נסה שוב
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
