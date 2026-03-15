import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, masechet, daf, textHe, textEn } = await req.json();

    if (!textHe && !textEn) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `אתה מומחה לתלמוד ומשפט עברי. סכם את הסוגיה הבאה באופן מקצועי ובהיר.

מסכת: ${masechet || "לא ידוע"}
דף: ${daf || "לא ידוע"}
כותרת: ${title || "סוגיה"}

טקסט הגמרא:
${textHe || ""}

${textEn ? `תרגום:\n${textEn}` : ""}

אנא ספק:
1. **תקציר הסוגיה** — 2-3 משפטים שמסכמים את הנושא המרכזי
2. **נקודות מפתח** — רשימה ממוספרת של 3-6 נקודות עיקריות
3. **מחלוקות** — אם יש מחלוקות, פרט את הדעות
4. **מסקנה/הלכה** — המסקנה העיקרית או ההלכה שנפסקה
5. **מושגים חשובים** — מילים ארמיות/עבריות מרכזיות עם הסבר קצר

כתוב בעברית, בסגנון אקדמי-מקצועי אך נגיש.`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2000,
        temperature: 0.4,
        messages: [
          { role: "system", content: "אתה מומחה לתלמוד בבלי, משנה, הלכה ומשפט עברי. תפקידך לסכם סוגיות בצורה ברורה ומקצועית." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const summary = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
