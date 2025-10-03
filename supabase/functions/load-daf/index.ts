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
    const { dafNumber, sugya_id, title } = await req.json();
    
    if (!dafNumber || !sugya_id || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: dafNumber, sugya_id, title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Loading daf:', dafNumber, sugya_id, title);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Convert daf number to Hebrew
    const toHebrewNumeral = (num: number): string => {
      const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
      const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
      const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
      
      if (num === 15) return 'ט״ו';
      if (num === 16) return 'ט״ז';
      
      const h = Math.floor(num / 100);
      const t = Math.floor((num % 100) / 10);
      const o = num % 10;
      
      let result = hundreds[h] + tens[t] + ones[o];
      
      if (result.length > 1) {
        return result.slice(0, -1) + '״' + result.slice(-1);
      }
      return result + '׳';
    };

    const dafYomi = `${toHebrewNumeral(dafNumber)} ע״א`;
    const sefariaRef = `Bava_Batra.${dafNumber}a`;

    // Verify the page exists in Sefaria
    const sefariaUrl = `https://www.sefaria.org/api/texts/${sefariaRef}?commentary=0&context=1`;
    const sefariaResponse = await fetch(sefariaUrl);

    if (!sefariaResponse.ok) {
      throw new Error(`Sefaria API error: ${sefariaResponse.status}`);
    }

    const sefariaData = await sefariaResponse.json();

    if (!sefariaData.he || sefariaData.he.length === 0) {
      throw new Error('No text found in Sefaria for this daf');
    }

    // Insert into database
    const { data, error } = await supabaseClient
      .from('gemara_pages')
      .insert({
        daf_number: dafNumber,
        sugya_id: sugya_id,
        title: title,
        daf_yomi: dafYomi,
        sefaria_ref: sefariaRef
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        message: `דף ${dafYomi} נטען בהצלחה`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in load-daf function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
