import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { psakDinId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the psak din from database
    const { data: psakDin, error: fetchError } = await supabase
      .from('psakei_din')
      .select('*')
      .eq('id', psakDinId)
      .single();

    if (fetchError || !psakDin) {
      throw new Error('Failed to fetch psak din');
    }

    console.log('Analyzing psak din:', psakDin.title);

    // Available sugyot to match
    const sugyot = [
      { id: 'shnayim-ochazin', name: 'שנים אוחזין בטלית', topic: 'מחלוקת בעלות' },
      { id: 'eilu-metziot', name: 'אלו מציאות שלו', topic: 'מציאה ויאוש' },
      { id: 'hashavat-aveida', name: 'מצוות השבת אבידה', topic: 'חובת השבה וסימנים' },
      { id: 'geneiva-aveida', name: 'גניבה ואבידה מההקדש', topic: 'ממון הקדש' },
      { id: 'hamotzei-shtarot', name: 'המוצא שטרות', topic: 'מסמכים וחשש תרמית' },
      { id: 'hamaafil', name: 'המפקיד אצל חברו', topic: 'דיני שומרים ופיקדון' }
    ];

    const systemPrompt = `אתה מומחה במשפט עברי ומשפט ישראלי. תפקידך לנתח פסקי דין ולמצוא קשרים לסוגיות בגמרא.
    
קבל פסק דין וזהה את הסוגיות הרלוונטיות ביותר מבין הרשימה הבאה:
${sugyot.map(s => `- ${s.id}: ${s.name} (${s.topic})`).join('\n')}

עבור כל סוגיה רלוונטית, תן:
1. relevance_score: ציון רלוונטיות 1-10 (רק סוגיות בציון 6 ומעלה)
2. connection_explanation: הסבר קצר וברור של הקשר בין הפסק לסוגיה (משפט אחד)

החזר תשובה בפורמט JSON בלבד.`;

    const userPrompt = `נתח את פסק הדין הבא ומצא קשרים לסוגיות:

כותרת: ${psakDin.title}
בית משפט: ${psakDin.court}
שנה: ${psakDin.year}
תקציר: ${psakDin.summary}
${psakDin.full_text ? `טקסט מלא: ${psakDin.full_text}` : ''}`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'link_sugyot',
              description: 'Link psak din to relevant sugyot',
              parameters: {
                type: 'object',
                properties: {
                  links: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        sugya_id: { type: 'string' },
                        connection_explanation: { type: 'string' },
                        relevance_score: { type: 'integer', minimum: 6, maximum: 10 }
                      },
                      required: ['sugya_id', 'connection_explanation', 'relevance_score'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['links'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'link_sugyot' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData, null, 2));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const links = JSON.parse(toolCall.function.arguments).links;

    // Insert links into database
    const insertPromises = links.map((link: any) =>
      supabase.from('sugya_psak_links').insert({
        sugya_id: link.sugya_id,
        psak_din_id: psakDinId,
        connection_explanation: link.connection_explanation,
        relevance_score: link.relevance_score
      })
    );

    await Promise.all(insertPromises);

    console.log(`Successfully linked ${links.length} sugyot to psak din`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        links,
        message: `נמצאו ${links.length} קשרים לסוגיות` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in analyze-psak-din:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
