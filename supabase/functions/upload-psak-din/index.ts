import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PsakDinData {
  title: string;
  court: string;
  year: number;
  caseNumber?: string;
  summary: string;
  fullText?: string;
  tags?: string[];
  fileName?: string;
  fileUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const metadata = formData.get("metadata") as string;
    
    let parsedMetadata: Record<string, unknown> = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        console.log("Could not parse metadata:", e);
      }
    }

    console.log(`Received ${files.length} files for upload`);
    const results: unknown[] = [];
    const errors: string[] = [];

    // Process files in parallel for better performance (max 3 concurrent)
    const processFile = async (file: File): Promise<void> => {
      const fileName = file.name;
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      
      console.log(`Processing file: ${fileName}, type: ${fileExt}`);

      try {
        if (['pdf', 'docx', 'doc', 'txt', 'rtf', 'zip'].includes(fileExt || '')) {
          const result = await processAndSaveFile(
            supabase,
            file,
            fileName,
            parsedMetadata
          );
          
          if (result.success) {
            results.push(result.data);
          } else {
            errors.push(`${fileName}: ${result.error}`);
          }
        } else {
          errors.push(`${fileName}: פורמט לא נתמך`);
        }
      } catch (err) {
        console.error(`Error processing ${fileName}:`, err);
        errors.push(`${fileName}: ${err instanceof Error ? err.message : 'שגיאה לא ידועה'}`);
      }
    };

    // Process files in batches of 3 for parallel execution
    const CONCURRENT_LIMIT = 3;
    for (let i = 0; i < files.length; i += CONCURRENT_LIMIT) {
      const batch = files.slice(i, i + CONCURRENT_LIMIT);
      await Promise.all(batch.map(processFile));
    }

    return new Response(
      JSON.stringify({
        success: true,
        uploaded: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in upload-psak-din:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "שגיאה בהעלאה"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processAndSaveFile(
  supabase: any,
  file: Blob | File,
  fileName: string,
  metadata: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Upload file to storage
    const timestamp = Date.now();
    const storagePath = `uploads/${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('psakei-din-files')
      .upload(storagePath, file);

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { success: false, error: `שגיאה בהעלאת הקובץ: ${uploadError.message}` };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('psakei-din-files')
      .getPublicUrl(storagePath);

    // Extract text content for TXT files
    let fullText = '';
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    if (fileExt === 'txt') {
      try {
        fullText = await (file as File).text?.() || await new Response(file).text();
      } catch (e) {
        console.log("Could not extract text:", e);
      }
    }

    // Create psak din record
    const psakData: PsakDinData = {
      title: metadata.title || extractTitleFromFileName(fileName),
      court: metadata.court || 'לא צוין',
      year: metadata.year || new Date().getFullYear(),
      caseNumber: metadata.caseNumber,
      summary: metadata.summary || `פסק דין שהועלה מהקובץ: ${fileName}`,
      fullText: fullText || metadata.fullText,
      tags: metadata.tags || [],
    };

    const { data: psakDin, error: psakError } = await supabase
      .from('psakei_din')
      .insert({
        title: psakData.title,
        court: psakData.court,
        year: psakData.year,
        case_number: psakData.caseNumber,
        summary: psakData.summary,
        full_text: psakData.fullText,
        source_url: publicUrl,
        tags: psakData.tags,
      })
      .select()
      .single();

    if (psakError) {
      console.error("Database insert error:", psakError);
      return { success: false, error: `שגיאה בשמירה למאגר: ${psakError.message}` };
    }

    console.log(`Successfully saved psak din: ${psakDin.id}`);
    return { success: true, data: psakDin };

  } catch (err) {
    console.error("processAndSaveFile error:", err);
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' };
  }
}

function extractTitleFromFileName(fileName: string): string {
  // Remove extension and clean up
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/^\d+_/, '')
    .trim() || 'פסק דין';
}