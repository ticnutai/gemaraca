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
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "נדרשת התחברות למערכת" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(SUPABASE_URL, supabaseAnonKey, {
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

    const { question, context, history } = await req.json();

    if (!question || typeof question !== "string" || question.length > 2000) {
      return new Response(
        JSON.stringify({ error: "שאלה לא תקינה" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `אתה מורה פרטי לתלמוד והלכה. שמך "מורה AI".
תפקידך לעזור ללומד להבין סוגיות תלמודיות, הלכות, מושגים ופסקי דין.

כללים:
- ענה תמיד בעברית
- היה מדויק ומשתמש במקורות כשאפשר (גמרא, רמב"ם, שולחן ערוך)
- הסבר מושגים ארמיים כשהם מופיעים
- אם אינך בטוח, ציין זאת במפורש
- היה תמציתי אך מקיף
- השתמש בדוגמאות מעשיות להמחשת הנקודות`;

    const contextStr = context?.pageTitle
      ? `\nהקשר נוכחי: המשתמש נמצא בדף "${context.pageTitle}"${context.activeTab ? ` בטאב "${context.activeTab}"` : ""}.`
      : "";

    const messages = [
      { role: "system", content: systemPrompt + contextStr },
      ...(Array.isArray(history) ? history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.content).slice(0, 1000),
      })) : []),
      { role: "user", content: question },
    ];

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content || "לא התקבלה תשובה.";

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("ai-tutor error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "שגיאה פנימית" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
