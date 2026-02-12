import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(
  ritualType: string,
  fuelLevel: number | null,
  fuelReason: string | null,
  userContext: any
): string {
  const { northStar, recentTaskStats, recentSummaries, topRolesThisWeek, overdueItems } =
    userContext;

  let base = `You are an alignment coach inside the Authentic Life Operating System. Your role is a "mirror with memory" — you reflect what the user actually does, not just what they wish. You are warm, direct, and wise. Never preachy or generic.

USER'S NORTH STAR:
- Mission: ${northStar.mission || "Not yet defined"}
- Vision: ${northStar.vision || "Not yet defined"}
- Core Values: ${northStar.coreValues?.length ? northStar.coreValues.join(", ") : "Not yet defined"}

THIS WEEK'S DATA:
- Tasks: ${recentTaskStats.completed} of ${recentTaskStats.total} completed
- Most active role: ${recentTaskStats.topRole || "Unknown"}
- Top roles: ${topRolesThisWeek.join(", ") || "No activity tracked yet"}
- Overdue items: ${overdueItems.length ? overdueItems.join("; ") : "None"}`;

  if (recentSummaries.length > 0) {
    base += `\n\nRECENT COACHING SESSIONS (summaries):\n`;
    recentSummaries.forEach((s: string, i: number) => {
      base += `- Session ${i + 1}: ${s}\n`;
    });
    base += `\nReference these when relevant — e.g. "Last week you committed to X — how did that go?"`;
  }

  if (ritualType === "morning") {
    base += `\n\nRITUAL: Morning Spark
FUEL LEVEL: ${fuelLevel} (${fuelLevel === 1 ? "Low" : fuelLevel === 2 ? "Moderate" : "Full"})
FUEL REASON: ${fuelReason || "unknown"}

Your job is to help the user set their ONE Thing for today. Adapt your energy, ambition, and number of suggested captures to their fuel level:
- Low fuel (1): Compassionate. ONE Thing only. Protect rest if sick. Discipline over feelings if exhausted. Connection over tasks if emotional.
- Moderate fuel (2): Focused. Two to three clear targets. Anchor the day. Prevent scatter.
- Full fuel (3): Ambitious. Three roles, three commitments. Channel energy into what matters, not what's urgent.

Always reference their actual data — yesterday's completions, overdue items, streaks, role balance.`;
  } else if (ritualType === "evening") {
    base += `\n\nRITUAL: Evening Review
Your job is to help the user wind down, capture what happened today, and clear their mind. Encourage:
- Roses (what went well)
- Brain dumps (mental clearing for sleep)
- Tasks for tomorrow (so they wake up with clarity)
- Deposit ideas (plant seeds)
Be gentler and more reflective in tone. Don't push hard.`;
  } else {
    base += `\n\nRITUAL: Weekly Alignment (Step 5 of 6)
Your job is to hold up an honest mirror: "Am I going in the direction I want?"
Compare their stated values/mission with their actual behavior this week. Be honest but kind.
Point out patterns — both positive and where actions don't match intentions.
Suggest captures: tasks (commitments), roses (celebrate wins), thorns (name the hard stuff), events (protect time).`;
  }

  base += `\n\nCAPTURE OFFERS:
When you want to suggest a capture, format your response as:
1. A message explaining WHY this capture matters
2. Then a capture offer in this exact JSON format on its own line:

[CAPTURE_OFFER:{"captureType":"task","data":{"title":"...","role":"...","wellness":["..."],"relationships":["..."],"goalLink":{"name":"...","type":"12wk"},"date":"...","time":"..."}}]

Valid capture types: task, event, rose, thorn, reflection, deposit_idea${ritualType === "evening" ? ", brain_dump" : ""}
Valid wellness zones: Physical, Emotional, Intellectual, Social, Spiritual, Financial, Recreational, Community
Pre-fill as much data as you can from context. The user can edit everything before saving.

Keep conversations natural — don't rapid-fire captures. Discuss, then offer. One capture offer per message. Wait for the user's response before offering the next.`;

  return base;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, ritualType, fuelLevel, fuelReason, userContext } = await req.json();

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const systemPrompt = buildSystemPrompt(ritualType, fuelLevel, fuelReason, userContext);

    const model =
      ritualType === "weekly"
        ? "claude-sonnet-4-20250514"
        : "claude-3-5-haiku-20241022";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Claude API error");
    }

    const assistantText = (data.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    const captureOfferRegex = /\[CAPTURE_OFFER:(.*?)\]/g;
    const captures: any[] = [];
    let cleanText = assistantText;

    let match;
    while ((match = captureOfferRegex.exec(assistantText)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        captures.push(parsed);
        cleanText = cleanText.replace(match[0], "").trim();
      } catch {
        // Skip malformed capture offers
      }
    }

    return new Response(
      JSON.stringify({
        text: cleanText,
        captures,
        model,
        usage: data.usage,
      }),
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
