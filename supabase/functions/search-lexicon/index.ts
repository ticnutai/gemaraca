import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word, lookupRef } = await req.json();
    
    if (!word) {
      return new Response(
        JSON.stringify({ error: 'Missing word parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching lexicon for word:', word, 'in ref:', lookupRef);

    // קריאה ל-Sefaria API לחיפוש במילון
    let sefariaUrl = `https://www.sefaria.org/api/words/${encodeURIComponent(word)}`;
    if (lookupRef) {
      sefariaUrl += `?lookup_ref=${encodeURIComponent(lookupRef)}`;
    }

    const response = await fetch(sefariaUrl);

    if (!response.ok) {
      throw new Error(`Sefaria API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          word: data.word,
          definitions: data.definitions || [],
          related_words: data.related_words || [],
          forms: data.forms || [],
          examples: data.examples || []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-lexicon function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
