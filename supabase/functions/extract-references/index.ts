import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { TRACTATE_NAMES as TRACTATES, ABBREVIATIONS, GEMATRIA, parseHebrewNumber, MASECHTOT } from "../_shared/masechtotData.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// maxDaf lookup
const MAX_DAF: Record<string, number> = Object.fromEntries(MASECHTOT.map(m => [m.name, m.maxDaf]));

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

interface ConfidenceFactors {
  base_specificity: number;
  frequency_boost: number;
  context_type: string;
  context_boost: number;
  source_agreement: boolean;
  agreement_boost: number;
  proximity_boost: number;
  daf_range_valid: boolean;
  range_boost: number;
  total: number;
  capped: number;
}

interface Reference {
  tractate: string;
  daf: string;
  amud: string | null;
  raw: string;
  normalized: string;
  confidence: string;
  confidence_score: number;
  confidence_factors: ConfidenceFactors;
  context_snippet?: string;
  source: string;
}

// ── Context keywords for scoring ──
const GEMARA_DIRECT_KEYWORDS = [
  "אמר רב", "אמר רבא", "אמר רבי", "אמר רבה", "אמר אביי",
  "תנן", "תנו רבנן", "תנא", "במתניתין", "בגמרא", "גרסינן",
  "איתמר", "דאמרינן", "כדאיתא", "דאמר", "דתנן", "דתניא",
  "אמרינן", "מתני", "שנאמר", "דכתיב", "אמר שמואל", "דגרסינן",
  "סוגיית", "הסוגיא", "הגמרא", "בסוגיא",
];

const MEFARESH_KEYWORDS = [
  'רש"י', 'רש״י', "רשי", "תוספות", "תוס'", "תוס׳",
  "הרמב\"ם", "הרמב״ם", "רמב\"ם", "רמב״ם",
  "הרשב\"א", "הרשב״א", "הרא\"ש", "הרא״ש",
  "ר\"ן", "ר״ן", "הר\"ן", "רבינו חננאל", "ר\"ח",
  "מהרש\"א", "מהרש״א", "ריטב\"א", "ריטב״א",
  "הרי\"ף", "הרי״ף", "רי\"ף", "רי״ף",
  "הרמב\"ן", "הרמב״ן", "המאירי", "נימוקי יוסף",
];

const DIRECT_QUOTE_PATTERNS = [
  /דאמר\s+[א-ת]/,
  /[""][^""]{5,60}[""]/, // text in quotes nearby
  /אמר\s+.{2,20}\s+דאמר/,
];

interface RawMatch {
  tractate: string;
  daf: number;
  amud: string | null;
  raw: string;
  normalized: string;
  matchIndex: number;
  contextSnippet: string;
  hasAmud: boolean;
}

function extractWithRegex(text: string): Reference[] {
  const rawMatches: RawMatch[] = [];
  // Track all occurrences (including duplicates) for frequency counting
  const frequencyMap = new Map<string, number>(); // normalized -> count of all matches
  const matchPositions = new Map<string, number[]>(); // normalized -> character positions

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

  const seen = new Set<string>();

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

      // Count ALL occurrences for frequency (even duplicates)
      frequencyMap.set(normalized, (frequencyMap.get(normalized) || 0) + 1);
      if (!matchPositions.has(normalized)) matchPositions.set(normalized, []);
      matchPositions.get(normalized)!.push(m.index);

      // Only create one reference per normalized
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      // Extract context snippet
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

      rawMatches.push({
        tractate: tractName,
        daf: dafNum,
        amud,
        raw: m[0].trim(),
        normalized,
        matchIndex: m.index,
        contextSnippet,
        hasAmud: amud !== null,
      });
    }
  }

  // Also count tractate-level frequency
  const tractateFreq = new Map<string, number>();
  for (const rm of rawMatches) {
    tractateFreq.set(rm.tractate, (tractateFreq.get(rm.tractate) || 0) + 1);
  }

  // Now compute scores for each unique reference
  const refs: Reference[] = rawMatches.map(rm => {
    const factors = computeConfidenceScore(rm, text, frequencyMap, matchPositions, tractateFreq);
    return {
      tractate: rm.tractate,
      daf: String(rm.daf),
      amud: rm.amud,
      raw: rm.raw,
      normalized: rm.normalized,
      confidence: scoreToLevel(factors.capped),
      confidence_score: factors.capped,
      confidence_factors: factors,
      context_snippet: rm.contextSnippet,
      source: "regex",
    };
  });

  return refs;
}

