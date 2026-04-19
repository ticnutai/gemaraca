import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MASECHTOT_MAP } from "../_shared/masechtotData.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "נדרשת התחברות למערכת" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "טוקן לא תקין" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Authenticated user: ${userData.user.id}`);

    console.log('=== LOAD DAF REQUEST START ===');
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { dafNumber, sugya_id, title, masechet, amud: rawAmud } = body;
    
    // Validate amud — only allow 'a' or 'b', default to 'a'
    const amud = rawAmud === 'b' ? 'b' : 'a';
    
    // ברירת מחדל - בבא בתרא (לתאימות אחורה)
    const masechetName = masechet || "בבא בתרא";
    const sefariaName = MASECHTOT_MAP[masechetName] || "Bava_Batra";
    
    console.log('Parsed params:', { dafNumber, sugya_id, title, masechetName, sefariaName });
    
    if (!dafNumber || !sugya_id || !title) {
      console.error('Missing required parameters:', { dafNumber, sugya_id, title });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: dafNumber, sugya_id, title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Loading daf:', dafNumber, 'sugya_id:', sugya_id, 'title:', title, 'masechet:', masechetName);

    // Create Supabase client with service role for writes
    console.log('Creating Supabase client...');
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('Supabase client created');

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

    const amudLabel = amud === 'a' ? 'ע״א' : 'ע״ב';
    const dafYomi = `${masechetName} ${toHebrewNumeral(dafNumber)} ${amudLabel}`;
    
    // Shekalim uses Jerusalem Talmud references on Sefaria
    const isYerushalmi = sefariaName === 'Shekalim';
    const SHEKALIM_DAF_MAP: Record<string, string> = {
      '2a':  'Jerusalem_Talmud_Shekalim.1.1',
      '2b':  'Jerusalem_Talmud_Shekalim.1.1',
      '3a':  'Jerusalem_Talmud_Shekalim.1.1',
      '3b':  'Jerusalem_Talmud_Shekalim.1.2',
      '4a':  'Jerusalem_Talmud_Shekalim.1.4',
      '4b':  'Jerusalem_Talmud_Shekalim.1.4',
      '5a':  'Jerusalem_Talmud_Shekalim.1.4',
      '5b':  'Jerusalem_Talmud_Shekalim.2.1',
      '6a':  'Jerusalem_Talmud_Shekalim.2.3',
      '6b':  'Jerusalem_Talmud_Shekalim.2.4',
      '7a':  'Jerusalem_Talmud_Shekalim.2.4',
      '7b':  'Jerusalem_Talmud_Shekalim.2.5',
      '8a':  'Jerusalem_Talmud_Shekalim.3.1',
      '8b':  'Jerusalem_Talmud_Shekalim.3.2',
      '9a':  'Jerusalem_Talmud_Shekalim.3.2',
      '9b':  'Jerusalem_Talmud_Shekalim.3.3',
      '10a': 'Jerusalem_Talmud_Shekalim.4.1',
      '10b': 'Jerusalem_Talmud_Shekalim.4.2',
      '11a': 'Jerusalem_Talmud_Shekalim.4.2',
      '11b': 'Jerusalem_Talmud_Shekalim.4.3',
      '12a': 'Jerusalem_Talmud_Shekalim.4.4',
      '12b': 'Jerusalem_Talmud_Shekalim.4.4',
      '13a': 'Jerusalem_Talmud_Shekalim.4.4',
      '13b': 'Jerusalem_Talmud_Shekalim.5.1',
      '14a': 'Jerusalem_Talmud_Shekalim.5.1',
      '14b': 'Jerusalem_Talmud_Shekalim.5.1',
      '15a': 'Jerusalem_Talmud_Shekalim.5.3',
      '15b': 'Jerusalem_Talmud_Shekalim.5.4',
      '16a': 'Jerusalem_Talmud_Shekalim.6.1',
      '16b': 'Jerusalem_Talmud_Shekalim.6.1',
      '17a': 'Jerusalem_Talmud_Shekalim.6.2',
      '17b': 'Jerusalem_Talmud_Shekalim.6.2',
      '18a': 'Jerusalem_Talmud_Shekalim.6.3',
      '18b': 'Jerusalem_Talmud_Shekalim.6.4',
      '19a': 'Jerusalem_Talmud_Shekalim.6.4',
      '19b': 'Jerusalem_Talmud_Shekalim.7.2',
      '20a': 'Jerusalem_Talmud_Shekalim.7.2',
      '20b': 'Jerusalem_Talmud_Shekalim.7.3',
      '21a': 'Jerusalem_Talmud_Shekalim.7.3',
      '21b': 'Jerusalem_Talmud_Shekalim.8.1',
      '22a': 'Jerusalem_Talmud_Shekalim.8.3',
      '22b': 'Jerusalem_Talmud_Shekalim.8.4',
    };
    const dafAmudKey = `${dafNumber}${amud}`;
    const sefariaRef = isYerushalmi && SHEKALIM_DAF_MAP[dafAmudKey]
      ? SHEKALIM_DAF_MAP[dafAmudKey]
      : `${sefariaName}.${dafAmudKey}`;
    
    console.log('Generated dafYomi:', dafYomi);
    console.log('Generated sefariaRef:', sefariaRef);

    // ─── 1. Check database FIRST ───
    const { data: existingPage } = await supabaseClient
      .from('gemara_pages')
      .select('*')
      .eq('masechet', sefariaName)
      .eq('sugya_id', sugya_id)
      .maybeSingle();

    if (existingPage?.text_he) {
      console.log('Page already exists with text in DB (skipping Sefaria):', existingPage.id);
      return new Response(
        JSON.stringify({
          success: true,
          data: existingPage,
          source: 'database',
          message: `דף ${dafYomi} כבר קיים במסד הנתונים`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 2. Fallback: fetch from Sefaria API ───
    const sefariaUrl = `https://www.sefaria.org/api/texts/${sefariaRef}?commentary=0&context=1`;
    console.log('Not in DB, calling Sefaria API:', sefariaUrl);
    
    const sefariaResponse = await fetch(sefariaUrl);
    console.log('Sefaria response status:', sefariaResponse.status);

    if (!sefariaResponse.ok) {
      const errorText = await sefariaResponse.text();
      console.error('Sefaria API error:', sefariaResponse.status, errorText);
      throw new Error(`Sefaria API error: ${sefariaResponse.status}`);
    }

    const sefariaData = await sefariaResponse.json();
    console.log('Sefaria data received:', { hasHe: !!sefariaData.he, heLength: sefariaData.he?.length });

    if (!sefariaData.he || sefariaData.he.length === 0) {
      console.error('No Hebrew text found in Sefaria for this daf');
      throw new Error('No text found in Sefaria for this daf');
    }

    // Check if page exists without text (needs updating with Sefaria data)
    if (existingPage && !existingPage.text_he) {
      console.log('Page exists without text, updating with content...');
      const { data: updated, error: updateError } = await supabaseClient
        .from('gemara_pages')
        .update({
          text_he: sefariaData.he,
          text_en: sefariaData.text || null,
          he_ref: sefariaData.heRef || null,
          book: sefariaData.book || null,
          categories: sefariaData.categories || null,
          section_ref: sefariaData.sectionRef || null,
        })
        .eq('id', existingPage.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating existing page with text:', updateError);
      } else {
        console.log('Updated existing page with text content:', updated.id);
        return new Response(
          JSON.stringify({
            success: true,
            data: updated,
            source: 'sefaria_updated',
            message: `דף ${dafYomi} עודכן עם תוכן טקסט`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Inserting into database with text content...');
    // Insert into database — now includes full text content
    const { data, error } = await supabaseClient
      .from('gemara_pages')
      .insert({
        daf_number: dafNumber,
        sugya_id: sugya_id,
        title: title,
        daf_yomi: dafYomi,
        sefaria_ref: sefariaRef,
        masechet: sefariaName,
        text_he: sefariaData.he,
        text_en: sefariaData.text || null,
        he_ref: sefariaData.heRef || null,
        book: sefariaData.book || null,
        categories: sefariaData.categories || null,
        section_ref: sefariaData.sectionRef || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('Successfully inserted daf:', data.id);
    console.log('=== LOAD DAF REQUEST SUCCESS ===');

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        message: `דף ${dafYomi} נטען בהצלחה`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== LOAD DAF ERROR ===');
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
