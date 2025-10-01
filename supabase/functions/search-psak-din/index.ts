import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sugyaId, sugyaTitle, sugyaDescription } = await req.json();
    console.log('Searching for psak din:', { sugyaId, sugyaTitle });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Search using AI for relevant psak din from real sources
    const searchPrompt = `חפש פסקי דין רבניים אמיתיים הקשורים לסוגיה: "${sugyaTitle}"
    
תיאור הסוגיה: ${sugyaDescription}

**חיפוש רק באתרים אלו - בדוק כל אחד בנפרד:**

1. **פסקדין** (www.psakdin.co.il) - אתר פסקי הדין הרבניים הרשמי של מדינת ישראל
   - חפש תחת "פסקי דין" -> הזן מילות חיפוש רלוונטיות
   - דוגמת קישור: https://www.psakdin.co.il/Court/-ביה"ד-הרבני-הגדול-לערעורים
   
2. **שו"ת מקוון** (www.daat.ac.il) - אתר דעת של האקדמיה הלאומית 
   - חפש בספריית השו"ת והפסיקה
   - דוגמת קישור: https://www.daat.ac.il/daat/toshba/...

3. **ספריא** (www.sefaria.org.il) - ספרייה דיגיטלית של טקסטים יהודיים
   - חפש תשובות הלכתיות מפוסקים מודרניים
   - דוגמת קישור: https://www.sefaria.org.il/...

4. **המכון לחקר המשפט העברי** (mishpat.ac.il) - אוניברסיטת בר אילן
   - מאגר פסקי דין רבניים
   
5. **בתי הדין הרבניים** (www.gov.il) - פסיקת בתי הדין הרבניים
   - דוגמת קישור: https://www.gov.il/he/departments/judicial_decisions/...

**הנחיות קריטיות:**
- אסור להמציא קישורים! רק קישורים שאתה יכול לאמת
- אם אתה לא בטוח בקישור - אל תכלול את התוצאה
- בדוק שכל URL מתחיל ב-https:// ושייך לאחד מהאתרים הרשמיים
- העדף פסקי דין רשמיים על פני שו"ת כלליות

עבור כל פסק דין שאתה מוצא, ספק:
1. כותרת מדויקת של הפסק דין
2. בית הדין / פוסק (רק אם זה פסק דין רשמי או שו"ת מוכר)
3. שנה
4. מספר תיק (חובה לפסקי דין רשמיים)
5. קישור ישיר ומאומת למקור (חובה!)
6. תקציר של הפסק דין (2-3 משפטים)
7. הסבר על הקשר לסוגיה בגמרא
8. תגיות רלוונטיות

החזר עד 3 פסקי דין באיכות גבוהה עם קישורים מאומתים בלבד.

פורמט JSON:
{
  "results": [
    {
      "title": "...",
      "court": "...",
      "year": 2023,
      "caseNumber": "...",
      "sourceUrl": "https://...",
      "summary": "...",
      "connection": "...",
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

    console.log('Calling Lovable AI for search...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "אתה עוזר מומחה בחיפוש פסקי דין רבניים ומקורות הלכתיים. חשוב מאוד: אסור לך להמציא קישורים! רק קישורים אמיתיים ומאומתים לאתרים רשמיים כמו psakdin.co.il, daat.ac.il, sefaria.org.il, gov.il. אם אינך בטוח בקישור - אל תכלול אותו. עדיף פחות תוצאות איכותיות מאשר קישורים שגויים."
          },
          {
            role: "user",
            content: searchPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "חרגת ממגבלת הבקשות. אנא נסה שוב מאוחר יותר." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "יש להוסיף קרדיטים לחשבון Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    console.log('AI response:', content);

    // Parse the JSON response
    let parsedResults;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResults = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ 
          error: "לא הצלחנו לעבד את תוצאות החיפוש",
          details: content 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save results to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const savedResults = [];

    for (const result of parsedResults.results || []) {
      // Skip results without valid URLs
      if (!result.sourceUrl || !result.sourceUrl.startsWith('http')) {
        console.log('Skipping result without valid URL:', result.title);
        continue;
      }

      // Insert psak din
      const { data: psakDin, error: psakError } = await supabase
        .from('psakei_din')
        .insert({
          title: result.title,
          court: result.court,
          year: result.year || new Date().getFullYear(),
          case_number: result.caseNumber,
          source_url: result.sourceUrl,
          summary: result.summary,
          tags: result.tags || [],
        })
        .select()
        .single();

      if (psakError) {
        console.error('Error inserting psak din:', psakError);
        continue;
      }

      // Link to sugya
      const { error: linkError } = await supabase
        .from('sugya_psak_links')
        .insert({
          sugya_id: sugyaId,
          psak_din_id: psakDin.id,
          connection_explanation: result.connection,
          relevance_score: 8, // Default high relevance for AI-found results
        });

      if (linkError) {
        console.error('Error linking psak din to sugya:', linkError);
      } else {
        savedResults.push(psakDin);
      }
    }

    console.log(`Saved ${savedResults.length} psak din results`);

    return new Response(
      JSON.stringify({ 
        success: true,
        count: savedResults.length,
        results: savedResults
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-psak-din:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "שגיאה בחיפוש פסקי דין" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});