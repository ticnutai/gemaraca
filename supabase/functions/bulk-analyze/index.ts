import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 2000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, jobId, psakIds } = await req.json();

    // Start a new bulk analysis job
    if (action === "start") {
      const newJobId = crypto.randomUUID();
      
      // Get unlinked psak IDs if not provided
      let idsToProcess = psakIds;
      if (!idsToProcess || idsToProcess.length === 0) {
        // Fetch ALL linked IDs (no limit)
        const allLinkedIds: string[] = [];
        let linkedOffset = 0;
        const FETCH_SIZE = 1000;
        
        while (true) {
          const { data: linkedBatch } = await supabase
            .from('sugya_psak_links')
            .select('psak_din_id')
            .range(linkedOffset, linkedOffset + FETCH_SIZE - 1);
          
          if (!linkedBatch || linkedBatch.length === 0) break;
          allLinkedIds.push(...linkedBatch.map(r => r.psak_din_id));
          if (linkedBatch.length < FETCH_SIZE) break;
          linkedOffset += FETCH_SIZE;
        }
        
        const linkedSet = new Set(allLinkedIds);
        
        // Fetch ALL psakim IDs (no limit)
        const allPsakimIds: string[] = [];
        let psakOffset = 0;
        
        while (true) {
          const { data: psakBatch } = await supabase
            .from('psakei_din')
            .select('id')
            .range(psakOffset, psakOffset + FETCH_SIZE - 1);
          
          if (!psakBatch || psakBatch.length === 0) break;
          allPsakimIds.push(...psakBatch.map(p => p.id));
          if (psakBatch.length < FETCH_SIZE) break;
          psakOffset += FETCH_SIZE;
        }
        
        idsToProcess = allPsakimIds.filter(id => !linkedSet.has(id));
        
        console.log(`Found ${allPsakimIds.length} total psakim, ${allLinkedIds.length} linked, ${idsToProcess.length} to process`);
      }

      // Create job record
      await supabase.from('upload_sessions').upsert({
        session_id: newJobId,
        status: 'analyzing',
        total_files: idsToProcess.length,
        processed_files: 0,
        successful_files: 0,
        failed_files: 0,
        skipped_files: 0,
        current_file: 'מתחיל ניתוח...',
        device_id: 'server',
      }, { onConflict: 'session_id' });

      // Start background processing
      EdgeRuntime.waitUntil(processInBackground(supabase, newJobId, idsToProcess));

      return new Response(
        JSON.stringify({ success: true, jobId: newJobId, total: idsToProcess.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check job status
    if (action === "status" && jobId) {
      const { data: job } = await supabase
        .from('upload_sessions')
        .select('*')
        .eq('session_id', jobId)
        .maybeSingle();

      if (!job) {
        return new Response(
          JSON.stringify({ success: false, error: "Job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: job.status,
          total: job.total_files,
          processed: job.processed_files,
          successful: job.successful_files,
          failed: job.failed_files,
          current: job.current_file,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cancel job
    if (action === "cancel" && jobId) {
      await supabase
        .from('upload_sessions')
        .update({ status: 'cancelled' })
        .eq('session_id', jobId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in bulk-analyze:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "שגיאה" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processInBackground(supabase: any, jobId: string, psakIds: string[]) {
  console.log(`Starting background processing for job ${jobId} with ${psakIds.length} items`);
  
  let processed = 0;
  let successful = 0;
  let failed = 0;

  try {
    for (let i = 0; i < psakIds.length; i += BATCH_SIZE) {
      // Check if cancelled
      const { data: job } = await supabase
        .from('upload_sessions')
        .select('status')
        .eq('session_id', jobId)
        .maybeSingle();

      if (job?.status === 'cancelled') {
        console.log(`Job ${jobId} was cancelled`);
        break;
      }

      const batch = psakIds.slice(i, i + BATCH_SIZE);
      
      // Update current status
      await supabase.from('upload_sessions').update({
        current_file: `מעבד ${processed + 1}-${Math.min(processed + batch.length, psakIds.length)} מתוך ${psakIds.length}`,
        processed_files: processed,
        successful_files: successful,
        failed_files: failed,
      }).eq('session_id', jobId);

      // Process batch
      const results = await Promise.allSettled(
        batch.map(psakId => analyzeSinglePsak(supabase, psakId))
      );

      for (const result of results) {
        processed++;
        if (result.status === 'fulfilled' && result.value) {
          successful++;
        } else {
          failed++;
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < psakIds.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }

    // Mark as completed
    await supabase.from('upload_sessions').update({
      status: 'completed',
      processed_files: processed,
      successful_files: successful,
      failed_files: failed,
      current_file: `הושלם: ${successful} הצליחו, ${failed} נכשלו`,
    }).eq('session_id', jobId);

    console.log(`Job ${jobId} completed: ${successful} successful, ${failed} failed`);

  } catch (error) {
    console.error(`Job ${jobId} error:`, error);
    await supabase.from('upload_sessions').update({
      status: 'error',
      current_file: `שגיאה: ${error instanceof Error ? error.message : 'Unknown'}`,
    }).eq('session_id', jobId);
  }
}

async function analyzeSinglePsak(supabase: any, psakId: string): Promise<boolean> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get psak data
    const { data: psak, error: fetchError } = await supabase
      .from('psakei_din')
      .select('*')
      .eq('id', psakId)
      .single();

    if (fetchError || !psak) {
      console.error(`Psak ${psakId} not found`);
      return false;
    }

    const textToAnalyze = `כותרת: ${psak.title}\nבית דין: ${psak.court}\nשנה: ${psak.year}\nתקציר: ${psak.summary}${psak.full_text ? `\n\nטקסט מלא: ${psak.full_text.substring(0, 8000)}` : ''}`;

    // Call AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: getSystemPrompt() },
          { role: "user", content: getAnalysisPrompt(textToAnalyze) },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`AI error for ${psakId}: ${response.status}`);
      return false;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return false;

    // Parse response - handle various formats
    let analysis: { tags?: string[]; sources?: any[] };
    try {
      // Try to extract JSON from the response
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`No JSON found in response for ${psakId}`);
        return false;
      }
      
      // Clean up common issues
      let cleanJson = jsonMatch[0]
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']');
      
      analysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error(`JSON parse error for ${psakId}:`, parseError);
      return false;
    }

    // Update psak
    await supabase.from('psakei_din').update({
      tags: analysis.tags || [],
    }).eq('id', psakId);

    // Create links
    const sources = analysis.sources || [];
    if (sources.length > 0) {
      for (const source of sources) {
        if (!source.masechetEnglish || !source.daf || typeof source.daf !== 'number') continue;
        
        let sugyaId = source.masechetEnglish === "Bava Batra" 
          ? `daf-${source.daf}`
          : `${source.masechetEnglish.replace(/\s+/g, '_')}_${source.daf}${source.amud || 'a'}`;

        const { data: existing } = await supabase
          .from('sugya_psak_links')
          .select('id')
          .eq('psak_din_id', psakId)
          .eq('sugya_id', sugyaId)
          .maybeSingle();

        if (!existing) {
          await supabase.from('sugya_psak_links').insert({
            psak_din_id: psakId,
            sugya_id: sugyaId,
            connection_explanation: source.explanation || `מקור: ${source.reference}`,
            relevance_score: 8,
          });
        }
      }
    }

    console.log(`Analyzed ${psakId}: ${analysis.sources?.length || 0} sources`);
    return true;

  } catch (error) {
    console.error(`Error analyzing ${psakId}:`, error);
    return false;
  }
}

function getSystemPrompt(): string {
  return `אתה מומחה בתלמוד בבלי והלכה. תפקידך לזהות מקורות תלמודיים בפסקי דין.

כללים חשובים:
1. זהה כל אזכור של מסכת, דף או סוגיא בטקסט
2. חפש מושגים הלכתיים וקשר אותם למקורות התלמודיים המתאימים
3. גם אם אין אזכור מפורש, נסה לזהות את הנושא ההלכתי ולקשר למקורות רלוונטיים
4. החזר JSON תקין בלבד, ללא טקסט נוסף

רשימת מסכתות (בעברית -> באנגלית):
ברכות=Berakhot, שבת=Shabbat, עירובין=Eruvin, פסחים=Pesachim, שקלים=Shekalim,
יומא=Yoma, סוכה=Sukkah, ביצה=Beitzah, ראש השנה=Rosh Hashanah, תענית=Taanit,
מגילה=Megillah, מועד קטן=Moed Katan, חגיגה=Chagigah, יבמות=Yevamot, כתובות=Ketubot,
נדרים=Nedarim, נזיר=Nazir, סוטה=Sotah, גיטין=Gittin, קידושין=Kiddushin,
בבא קמא=Bava Kamma, בבא מציעא=Bava Metzia, בבא בתרא=Bava Batra,
סנהדרין=Sanhedrin, מכות=Makkot, שבועות=Shevuot, עבודה זרה=Avodah Zarah,
הוריות=Horayot, זבחים=Zevachim, מנחות=Menachot, חולין=Chullin, בכורות=Bekhorot,
ערכין=Arakhin, תמורה=Temurah, כריתות=Keritot, מעילה=Meilah, תמיד=Tamid,
נדה=Niddah`;
}

function getAnalysisPrompt(text: string): string {
  return `נתח את פסק הדין הבא וזהה את כל המקורות התלמודיים הרלוונטיים.

הוראות:
1. זהה אזכורים מפורשים של מסכתות ודפים
2. זהה מושגים הלכתיים (כגון: חזקה, מיגו, קים ליה, ספק ספיקא) וקשר למקורותיהם
3. עבור כל נושא הלכתי, מצא לפחות מקור תלמודי אחד רלוונטי
4. אם יש דיון בממונות - בדוק קשר לבבא קמא/מציעא/בתרא
5. אם יש דיון באיסורים - בדוק קשר למסכת הרלוונטית

החזר JSON בפורמט הבא בלבד (ללא markdown או טקסט נוסף):
{
  "tags": ["נזיקין", "חוזים", "ירושה"],
  "sources": [
    {
      "masechet": "בבא קמא",
      "masechetEnglish": "Bava Kamma",
      "daf": 84,
      "amud": "א",
      "reference": "בבא קמא פד.",
      "explanation": "הסוגיא דנה בעין תחת עין..."
    }
  ]
}

טקסט לניתוח:
${text.substring(0, 8000)}`;
}
