// supabase/functions/generate-mission/index.ts
// Updated to handle Identity, Mission, Vision, and Values synthesis

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuestionResponse {
  questionId: string;
  questionText: string;
  response: string;
  questionContext?: string;
}

interface RequestBody {
  responses: QuestionResponse[];
  domain: "mission" | "vision" | "values" | "identity";
  identity?: string;
}

interface GenerationResult {
  suggestions: string[];
  detected_roles: string[];
  detected_wellness_zones: string[];
}

// Valid roles for detection
const VALID_ROLES = [
  // Family
  "Spouse/Partner", "Parent", "Son/Daughter", "Sibling", "Grandparent", "Grandchild",
  "Uncle/Aunt", "Nephew/Niece", "Cousin", "In-Law", "Stepparent", "Stepchild",
  // Professional
  "Business Owner", "Employee", "Manager", "Team Leader", "Mentor", "Mentee",
  "Colleague", "Entrepreneur", "Freelancer", "Consultant", "Board Member",
  // Community
  "Neighbor", "Volunteer", "Community Leader", "Church Member", "Club Member",
  "Civic Participant", "Activist", "Donor/Philanthropist",
  // Recreation
  "Athlete", "Coach", "Hobbyist", "Artist", "Musician", "Writer", "Gamer",
  // Home & Stewardship
  "Homeowner", "Tenant", "Property Manager", "Gardener", "Pet Owner",
  // Caregiving
  "Caregiver", "Healthcare Proxy", "Guardian", "Foster Parent"
];

// Valid wellness zones
const WELLNESS_ZONES = [
  "Physical", "Emotional", "Intellectual", "Social", 
  "Spiritual", "Financial", "Recreational", "Community"
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { responses, domain, identity }: RequestBody = await req.json();

    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ error: "No responses provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await generateWithClaude(responses, domain, identity);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-mission:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateWithClaude(
  responses: QuestionResponse[],
  domain: string,
  identity?: string
): Promise<GenerationResult> {
  
  const systemPrompt = buildSystemPrompt(domain, identity);
  const userPrompt = buildUserPrompt(responses, domain, identity);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Claude API error:", errorText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "";

  return parseClaudeResponse(content, domain);
}

function buildSystemPrompt(domain: string, identity?: string): string {
  const identityContext = identity 
    ? `The user has identified their core identity as: "${identity}". This should inform and anchor the suggestions you generate.`
    : "";

  const basePrompt = `You are a thoughtful life coach helping someone articulate their personal ${domain}. ${identityContext}

Your job is to synthesize their answers into clear, actionable statements that feel authentic to them.

IMPORTANT GUIDELINES:
1. Use their actual words and phrases when possible
2. Keep suggestions concise but meaningful (1-2 sentences each)
3. Make each suggestion distinctly different in approach or emphasis
4. The statements should feel personal, not generic
5. Avoid corporate jargon or overly formal language`;

  const domainSpecific = getDomainSpecificPrompt(domain);

  const detectionPrompt = `

ALSO DETECT:
- Roles: From this list ONLY: ${VALID_ROLES.join(", ")}
- Wellness Zones: From this list ONLY: ${WELLNESS_ZONES.join(", ")}

Only include roles and zones that are clearly implied by their answers.`;

  const outputFormat = `

OUTPUT FORMAT (respond ONLY with this JSON structure):
{
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "detected_roles": ["Role1", "Role2"],
  "detected_wellness_zones": ["Zone1", "Zone2"]
}`;

  return basePrompt + domainSpecific + detectionPrompt + outputFormat;
}

function getDomainSpecificPrompt(domain: string): string {
  switch (domain) {
    case "mission":
      return `

MISSION STATEMENT FORMAT:
Mission statements describe your core purpose—what you do and why.
Structure: "To [POWER VERB] [WHO/WHAT] so that [TRANSFORMATION/IMPACT]"

Examples of good mission statements:
- "To create sustainable opportunities for entrepreneurs so that communities can thrive economically."
- "To nurture and guide my children so that they become confident, compassionate adults."
- "To connect isolated individuals so that they experience belonging and support."

The verb should be active and specific (create, build, teach, heal, connect, serve, empower, etc.)
The beneficiary should be specific (my family, struggling entrepreneurs, my team, the overlooked)
The impact should describe the transformation or result`;

    case "vision":
      return `

VISION STATEMENT FORMAT:
Vision statements paint a picture of your desired future—where you're headed.
Structure: "A [TIME/PLACE] where [CURRENT PROBLEM IS SOLVED] and [IDEAL STATE EXISTS]"
OR: "I see [VIVID FUTURE PICTURE]"
OR: "In 5 years, [SPECIFIC ACHIEVEMENT/STATE]"

Examples of good vision statements:
- "A home filled with peace, laughter, and financial security where my family never worries about basic needs."
- "I see myself leading a thriving business that employs 50 people from my community."
- "In 5 years, I will have built a legacy of mentorship that continues beyond my direct involvement."

Focus on feelings, achievements, and specific outcomes
Be concrete—paint a picture they can visualize
Include both personal fulfillment and impact on others`;

    case "values":
      return `

CORE VALUE FORMAT:
Core values are actionable principles that guide decisions—not just words, but rules for living.
Structure: "[VALUE NAME]: I am committed to [SPECIFIC BEHAVIOR/RULE]"

Examples of good core values:
- "Family First: I am committed to being present at dinner every night, no matter what work demands."
- "Integrity: I am committed to telling the truth even when it costs me money or reputation."
- "Growth: I am committed to learning something new every month and sharing it with others."
- "Generosity: I am committed to giving 10% of my income to causes I believe in."

The value name should be 1-3 words
The commitment should be specific and observable (not vague like "being a good person")
Someone should be able to tell if you're living this value or not`;

    case "identity":
      return `

IDENTITY SYNTHESIS:
Help the user articulate their core identity—who they are when all titles and roles are stripped away.
Focus on the essence of their being, their fundamental nature.

Examples:
- "A steward—called to care for and develop what has been entrusted to me"
- "A creator—bringing new possibilities into existence through imagination and effort"
- "A servant—finding deepest fulfillment through lifting others"

Keep it simple and profound
Connect to their answers about what brings them alive
Avoid job titles or temporary roles`;

    default:
      return "";
  }
}

