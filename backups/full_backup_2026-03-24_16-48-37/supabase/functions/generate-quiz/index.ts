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

    const { masechet, daf, textHe, textEn, difficulty, numQuestions } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = Math.min(numQuestions || 5, 10);
    const level = difficulty || "בינוני";

    const prompt = `צור ${count} שאלות מבחן מתוך הסוגיה הבאה.

מסכת: ${masechet || "כללי"}
דף: ${daf || ""}
רמת קושי: ${level}

טקסט:
${textHe || ""}
${textEn ? `\nתרגום: ${textEn}` : ""}

לכל שאלה, ספק בפורמט JSON:
[
  {
    "question": "השאלה",
    "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
    "correctIndex": 0,
    "explanation": "הסבר קצר למה זו התשובה הנכונה",
    "difficulty": "קל/בינוני/קשה"
  }
]

שאלות צריכות לכלול:
- מי אמר מה (תנאים/אמוראים)
- מחלוקות וסברות
- מושגים הלכתיים
- הבנת הסוגיה
- יישום מעשי

חשוב: החזר רק JSON תקין, ללא טקסט נוסף.`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 3000,
        temperature: 0.5,
        messages: [
          { role: "system", content: "אתה יוצר שאלות מבחן על תלמוד בבלי. תמיד החזר JSON תקין בלבד ללא markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";

    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const questions = JSON.parse(content);

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
