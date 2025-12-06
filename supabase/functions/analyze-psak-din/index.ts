import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// List of known Masechtot with Hebrew names
const MASECHTOT = [
  { name: "ברכות", english: "Berakhot", maxDaf: 64 },
  { name: "שבת", english: "Shabbat", maxDaf: 157 },
  { name: "עירובין", english: "Eruvin", maxDaf: 105 },
  { name: "פסחים", english: "Pesachim", maxDaf: 121 },
  { name: "שקלים", english: "Shekalim", maxDaf: 22 },
  { name: "יומא", english: "Yoma", maxDaf: 88 },
  { name: "סוכה", english: "Sukkah", maxDaf: 56 },
  { name: "ביצה", english: "Beitza", maxDaf: 40 },
  { name: "ראש השנה", english: "Rosh Hashanah", maxDaf: 35 },
  { name: "תענית", english: "Taanit", maxDaf: 31 },
  { name: "מגילה", english: "Megillah", maxDaf: 32 },
  { name: "מועד קטן", english: "Moed Katan", maxDaf: 29 },
  { name: "חגיגה", english: "Chagigah", maxDaf: 27 },
  { name: "יבמות", english: "Yevamot", maxDaf: 122 },
  { name: "כתובות", english: "Ketubot", maxDaf: 112 },
  { name: "נדרים", english: "Nedarim", maxDaf: 91 },
  { name: "נזיר", english: "Nazir", maxDaf: 66 },
  { name: "סוטה", english: "Sotah", maxDaf: 49 },
  { name: "גיטין", english: "Gittin", maxDaf: 90 },
  { name: "קידושין", english: "Kiddushin", maxDaf: 82 },
  { name: "בבא קמא", english: "Bava Kamma", maxDaf: 119 },
  { name: "בבא מציעא", english: "Bava Metzia", maxDaf: 119 },
  { name: "בבא בתרא", english: "Bava Batra", maxDaf: 176 },
  { name: "סנהדרין", english: "Sanhedrin", maxDaf: 113 },
  { name: "מכות", english: "Makkot", maxDaf: 24 },
  { name: "שבועות", english: "Shevuot", maxDaf: 49 },
  { name: "עבודה זרה", english: "Avodah Zarah", maxDaf: 76 },
  { name: "הוריות", english: "Horayot", maxDaf: 14 },
  { name: "זבחים", english: "Zevachim", maxDaf: 120 },
  { name: "מנחות", english: "Menachot", maxDaf: 110 },
  { name: "חולין", english: "Chullin", maxDaf: 142 },
  { name: "בכורות", english: "Bekhorot", maxDaf: 61 },
  { name: "ערכין", english: "Arakhin", maxDaf: 34 },
  { name: "תמורה", english: "Temurah", maxDaf: 34 },
  { name: "כריתות", english: "Keritot", maxDaf: 28 },
  { name: "מעילה", english: "Meilah", maxDaf: 22 },
  { name: "תמיד", english: "Tamid", maxDaf: 33 },
  { name: "נידה", english: "Niddah", maxDaf: 73 },
];

interface AnalysisResult {
  title: string;
  court: string;
  year: number;
  summary: string;
  tags: string[];
  sources: Array<{
    masechet: string;
    masechetEnglish: string;
    daf: number;
    amud: string;
    reference: string;
    explanation: string;
  }>;
}

