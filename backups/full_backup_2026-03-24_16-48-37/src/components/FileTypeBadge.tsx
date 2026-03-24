/**
 * FileTypeBadge — shows a small letter-badge indicating the source file type
 * P = PDF, W = Word, H = HTML, T = Text
 */

const FILE_TYPES = {
  pdf:  { letter: "P", label: "PDF",  bg: "bg-primary/10",    text: "text-foreground",    border: "border-border" },
  word: { letter: "W", label: "Word", bg: "bg-primary/10",  text: "text-foreground",  border: "border-border" },
  text: { letter: "T", label: "Text", bg: "bg-primary/10",text: "text-foreground",border: "border-border" },
  html: { letter: "H", label: "HTML", bg: "bg-primary/10",text: "text-foreground",border: "border-border" },
} as const;

type FileType = keyof typeof FILE_TYPES;

export function detectFileType(url: string | null | undefined): FileType | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (/\.(pdf)(\?|#|$)/.test(lower)) return "pdf";
  if (/\.(docx?|rtf|odt)(\?|#|$)/.test(lower)) return "word";
  if (/\.(txt|text|log|csv|md)(\?|#|$)/.test(lower)) return "text";
  // Everything else with a URL is an HTML page
  return "html";
}

interface FileTypeBadgeProps {
  url: string | null | undefined;
  size?: "xs" | "sm";
}

export default function FileTypeBadge({ url, size = "xs" }: FileTypeBadgeProps) {
  const type = detectFileType(url);
  if (!type) return null;
  const cfg = FILE_TYPES[type];

  const sizeClasses = size === "sm"
    ? "w-5 h-5 text-[10px]"
    : "w-4 h-4 text-[9px]";

  return (
    <span
      title={cfg.label}
      className={`inline-flex items-center justify-center rounded font-bold border shrink-0 ${sizeClasses} ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.letter}
    </span>
  );
}
