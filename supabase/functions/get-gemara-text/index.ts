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
    const { ref } = await req.json();
    
    if (!ref) {
      return new Response(
        JSON.stringify({ error: 'Missing ref parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Gemara text for:', ref);

    // קריאה ל-Sefaria API לקבלת טקסט הגמרא
    const sefariaUrl = `https://www.sefaria.org/api/texts/${ref}?commentary=0&context=1`;
    const response = await fetch(sefariaUrl);

    if (!response.ok) {
      throw new Error(`Sefaria API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
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
