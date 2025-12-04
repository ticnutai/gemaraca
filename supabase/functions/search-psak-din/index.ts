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
    const body = await req.json();
    const { query, sugyaId, sugyaTitle, sugyaDescription } = body;
    
    // Support both query-based and sugya-based search
    const searchTerm = query || sugyaTitle || "";
    console.log('Search request:', { query, sugyaId, sugyaTitle, searchTerm });

    if (!searchTerm.trim()) {
      return new Response(
        JSON.stringify({ error: "חסרות מילות חיפוש", results: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const searchPrompt = `חפש פסקי דין רבניים ומקורות הלכתיים הקשורים ל: "${searchTerm}"
${sugyaDescription ? `\nתיאור נוסף: ${sugyaDescription}` : ''}

**מקורות לחיפוש:**

1. **פסקדין** (www.psakdin.co.il) - מאגר פסקי הדין הרבניים הרשמי
2. **דין תורה** (www.dintorha.co.il) - מאגר פסקי דין רבניים ושו"ת
3. **דעת** (www.daat.ac.il) - ספריית השו"ת והפסיקה
4. **ספריא** (www.sefaria.org.il) - ספרייה דיגיטלית של טקסטים יהודיים
5. **המכון לחקר המשפט העברי** (mishpat.ac.il) - מאגר פסקי דין
6. **בתי הדין הרבניים** (www.gov.il) - פסיקת בתי הדין הרבניים
7. **אוצר החכמה** (www.otzar.org) - ספרים וכתבי יד
8. **HebrewBooks** (www.hebrewbooks.org) - ספרי קודש
9. **שו"ת באינטרנט** (www.responsa.co.il) - מאגר שאלות ותשובות
10. **תורה שבעל פה** (www.toratemetfreeware.com) - מאגר תורני

**הנחיות:**
- החזר JSON בלבד
- רק קישורים אמיתיים - אם לא בטוח, אל תכלול
- עדיף פחות תוצאות איכותיות מאשר קישורים שגויים
- אם לא מצאת תוצאות, החזר מערך ריק

**פורמט JSON:**
{
  "results": [
    {
      "title": "כותרת הפסק/התשובה",
      "court": "בית הדין / הפוסק",
      "year": 2023,
      "caseNumber": "מספר תיק (אם יש)",
      "sourceUrl": "https://... (קישור מאומת)",
      "summary": "תקציר קצר",
      "connection": "הקשר לנושא החיפוש",
      "tags": ["תג1", "תג2"],
      "source": "שם המקור (psakdin/sefaria/daat וכו')"
    }
  ]
}`;

    console.log('Calling Lovable AI...');
    
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
            content: "אתה מומחה בחיפוש פסקי דין רבניים ומקורות הלכתיים. החזר רק JSON תקין. אסור להמציא קישורים - רק קישורים אמיתיים."
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
          JSON.stringify({ error: "חרגת ממגבלת הבקשות. נסה שוב מאוחר יותר.", results: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "יש להוסיף קרדיטים לחשבון.", results: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    console.log('AI response received, length:', content.length);

    let parsedResults;
    try {
      try {
        parsedResults = JSON.parse(content);
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResults = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      }
      
      if (!parsedResults.results || !Array.isArray(parsedResults.results)) {
        parsedResults = { results: [] };
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(
        JSON.stringify({ error: "שגיאה בעיבוד התוצאות", results: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter results with valid URLs only
    const validResults = parsedResults.results.filter((r: any) => 
      r.sourceUrl && r.sourceUrl.startsWith('http') && r.title
    );

    console.log(`Found ${validResults.length} valid results`);

    // If sugyaId is provided, save to database
    if (sugyaId && validResults.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      for (const result of validResults) {
        try {
          const { data: psakDin, error: psakError } = await supabase
            .from('psakei_din')
            .insert({
              title: result.title,
              court: result.court || 'לא ידוע',
              year: result.year || new Date().getFullYear(),
              case_number: result.caseNumber,
              source_url: result.sourceUrl,
              summary: result.summary || '',
              tags: result.tags || [],
            })
            .select()
            .single();

          if (psakError) {
            console.error('Error inserting psak din:', psakError);
            continue;
          }

          await supabase
            .from('sugya_psak_links')
            .insert({
              sugya_id: sugyaId,
              psak_din_id: psakDin.id,
              connection_explanation: result.connection || '',
              relevance_score: 8,
            });
        } catch (err) {
          console.error('Error saving result:', err);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        count: validResults.length,
        results: validResults
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in search-psak-din:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "שגיאה בחיפוש",
        results: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});