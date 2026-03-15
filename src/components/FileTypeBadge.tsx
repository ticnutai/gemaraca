/**
 * FileTypeBadge — shows a small letter-badge indicating the source file type
 * P = PDF, W = Word, H = HTML, T = Text
 */

const FILE_TYPES = {
  pdf:  { letter: "P", label: "PDF",  bg: "bg-red-100 dark:bg-red-950",    text: "text-red-700 dark:text-red-300",    border: "border-red-300 dark:border-red-800" },
  word: { letter: "W", label: "Word", bg: "bg-blue-100 dark:bg-blue-950",  text: "text-blue-700 dark:text-blue-300",  border: "border-blue-300 dark:border-blue-800" },
  text: { letter: "T", label: "Text", bg: "bg-green-100 dark:bg-green-950",text: "text-green-700 dark:text-green-300",border: "border-green-300 dark:border-green-800" },
  html: { letter: "H", label: "HTML", bg: "bg-orange-100 dark:bg-orange-950",text: "text-orange-700 dark:text-orange-300",border: "border-orange-300 dark:border-orange-800" },
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
