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
      const { data: total } = await supabase.from('psakei_din').select('id', { count: 'exact' });
      const { count: totalCount } = await supabase.from('psakei_din').select('*', { count: 'exact', head: true });
      
      const { data: linkedCount } = await supabase
        .from('sugya_psak_links')
        .select('psak_din_id')
        .then(res => ({ data: new Set(res.data?.map(r => r.psak_din_id)).size }));

      // Find duplicates
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year');

      const seen = new Map<string, string>();
      let duplicatesCount = 0;
      
      for (const psak of allPsakim || []) {
        const key = `${psak.title}-${psak.court}-${psak.year}`;
        if (seen.has(key)) {
          duplicatesCount++;
        } else {
          seen.set(key, psak.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            total: totalCount || 0,
            linked: linkedCount || 0,
            duplicates: duplicatesCount,
            unlinked: (totalCount || 0) - (linkedCount || 0),
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup") {
      // Find and remove duplicates (keep the first one with the most links)
      const { data: allPsakim } = await supabase
        .from('psakei_din')
        .select('id, title, court, year, created_at')
        .order('created_at', { ascending: true });

      const seen = new Map<string, string>();
      const toDelete: string[] = [];
      
      for (const psak of allPsakim || []) {
        const key = `${psak.title}-${psak.court}-${psak.year}`;
        if (seen.has(key)) {
          toDelete.push(psak.id);
        } else {
          seen.set(key, psak.id);
        }
      }

      console.log(`Found ${toDelete.length} duplicates to delete`);

      if (toDelete.length > 0) {
        // Delete links first
        const { error: linksError } = await supabase
          .from('sugya_psak_links')
          .delete()
          .in('psak_din_id', toDelete);

        if (linksError) {
          console.error("Error deleting links:", linksError);
        }

        // Delete duplicates
        const { error: deleteError } = await supabase
          .from('psakei_din')
          .delete()
          .in('id', toDelete);

        if (deleteError) {
          console.error("Error deleting duplicates:", deleteError);
          throw deleteError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted: toDelete.length,
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
