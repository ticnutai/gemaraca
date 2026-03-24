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

חוק עליון: חובה לכלול את כל הטקסט המקורי מלה במלה! אסור לקצר, לדלג, לסכם או להשמיט שום חלק מהתוכן. כל משפט, כל פסקה, כל ציטוט — חייבים להופיע בפלט. אם הטקסט ארוך — הפלט חייב להיות ארוך בהתאם.

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
11. חזור על זה: אל תשמיט תוכן! כל התוכן המקורי חייב להופיע במלואו!

הפלט חייב להיות HTML תקני בלבד, ללא markdown, ללא \`\`\`html\`\`\`, רק קוד HTML נקי.
ה-HTML צריך להיות self-contained עם כל ה-CSS inline או ב-style tag בתוך ה-HTML.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `עצב את פסק הדין הבא ל-HTML מקצועי ויפה. חשוב מאוד: כלול את כל הטקסט המקורי במלואו, ללא קיצורים או השמטות!\n\n${rawContent}` },
        ],
        temperature: 0.3,
        max_tokens: 65000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI service error: ${response.status}`);
    }

    // Stream the response back to the client using SSE
    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullHtml = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  fullHtml += content;
                  // Send each chunk as SSE event
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }

          // Clean up any markdown code block wrapper from full result
          fullHtml = fullHtml.replace(/^```html?\s*/i, "").replace(/\s*```$/i, "").trim();

          // Send final complete event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, html: fullHtml })}\n\n`));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("beautify-psak-din error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "שגיאה בעיצוב פסק הדין" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
