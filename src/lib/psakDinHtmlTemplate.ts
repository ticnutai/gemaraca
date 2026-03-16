import type { ParsedPsakDin } from './psakDinParser';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2p(text: string): string {
  return text
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<div class="paragraph">${esc(l)}</div>`)
    .join('\n        ');
}

/**
 * Generate a self-contained HTML document from parsed psak din data.
 * Output matches the professional template style with RTL, icons, and sections.
 */
export function generatePsakDinHtml(data: ParsedPsakDin): string {
  const judgesHtml = data.judges.length > 0
    ? `<ul style="list-style-type: none; padding: 0; margin: 0;">
                ${data.judges.map(j => `<li>${esc(j)}</li>`).join('\n                ')}
            </ul>`
    : '';

  const sectionsHtml = data.sections.map(section => {
    const icon = section.type === 'plaintiff-claims' ? '📌'
      : section.type === 'defendant-claims' ? '📌'
      : section.type === 'ruling' ? '✅'
      : section.type === 'decision' ? '✅'
      : section.type === 'summary' ? '📝'
      : section.type === 'facts' ? '📋'
      : '📜';
    
    return `
        <h3 class="subsection-title"><span class="icon">${icon}</span> ${esc(section.title)}</h3>
        ${nl2p(section.content)}`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>פסק דין: ${esc(data.title)}</title>
    <style>
        @font-face {
            font-family: 'David';
            src: url('https://fonts.cdnfonts.com/s/17208/David.woff') format('woff');
            font-weight: normal;
            font-style: normal;
        }
        body {
            font-family: 'David', 'Times New Roman', serif;
            line-height: 1.8;
            color: #333;
            background-color: #f9f9f9;
            margin: 0;
            padding: 20px;
            direction: rtl;
            text-align: right;
        }
        .container {
            max-width: 900px;
            margin: 30px auto;
            background-color: #ffffff;
            border: 1px solid #eee;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.05);
            padding: 40px 60px;
            border-radius: 8px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #D4AF37;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #0B1F5B;
            font-size: 2.8em;
            margin: 0;
            padding-bottom: 10px;
            font-weight: bold;
        }
        .header .logo {
            font-size: 1.2em;
            color: #555;
            margin-top: 5px;
        }
        .section-title {
            color: #0B1F5B;
            font-size: 1.8em;
            margin-top: 35px;
            margin-bottom: 15px;
            border-bottom: 2px solid #D4AF37;
            padding-bottom: 8px;
            font-weight: bold;
        }
        .subsection-title {
            color: #0B1F5B;
            font-size: 1.4em;
            margin-top: 25px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        }
        .details-table td {
            padding: 10px 0;
            border-bottom: 1px dashed #eee;
            vertical-align: top;
        }
        .details-table td:first-child {
            font-weight: bold;
            width: 150px;
            color: #0B1F5B;
        }
        .paragraph {
            margin-bottom: 15px;
            text-align: justify;
        }
        .bold-text {
            font-weight: bold;
            color: #0B1F5B;
        }
        .icon {
            margin-left: 8px;
            color: #D4AF37;
        }
        .divider {
            border: none;
            border-top: 1px solid #eee;
            margin: 30px 0;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #777;
            font-size: 0.9em;
        }
        .signature {
            text-align: center;
            margin-top: 40px;
            font-weight: bold;
            color: #0B1F5B;
        }
        .signature div {
            margin-top: 10px;
        }
        .psakim-link {
            text-align: center;
            margin-top: 30px;
            font-size: 1.1em;
        }
        .psakim-link a {
            color: #0B1F5B;
            text-decoration: none;
            font-weight: bold;
        }
        .psakim-link a:hover {
            text-decoration: underline;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; border: none; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏛️ בית דין רבני ⚖️</div>
            <h1>פסק דין</h1>
            ${data.caseNumber ? `<div style="font-size: 1.1em; color: #555;">תיק מס' ${esc(data.caseNumber)}</div>` : ''}
        </div>

        <h2 class="section-title"><span class="icon">📋</span> פרטי התיק</h2>
        <table class="details-table">
            <tr>
                <td><span class="icon">📌</span> כותרת:</td>
                <td>${esc(data.title)}</td>
            </tr>
            <tr>
                <td><span class="icon">🏛️</span> בית דין:</td>
                <td>${esc(data.court)}</td>
            </tr>
            <tr>
                <td><span class="icon">📅</span> תאריך:</td>
                <td>${esc(data.date)}${data.year ? ` (${data.year})` : ''}</td>
            </tr>
            ${data.sourceId ? `<tr>
                <td><span class="icon">🆔</span> מזהה תיק:</td>
                <td>${esc(data.sourceId)}</td>
            </tr>` : ''}
            ${data.sourceUrl ? `<tr>
                <td><span class="icon">🔗</span> קישור מקור:</td>
                <td><a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color: #0B1F5B;">${esc(data.sourceUrl)}</a></td>
            </tr>` : ''}
        </table>

        ${data.summary ? `
        <h2 class="section-title"><span class="icon">📝</span> תקציר</h2>
        <div class="paragraph">${esc(data.summary)}</div>
        ` : ''}

        <hr class="divider">

        <h2 class="section-title"><span class="icon">📜</span> טקסט מלא של פסק הדין</h2>

        <div style="text-align: center; margin-bottom: 20px; font-weight: bold; font-size: 1.1em;">
            בס"ד
        </div>
        ${data.sourceId ? `<div style="text-align: center; margin-bottom: 20px;">מס. סידורי:${esc(data.sourceId)}</div>` : ''}
        <h3 style="text-align: center; color: #0B1F5B; font-size: 1.6em; margin-bottom: 25px;">
            ${esc(data.title)}
        </h3>

        <div style="font-size: 1.1em; margin-bottom: 20px;">
            <span class="bold-text">שם בית דין:</span> ${esc(data.court)}
        </div>
        ${judgesHtml ? `<div style="font-size: 1.1em; margin-bottom: 20px;">
            <span class="bold-text">דיינים:</span>
            ${judgesHtml}
        </div>` : ''}
        ${data.topics ? `<div style="font-size: 1.1em; margin-bottom: 20px;">
            <span class="bold-text">נושאים הנידונים בפסק:</span> ${esc(data.topics)}
        </div>` : ''}
        <div style="font-size: 1.1em; margin-bottom: 20px;">
            <span class="bold-text">תאריך:</span> ${esc(data.date)}
        </div>
        ${data.caseNumber ? `<div style="font-size: 1.1em; margin-bottom: 20px;">
            <span class="bold-text">תיק מספר:</span> ${esc(data.caseNumber)}
        </div>` : ''}

        ${sectionsHtml}

        ${data.sections.length === 0 ? `
        <div style="font-size: 1.1em; line-height: 2;">
            ${nl2p(data.rawText)}
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 40px; font-style: italic; color: #555;">
            'והאמת והשלום אהבו'
        </div>

        ${data.judges.length > 0 ? `<div class="signature">
            ${data.judges.map(j => `<div>${esc(j)}</div>`).join('\n            ')}
        </div>` : ''}

        ${data.sourceUrl ? `<div class="psakim-link">
            בכדי להתייחס לפסק דין זה,
            <a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener noreferrer">לחץ כאן</a>
        </div>` : ''}

        <div class="footer">
            <hr class="divider">
            מעוצב אוטומטית | &copy; ${new Date().getFullYear()} כל הזכויות שמורות
        </div>
    </div>
</body>
</html>`;
}
