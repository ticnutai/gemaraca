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
   
2. **דין תורה** (www.dintorha.co.il) - מאגר פסקי דין רבניים ושו"ת
   - חפש במאגר פסקי הדין והשאלות והתשובות
   - דוגמת קישור: https://www.dintorha.co.il/...
   
3. **שו"ת מקוון** (www.daat.ac.il) - אתר דעת של האקדמיה הלאומית 
   - חפש בספריית השו"ת והפסיקה
   - דוגמת קישור: https://www.daat.ac.il/daat/toshba/...

4. **ספריא** (www.sefaria.org.il) - ספרייה דיגיטלית של טקסטים יהודיים
   - חפש תשובות הלכתיות מפוסקים מודרניים
   - דוגמת קישור: https://www.sefaria.org.il/...

5. **המכון לחקר המשפט העברי** (mishpat.ac.il) - אוניברסיטת בר אילן
   - מאגר פסקי דין רבניים
   
6. **בתי הדין הרבניים** (www.gov.il) - פסיקת בתי הדין הרבניים
   - דוגמת קישור: https://www.gov.il/he/departments/judicial_decisions/...

**הנחיות קריטיות:**
- חובה להחזיר תשובה בפורמט JSON בלבד!
- אסור להמציא קישורים! רק קישורים שאתה יכול לאמת
- אם אתה לא בטוח בקישור - אל תכלול את התוצאה
- בדוק שכל URL מתחיל ב-https:// ושייך לאחד מהאתרים הרשמיים
- העדף פסקי דין רשמיים על פני שו"ת כלליות
- אם לא מצאת תוצאות - החזר מערך ריק

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

**חשוב: החזר רק JSON תקין, ללא טקסט נוסף!**

פורמט JSON חובה:
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
    console.log('Search prompt length:', searchPrompt.length);
    
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
            content: "אתה עוזר מומחה בחיפוש פסקי דין רבניים ומקורות הלכתיים. חשוב מאוד: אסור לך להמציא קישורים! רק קישורים אמיתיים ומאומתים לאתרים רשמיים כמו psakdin.co.il, dintorha.co.il, daat.ac.il, sefaria.org.il, gov.il. אם אינך בטוח בקישור - אל תכלול אותו. עדיף פחות תוצאות איכותיות מאשר קישורים שגויים. החזר תמיד JSON תקין בלבד ללא טקסט הסבר נוסף!"
          },
          {
            role: "user",
            content: searchPrompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    console.log('AI response status:', response.status);

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
    console.log('AI response raw content:', content);
    console.log('AI response length:', content.length);

    // Parse the JSON response
    let parsedResults;
    try {
      // First try to parse directly as JSON
      try {
        parsedResults = JSON.parse(content);
        console.log('Parsed JSON directly');
      } catch {
        // If that fails, try to extract JSON from the response
        console.log('Trying to extract JSON from content...');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResults = JSON.parse(jsonMatch[0]);
          console.log('Extracted and parsed JSON');
        } else {
          throw new Error("No JSON found in response");
        }
      }
      
      console.log('Parsed results:', JSON.stringify(parsedResults, null, 2));
      
      if (!parsedResults.results || !Array.isArray(parsedResults.results)) {
        console.error('Invalid response structure:', parsedResults);
        throw new Error("Response missing 'results' array");
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      console.error("Content was:", content);
      return new Response(
        JSON.stringify({ 
          error: "לא הצלחנו לעבד את תוצאות החיפוש - פורמט שגוי",
          details: e instanceof Error ? e.message : "Unknown error"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save results to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const savedResults = [];
    const numResults = parsedResults.results?.length || 0;
    console.log(`Processing ${numResults} results from AI...`);

    for (const result of parsedResults.results || []) {
      console.log('Processing result:', result.title);
      
      // Skip results without valid URLs
      if (!result.sourceUrl || !result.sourceUrl.startsWith('http')) {
        console.log('Skipping result without valid URL:', result.title);
        continue;
      }

      try {
        // Insert psak din
        console.log('Inserting psak din to database...');
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

        console.log('Inserted psak din:', psakDin.id);

        // Link to sugya
        console.log('Linking psak din to sugya...');
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
          console.log('Successfully linked psak din to sugya');
          savedResults.push(psakDin);
        }
      } catch (err) {
        console.error('Error processing result:', err);
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
    console.error("Error in search-psak-din function:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "שגיאה בחיפוש פסקי דין",
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});