serve(async (req) => {
  console.log("analyze-psak-din function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));
    
    // Support both text-based and ID-based analysis
    let textToAnalyze = body.text;
    let psakId = body.psakId || body.psakDinId;
    const fileName = body.fileName;

    console.log("psakId:", psakId, "fileName:", fileName);

    // If psakId provided without text, fetch from database
    if (psakId && !textToAnalyze) {
      console.log("Fetching psak din from database...");
      const { data: psakDin, error: fetchError } = await supabase
        .from('psakei_din')
        .select('*')
        .eq('id', psakId)
        .single();

      if (fetchError || !psakDin) {
        console.error("Error fetching psak din:", fetchError);
        throw new Error('לא נמצא פסק דין עם מזהה זה');
      }

      console.log("Found psak din:", psakDin.title);
      textToAnalyze = `כותרת: ${psakDin.title}\nבית דין: ${psakDin.court}\nשנה: ${psakDin.year}\nתקציר: ${psakDin.summary}${psakDin.full_text ? `\n\nטקסט מלא: ${psakDin.full_text}` : ''}`;
    }

    if (!textToAnalyze || textToAnalyze.trim().length < 20) {
      console.log("Text too short for analysis");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "טקסט קצר מדי לניתוח" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing psak din: ${fileName || psakId}, text length: ${textToAnalyze.length}`);

    const masechtotList = MASECHTOT.map(m => `${m.name} (${m.english})`).join(", ");

    const systemPrompt = `אתה מומחה לניתוח פסקי דין הלכתיים ותורניים. תפקידך לנתח טקסט של פסק דין ולזהות:
1. כותרת מתאימה לפסק הדין (קצרה וממוקדת)
2. בית הדין או הרב הפוסק
3. שנת הפסק (אם מצוינת, אחרת השנה הנוכחית)
4. תקציר קצר של הנושא והפסיקה (2-3 משפטים)
5. תגיות רלוונטיות (נושאים כמו: ממונות, נזיקין, שכנים, קניין, שכירות, הלוואה, ירושה, גיטין, קידושין, כשרות, שבת וכו')
6. מקורות תלמודיים שמוזכרים או רלוונטיים לפסק - זהה מסכתות ודפים ספציפיים

רשימת המסכתות: ${masechtotList}

החזר תשובה בפורמט JSON בלבד, ללא טקסט נוסף.`;

    const userPrompt = `נתח את פסק הדין הבא וזהה את המקורות התלמודיים. חפש הזכרות מפורשות של מסכתות ודפים, וגם נושאים שקשורים לסוגיות ידועות:

${textToAnalyze.substring(0, 10000)}

החזר JSON בפורמט הבא בלבד (חשוב: daf חייב להיות מספר רגיל כמו 30, לא אותיות עבריות):
{
  "title": "כותרת הפסק",
  "court": "שם בית הדין או הפוסק",
  "year": 2024,
  "summary": "תקציר קצר של הפסק",
  "tags": ["תגית1", "תגית2"],
  "sources": [
    {
      "masechet": "בבא מציעא",
      "masechetEnglish": "Bava Metzia",
      "daf": 30,
      "amud": "א",
      "reference": "בבא מציעא ל עמוד א",
      "explanation": "הסבר קצר מדוע מקור זה רלוונטי לפסק"
    }
  ]
}`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "מגבלת בקשות, נסה שוב מאוחר יותר" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "נדרש תשלום לשימוש ב-AI" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from response
    let analysis: AnalysisResult;
    try {
      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      // Fix common issues: Hebrew numbers in daf field
      let jsonStr = jsonMatch[0];
      // Replace Hebrew numbers with Arabic numerals for daf field
      const hebrewToNumber: { [key: string]: number } = {
        'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
        'י': 10, 'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19,
        'כ': 20, 'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29,
        'ל': 30, 'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35, 'לו': 36, 'לז': 37, 'לח': 38, 'לט': 39,
        'מ': 40, 'מא': 41, 'מב': 42, 'מג': 43, 'מד': 44, 'מה': 45, 'מו': 46, 'מז': 47, 'מח': 48, 'מט': 49,
        'נ': 50, 'נא': 51, 'נב': 52, 'נג': 53, 'נד': 54, 'נה': 55, 'נו': 56, 'נז': 57, 'נח': 58, 'נט': 59,
        'ס': 60, 'סא': 61, 'סב': 62, 'סג': 63, 'סד': 64, 'סה': 65, 'סו': 66, 'סז': 67, 'סח': 68, 'סט': 69,
        'ע': 70, 'עא': 71, 'עב': 72, 'עג': 73, 'עד': 74, 'עה': 75, 'עו': 76, 'עז': 77, 'עח': 78, 'עט': 79,
        'פ': 80, 'פא': 81, 'פב': 82, 'פג': 83, 'פד': 84, 'פה': 85, 'פו': 86, 'פז': 87, 'פח': 88, 'פט': 89,
        'צ': 90, 'צא': 91, 'צב': 92, 'צג': 93, 'צד': 94, 'צה': 95, 'צו': 96, 'צז': 97, 'צח': 98, 'צט': 99,
        'ק': 100, 'קא': 101, 'קב': 102, 'קג': 103, 'קד': 104, 'קה': 105, 'קו': 106, 'קז': 107, 'קח': 108, 'קט': 109,
        'קי': 110, 'קיא': 111, 'קיב': 112, 'קיג': 113, 'קיד': 114, 'קטו': 115, 'קטז': 116, 'קיז': 117, 'קיח': 118, 'קיט': 119,
        'קכ': 120, 'קל': 130, 'קמ': 140, 'קנ': 150, 'קס': 160, 'קסג': 163, 'קע': 170, 'קעו': 176,
      };
      
      // Fix Hebrew numbers in daf field: "daf": לט, -> "daf": 39,
      jsonStr = jsonStr.replace(/"daf":\s*([א-ת]+)\s*,/g, (match: string, hebrewNum: string) => {
        const num = hebrewToNumber[hebrewNum.trim()];
        return num ? `"daf": ${num},` : match;
      });
      
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI analysis");
    }

    console.log(`Analysis complete. Found ${analysis.sources?.length || 0} sources, tags: ${analysis.tags?.join(', ')}`);

    // If psakId provided, update the database
    if (psakId) {
      // Update the psak din record
      const { error: updateError } = await supabase
        .from('psakei_din')
        .update({
          title: analysis.title || fileName || 'פסק דין',
          court: analysis.court || 'לא צוין',
          year: analysis.year || new Date().getFullYear(),
          summary: analysis.summary || '',
          tags: analysis.tags || [],
        })
        .eq('id', psakId);

      if (updateError) {
        console.error("Error updating psak:", updateError);
      } else {
        console.log(`Updated psak din ${psakId}`);
      }

      // Create links to Gemara pages/sugyot
      if (analysis.sources && analysis.sources.length > 0) {
        for (const source of analysis.sources) {
          // Skip sources with missing required data
          if (!source.masechetEnglish || !source.daf || typeof source.daf !== 'number') {
            console.log(`Skipping source with missing data: masechet=${source.masechetEnglish}, daf=${source.daf}`);
            continue;
          }
          
          // Generate sugya_id based on masechet and daf
          // Format: daf-{number} for Bava Batra, or {masechet}_{daf}{amud} for others
          let sugyaId: string;
          
          if (source.masechetEnglish === "Bava Batra" || source.masechet === "בבא בתרא") {
            sugyaId = `daf-${source.daf}`;
          } else {
            sugyaId = `${source.masechetEnglish.replace(/\s+/g, '_')}_${source.daf}${source.amud || 'a'}`;
          }
          
          // Check if link already exists
          const { data: existingLink } = await supabase
            .from('sugya_psak_links')
            .select('id')
            .eq('psak_din_id', psakId)
            .eq('sugya_id', sugyaId)
            .maybeSingle();

          if (!existingLink) {
            const { error: linkError } = await supabase
              .from('sugya_psak_links')
              .insert({
                psak_din_id: psakId,
                sugya_id: sugyaId,
                connection_explanation: source.explanation || `מקור: ${source.reference}`,
                relevance_score: 8,
              });

            if (linkError) {
              console.error("Error creating link:", linkError);
            } else {
              console.log(`Created link: ${psakId} -> ${sugyaId}`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-psak-din:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "שגיאה בניתוח",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
