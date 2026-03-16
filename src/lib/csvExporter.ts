/**
 * Export psakei din list as CSV with metadata
 */
export function exportPsakimToCsv(
  items: Array<{
    title: string;
    court: string;
    year: number;
    case_number?: string | null;
    tags?: string[] | null;
    summary?: string;
  }>,
  filename?: string
) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel Hebrew support
  const headers = ['כותרת', 'בית דין', 'שנה', 'מספר תיק', 'תגיות', 'תקציר'];

  const escapeField = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = items.map((item) => [
    escapeField(item.title || ''),
    escapeField(item.court || ''),
    String(item.year || ''),
    escapeField(item.case_number || ''),
    escapeField((item.tags || []).join('; ')),
    escapeField((item.summary || '').substring(0, 200)),
  ]);

  const csvContent = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `psakei-din-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
