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

    console.log('Fetching commentaries for:', ref);

    // קריאה ל-Sefaria API לקבלת מפרשים
    const sefariaUrl = `https://www.sefaria.org/api/related/${ref}?with_text=1`;
    const response = await fetch(sefariaUrl);

    if (!response.ok) {
      throw new Error(`Sefaria API error: ${response.status}`);
    }

    const data = await response.json();

    // סינון ועיבוד המפרשים
    const commentaries = data.filter((item: any) => 
      item.category === 'Commentary' || item.type === 'commentary'
    ).map((item: any) => ({
      ref: item.ref,
      heRef: item.heRef,
      sourceRef: item.sourceRef,
      sourceHeRef: item.sourceHeRef,
      category: item.category,
      type: item.type,
      text: item.text,
      he: item.he,
      book: item.book,
      index_title: item.index_title,
      collectiveTitle: item.collectiveTitle
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: commentaries
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-commentaries function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
