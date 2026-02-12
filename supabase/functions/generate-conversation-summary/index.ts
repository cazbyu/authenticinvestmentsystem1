import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId, userId } = await req.json();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: messages } = await supabaseClient
      .from("0008-ap-conversation-messages")
      .select("role, content, message_type")
      .eq("session_id", sessionId)
      .order("sequence_number", { ascending: true });

    if (!messages || messages.length < 2) {
      return new Response(
        JSON.stringify({ summary: null }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const transcript = messages
      .filter((m: any) => m.message_type !== "system")
      .map((m: any) =>
        m.role === "user" ? `User: ${m.content}` : `Coach: ${m.content}`
      )
      .join("\n");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 300,
        system:
          "You summarize coaching conversations. Output a JSON object with: summary_text (2-3 sentences capturing what was discussed and decided), key_commitments (array of specific things the user committed to), patterns_noted (array of behavioral patterns observed). Be concise and factual.",
        messages: [
          {
            role: "user",
            content: `Summarize this coaching conversation:\n\n${transcript}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const resultText = data.content?.[0]?.text || "";

    let parsed: any;
    try {
      parsed = JSON.parse(resultText.replace(/```json|```/g, "").trim());
    } catch {
      parsed = {
        summary_text: resultText.slice(0, 500),
        key_commitments: [],
        patterns_noted: [],
      };
    }

    await supabaseClient.from("0008-ap-conversation-summaries").insert({
      session_id: sessionId,
      user_id: userId,
      summary_text: parsed.summary_text,
      key_commitments: parsed.key_commitments || [],
      patterns_noted: parsed.patterns_noted || [],
    });

    await supabaseClient
      .from("0008-ap-ritual-sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({ summary: parsed }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
