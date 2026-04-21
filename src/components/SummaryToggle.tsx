import { FileText } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SummaryToggleProps {
  summary?: string | null;
  compact?: boolean;
}

export default function SummaryToggle({ summary, compact }: SummaryToggleProps) {
  if (!summary) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className={`inline-flex items-center justify-center rounded-md hover:bg-accent cursor-pointer ${compact ? "h-6 w-6" : "h-7 w-7"}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              (e.currentTarget as HTMLSpanElement).click();
            }
          }}
          title="תקציר המקרה"
          aria-label="תקציר המקרה"
        >
          <FileText className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-foreground`} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 text-right"
        dir="rtl"
        side="left"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
            <FileText className="w-4 h-4 text-foreground" />
            תקציר המקרה
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