function buildUserPrompt(
  responses: QuestionResponse[],
  domain: string,
  identity?: string
): string {
  let prompt = `Here are the user's answers to reflection questions about their ${domain}:\n\n`;

  responses.forEach((r, index) => {
    prompt += `Question ${index + 1}: "${r.questionText}"\n`;
    if (r.questionContext) {
      prompt += `(Context: ${r.questionContext})\n`;
    }
    prompt += `Answer: "${r.response}"\n\n`;
  });

  if (identity && domain !== "identity") {
    prompt += `\nRemember: Their core identity is "${identity}". The ${domain} should flow naturally from this identity.\n`;
  }

  prompt += `\nBased on these answers, generate 3 distinct ${domain} statement suggestions that feel authentic to this person. Each should take a slightly different angle or emphasis.`;

  return prompt;
}

function parseClaudeResponse(content: string, domain: string): GenerationResult {
  try {
    // Try to parse as JSON first
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestions: parsed.suggestions || [],
        detected_roles: validateRoles(parsed.detected_roles || []),
        detected_wellness_zones: validateZones(parsed.detected_wellness_zones || []),
      };
    }
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
  }

  // Fallback: try to extract suggestions from text
  const suggestions = extractSuggestionsFromText(content, domain);
  
  return {
    suggestions,
    detected_roles: [],
    detected_wellness_zones: [],
  };
}

function extractSuggestionsFromText(content: string, domain: string): string[] {
  const suggestions: string[] = [];
  
  // Try to find numbered or bulleted items
  const lines = content.split("\n").filter(line => line.trim());
  
  for (const line of lines) {
    const cleanLine = line
      .replace(/^[\d\.\-\*\•]+\s*/, "") // Remove numbering/bullets
      .replace(/^["']|["']$/g, "") // Remove quotes
      .trim();
    
    if (cleanLine.length > 20 && cleanLine.length < 500) {
      // Check if it looks like a statement for this domain
      if (domain === "mission" && (cleanLine.toLowerCase().startsWith("to ") || cleanLine.includes("so that"))) {
        suggestions.push(cleanLine);
      } else if (domain === "vision" && (cleanLine.includes("see") || cleanLine.includes("year") || cleanLine.includes("where"))) {
        suggestions.push(cleanLine);
      } else if (domain === "values" && cleanLine.includes(":")) {
        suggestions.push(cleanLine);
      } else if (suggestions.length < 3) {
        // Fallback: include any reasonable-looking statement
        suggestions.push(cleanLine);
      }
    }
    
    if (suggestions.length >= 3) break;
  }

  // If we still don't have enough, return generic fallbacks
  if (suggestions.length === 0) {
    return getGenericFallbacks(domain);
  }

  return suggestions.slice(0, 3);
}

function validateRoles(roles: string[]): string[] {
  return roles.filter(role => 
    VALID_ROLES.some(validRole => 
      validRole.toLowerCase() === role.toLowerCase() ||
      validRole.toLowerCase().includes(role.toLowerCase())
    )
  );
}

function validateZones(zones: string[]): string[] {
  return zones.filter(zone =>
    WELLNESS_ZONES.some(validZone =>
      validZone.toLowerCase() === zone.toLowerCase()
    )
  );
}

function getGenericFallbacks(domain: string): string[] {
  switch (domain) {
    case "mission":
      return [
        "To serve others with wisdom and compassion, creating positive change in my sphere of influence.",
        "To build and nurture relationships that help people reach their full potential.",
        "To use my unique gifts to contribute meaningfully to my family and community.",
      ];
    case "vision":
      return [
        "A life of purpose and peace, where my family is secure and my work creates lasting impact.",
        "I see myself as a respected leader in my community, having built something that outlasts me.",
        "In 5 years, I will have achieved financial freedom and the time to invest in what matters most.",
      ];
    case "values":
      return [
        "Integrity: I am committed to keeping my word, even when it's costly.",
        "Family First: I am committed to prioritizing presence over productivity at home.",
        "Growth: I am committed to continuous learning and honest self-reflection.",
      ];
    default:
      return [];
  }
}