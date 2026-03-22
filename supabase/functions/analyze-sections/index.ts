import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SECTION_TYPES = [
  "summary",
  "facts",
  "plaintiff-claims",
  "defendant-claims",
  "discussion",
  "reasoning",
  "ruling",
  "decision",
  "conclusion",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { text, documentId } = await req.json();

    if (!text || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ sections: [], case_summary: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Truncate to avoid token limits
    const truncated = text.length > 15000 ? text.substring(0, 15000) : text;

    const systemPrompt = `אתה מומחה בניתוח פסקי דין הלכתיים ומשפטיים. תפקידך לזהות ולחלץ את הסעיפים המרכזיים מתוך פסק הדין.

סוגי הסעיפים שעליך לזהות:
- summary: תקציר / תמצית פסק הדין
- facts: עובדות המקרה / רקע עובדתי / עובדות מוסכמות
- plaintiff-claims: טענות התובע / המבקש
- defendant-claims: טענות הנתבע / המשיב
- discussion: דיון הלכתי / משפטי
- reasoning: נימוקי פסק הדין / הנמקה
- ruling: פסק הדין / פסיקה
- decision: החלטה / הכרעה
- conclusion: סיכום / סוף דבר

כללים:
1. חלץ רק סעיפים שקיימים בפועל בטקסט
2. עבור כל סעיף, ציין את הכותרת המקורית כפי שמופיעה בטקסט
3. חלץ את תוכן הסעיף (עד 2000 תווים)
4. אם אין סעיפים ברורים, נסה לזהות חלקים לוגיים בטקסט
5. צור גם תקציר קצר (2-3 משפטים) של המקרה`;

    const userPrompt = `נתח את פסק הדין הבא וחלץ את הסעיפים המרכזיים:

${truncated}

החזר JSON בפורמט הבא בלבד:
{
  "case_summary": "תקציר קצר של המקרה ב-2-3 משפטים",
  "sections": [
    {
      "type": "facts",
      "title": "הכותרת המקורית מהטקסט",
      "content": "תוכן הסעיף"
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "מגבלת בקשות, נסה שוב מאוחר יותר" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and sanitize sections
    const validSections = (parsed.sections || [])
      .filter((s: { type: string; content: string }) =>
        SECTION_TYPES.includes(s.type as typeof SECTION_TYPES[number]) &&
        s.content && s.content.length > 10
      )
      .map((s: { type: string; title: string; content: string }, i: number) => ({
        type: s.type,
        title: s.title || s.type,
        content: s.content.length > 2000 ? s.content.substring(0, 2000) + "..." : s.content,
        order: i,
      }));

    console.log(`analyze-sections: doc=${documentId}, found ${validSections.length} sections via AI`);

    return new Response(
      JSON.stringify({
        sections: validSections,
        case_summary: parsed.case_summary || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-sections error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "שגיאה בניתוח",
        sections: [],
        case_summary: "",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
