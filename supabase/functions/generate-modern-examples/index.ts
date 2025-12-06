import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gemaraText, sugyaTitle, dafYomi, masechet } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Generating modern examples for ${masechet} ${dafYomi} - ${sugyaTitle}`);

    const systemPrompt = `אתה מומחה להלכה ותלמוד שמסביר מושגים עתיקים במונחים מודרניים.
תפקידך ליצור דוגמאות מודרניות ורלוונטיות שממחישות את היסודות ההלכתיים מהגמרא.

הנחיות:
1. צור 3-4 דוגמאות מודרניות שממחישות את היסוד ההלכתי
2. כל דוגמה צריכה להיות מציאותית ורלוונטית לימינו
3. הסבר איך הדוגמה המודרנית מתקשרת ליסוד מהגמרא
4. השתמש בשפה פשוטה וברורה
5. הוסף סיכום קצר של היסוד ההלכתי

החזר את התשובה בפורמט JSON:
{
  "principle": "היסוד ההלכתי המרכזי בקצרה",
  "examples": [
    {
      "title": "כותרת הדוגמה",
      "scenario": "תיאור המקרה המודרני",
      "connection": "הקשר ליסוד מהגמרא",
      "icon": "אימוג'י מתאים"
    }
  ],
  "practicalSummary": "סיכום הלכה למעשה קצר"
}`;

    const userPrompt = `בבקשה צור דוגמאות מודרניות עבור:

מסכת: ${masechet}
דף: ${dafYomi}
נושא: ${sugyaTitle}

טקסט הגמרא:
${gemaraText?.substring(0, 2000) || 'לא זמין'}

צור דוגמאות שממחישות את היסודות ההלכתיים לקוראים בני זמננו.`;

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
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI response received:", content?.substring(0, 200));

    // Parse JSON from response
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // Create a fallback structure
      result = {
        principle: "היסוד ההלכתי מהסוגיה",
        examples: [{
          title: "דוגמה מודרנית",
          scenario: content || "לא הצלחנו ליצור דוגמה",
          connection: "קשר לגמרא",
          icon: "💡"
        }],
        practicalSummary: "יש לעיין בסוגיה לפרטים נוספים"
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-modern-examples:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
