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

    const { learningHistory, currentMasechet, recentTopics } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historyText = (learningHistory || [])
      .slice(0, 30)
      .map((h: any) => `${h.masechet} ${h.dafYomi} (${new Date(h.visitedAt).toLocaleDateString("he-IL")})`)
      .join("\n");

    const prompt = `בהתבסס על היסטוריית הלמידה הבאה של התלמיד, המלץ על מה ללמוד הלאה.

היסטוריית למידה אחרונה:
${historyText || "אין היסטוריה עדיין"}

${currentMasechet ? `מסכת נוכחית: ${currentMasechet}` : ""}
${recentTopics ? `נושאים אחרונים: ${recentTopics}` : ""}

אנא ספק:
1. **המשך ישיר** — הדף או הסוגיה הבאה שמומלץ ללמוד (המשך מאיפה שהפסיק)
2. **חזרה מומלצת** — דף קודם שכדאי לחזור עליו (לפי עקרון החזרה המרווחת)
3. **נושא קשור** — מסכת או סוגיה קשורה שתעשיר את ההבנה
4. **הצעה מיוחדת** — סוגיה מעניינת או נושא אקטואלי שקשור למה שלמד

לכל המלצה, תן:
- שם המסכת והדף
- סיבה קצרה להמלצה
- רמת קושי משוערת (קל/בינוני/מתקדם)`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        temperature: 0.6,
        messages: [
          { role: "system", content: "אתה מלמד תלמוד מנוסה. תפקידך להמליץ לתלמידים על מסלול למידה מותאם אישית. תמיד ענה בעברית." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const recommendations = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
