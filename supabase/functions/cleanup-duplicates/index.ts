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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === "stats") {
      // Get statistics
      const { count: totalCount } = await supabase.from('psakei_din').select('*', { count: 'exact', head: true });
      
      // Get unique linked psak IDs
      const { data: linksData } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');
      
      const linkedPsakIds = new Set((linksData || []).map(r => r.psak_din_id));
      const linkedCount = linkedPsakIds.size;

      // Find duplicates by title+court+year AND by content_hash
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, content_hash');

      const seenTitles = new Map<string, string>();
      const seenHashes = new Map<string, string>();
      let duplicatesByTitle = 0;
      let duplicatesByHash = 0;
      
      for (const psak of allPsakim || []) {
        const titleKey = `${psak.title}-${psak.court}-${psak.year}`;
        
        // Check title-based duplicate
        if (seenTitles.has(titleKey)) {
          duplicatesByTitle++;
        } else {
          seenTitles.set(titleKey, psak.id);
        }
        
        // Check hash-based duplicate (only if hash exists)
        if (psak.content_hash) {
          if (seenHashes.has(psak.content_hash)) {
            duplicatesByHash++;
          } else {
            seenHashes.set(psak.content_hash, psak.id);
          }
        }
      }

      // Total unique duplicates (some might be caught by both methods)
      const totalDuplicates = Math.max(duplicatesByTitle, duplicatesByHash);

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            total: totalCount || 0,
            linked: linkedCount,
            duplicates: totalDuplicates,
            duplicatesByTitle,
            duplicatesByHash,
            unlinked: (totalCount || 0) - linkedCount,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup") {
      // Find and remove duplicates by both title+court+year AND content_hash
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, content_hash, created_at')
        .order('created_at', { ascending: true });

      const seenTitles = new Map<string, string>();
      const seenHashes = new Map<string, string>();
      const toDelete = new Set<string>();
      
      for (const psak of allPsakim || []) {
        const titleKey = `${psak.title}-${psak.court}-${psak.year}`;
        
        // Check title-based duplicate
        if (seenTitles.has(titleKey)) {
          toDelete.add(psak.id);
          continue;
        }
        seenTitles.set(titleKey, psak.id);
        
        // Check hash-based duplicate
        if (psak.content_hash && seenHashes.has(psak.content_hash)) {
          toDelete.add(psak.id);
          continue;
        }
        if (psak.content_hash) {
          seenHashes.set(psak.content_hash, psak.id);
        }
      }

      const toDeleteArray = Array.from(toDelete);
      console.log(`Found ${toDeleteArray.length} duplicates to delete (by title and/or hash)`);

      if (toDeleteArray.length > 0) {
        // Delete links first
        const { error: linksError } = await supabase
          .from('sugya_psak_links')
          .delete()
          .in('psak_din_id', toDeleteArray);

        if (linksError) {
          console.error("Error deleting links:", linksError);
        }

        // Delete duplicates in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < toDeleteArray.length; i += BATCH_SIZE) {
          const batch = toDeleteArray.slice(i, i + BATCH_SIZE);
          const { error: deleteError } = await supabase
            .from('psakei_din')
            .delete()
            .in('id', batch);

          if (deleteError) {
            console.error("Error deleting duplicates batch:", deleteError);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted: toDeleteArray.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-unlinked") {
      // Get IDs of psakim without links
      const { data: linkedIds } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id');

      const linkedSet = new Set(linkedIds?.map(r => r.psak_din_id) || []);

      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id');

      const unlinked = (allPsakim || [])
        .filter(p => !linkedSet.has(p.id))
        .map(p => p.id);

      return new Response(
        JSON.stringify({
          success: true,
          unlinkedIds: unlinked,
          count: unlinked.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cleanup-duplicates:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "שגיאה",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
