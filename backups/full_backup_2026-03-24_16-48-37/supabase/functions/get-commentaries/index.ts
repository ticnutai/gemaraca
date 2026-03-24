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
    console.log('=== GET COMMENTARIES REQUEST START ===');
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { ref } = body;
    
    if (!ref) {
      console.error('Missing ref parameter');
      return new Response(
        JSON.stringify({ error: 'Missing ref parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching commentaries for ref:', ref);

    // קריאה ל-Sefaria API לקבלת מפרשים
    const sefariaUrl = `https://www.sefaria.org/api/related/${ref}?with_text=1`;
    console.log('Calling Sefaria API:', sefariaUrl);
    
    const response = await fetch(sefariaUrl);
    console.log('Sefaria response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sefaria API error:', response.status, errorText);
      throw new Error(`Sefaria API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Sefaria data received, keys:', Object.keys(data || {}));

    // Sefaria /api/related returns an object with 'links' array
    const links = data?.links || [];
    console.log('Links count:', links.length);

    // סינון ועיבוד המפרשים
    const commentaries = links.filter((item: any) => {
      const isCommentary = item.category === 'Commentary' || item.type === 'commentary';
      if (isCommentary) {
        console.log('Found commentary:', item.ref || item.heRef);
      }
      return isCommentary;
    }).map((item: any) => ({
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

    console.log(`Processed ${commentaries.length} commentaries`);
    console.log('=== GET COMMENTARIES REQUEST SUCCESS ===');

    return new Response(
      JSON.stringify({
        success: true,
        data: commentaries
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== GET COMMENTARIES ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
