import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { title, court, year, caseNumber, summary, fullText, tags } = await req.json();

    if (!title && !summary && !fullText) {
      return new Response(
        JSON.stringify({ success: false, error: "אין מספיק מידע לעיצוב" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawContent = [
      title && `כותרת: ${title}`,
      court && `בית דין: ${court}`,
      year && `שנה: ${year}`,
      caseNumber && `מספר תיק: ${caseNumber}`,
      tags?.length && `תגיות: ${tags.join(", ")}`,
      summary && `תקציר: ${summary}`,
      fullText && `טקסט מלא:\n${fullText}`,
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `אתה מעצב מסמכים משפטיים מקצועי. תפקידך לקבל טקסט גולמי של פסק דין ולהפוך אותו ל-HTML מעוצב, מקצועי ויפה.

הנחיות עיצוב:
1. השתמש ב-HTML שלם ומעוצב עם CSS inline
2. כיוון RTL (ימין לשמאל) לעברית
3. צור מבנה ברור עם חלוקה לסעיפים: כותרת ראשית, פרטי תיק, תקציר, עובדות המקרה, טענות הצדדים, ניתוח משפטי, פסיקה/החלטה, הערות
4. השתמש בגופן serif (David, Times New Roman)
5. ערכת צבעים מקצועית: כחול כהה (#0B1F5B) לכותרות, זהב (#D4AF37) לקווים מפרידים, רקע לבן עם גוונים עדינים
6. הוסף מספור סעיפים, קווים מפרידים דקורטיביים, ואייקונים יוניקוד (⚖️ 📋 🏛️ 📌 ✅)
7. הבלט מונחים משפטיים חשובים ב-bold או בצבע
8. אם הטקסט לא מפורט מספיק, הרחב ועצב את מה שיש
9. הוסף header מעוצב עם לוגו טקסטואלי ופרטי התיק
10. הוסף footer עם חותמת "מעוצב אוטומטית"

הפלט חייב להיות HTML תקני בלבד, ללא markdown, ללא \`\`\`html\`\`\`, רק קוד HTML נקי.
ה-HTML צריך להיות self-contained עם כל ה-CSS inline או ב-style tag בתוך ה-HTML.`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `עצב את פסק הדין הבא ל-HTML מקצועי ויפה:\n\n${rawContent}` },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content || "";

    // Clean up any markdown code block wrapper
    html = html.replace(/^```html?\s*/i, "").replace(/\s*```$/i, "").trim();

    return new Response(
      JSON.stringify({ success: true, html }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("beautify-psak-din error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "שגיאה בעיצוב פסק הדין" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
