import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, selectedText, masechet, daf, fullPageText } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "No question provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextParts: string[] = [];
    if (masechet) contextParts.push(`מסכת: ${masechet}`);
    if (daf) contextParts.push(`דף: ${daf}`);
    if (selectedText) contextParts.push(`טקסט מסומן:\n"${selectedText}"`);
    if (fullPageText) contextParts.push(`טקסט הדף המלא:\n${fullPageText.slice(0, 3000)}`);

    const prompt = `${contextParts.length > 0 ? contextParts.join("\n") + "\n\n" : ""}שאלת המשתמש: ${question}

ענה על השאלה בהתבסס על הטקסט שסופק. אם הטקסט המסומן רלוונטי, התמקד בו. 
הסבר בעברית ברורה ומקצועית. אם יש מקורות נוספים שרלוונטיים, ציין אותם.`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        temperature: 0.5,
        messages: [
          { role: "system", content: "אתה מומחה לתלמוד בבלי והלכה. ענה על שאלות ספציפיות על טקסטים תלמודיים. תמיד ענה בעברית." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const answer = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
