import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gemaraText, sugyaTitle, dafYomi, masechet, sugyaId, forceRegenerate, loadMore, existingCount } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const effectiveSugyaId = sugyaId || `${masechet}-${dafYomi}`.replace(/\s+/g, '-');

    // Handle loadMore request FIRST - generate additional examples only
    if (loadMore) {
      console.log(`Generating more examples for ${masechet} ${dafYomi}, existing: ${existingCount}`);
      
      const loadMoreSystemPrompt = `אתה מומחה להלכה ותלמוד שמסביר מושגים עתיקים במונחים מודרניים.
תפקידך ליצור דוגמאות מודרניות נוספות שממחישות את היסודות ההלכתיים מהגמרא.

הנחיות:
1. צור 2-3 דוגמאות מודרניות **חדשות ושונות** שממחישות את היסוד ההלכתי
2. כל דוגמה צריכה להיות מציאותית ורלוונטית לימינו
3. הימנע מלחזור על דוגמאות קיימות - חפש זוויות וסיטואציות חדשות
4. השתמש בשפה פשוטה וברורה
5. **חשוב מאוד: כתוב את כל התוכן בעברית בלבד! אין להשתמש במילים באנגלית כלל!**
6. השתמש באימוג'י (לא טקסט) עבור האייקונים

החזר את התשובה בפורמט JSON:
{
  "examples": [
    {
      "title": "כותרת הדוגמה",
      "scenario": "תיאור המקרה המודרני",
      "connection": "הקשר ליסוד מהגמרא",
      "icon": "אימוג'י מתאים (לא טקסט)"
    }
  ]
}`;

      const loadMoreUserPrompt = `בבקשה צור דוגמאות מודרניות נוספות עבור:

מסכת: ${masechet}
דף: ${dafYomi}
נושא: ${sugyaTitle}

טקסט הגמרא:
${gemaraText?.substring(0, 2000) || 'לא זמין'}

כבר יש ${existingCount || 0} דוגמאות קיימות. צור 2-3 דוגמאות חדשות ושונות שמציגות זוויות נוספות של הסוגיה.`;

      const loadMoreResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: loadMoreSystemPrompt },
            { role: "user", content: loadMoreUserPrompt }
          ],
        }),
      });

      if (!loadMoreResponse.ok) {
        if (loadMoreResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (loadMoreResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await loadMoreResponse.text();
        console.error("AI gateway error:", loadMoreResponse.status, errorText);
        throw new Error(`AI gateway error: ${loadMoreResponse.status}`);
      }

      const loadMoreData = await loadMoreResponse.json();
      const loadMoreContent = loadMoreData.choices?.[0]?.message?.content;
      
      console.log("Load more AI response received");

      let loadMoreResult;
      try {
        const jsonMatch = loadMoreContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : loadMoreContent.trim();
        loadMoreResult = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse load more response:", parseError);
        loadMoreResult = {
          examples: [{
            title: "דוגמה נוספת",
            scenario: loadMoreContent || "לא הצלחנו ליצור דוגמה",
            connection: "קשר לגמרא",
            icon: "💡"
          }]
        };
      }

      console.log(`Returning ${loadMoreResult.examples?.length || 0} new examples`);
      return new Response(JSON.stringify({ examples: loadMoreResult.examples }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we already have cached examples (unless forcing regeneration)
    if (!forceRegenerate) {
      const { data: existing, error: fetchError } = await supabase
        .from('modern_examples')
        .select('*')
        .eq('sugya_id', effectiveSugyaId)
        .maybeSingle();

      if (existing && !fetchError) {
        console.log(`Found cached examples for ${effectiveSugyaId}`);
        return new Response(JSON.stringify({
          principle: existing.principle,
          examples: existing.examples,
          practicalSummary: existing.practical_summary,
          cached: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
6. **חשוב מאוד: כתוב את כל התוכן בעברית בלבד! אין להשתמש במילים באנגלית כלל!**
7. השתמש באימוג'י (לא טקסט) עבור האייקונים

החזר את התשובה בפורמט JSON:
{
  "principle": "היסוד ההלכתי המרכזי בקצרה",
  "examples": [
    {
      "title": "כותרת הדוגמה",
      "scenario": "תיאור המקרה המודרני",
      "connection": "הקשר ליסוד מהגמרא",
      "icon": "אימוג'י מתאים (לא טקסט)"
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

    // Save to database
    const { error: upsertError } = await supabase
      .from('modern_examples')
      .upsert({
        sugya_id: effectiveSugyaId,
        masechet: masechet,
        daf_yomi: dafYomi,
        principle: result.principle,
        examples: result.examples,
        practical_summary: result.practicalSummary
      }, { onConflict: 'sugya_id' });

    if (upsertError) {
      console.error("Error saving to database:", upsertError);
    } else {
      console.log(`Saved examples to database for ${effectiveSugyaId}`);
    }

    return new Response(JSON.stringify({ ...result, cached: false }), {
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