function computeConfidenceScore(
  rm: RawMatch,
  text: string,
  frequencyMap: Map<string, number>,
  matchPositions: Map<string, number[]>,
  tractateFreq: Map<string, number>,
): ConfidenceFactors {
  // 1. Base specificity
  const base_specificity = rm.hasAmud ? 60 : 45;

  // 2. Frequency boost
  const occurrences = frequencyMap.get(rm.normalized) || 1;
  let frequency_boost = 0;
  if (occurrences >= 4) frequency_boost = 20;
  else if (occurrences >= 2) frequency_boost = 10;
  // Tractate-level frequency bonus
  const tractCount = tractateFreq.get(rm.tractate) || 0;
  if (tractCount >= 3 && occurrences < 2) frequency_boost += 5;

  // 3. Context analysis - check ~200 chars around the match
  const pos = rm.matchIndex;
  const contextWindow = text.slice(Math.max(0, pos - 200), Math.min(text.length, pos + rm.raw.length + 200));

  let context_type = "none";
  let context_boost = 0;

  // Check for direct quote patterns first (highest value)
  const hasDirectQuote = DIRECT_QUOTE_PATTERNS.some(p => p.test(contextWindow));
  if (hasDirectQuote) {
    context_type = "direct_quote";
    context_boost = 20;
  } else {
    // Check gemara direct keywords
    const hasGemara = GEMARA_DIRECT_KEYWORDS.some(kw => contextWindow.includes(kw));
    if (hasGemara) {
      context_type = "gemara_direct";
      context_boost = 15;
    } else {
      // Check mefaresh keywords
      const hasMefaresh = MEFARESH_KEYWORDS.some(kw => contextWindow.includes(kw));
      if (hasMefaresh) {
        context_type = "mefaresh";
        context_boost = 5;
      }
    }
  }

  // 4. Source agreement — will be updated post-AI, default false
  const source_agreement = false;
  const agreement_boost = 0;

  // 5. Proximity cluster — other refs from same tractate within 500 chars
  let proximity_boost = 0;
  const allPositions = matchPositions.get(rm.normalized) || [];
  // Check if any OTHER normalized ref from same tractate is nearby
  for (const [norm, positions] of matchPositions.entries()) {
    if (norm === rm.normalized) continue;
    // Check if this is same tractate
    if (!norm.startsWith(rm.tractate + " ")) continue;
    for (const otherPos of positions) {
      if (Math.abs(otherPos - pos) <= 500) {
        proximity_boost = 10;
        break;
      }
    }
    if (proximity_boost > 0) break;
  }

  // 6. Daf range validation
  const maxDaf = MAX_DAF[rm.tractate];
  const daf_range_valid = maxDaf ? (rm.daf >= 2 && rm.daf <= maxDaf) : true;
  const range_boost = daf_range_valid ? 5 : -20;

  const total = base_specificity + frequency_boost + context_boost + agreement_boost + proximity_boost + range_boost;
  const capped = Math.max(0, Math.min(100, total));

  return {
    base_specificity,
    frequency_boost,
    context_type,
    context_boost,
    source_agreement,
    agreement_boost,
    proximity_boost,
    daf_range_valid,
    range_boost,
    total,
    capped,
  };
}

function scoreToLevel(score: number): string {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  if (score >= 30) return "low";
  return "very_low";
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
                        const aiConfidence = ref.confidence || "medium";
                        const aiScore = aiConfidence === "high" ? 75 : aiConfidence === "medium" ? 55 : 35;
                        const maxDaf = MAX_DAF[ref.tractate];
                        const dafValid = maxDaf ? (dafNum >= 2 && dafNum <= maxDaf) : true;
                        const aiFactors: ConfidenceFactors = {
                          base_specificity: ref.amud ? 60 : 45,
                          frequency_boost: 0,
                          context_type: "ai_detected",
                          context_boost: 10,
                          source_agreement: false,
                          agreement_boost: 0,
                          proximity_boost: 0,
                          daf_range_valid: dafValid,
                          range_boost: dafValid ? 5 : -20,
                          total: aiScore,
                          capped: Math.min(100, Math.max(0, aiScore)),
                        };
                        aiRefs.push({
                          tractate: ref.tractate,
                          daf: String(dafNum),
                          amud: ref.amud || null,
                          raw: ref.raw || normalizedRef,
                          normalized: normalizedRef,
                          confidence: scoreToLevel(aiFactors.capped),
                          confidence_score: aiFactors.capped,
                          confidence_factors: aiFactors,
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

    // Apply source agreement boost: if both regex and AI found the same reference
    if (aiRefs.length > 0 && regexRefs.length > 0) {
      const aiNormalized = new Set(aiRefs.map(r => r.normalized));
      for (const ref of allRefs) {
        if (ref.source === "regex" && aiNormalized.has(ref.normalized)) {
          ref.confidence_factors.source_agreement = true;
          ref.confidence_factors.agreement_boost = 15;
          ref.confidence_factors.total += 15;
          ref.confidence_factors.capped = Math.min(100, Math.max(0, ref.confidence_factors.total));
          ref.confidence = scoreToLevel(ref.confidence_factors.capped);
          ref.confidence_score = ref.confidence_factors.capped;
        }
      }
    }

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
