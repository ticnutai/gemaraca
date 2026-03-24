import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ref } = await req.json();
    
    if (!ref) {
      return new Response(
        JSON.stringify({ error: 'Missing ref parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Gemara text for:', ref);

    // ─── 1. Check database first for cached text ───
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: cachedPage } = await supabaseClient
      .from('gemara_pages')
      .select('text_he, text_en, sefaria_ref, he_ref, book, categories, section_ref')
      .eq('sefaria_ref', ref)
      .not('text_he', 'is', null)
      .maybeSingle();

    if (cachedPage?.text_he) {
      console.log('Serving from database cache for:', ref);
      return new Response(
        JSON.stringify({
          success: true,
          source: 'database',
          data: {
            ref: cachedPage.sefaria_ref,
            heRef: cachedPage.he_ref,
            text: cachedPage.text_en || [],
            he: cachedPage.text_he,
            commentary: [],
            book: cachedPage.book,
            categories: cachedPage.categories || [],
            sectionRef: cachedPage.section_ref,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 2. Fallback to Sefaria API ───
    console.log('Not in DB, fetching from Sefaria:', ref);
    const sefariaUrl = `https://www.sefaria.org/api/texts/${ref}?commentary=0&context=1`;
    const response = await fetch(sefariaUrl);

    if (!response.ok) {
      throw new Error(`Sefaria API error: ${response.status}`);
    }

    const data = await response.json();

    // ─── 3. Save to database for future requests ───
    if (data.he && data.he.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('gemara_pages')
        .update({
          text_he: data.he,
          text_en: data.text || null,
          he_ref: data.heRef || null,
          book: data.book || null,
          categories: data.categories || null,
          section_ref: data.sectionRef || null,
        })
        .eq('sefaria_ref', ref);
      
      if (upsertError) {
        console.log('Could not cache text (page row may not exist):', upsertError.message);
      } else {
        console.log('Cached Sefaria response to DB for:', ref);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: 'sefaria',
        data: {
          ref: data.ref,
          heRef: data.heRef,
          text: data.text,
          he: data.he,
          commentary: data.commentary || [],
          book: data.book,
          categories: data.categories,
          sectionRef: data.sectionRef
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-gemara-text function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
