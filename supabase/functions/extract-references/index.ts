import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { TRACTATE_NAMES as TRACTATES, ABBREVIATIONS, GEMATRIA, parseHebrewNumber } from "../_shared/masechtotData.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function numberToHebrewLetter(n: number): string {
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת"];
  if (n <= 0 || n > 500) return String(n);
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  if (t === 1 && u === 5) return hundreds[h] + "ט״ו";
  if (t === 1 && u === 6) return hundreds[h] + "ט״ז";
  let result = hundreds[h] + tens[t] + units[u];
  if (result.length > 1) {
    result = result.slice(0, -1) + "״" + result.slice(-1);
  } else {
    result += "׳";
  }
  return result;
}

interface Reference {
  tractate: string;
  daf: string;
  amud: string | null;
  raw: string;
  normalized: string;
  confidence: string;
  context_snippet?: string;
  source: string;
}

function extractWithRegex(text: string): Reference[] {
  const refs: Reference[] = [];
  const seen = new Set<string>();

  const allNames = [...TRACTATES, ...Object.keys(ABBREVIATIONS)];
  allNames.sort((a, b) => b.length - a.length);
  const escapedNames = allNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tractatePattern = escapedNames.join("|");

  const patterns = [
    // מסכת/מס' X דף Y עמוד א/ב
    new RegExp(`(?:מסכת|מס['׳"])\\s*(${tractatePattern})\\s+דף\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+עמוד\\s+([אב])['׳]?`, "g"),
    // X דף Y ע"א / ע"ב (double-quote, smart-quote, gershayim, geresh variants)
    new RegExp(`(${tractatePattern})\\s+דף\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+ע[""״'׳]([אב])`, "g"),
    // X דף Y עמוד א/ב
    new RegExp(`(${tractatePattern})\\s+דף\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+עמוד\\s+([אב])['׳]?`, "g"),
    // X דף Y עמ' א/ב (abbreviated עמוד)
    new RegExp(`(${tractatePattern})\\s+דף\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+עמ['׳]\\s*([אב])['׳]?`, "g"),
    // X דף Y צד א/ב ("side" notation)
    new RegExp(`(${tractatePattern})\\s+דף\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+צד\\s+([אב])['׳]?`, "g"),
    // X דף Y (no amud) — negative lookahead excludes all amud indicators
    new RegExp(`(${tractatePattern})\\s+דף\\s+([א-תך-ץ]+['׳"]?|\\d+)(?!\\s*(?:עמוד|עמ['׳]|ע[""״'׳]|צד))`, "g"),
    // X Y. / Y: (dot=amud a, colon=amud b)
    new RegExp(`(${tractatePattern})\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s*([.:])`, "g"),
    // X Y ע"א/ע"ב (without דף)
    new RegExp(`(${tractatePattern})\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+ע[""״'׳]([אב])`, "g"),
    // X Y עמ' א/ב (without דף, abbreviated)
    new RegExp(`(${tractatePattern})\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+עמ['׳]\\s*([אב])['׳]?`, "g"),
    // X Y צד א/ב (without דף)
    new RegExp(`(${tractatePattern})\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+צד\\s+([אב])['׳]?`, "g"),
    // X Y, א/ב
    new RegExp(`(${tractatePattern})\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s*,\\s*([אב])`, "g"),
    // X Y א/ב (direct letter, no Hebrew letter after)
    new RegExp(`(${tractatePattern})\\s+([א-תך-ץ]+['׳"]?|\\d+)\\s+([אב])(?![א-ת])`, "g"),
  ];

  for (const regex of patterns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      let tractName = m[1].trim();
      const dafRaw = m[2];
      const amudIndicator = m[3] || null;

      if (ABBREVIATIONS[tractName]) {
        tractName = ABBREVIATIONS[tractName];
      }

      if (!TRACTATES.includes(tractName)) continue;

      const dafNum = parseHebrewNumber(dafRaw);
      if (!dafNum || dafNum < 2 || dafNum > 200) continue;

      let amud: string | null = null;
      if (amudIndicator === "א" || amudIndicator === "a" || amudIndicator === ".") {
        amud = "a";
      } else if (amudIndicator === "ב" || amudIndicator === "b" || amudIndicator === ":") {
        amud = "b";
      }

      const dafHeb = numberToHebrewLetter(dafNum);
      const normalized = `${tractName} ${dafHeb}${amud === "a" ? "." : amud === "b" ? ":" : ""}`;

      if (seen.has(normalized)) continue;
      seen.add(normalized);

      let contextSnippet = '';
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      const lineStart = text.lastIndexOf('\n', matchStart);
      const lineEnd = text.indexOf('\n', matchEnd);

      if (lineStart !== -1 || lineEnd !== -1) {
        const start = lineStart === -1 ? 0 : lineStart + 1;
        const end = lineEnd === -1 ? text.length : lineEnd;
        contextSnippet = text.slice(start, end).trim();
      } else {
        const before = text.slice(Math.max(0, matchStart - 200), matchStart);
        const sentenceStart = Math.max(
          before.lastIndexOf('.'),
          before.lastIndexOf(':'),
          before.lastIndexOf(';'),
        );
        const ctxStart = sentenceStart !== -1
          ? Math.max(0, matchStart - 200) + sentenceStart + 1
          : Math.max(0, matchStart - 80);

        const after = text.slice(matchEnd, Math.min(text.length, matchEnd + 200));
        const sentenceEnd = Math.min(
          ...[after.indexOf('.'), after.indexOf(':'), after.indexOf(';')]
            .filter(i => i !== -1)
            .concat([80])
        );
        const ctxEnd = Math.min(text.length, matchEnd + sentenceEnd + 1);
        contextSnippet = text.slice(ctxStart, ctxEnd).trim();
      }

      if (contextSnippet.length > 300) {
        const refInCtx = contextSnippet.indexOf(m[0].trim());
        if (refInCtx !== -1) {
          const start = Math.max(0, refInCtx - 120);
          const end = Math.min(contextSnippet.length, refInCtx + m[0].length + 120);
          contextSnippet = (start > 0 ? '...' : '') + contextSnippet.slice(start, end).trim() + (end < contextSnippet.length ? '...' : '');
        } else {
          contextSnippet = contextSnippet.slice(0, 300) + '...';
        }
      }

      refs.push({
        tractate: tractName,
        daf: String(dafNum),
        amud,
        raw: m[0].trim(),
        normalized,
        confidence: amud ? "high" : "medium",
        context_snippet: contextSnippet,
        source: "regex",
      });
    }
  }

  return refs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, documentId, useAI } = await req.json();
    if (!text || !documentId) {
      return new Response(
        JSON.stringify({ error: "text and documentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const regexRefs = extractWithRegex(text);

    const aiRefs: Reference[] = [];
    if (useAI) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const systemPrompt = `אתה מומחה בתלמוד בבלי. מצא את כל ההפניות למסכתות, דפים ועמודים בטקסט הנתון.
רשימת המסכתות: ${TRACTATES.join(", ")}.
קיצורים נפוצים: ב"ק=בבא קמא, ב"מ=בבא מציעא, ב"ב=בבא בתרא, ר"ה=ראש השנה, ע"ז=עבודה זרה.
זהה גם את העמוד (amud) כשמופיע: ע"א=amud "a", ע"ב=amud "b", נקודה=amud "a", נקודתיים=amud "b".
החזר JSON בלבד, ללא markdown.`;

          const userPrompt = `מצא הפניות תלמודיות בטקסט. ציין מסכת, דף (מספר ערבי), עמוד ("a"/"b"/null), טקסט מקורי, ורמת ביטחון.

טקסט:
${text.slice(0, 6000)}

${regexRefs.length > 0 ? `הפניות regex:\n${JSON.stringify(regexRefs.map(r => ({ normalized: r.normalized, amud: r.amud })))}` : ""}

JSON format:
{"references": [{"tractate": "שם מסכת", "daf": "30", "amud": "a"|"b"|null, "raw": "טקסט מקורי", "normalized": "מסכת ל׳.", "confidence": "high"|"medium"|"low"}]}`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.1,
            }),
          });

          if (response.ok) {
            const aiData = await response.json();
            const rawText = aiData.choices?.[0]?.message?.content ?? "";
            const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
            try {
              const parsed = JSON.parse(cleaned);
              if (parsed.references?.length) {
                const regexNormalized = new Set(regexRefs.map(r => r.normalized));
                for (const ref of parsed.references) {
                  if (ref.tractate && ref.daf && TRACTATES.includes(ref.tractate)) {
                    const dafNum = parseInt(ref.daf, 10);
                    if (!isNaN(dafNum) && dafNum >= 2 && dafNum <= 200) {
                      const dafHeb = numberToHebrewLetter(dafNum);
                      const normalizedRef = `${ref.tractate} ${dafHeb}${ref.amud === "a" ? "." : ref.amud === "b" ? ":" : ""}`;
                      if (!regexNormalized.has(normalizedRef)) {
                        let ctxSnippet = '';
                        if (ref.raw && text.includes(ref.raw)) {
                          const idx = text.indexOf(ref.raw);
                          const ls = text.lastIndexOf('\n', idx);
                          const le = text.indexOf('\n', idx + ref.raw.length);
                          const start = ls === -1 ? Math.max(0, idx - 80) : ls + 1;
                          const end = le === -1 ? Math.min(text.length, idx + ref.raw.length + 80) : le;
                          ctxSnippet = text.slice(start, end).trim().slice(0, 300);
                        }
                        aiRefs.push({
                          tractate: ref.tractate,
                          daf: String(dafNum),
                          amud: ref.amud || null,
                          raw: ref.raw || normalizedRef,
                          normalized: normalizedRef,
                          confidence: ref.confidence || "medium",
                          context_snippet: ctxSnippet || undefined,
                          source: "ai",
                        });
                      }
                    }
                  }
                }
              }
            } catch {
              console.error("Failed to parse AI response");
            }
          }
        } catch (e) {
          console.error("AI extraction error:", e);
        }
      }
    }

    const allRefs = [...regexRefs, ...aiRefs];

    return new Response(
      JSON.stringify({ references: allRefs, documentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-references error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
