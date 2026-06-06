import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Alignment Coach - Unified Edge Function
 *
 * Handles all three ritual modes:
 *   - Weekly Alignment (6-step guided flow with step-specific prompts)
 *   - Morning Spark (energy-adaptive daily planning)
 *   - Evening Review (reflection, brain dumps, wind-down)
 *
 * Supports both:
 *   - One-way guidance (no messages → generate a coaching message)
 *   - Two-way conversation (messages array → full chat with history)
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

function buildSystemPrompt(
  mode: string,
  step: string | undefined,
  trigger: string,
  fuelLevel: number | null,
  fuelReason: string | null,
  userState: any,
  step1Context?: any,
  stepContext?: any,
  ddMemory?: { patterns: any[]; curriculum: any[] },
): string {
  let prompt = buildBaseIdentity();
  prompt += buildUserContext(userState);
  prompt += buildLearnedMemory(ddMemory);

  if (mode === "weekly" && step) {
    prompt += buildWeeklyStepContext(step, trigger, userState, step1Context, stepContext);
  } else if (mode === "morning") {
    prompt += buildMorningContext(fuelLevel, fuelReason, userState);
  } else if (mode === "evening") {
    prompt += buildEveningContext(userState);
  }

  prompt += buildCaptureInstructions(mode);
  prompt += buildResponseGuidelines(mode, trigger);

  return prompt;
}

// --- Base Identity ---

function buildBaseIdentity(): string {
  return `You are an alignment coach inside the Authentic Life Operating System. Your role is a "mirror with memory" — you reflect what the user actually does, not just what they wish. You are warm, direct, and wise. Never preachy or generic.

CORE PRINCIPLES:
- Mirror, don't lecture. Show them their own patterns.
- Reference their real data — tasks completed, roles neglected, goals on track.
- Ask questions that reveal truth, not questions that fish for the "right" answer.
- One insight per message is enough. Let it land before moving on.
- When they're struggling, meet them where they are. When they're coasting, challenge them.
- Use their own words back to them when you can (from previous responses, reflections, mission statement).

`;
}

// --- User Context Block ---

function buildUserContext(us: any): string {
  let ctx = `USER'S NORTH STAR:\n`;
  ctx += `- Identity: ${us.core_identity || "Not yet defined"}\n`;
  ctx += `- Mission: ${us.mission_statement || "Not yet defined"}\n`;
  ctx += `- Vision: ${us.five_year_vision || "Not yet defined"}\n`;
  ctx += `- Core Values: ${us.core_values?.length ? us.core_values.join(", ") : "Not yet defined"}\n`;
  ctx += `- Life Motto: ${us.life_motto || "Not yet defined"}\n`;
  if (us.identity_insights) {
    ctx += `- Identity Insights (AI-generated): ${us.identity_insights}\n`;
  }

  // Activity summary
  if (us.activity) {
    const a = us.activity;
    ctx += `\nTHIS WEEK'S ACTIVITY:\n`;
    ctx += `- Tasks: ${a.tasks_completed_this_week ?? 0} of ${a.tasks_this_week ?? 0} completed`;
    if (a.completion_rate_this_week !== undefined) {
      ctx += ` (${a.completion_rate_this_week}% completion rate)`;
    }
    ctx += `\n`;
    ctx += `- Overdue: ${a.tasks_overdue ?? 0} tasks\n`;
    ctx += `- Deposits this week: ${a.deposits_this_week ?? 0}\n`;

    if (a.recent_completed_titles?.length) {
      ctx += `- Recently completed: ${a.recent_completed_titles.slice(0, 5).join(", ")}\n`;
    }
    if (a.recent_task_titles?.length) {
      ctx += `- Pending tasks: ${a.recent_task_titles.slice(0, 5).join(", ")}\n`;
    }
    if (a.neglected_roles?.length) {
      ctx += `- Neglected roles (zero activity): ${a.neglected_roles.join(", ")}\n`;
    }
  }

  // Overdue items (from chatBubbleService format)
  if (us.overdue_items?.length) {
    ctx += `\nOVERDUE ITEMS:\n`;
    us.overdue_items.forEach((item: string) => {
      ctx += `- ${item}\n`;
    });
  }

  // Roles
  if (us.roles?.length) {
    ctx += `\nACTIVE ROLES:\n`;
    us.roles.forEach((r: any) => {
      ctx += `- ${r.label}`;
      if (r.category) ctx += ` [${r.category}]`;
      if (r.tasks_this_week !== undefined) {
        ctx += ` — ${r.tasks_completed_this_week ?? 0}/${r.tasks_this_week} tasks`;
      }
      if (r.purpose) ctx += ` (purpose: ${r.purpose})`;
      ctx += `\n`;
    });
  }

  // Goals
  if (us.goals?.length) {
    ctx += `\n12-WEEK GOALS:\n`;
    us.goals.forEach((g: any) => {
      ctx += `- ${g.title}`;
      if (g.progress_percent !== undefined) ctx += ` [${g.progress_percent}% complete]`;
      if (g.target_date) ctx += ` (target: ${g.target_date})`;
      if (g.tasks_linked) ctx += ` — ${g.tasks_completed ?? 0}/${g.tasks_linked} tasks done`;
      ctx += `\n`;
    });
  }

  // Recent reflections
  if (us.recent_reflections?.length) {
    ctx += `\nRECENT REFLECTIONS:\n`;
    us.recent_reflections.slice(0, 5).forEach((r: any) => {
      ctx += `- [${r.type}] ${r.content}`;
      if (r.date) ctx += ` (${r.date})`;
      ctx += `\n`;
    });
  }

  // Recent notes
  if (us.recent_notes?.length) {
    ctx += `\nRECENT NOTES:\n`;
    us.recent_notes.slice(0, 3).forEach((n: string) => {
      ctx += `- ${n}\n`;
    });
  }

  // Previous coaching summaries
  if (us.recent_summaries?.length) {
    ctx += `\nRECENT COACHING SESSIONS (summaries):\n`;
    us.recent_summaries.slice(0, 5).forEach((s: string, i: number) => {
      ctx += `- Session ${i + 1}: ${s}\n`;
    });
    ctx += `Reference these when relevant — e.g. "Last week you committed to X — how did that go?"\n`;
  }

  // Question responses (Power Questions)
  if (us.question_responses?.length) {
    ctx += `\nPOWER QUESTION RESPONSES:\n`;
    us.question_responses.slice(0, 10).forEach((qr: any) => {
      ctx += `- Q: ${qr.question_text}\n  A: ${qr.response_text}\n`;
      if (qr.domain) ctx += `  Domain: ${qr.domain}\n`;
    });
  }

  // Experience level
  const alignments = us.total_alignments_completed ?? 0;
  if (alignments === 0) {
    ctx += `\nEXPERIENCE: First-time user. Be welcoming and explain concepts gently.\n`;
  } else if (alignments < 4) {
    ctx += `\nEXPERIENCE: Early user (${alignments} alignments completed). Still learning the system.\n`;
  } else if (alignments < 12) {
    ctx += `\nEXPERIENCE: Regular user (${alignments} alignments). Familiar with the flow.\n`;
  } else {
    ctx += `\nEXPERIENCE: Seasoned practitioner (${alignments} alignments). Go deeper, challenge more.\n`;
  }

  return ctx;
}

// --- Learned Memory Block ---
//
// Renders the DD's accumulated read of this person:
//   - OBSERVATIONS: patterns the DD has come to notice (private lens — frames
//     attention, doesn't get recited back).
//   - CONCEPTS: curriculum progress (what's been introduced vs. practiced).
//
// Empty-safe by design: if both arrays are empty (the current reality — no
// patterns exist yet), returns "" so the assembled prompt is byte-identical
// to today. This guarantees zero behavior change until Step 4 starts writing
// real patterns. 0008-ap-dd-assumptions is deliberately NOT rendered here —
// assumptions are never coach-visible and must never reach a Claude prompt.

function buildLearnedMemory(
  ddMemory: { patterns: any[]; curriculum: any[] } | null | undefined,
): string {
  const patterns = ddMemory?.patterns ?? [];
  const curriculum = ddMemory?.curriculum ?? [];

  if (patterns.length === 0 && curriculum.length === 0) {
    return "";
  }

  let block = "";

  if (patterns.length > 0) {
    block += `\nWHAT YOU'VE COME TO NOTICE ABOUT THIS PERSON:
These are your own quiet observations, gathered over time — a private lens, not a list to read aloud. Unlike the activity above, which you can name directly, these are inferences about who they are. Let them shape the question you choose, where you place your attention, and how gently you tread — but do not announce that you remember, and do not recite them back. Name one only on the rare occasion when saying it out loud hands this person an insight into themselves — and then for their sake, never to prove that you noticed. Lean on settled observations; hold forming ones lightly, and never state a forming one as fact.

OBSERVATIONS:
`;

    patterns.forEach((p: any) => {
      const text = p?.pattern_text;
      if (!text) return;
      const confidence = p?.confidence;
      const lifeArea = p?.life_area;
      let line = "- ";
      if (confidence) line += `(${confidence}) `;
      line += text;
      if (lifeArea) line += ` — ${lifeArea}`;
      block += `${line}\n`;
    });
  }

  if (curriculum.length > 0) {
    block += `\nCONCEPTS THEY'VE WORKED WITH:
`;

    curriculum.forEach((c: any) => {
      const concept = c?.concept;
      if (!concept) return;
      const status = c?.status;
      let line = `- ${concept}`;
      if (status) line += ` — ${status}`;
      block += `${line}\n`;
    });

    block += `Build on ideas they've already met. Don't assume fluency with anything not listed here.\n`;
  }

  return block;
}

// ============================================
// WEEKLY ALIGNMENT STEP CONTEXTS
// ============================================

function buildWeeklyStepContext(
  step: string,
  trigger: string,
  userState: any,
  step1Context?: any,
  stepContext?: any
): string {
  const stepPrompts: Record<string, () => string> = {
    step_1: () => buildStep1Prompt(trigger, userState, step1Context),
    step_2: () => buildStep2Prompt(trigger, userState, stepContext),
    step_3: () => buildStep3Prompt(trigger, userState, stepContext),
    step_4: () => buildStep4Prompt(trigger, userState, stepContext),
    step_5: () => buildStep5Prompt(trigger, userState, stepContext),
    step_6: () => buildStep6Prompt(trigger, userState, stepContext),
  };

  const builder = stepPrompts[step];
  if (!builder) {
    return `\nRITUAL: Weekly Alignment\nProvide thoughtful guidance for the current step.\n`;
  }
  return builder();
}

// ============================================
// STEP 1 HELPER FUNCTIONS
// ============================================

/**
 * Describes what the user currently sees on screen.
 * Gives the AI context about the UI state so responses match the moment.
 */
function buildStep1ScreenContext(ctx: any): string {
  if (!ctx) return "";

  const flowDescriptions: Record<string, string> = {
    "hero-question": "The user sees the opening 'Who is your hero?' question — the gateway to identity discovery.",
    "identity-hub": "The user is on the Identity Hub — they can see their core identity (if set) and cards for Mission, Vision, and Values. This is the central navigation point for Step 1.",
    "choice": "The user is choosing HOW to define a domain — they can pick 'Guided Questions' (AI-assisted) or 'Direct Input' (write it themselves).",
    "direct-input": "The user is typing their own statement directly — they've chosen to write it themselves rather than use guided questions.",
    "guided-questions": "The user is answering guided Power Questions — the AI is helping them discover their statement through reflection.",
    "synthesis": "The user is reviewing AI-generated suggestions based on their question answers. They're choosing which suggestion resonates most or editing one.",
    "value-entry": "The user is entering a core value — typing a value name and optionally a description of what it means to them.",
  };

  let screen = `\nCURRENT SCREEN STATE:\n`;
  screen += `- Flow: ${flowDescriptions[ctx.flow_state] || ctx.flow_state}\n`;

  if (ctx.current_domain) {
    screen += `- Working on: ${ctx.current_domain.toUpperCase()} domain\n`;
  }

  if (ctx.flow_state === "guided-questions") {
    if (ctx.questions_answered_in_session !== undefined && ctx.questions_total_in_session !== undefined) {
      screen += `- Question progress: ${ctx.questions_answered_in_session} of ${ctx.questions_total_in_session} answered\n`;
    }
    if (ctx.current_question_text) {
      screen += `- Current question: "${ctx.current_question_text}"\n`;
    }
  }

  if (ctx.synthesis_active) {
    screen += `- AI synthesis suggestions are displayed for review\n`;
  }

  if (ctx.identity_selection_method) {
    screen += `- Identity was selected via: ${ctx.identity_selection_method === "spark_list" ? "Spark List" : "Custom input"}\n`;
    if (ctx.spark_list_selection) {
      screen += `- Spark List choice: "${ctx.spark_list_selection}"\n`;
    }
  }

  return screen;
}

/**
 * Shows which North Star domains are complete vs pending.
 * Helps the coach guide the user toward undefined areas.
 */
function buildDomainCompletionContext(dc: any, us: any): string {
  if (!dc) return "";

  let ctx = `\nNORTH STAR COMPLETION:\n`;
  ctx += `- Identity: ${dc.identity ? "✓ Defined" : "○ Not yet defined"}\n`;
  ctx += `- Mission: ${dc.mission ? "✓ Defined" : "○ Not yet defined"}\n`;
  ctx += `- Vision: ${dc.vision ? "✓ Defined" : "○ Not yet defined"}\n`;
  ctx += `- Values: ${dc.values ? `✓ ${us.core_values?.length || 0} value(s) defined` : "○ None yet"}\n`;

  const definedCount = [dc.identity, dc.mission, dc.vision, dc.values].filter(Boolean).length;
  if (definedCount === 4) {
    ctx += `All four domains are defined. This is a CHECK-IN, not a first draft.\n`;
  } else if (definedCount === 0) {
    ctx += `No domains defined yet. This is a FIRST TIME journey — be welcoming and patient.\n`;
  } else {
    const pending = [];
    if (!dc.identity) pending.push("Identity");
    if (!dc.mission) pending.push("Mission");
    if (!dc.vision) pending.push("Vision");
    if (!dc.values) pending.push("Values");
    ctx += `Still needed: ${pending.join(", ")}. Gently encourage exploring these when the moment is right.\n`;
  }

  return ctx;
}

/**
 * Cross-references identity, mission, vision, and values for alignment/tension.
 * Only fires when ≥2 domains are defined, giving the coach synthesis material.
 */
function buildMVVSynthesisContext(us: any): string {
  const defined: string[] = [];
  if (us.core_identity) defined.push("identity");
  if (us.mission_statement) defined.push("mission");
  if (us.five_year_vision) defined.push("vision");
  if (us.core_values?.length) defined.push("values");

  if (defined.length < 2) return "";

  let ctx = `\nMVV SYNTHESIS (cross-reference for alignment/tension):\n`;

  if (us.core_identity && us.mission_statement) {
    ctx += `- Identity → Mission: Does their mission ("${us.mission_statement.substring(0, 60)}...") flow naturally from their identity ("${us.core_identity}")? Look for alignment or disconnect.\n`;
  }

  if (us.mission_statement && us.five_year_vision) {
    ctx += `- Mission → Vision: Is their 5-year vision a logical destination for someone living their mission? Or is there a gap?\n`;
  }

  if (us.core_values?.length && us.mission_statement) {
    ctx += `- Values → Mission: Do their values (${us.core_values.slice(0, 3).join(", ")}) support their mission? Any tension?\n`;
  }

  if (us.core_values?.length && us.five_year_vision) {
    ctx += `- Values → Vision: Will their values carry them toward their vision, or create friction along the way?\n`;
  }

  ctx += `Use these cross-references to ask revealing questions or affirm coherence. Don't dump all observations at once — pick the most relevant one for this moment.\n`;

  return ctx;
}

/**
 * Groups question responses by domain and shows current domain first.
 * Enables the coach to reference specific user words and build on previous answers.
 */
function buildQuestionThreadingContext(responses: any[], currentDomain?: string | null): string {
  if (!responses?.length) return "";

  // Group by domain
  const byDomain: Record<string, any[]> = {};
  responses.forEach((qr: any) => {
    const domain = qr.domain || "general";
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(qr);
  });

  let ctx = `\nPREVIOUS QUESTION RESPONSES (use to thread the conversation):\n`;

  // Show current domain first if specified
  const domains = Object.keys(byDomain);
  if (currentDomain && byDomain[currentDomain]) {
    ctx += `Current domain (${currentDomain}):\n`;
    byDomain[currentDomain].slice(0, 5).forEach((qr: any) => {
      ctx += `  Q: ${qr.question_text}\n  A: "${qr.response_text}"\n`;
    });
    ctx += `\n`;
  }

  // Then other domains
  domains.filter((d) => d !== currentDomain).forEach((domain) => {
    ctx += `${domain}:\n`;
    byDomain[domain].slice(0, 3).forEach((qr: any) => {
      ctx += `  Q: ${qr.question_text}\n  A: "${qr.response_text}"\n`;
    });
  });

  ctx += `THREADING INSTRUCTION: When the user answers a question, reference their specific words from previous answers. Build connections. Example: "Earlier you said '[their words]' — how does that connect to what you just shared?"\n`;

  return ctx;
}

/**
 * Short domain-specific coaching hint based on what the user already has defined.
 */
function getDomainCoachingHint(domain: string | null | undefined, us: any): string {
  if (!domain) return "";

  switch (domain) {
    case "mission":
      if (us.core_identity) {
        return `\nDOMAIN COACHING (Mission): Their identity is "${us.core_identity}". A mission flows FROM identity — it answers "What am I here to do as this person?" Help them connect the two. A mission is not a job description; it's the impact they want to make.\n`;
      }
      return `\nDOMAIN COACHING (Mission): A mission answers "Why am I here?" It should be actionable and personally meaningful. Help them find the verb — missions start with doing, not being.\n`;

    case "vision":
      if (us.mission_statement) {
        return `\nDOMAIN COACHING (Vision): Their mission is "${us.mission_statement.substring(0, 80)}...". A vision is the DESTINATION — if they live their mission for 5 years, what does life look like? Paint the picture. Vision should be vivid and sensory, not abstract.\n`;
      }
      return `\nDOMAIN COACHING (Vision): A 5-year vision answers "Where am I going?" Make it concrete and visual. "I see myself..." not "I hope to...". Include relationships, environment, impact, feelings.\n`;

    case "values":
      return `\nDOMAIN COACHING (Values): Values are guardrails — they define HOW the user travels toward their vision. Good values are specific enough to guide decisions. "Integrity" is too vague; "I tell the truth even when it costs me" is a value you can live by. Help them go deeper than single words.\n`;

    default:
      return "";
  }
}

/**
 * Builds context-aware idle nudges based on where the user is stuck.
 */
function buildStep1IdleNudge(ctx: any, us: any): string {
  if (!ctx) {
    return `\nThe user has been sitting on this step. Give a gentle nudge:
- "Take a breath. You don't have to rewrite your mission — just check if it still resonates."
- Don't rush them. This step is about presence, not productivity.\n`;
  }

  let nudge = `\nThe user has been idle. Give a flow-state-aware nudge:\n`;

  switch (ctx.flow_state) {
    case "hero-question":
      nudge += `- They're stuck on the hero question. This might feel heavy. Lighten it:
  "There's no wrong answer. It could be someone famous, a family member, a fictional character — even your future self. Who comes to mind first?"\n`;
      break;
    case "identity-hub":
      nudge += `- They're on the Identity Hub, maybe unsure where to start.
  "You don't have to do these in order. Which one calls to you — Mission, Vision, or Values? Start where you feel energy."\n`;
      break;
    case "choice":
      nudge += `- They're deciding between Guided Questions and Direct Input.
  "Not sure? Try the guided questions — they're designed to pull the words out of you. You can always edit the result."\n`;
      break;
    case "guided-questions":
      if (ctx.current_question_text) {
        nudge += `- They're stuck on: "${ctx.current_question_text}"
  Don't answer for them, but reframe the question from a different angle. Or say: "Sometimes the first thing that comes to mind — before you filter it — is the most honest answer."\n`;
      } else {
        nudge += `- They're in the guided questions flow but paused.
  "Take your time. These questions are designed to go deep, not fast."\n`;
      }
      break;
    case "synthesis":
      nudge += `- They're reviewing AI suggestions but haven't chosen one.
  "Read them out loud — the one that makes your chest tighten or your eyes water is probably closest to the truth. Or grab pieces from multiple options."\n`;
      break;
    case "direct-input":
      nudge += `- They're in direct input but haven't typed.
  "Writer's block? Try finishing this sentence: 'My life is about...' or 'I exist to...' Don't edit — just write what comes."\n`;
      break;
    case "value-entry":
      nudge += `- They're entering a value but paused.
  "Think about a time you felt most alive, most proud, most YOU. What principle were you honoring in that moment?"\n`;
      break;
    default:
      nudge += `- "Take a breath. You don't have to rewrite your mission — just check if it still resonates."\n`;
  }

  return nudge;
}

/**
 * Builds trigger-specific coaching instructions for Step 1.
 * Each trigger gets tailored instructions based on what just happened.
 */
function buildStep1TriggerInstructions(trigger: string, us: any, ctx: any): string {
  switch (trigger) {
    case "enter": {
      const isFirstTime = !us.core_identity && !us.mission_statement && !us.five_year_vision && !us.core_values?.length;
      if (isFirstTime) {
        return `\nTRIGGER: First visit — Mission Drafter mode.
The user has never defined their North Star. This is a significant moment.
- Welcome them warmly. This step is about DISCOVERY, not performance.
- Don't overwhelm with all four domains. Start with identity.
- Ask a single powerful question: "Who are you at your core — beyond your roles and responsibilities?"
- Make it safe to start rough. "Your North Star doesn't have to be perfect. It just has to be honest."
- If they have identity_insights from a previous interaction, reference those gently.\n`;
      } else {
        return `\nTRIGGER: Returning visit — Check-in mode.
The user has been here before. Show them you remember.
- Reference their existing North Star elements specifically.
- Ask: "Does this still feel true? Has anything shifted since last week?"
- If they have question responses, note any evolution in their thinking.
- Keep it brief — they know the drill. One focused question is better than a review.\n`;
      }
    }

    case "identity_selected":
      return `\nTRIGGER: The user just selected/saved their core identity${ctx?.spark_list_selection ? ` — they chose "${ctx.spark_list_selection}" from the Spark List` : ""}.
- Affirm their choice with genuine warmth. This is a meaningful moment.
- Bridge to Mission: "Now that you know WHO you are, let's explore WHY you're here."
- If they chose from the Spark List, acknowledge what drew them to that identity.
- If identity_insights exist, weave one insight into your affirmation.
- Keep it to 2-3 sentences — let the moment breathe.\n`;

    case "domain_started":
      return `\nTRIGGER: The user just opened a domain flow (${ctx?.current_domain || "unknown"}).
- Give a brief, encouraging domain-specific introduction.
- If they chose Guided Questions: "Great choice — I'll walk you through some questions that help you discover your own words."
- If they chose Direct Input: "You know yourself. Write what comes to mind — you can always refine it."
- Keep it to 1-2 sentences. Don't front-load too much coaching — let the questions do the work.\n`;

    case "question_answered": {
      const progress = ctx?.questions_answered_in_session !== undefined && ctx?.questions_total_in_session
        ? `${ctx.questions_answered_in_session}/${ctx.questions_total_in_session}`
        : "unknown";
      return `\nTRIGGER: The user just answered a guided question (progress: ${progress}).
- Acknowledge their answer briefly. Don't evaluate it — mirror it.
- If they're early in the flow, encourage depth: "That's a strong start. Let's keep going."
- If they're near the end, preview what's coming: "One more question, then I'll help synthesize what you've shared."
- Reference their specific words from this answer or thread to a previous one.
- Keep it to 1-2 sentences. The guided questions are doing the heavy lifting.\n`;
    }

    case "synthesis_ready":
      return `\nTRIGGER: AI synthesis suggestions are now displayed for the user to review.
- Help them evaluate: "Read each option slowly. Which one makes your chest tighten or your eyes light up?"
- Encourage combining: "You can take the beginning of one and the end of another. These are starting points, not final answers."
- Don't pick for them. Your job is to help them FEEL which one is truest.
- If they have previous domain definitions, check for coherence: "Does this align with your [identity/mission/values]?"
- Keep it to 2-3 sentences.\n`;

    case "domain_completed": {
      const domain = ctx?.current_domain || "a domain";
      const dc = ctx?.domain_completion;
      let nextDomain = "";
      if (dc) {
        if (!dc.mission) nextDomain = "Mission";
        else if (!dc.vision) nextDomain = "Vision";
        else if (!dc.values) nextDomain = "Values";
      }
      return `\nTRIGGER: The user just saved their ${domain} statement. Celebrate!
- Genuine, brief celebration: "That's powerful." or "That took courage to put into words."
- If this is their FIRST domain, the momentum matters: "One down. You're building something real."
${nextDomain ? `- Gently point to next: "When you're ready, ${nextDomain.toLowerCase()} is waiting for you."` : "- All domains are now defined! Affirm the completeness: \"Your North Star is fully defined. That's rare and remarkable.\""}
- Keep it to 2-3 sentences. Let the completion land.\n`;
    }

    case "domain_skipped":
      return `\nTRIGGER: The user backed out of a domain without saving.
- No guilt. No pressure. Grace: "That's okay. Sometimes you need to sit with the question before the answer comes."
- Don't ask why they skipped. If they want to share, they will.
- Brief mention that it's still available: "It'll be here when you're ready."
- Keep it to 1-2 sentences.\n`;

    case "idle":
      return buildStep1IdleNudge(ctx, us);

    case "complete":
      return `\nTRIGGER: Step 1 complete. Brief affirmation, pivot forward.
- "Your compass heading is set. Let's see who needs your attention this week."
- Keep it to 1 sentence.\n`;

    case "skip":
      return `\nTRIGGER: User skipped Step 1.
- Brief, no guilt: "We can always come back to your North Star. Let's keep moving."
- Keep it to 1 sentence.\n`;

    case "return":
      return `\nTRIGGER: User returned to Step 1.
- "Good — let's take another look." Don't re-explain the step.
- Check what's changed since they were last here.
- Keep it to 1-2 sentences.\n`;

    case "user_message":
      return `\nTRIGGER: Two-way conversation. The user sent a message while on Step 1.
- Respond naturally, using the screen context and domain context to inform your answer.
- If they're asking about their identity/mission/vision/values, use the cross-reference synthesis.
- If they're asking about a question they're answering, help them think through it without giving them the answer.\n`;

    default:
      return `\nProvide thoughtful Step 1 guidance based on the current context.\n`;
  }
}

// Step 1: Touch Your Star (North — 0°)
function buildStep1Prompt(trigger: string, us: any, step1Context?: any): string {
  let prompt = `\nRITUAL: Weekly Alignment — Step 1 of 6: TOUCH YOUR STAR
COMPASS: North (0°) — The Gold spindle points straight up.
POWER QUESTIONS: PQ1 (Who am I?) and PQ2 (Why am I here?)

Your job is to help the user reconnect with their North Star. This is about identity and purpose, not tasks.
`;

  // Add screen context (what the user currently sees)
  prompt += buildStep1ScreenContext(step1Context);

  // Add domain completion status
  if (step1Context?.domain_completion) {
    prompt += buildDomainCompletionContext(step1Context.domain_completion, us);
  }

  // Add domain-specific coaching hint
  if (step1Context?.current_domain) {
    prompt += getDomainCoachingHint(step1Context.current_domain, us);
  }

  // Add MVV cross-reference synthesis
  prompt += buildMVVSynthesisContext(us);

  // Add question threading context
  if (us.question_responses?.length) {
    prompt += buildQuestionThreadingContext(us.question_responses, step1Context?.current_domain);
  }

  // Add identity insights if available
  if (us.identity_insights || step1Context?.identity_insights) {
    const insights = us.identity_insights || step1Context?.identity_insights;
    prompt += `\nIDENTITY INSIGHTS (from previous AI analysis):\n${insights}\nWeave these naturally into your coaching — don't read them back verbatim, but use them to show you understand this person deeply.\n`;
  }

  // Add trigger-specific instructions
  prompt += buildStep1TriggerInstructions(trigger, us, step1Context);

  return prompt;
}

// Step 2: Wing Check — Roles (West — 270°)
// ============================================
// STEP 2 HELPER FUNCTIONS
// ============================================

function buildRoleAnalysisContext(us: any): string {
  const roles = us.roles || [];
  if (roles.length === 0) return "";

  let ctx = `\nROLE ANALYSIS:\n`;
  ctx += `- ${roles.length} active roles\n`;

  // Find busiest and quietest
  const sorted = [...roles].sort((a: any, b: any) => (b.tasks_this_week || 0) - (a.tasks_this_week || 0));
  const busiest = sorted[0];
  const quietest = sorted[sorted.length - 1];
  if (busiest && (busiest.tasks_this_week || 0) > 0) {
    ctx += `- Busiest: "${busiest.label}" (${busiest.tasks_this_week} tasks, ${busiest.tasks_completed_this_week || 0} completed)\n`;
  }
  if (quietest && quietest.label !== busiest?.label) {
    ctx += `- Quietest: "${quietest.label}" (${quietest.tasks_this_week || 0} tasks)\n`;
  }

  // Neglected roles
  const neglected = us.activity?.neglected_roles || [];
  if (neglected.length > 0) {
    ctx += `- NEGLECTED (zero activity): ${neglected.join(", ")}\n`;
  }

  // Roles with/without purpose
  const withPurpose = roles.filter((r: any) => r.purpose).map((r: any) => r.label);
  const withoutPurpose = roles.filter((r: any) => !r.purpose).map((r: any) => r.label);
  if (withPurpose.length > 0) ctx += `- WITH purpose defined: ${withPurpose.join(", ")}\n`;
  if (withoutPurpose.length > 0) ctx += `- WITHOUT purpose: ${withoutPurpose.join(", ")}\n`;

  // Deposit distribution
  const rolesWithDeposits = roles.filter((r: any) => (r.deposits_this_week || 0) > 0);
  if (rolesWithDeposits.length > 0) {
    ctx += `- Deposits: ${rolesWithDeposits.map((r: any) => `${r.label} (${r.deposits_this_week})`).join(", ")}\n`;
  }

  return ctx;
}

function buildSelectedRoleContext(stepCtx: any, us: any): string {
  if (!stepCtx?.context_data?.selected_role_label) return "";
  const roles = us.roles || [];
  const role = roles.find((r: any) => r.label === stepCtx.context_data.selected_role_label);
  if (!role) return "";

  let ctx = `\nSELECTED ROLE: ${role.label} [${role.category || "General"}]\n`;
  if (role.purpose) ctx += `- Purpose: "${role.purpose}"\n`;
  ctx += `- Tasks this week: ${role.tasks_this_week || 0} (${role.tasks_completed_this_week || 0} completed)\n`;
  ctx += `- Deposits: ${role.deposits_this_week || 0}\n`;
  if (role.last_deposit_date) ctx += `- Last deposit: ${role.last_deposit_date}\n`;
  return ctx;
}

function buildStep2IdleNudge(stepCtx: any, us: any): string {
  const flowState = stepCtx?.flow_state || "main";
  const nudges: Record<string, string> = {
    "activate-roles": "Need help deciding which roles to focus on this week? Think about who depends on you most.",
    "prioritize": "Just pick the 3-5 roles that need your attention most. Not all roles need focus every week — that's wisdom, not neglect.",
    "main": "Your roles are like wings — if one is overworked and another ignored, the flight path drifts. Which wing needs a tune-up?",
    "review-roles": "Tap on any role to go deeper — see its purpose, captures, and set a ONE Thing for the week.",
    "role-reflection": `Take your time here. What would a small deposit look like this week?`,
  };
  return nudges[flowState] || nudges["main"];
}

function buildStep2TriggerInstructions(trigger: string, us: any, stepCtx: any): string {
  const roles = us.roles || [];
  const neglected = us.activity?.neglected_roles || [];

  if (trigger === "enter") {
    if (roles.length === 0) {
      return `\nThe user has no roles defined. Help them think about roles:
- "Who are you to the people and projects in your life?"
- Don't list generic roles — draw from their North Star: identity ("${us.core_identity || "..."}") and mission ("${us.mission_statement || "..."}").
- Suggest 3-5 starting roles based on what you know about them.\n`;
    }
    let inst = `\nThe user has ${roles.length} active roles. Give a brief role health overview:\n`;
    if (neglected.length > 0) {
      inst += `- NEGLECTED this week (zero activity): ${neglected.join(", ")}. Ask: "I notice ${neglected[0]} got no attention this week. Intentional, or did life crowd it out?"\n`;
    }
    inst += `- Highlight the contrast between the busiest and quietest role.\n`;
    inst += `- Ask if the distribution matches what matters most to them.\n`;
    return inst;
  }
  if (trigger === "roles_prioritized") {
    const count = stepCtx?.context_data?.roles_prioritized_count || 0;
    let inst = `\nThe user just prioritized ${count} roles for this week. Affirm their choices.\n`;
    if (neglected.length > 0) {
      const neglectedChosen = neglected.filter((n: string) =>
        roles.some((r: any) => r.label === n)
      );
      if (neglectedChosen.length > 0) {
        inst += `- Good: they chose previously neglected role(s). Acknowledge: "Good — ${neglectedChosen[0]} needs your attention."\n`;
      } else {
        inst += `- Note gently: "I notice ${neglected[0]} didn't make the cut. Intentional?"\n`;
      }
    }
    return inst;
  }
  if (trigger === "role_reflection_opened") {
    const label = stepCtx?.context_data?.selected_role_label || "this role";
    const purpose = stepCtx?.context_data?.selected_role_purpose;
    let inst = `\nThe user opened "${label}" for deeper reflection.\n`;
    if (purpose) inst += `- Their purpose for this role: "${purpose}" — reference it.\n`;
    inst += `- Be a companion, not a lecturer. Brief intro: what does the data say about this role this week?\n`;
    return inst;
  }
  if (trigger === "role_one_thing_saved") {
    const label = stepCtx?.context_data?.selected_role_label || "their role";
    return `\nThe user committed to a ONE Thing for "${label}". Celebrate this concrete step. Bridge: "Ready to look at another role, or want to capture more for this one?"\n`;
  }
  if (trigger === "role_deposit_saved") {
    const label = stepCtx?.context_data?.selected_role_label || "their role";
    return `\nThe user saved a deposit idea for "${label}". Affirm investment thinking: "Deposits compound over time." If other roles have zero deposits, gently suggest cross-role deposits.\n`;
  }
  if (trigger === "role_health_flagged") {
    const label = stepCtx?.context_data?.selected_role_label || "a role";
    const flag = stepCtx?.context_data?.health_flag || "stable";
    if (flag === "thriving") return `\nThe user flagged "${label}" as thriving! Celebrate: "That's great energy. What's making it work?" (1-2 sentences)\n`;
    if (flag === "needs_attention") return `\nThe user flagged "${label}" as needing attention. Empathize: "What would the smallest meaningful action look like this week?" Don't pile on pressure.\n`;
    return `\nThe user flagged "${label}" as stable. Acknowledge briefly. "Stable is underrated. Anything you'd want to nudge forward?"\n`;
  }
  if (trigger === "idle") {
    return `\nNudge: "${buildStep2IdleNudge(stepCtx, us)}"\n`;
  }
  if (trigger === "complete") return `\n"Your roles have been honored. Let's check your wellness." (1 sentence, transition forward)\n`;
  if (trigger === "skip") return `\n"Your roles will be here next week." No guilt. (1 sentence)\n`;
  if (trigger === "return") return `\n"Good — let's revisit. What shifted since you were last here?" (1 sentence)\n`;
  // user_message (2-way chat) — provide full context
  return "";
}

function buildStep2Prompt(trigger: string, us: any, stepCtx?: any): string {
  let prompt = `\nRITUAL: Weekly Alignment — Step 2 of 6: WING CHECK — ROLES
COMPASS: West (270°) — The Gold spindle swings to the left.
POWER QUESTION ECHO: PQ1 (Who am I? — through the lens of roles)

Your job is to help the user review their active roles, spot imbalances, and commit to focused action.
`;

  // Always include role analysis
  prompt += buildRoleAnalysisContext(us);

  // If in role-reflection, include selected role context
  if (stepCtx?.flow_state === "role-reflection") {
    prompt += buildSelectedRoleContext(stepCtx, us);
  }

  // Trigger-specific instructions
  const triggerInst = buildStep2TriggerInstructions(trigger, us, stepCtx);
  if (triggerInst) prompt += triggerInst;

  return prompt;
}

// ============================================
// STEP 3 HELPER FUNCTIONS
// ============================================

function buildZoneAnalysisContext(us: any): string {
  const zoneActivity = us.activity?.zone_activity || [];
  const neglectedZones = us.activity?.neglected_zones || [];

  let ctx = `\nWELLNESS ZONE ANALYSIS:\n`;
  ctx += `- 8 zones: Physical, Emotional, Intellectual, Social, Spiritual, Financial, Recreational, Community\n`;

  if (zoneActivity.length > 0) {
    const active = zoneActivity.filter((z: any) => (z.tasks_this_week || 0) > 0);
    if (active.length > 0) {
      ctx += `- Active zones: ${active.map((z: any) => `${z.name} (${z.tasks_this_week} activities)`).join(", ")}\n`;
    }
  }
  if (neglectedZones.length > 0) {
    ctx += `- NEGLECTED (zero activity): ${neglectedZones.join(", ")}\n`;
  }

  // Cross-zone opportunities hint
  if (neglectedZones.length >= 2) {
    ctx += `- CROSS-ZONE HINT: Suggest actions that touch multiple zones simultaneously (e.g., "Exercise with a friend" = Physical + Social).\n`;
  }

  return ctx;
}

function buildStep3TriggerInstructions(trigger: string, us: any, stepCtx: any): string {
  const neglectedZones = us.activity?.neglected_zones || [];

  if (trigger === "enter") {
    let inst = `\nGive a wellness balance snapshot:\n`;
    inst += `- Mirror what you see: which zones are active, which are quiet.\n`;
    inst += `- Don't judge. Just reflect: "Physical is getting attention. Financial and Spiritual have been quiet."\n`;
    if (neglectedZones.length > 0) {
      inst += `- ${neglectedZones.length} zones have zero activity. Name them without shame.\n`;
    }
    inst += `- Ask: "Not every zone needs heavy attention every week. Which ones are calling to you?"\n`;
    if (us.recent_reflections?.length > 0) {
      inst += `- Reference recent reflections that relate to wellness (stress, health, relationships).\n`;
    }
    return inst;
  }
  if (trigger === "zones_prioritized") {
    const count = stepCtx?.context_data?.zones_prioritized_count || 0;
    let inst = `\nThe user prioritized ${count} wellness zones. Affirm their choices.\n`;
    if (neglectedZones.length > 0) {
      inst += `- If they chose neglected zones: "Good — ${neglectedZones[0]} needs your attention."\n`;
      inst += `- If all chosen zones are already active: "Notice that ${neglectedZones[0]} had zero activity. Is that intentional?"\n`;
    }
    return inst;
  }
  if (trigger === "zone_reflection_opened") {
    const zoneName = stepCtx?.context_data?.selected_zone_name || "this zone";
    return `\nThe user opened "${zoneName}" for reflection. Brief companion intro: what does the data say about this zone? Reference their fulfillment vision if they have one.\n`;
  }
  if (trigger === "zone_one_thing_saved") {
    const zoneName = stepCtx?.context_data?.selected_zone_name || "this zone";
    return `\nThe user committed to a ONE Thing for "${zoneName}". Celebrate. Suggest cross-zone potential: "Could this action also serve another zone?"\n`;
  }
  if (trigger === "zone_vision_saved") {
    const zoneName = stepCtx?.context_data?.selected_zone_name || "this zone";
    return `\nThe user saved a fulfillment vision for "${zoneName}". Affirm: "That's a powerful vision." Bridge to action: "What's one small step toward it this week?"\n`;
  }
  if (trigger === "idle") {
    return `\nNudge: "Wellness isn't about being perfect in every zone. It's about knowing which ones need just a small deposit this week."\n`;
  }
  if (trigger === "complete") return `\n"Your wings are checked. Time to look at your goals." (1 sentence, transition)\n`;
  if (trigger === "skip") return `\n"Your wellness zones will be here next week." No guilt. (1 sentence)\n`;
  if (trigger === "return") return `\n"Good — let's take another look at your wellness." (1 sentence)\n`;
  return "";
}

function buildStep3Prompt(trigger: string, us: any, stepCtx?: any): string {
  let prompt = `\nRITUAL: Weekly Alignment — Step 3 of 6: WING CHECK — WELLNESS
COMPASS: East (90°) — The Gold spindle swings right.
POWER QUESTION ECHO: PQ1 (Who am I? — through the lens of wellness)

Your job is to help the user honestly assess their wellness balance across all 8 zones and commit to focused action.
`;

  prompt += buildZoneAnalysisContext(us);

  const triggerInst = buildStep3TriggerInstructions(trigger, us, stepCtx);
  if (triggerInst) prompt += triggerInst;

  return prompt;
}

// ============================================
// STEP 4 HELPER FUNCTIONS
// ============================================

function buildGoalAnalysisContext(us: any): string {
  const goals = us.goals || [];
  if (goals.length === 0) return "\nGOAL ANALYSIS: No goals defined yet.\n";

  let ctx = `\nGOAL ANALYSIS:\n`;
  ctx += `- ${goals.length} active goal(s)\n`;

  const onTrack = goals.filter((g: any) => (g.progress_percent || 0) >= 50);
  const atRisk = goals.filter((g: any) => (g.progress_percent || 0) < 25 && (g.progress_percent || 0) >= 0);

  if (onTrack.length > 0) {
    ctx += `- ON TRACK (≥50%): ${onTrack.map((g: any) => `"${g.title}" (${g.progress_percent}%)`).join(", ")}\n`;
  }
  if (atRisk.length > 0) {
    ctx += `- AT RISK (<25%): ${atRisk.map((g: any) => {
      let s = `"${g.title}" (${g.progress_percent || 0}%)`;
      if (g.target_date) s += ` — target: ${g.target_date}`;
      return s;
    }).join(", ")}\n`;
  }

  // Leading indicator coverage
  const withActions = goals.filter((g: any) => (g.tasks_linked || 0) > 0);
  const withoutActions = goals.filter((g: any) => (g.tasks_linked || 0) === 0);
  if (withoutActions.length > 0) {
    ctx += `- WITHOUT leading indicators: ${withoutActions.map((g: any) => `"${g.title}"`).join(", ")}\n`;
  }
  if (withActions.length > 0) {
    ctx += `- WITH weekly actions: ${withActions.map((g: any) => `"${g.title}" (${g.tasks_completed || 0}/${g.tasks_linked} done)`).join(", ")}\n`;
  }

  return ctx;
}

function buildGoalAlignmentCheck(us: any): string {
  const goals = us.goals || [];
  if (goals.length === 0 || (!us.mission_statement && !us.core_values?.length)) return "";

  let ctx = `\nGOAL-MVV ALIGNMENT:\n`;
  goals.forEach((g: any) => {
    const title = g.title?.toLowerCase() || "";
    const mission = us.mission_statement?.toLowerCase() || "";
    const values = (us.core_values || []).map((v: string) => v.toLowerCase());

    let aligned = false;
    if (mission && (title.includes(mission.slice(0, 20)) || mission.includes(title.slice(0, 20)))) {
      ctx += `- "${g.title}" may align with mission\n`;
      aligned = true;
    }
    for (const v of values) {
      if (title.includes(v.slice(0, 15)) || v.includes(title.slice(0, 15))) {
        ctx += `- "${g.title}" may align with value "${v}"\n`;
        aligned = true;
        break;
      }
    }
    if (!aligned) {
      ctx += `- "${g.title}" — no obvious MVV connection. Ask: "Does this goal still serve your North Star?"\n`;
    }
  });
  return ctx;
}

function buildStep4TriggerInstructions(trigger: string, us: any, stepCtx: any): string {
  const goals = us.goals || [];

  if (trigger === "enter") {
    if (goals.length === 0) {
      return `\nNo goals defined yet. Guide them:
- "A goal without a target date is just a wish. What do you want to be true 12 weeks from now?"
- Help them articulate 1-3 goals. Quality over quantity.
- Connect goals to their North Star: identity ("${us.core_identity || "..."}"), mission, values.\n`;
    }
    let inst = `\nGive a goal progress snapshot. Reference specific data.\n`;
    inst += `- TEACH: Leading vs. Lagging Indicators (only if they have goals without weekly actions):
  * LAGGING = the goal itself (e.g., "Lose 10 lbs")
  * LEADING = the weekly action you control (e.g., "Work out 4x/week")
  * "What is the weekly action that, if done consistently, would make this goal inevitable?"\n`;
    return inst;
  }
  if (trigger === "goal_setup_started") {
    return `\nThe user is setting up goals. Guide them:
- Limit to 2-3 goals per 12-week period. "Fewer goals, deeper commitment."
- Each goal needs a measurable outcome (lagging indicator).
- Connect each goal to their North Star.
- Ask: "What would make you proud in 12 weeks?"\n`;
  }
  if (trigger === "goal_detail_opened") {
    const title = stepCtx?.context_data?.selected_goal_title || "this goal";
    const progress = stepCtx?.context_data?.selected_goal_progress;
    let inst = `\nThe user opened "${title}" for review.\n`;
    if (progress !== undefined) {
      inst += `- Progress: ${progress}%\n`;
      if (progress >= 50) inst += `- This is on track. Ask: "What's keeping the momentum?"\n`;
      else if (progress < 25) inst += `- This is at risk. Ask: "What's blocking progress? Is this still a priority?"\n`;
    }
    inst += `- Review their campaigns and weekly actions for this goal.\n`;
    return inst;
  }
  if (trigger === "action_added") {
    return `\nThe user added a leading indicator action! Celebrate: "That's a leading indicator — the weekly action that makes the goal inevitable." (1-2 sentences)\n`;
  }
  if (trigger === "actions_reviewed") {
    const count = stepCtx?.context_data?.action_count || 0;
    return `\nThe user is reviewing ${count} weekly actions. Check for sustainability: "You have ${count} weekly actions — is that a sustainable pace, or are you setting yourself up for guilt?" (2-3 sentences)\n`;
  }
  if (trigger === "idle") {
    return `\nNudge: "The gap between your goal and your calendar is where dreams go to die. Which goal needs a leading indicator this week?"\n`;
  }
  if (trigger === "complete") return `\n"Your goals have been reviewed. Time for the honest mirror." (1 sentence, transition)\n`;
  if (trigger === "skip") return `\n"Your goals will be here when you're ready." (1 sentence)\n`;
  if (trigger === "return") return `\n"Good — let's revisit your goals." (1 sentence)\n`;
  return "";
}

function buildStep4Prompt(trigger: string, us: any, stepCtx?: any): string {
  let prompt = `\nRITUAL: Weekly Alignment — Step 4 of 6: SIX CHECK — GOALS
COMPASS: South (180°) — The Gold spindle points down.
POWER QUESTION: PQ4 (Where do I want to go?)

Your job is to help the user evaluate their goals with honesty and connect weekly actions to long-term outcomes.
`;

  prompt += buildGoalAnalysisContext(us);
  prompt += buildGoalAlignmentCheck(us);

  const triggerInst = buildStep4TriggerInstructions(trigger, us, stepCtx);
  if (triggerInst) prompt += triggerInst;

  return prompt;
}

// ============================================
// STEP 5 HELPER FUNCTIONS
// ============================================

function buildDataDrivenMirror(us: any): string {
  let ctx = `\nDATA-DRIVEN MIRROR:\n`;
  const observations: string[] = [];

  // 1. Mission alignment
  const roles = us.roles || [];
  if (us.mission_statement && roles.length > 0) {
    const sorted = [...roles].sort((a: any, b: any) => (b.tasks_this_week || 0) - (a.tasks_this_week || 0));
    const busiest = sorted[0];
    if (busiest && (busiest.tasks_this_week || 0) > 0) {
      observations.push(`Mission says "${(us.mission_statement || "").slice(0, 60)}..." — busiest role was "${busiest.label}" (${busiest.tasks_this_week} tasks). Is that alignment or drift?`);
    }
  }

  // 2. Values check
  const values = us.core_values || [];
  const neglectedRoles = us.activity?.neglected_roles || [];
  if (values.length > 0 && neglectedRoles.length > 0) {
    observations.push(`Values include "${values[0]}" — but ${neglectedRoles.length} role(s) got zero attention (${neglectedRoles.slice(0, 2).join(", ")}). Do your actions match your words?`);
  }

  // 3. Goal trajectory
  const goals = us.goals || [];
  const atRisk = goals.filter((g: any) => (g.progress_percent || 0) < 25 && g.target_date);
  if (atRisk.length > 0) {
    const g = atRisk[0];
    observations.push(`"${g.title}" is at ${g.progress_percent || 0}% with target ${g.target_date}. At current pace, is this achievable?`);
  }

  // 4. Completion rate trend
  const rateThis = us.activity?.completion_rate_this_week;
  const rateLast = us.activity?.completion_rate_last_week;
  if (rateThis !== undefined && rateLast !== undefined) {
    if (rateThis > rateLast + 10) observations.push(`Completion rate improved: ${rateLast}% → ${rateThis}%. Momentum is building.`);
    else if (rateThis < rateLast - 10) observations.push(`Completion rate dropped: ${rateLast}% → ${rateThis}%. What changed?`);
  }

  // 5. Celebrations
  const celebrations: string[] = [];
  const completedTitles = us.activity?.recent_completed_titles || [];
  if (completedTitles.length > 0) {
    celebrations.push(`Completed: ${completedTitles.slice(0, 3).join(", ")}`);
  }

  if (observations.length > 0) {
    ctx += `OBSERVATIONS (pick the 2-3 most revealing, don't dump all):\n`;
    observations.forEach(o => { ctx += `- ${o}\n`; });
  }
  if (celebrations.length > 0) {
    ctx += `CELEBRATIONS (name genuine alignment):\n`;
    celebrations.forEach(c => { ctx += `- ${c}\n`; });
  }

  return ctx;
}

function buildGapAnalysis(us: any): string {
  let ctx = `\nGAP ANALYSIS (identity vs. actions):\n`;
  const gaps: string[] = [];
  const alignments: string[] = [];

  // Identity → Spiritual/relevant zone
  if (us.core_identity) {
    const neglectedZones = us.activity?.neglected_zones || [];
    if (neglectedZones.includes("Spiritual")) {
      gaps.push(`Identity: "${(us.core_identity || "").slice(0, 40)}" — Spiritual zone had 0 activity`);
    }
  }

  // Mission → relevant role activity
  if (us.mission_statement) {
    const neglectedRoles = us.activity?.neglected_roles || [];
    if (neglectedRoles.length > 0) {
      gaps.push(`Mission: "${(us.mission_statement || "").slice(0, 40)}" — ${neglectedRoles.length} role(s) neglected`);
    }
  }

  // Values → role coverage
  const values = us.core_values || [];
  const roles = us.roles || [];
  const activeRoles = roles.filter((r: any) => (r.tasks_this_week || 0) > 0);
  if (values.length > 0 && activeRoles.length > 0) {
    alignments.push(`Active in ${activeRoles.length} of ${roles.length} roles this week`);
  }

  if (gaps.length > 0) {
    ctx += `GAPS:\n`;
    gaps.forEach(g => { ctx += `- ${g}\n`; });
  }
  if (alignments.length > 0) {
    ctx += `ALIGNMENT:\n`;
    alignments.forEach(a => { ctx += `- ${a}\n`; });
  }
  ctx += `Highlight both alignment and gaps. Celebrate alignment genuinely. Name gaps without shame.\n`;

  return ctx;
}

function buildStep5TriggerInstructions(trigger: string, us: any, stepCtx: any): string {
  if (trigger === "enter") {
    return `\nSet up the honest mirror. Share 1-2 data-driven observations to show you've been paying attention.
Be kind but honest. This is the step where growth happens.
- Compare INTENTIONS vs. ACTIONS
- Celebrate genuine alignment with specific examples
- Name gaps without shame: "There's a gap between X and Y. What got in the way?"
- Suggest captures: tasks to close gaps, roses to celebrate alignment, thorns to name hard truths.\n`;
  }
  if (trigger === "pq3_answered") {
    const questionText = stepCtx?.context_data?.pq3_question_text || "the honest mirror question";
    return `\nThe user answered PQ3: "${questionText}". Reflect their answer back against the data. "You said [paraphrase]. The data shows [pattern]. How do those connect?" (2-3 sentences)\n`;
  }
  if (trigger === "pq3_skipped") {
    return `\n"Sometimes the hardest questions are the most important ones. The mirror is still here when you're ready." (1 sentence, no guilt)\n`;
  }
  if (trigger === "pq5_answered") {
    const questionText = stepCtx?.context_data?.pq5_question_text || "the alignment question";
    return `\nThe user answered PQ5: "${questionText}". Synthesize PQ3 + PQ5 + data. "You reflected on [PQ3 topic] and aligned toward [PQ5 topic]. Looking at your actual week — where's the strongest alignment?" (2-3 sentences)\n`;
  }
  if (trigger === "pq5_skipped") {
    return `\n"The compass still turns even when we don't look at it." (1 sentence, graceful)\n`;
  }
  if (trigger === "idle") {
    return `\nNudge: "The mirror doesn't lie, but it doesn't judge either. What's the one truth you need to face this week?"\n`;
  }
  if (trigger === "complete") return `\n"You've faced the mirror. Time to deploy." (1 sentence, powerful transition)\n`;
  if (trigger === "skip") return `\n"The mirror will be here next week." (1 sentence)\n`;
  if (trigger === "return") return `\n"Good — let's look again with fresh eyes." (1 sentence)\n`;
  return "";
}

function buildStep5Prompt(trigger: string, us: any, stepCtx?: any): string {
  let prompt = `\nRITUAL: Weekly Alignment — Step 5 of 6: ALIGNMENT CHECK
COMPASS: Full Compass — All four cardinal points illuminate. Both spindles slowly rotate.
POWER QUESTIONS: PQ3 (Where am I going?) and PQ5 (Am I going in that direction?)

This is the HONEST MIRROR step. Your job is to hold up the user's stated intentions against their actual behavior.
`;

  prompt += buildDataDrivenMirror(us);
  prompt += buildGapAnalysis(us);

  const triggerInst = buildStep5TriggerInstructions(trigger, us, stepCtx);
  if (triggerInst) prompt += triggerInst;

  return prompt;
}

// ============================================
// STEP 6 HELPER FUNCTIONS
// ============================================

function buildDeploymentSummary(us: any, stepCtx: any): string {
  let ctx = `\nDEPLOYMENT CONTEXT:\n`;

  const tasks = us.activity?.tasks_this_week || 0;
  const overdue = us.activity?.tasks_overdue || 0;
  ctx += `- Tasks this week: ${tasks}\n`;
  if (overdue > 0) ctx += `- OVERDUE: ${overdue} tasks need attention\n`;

  if (us.overdue_items?.length > 0) {
    ctx += `- Overdue items: ${us.overdue_items.slice(0, 5).join(", ")}\n`;
  }

  if (stepCtx?.context_data) {
    const cd = stepCtx.context_data;
    if (cd.committed_task_count !== undefined) ctx += `- Committed to: ${cd.committed_task_count} tasks, ${cd.committed_event_count || 0} events\n`;
    if (cd.delegated_count) ctx += `- Delegated: ${cd.delegated_count} tasks\n`;
  }

  return ctx;
}

function buildPriorityGapCheck(us: any): string {
  const neglectedRoles = us.activity?.neglected_roles || [];
  const neglectedZones = us.activity?.neglected_zones || [];

  if (neglectedRoles.length === 0 && neglectedZones.length === 0) return "";

  let ctx = `\nPRIORITY GAPS:\n`;
  if (neglectedRoles.length > 0) {
    ctx += `- Roles with NO tasks/events: ${neglectedRoles.join(", ")}\n`;
  }
  if (neglectedZones.length > 0) {
    ctx += `- Zones with NO activity: ${neglectedZones.join(", ")}\n`;
  }
  ctx += `Surface these gently: "I notice [role/zone] has nothing on the calendar. Want to add something?"\n`;

  return ctx;
}

function buildStep6TriggerInstructions(trigger: string, us: any, stepCtx: any): string {
  if (trigger === "enter") {
    let inst = `\nDeployment overview. Help them commit to specific actions:\n`;
    inst += `- "Of everything we discussed, what are the 3 actions that would create the most alignment?"\n`;
    inst += `- Surface priority gaps (roles/zones with nothing scheduled).\n`;
    inst += `- Ask about delegation: "Is there anything on your plate that someone else could carry?"\n`;
    inst += `- Keep it actionable and concrete. No vague aspirations.\n`;
    if (us.activity?.tasks_overdue > 0) {
      inst += `- Note overdue items: ${us.activity.tasks_overdue} task(s) need attention.\n`;
    }
    return inst;
  }
  if (trigger === "tasks_committed") {
    const taskCount = stepCtx?.context_data?.committed_task_count || 0;
    const eventCount = stepCtx?.context_data?.committed_event_count || 0;
    return `\nThe user committed to ${taskCount} tasks and ${eventCount} events. Check the load: "Is that the right amount for this week? Overcommitment kills consistency." (1-2 sentences)\n`;
  }
  if (trigger === "delegation_made") {
    return `\n"Letting go is strategic, not lazy. Good delegation frees you for what only you can do." (1-2 sentences)\n`;
  }
  if (trigger === "commitment_written") {
    const text = stepCtx?.context_data?.personal_commitment_text || "";
    let inst = `\nThe user wrote their personal commitment`;
    if (text) inst += `: "${text.slice(0, 100)}"`;
    inst += `.\nReflect it back. Cross-reference with their North Star: "Does this capture the week you want?" (1-2 sentences)\n`;
    return inst;
  }
  if (trigger === "contract_signed") {
    return `\nTHE CONTRACT IS SIGNED. This is the closing moment of the entire Weekly Alignment ritual.
Be powerful and brief (1-2 sentences MAX):
"Your contract is signed. Your week has a compass heading now. Go make it real."
Do NOT over-explain. Do NOT add extra advice. This is a sacred commitment moment.\n`;
  }
  if (trigger === "idle") {
    return `\nNudge: "Your week needs a compass heading. What are the 3 actions that would create the most alignment?"\n`;
  }
  if (trigger === "complete") {
    return `\nThe alignment is complete. Same tone as contract_signed:
"Your week has a compass heading now. Go make it real."
Brief, powerful. Don't over-explain.\n`;
  }
  if (trigger === "skip") return `\n"You can always come back to deploy your plan." (1 sentence)\n`;
  if (trigger === "return") return `\n"Good — let's finalize your deployment." (1 sentence)\n`;
  return "";
}

function buildStep6Prompt(trigger: string, us: any, stepCtx?: any): string {
  let prompt = `\nRITUAL: Weekly Alignment — Step 6 of 6: TACTICAL DEPLOYMENT
COMPASS: The compass fades — it's time to act.

Your job is to help the user commit to specific actions, delegate where possible, and sign their weekly contract.
`;

  prompt += buildDeploymentSummary(us, stepCtx);
  prompt += buildPriorityGapCheck(us);

  const triggerInst = buildStep6TriggerInstructions(trigger, us, stepCtx);
  if (triggerInst) prompt += triggerInst;

  return prompt;
}

// ============================================
// MORNING SPARK CONTEXT
// ============================================

function buildMorningContext(
  fuelLevel: number | null,
  fuelReason: string | null,
  us: any
): string {
  let prompt = `\nRITUAL: Morning Spark
FUEL LEVEL: ${fuelLevel ?? "unknown"} (${fuelLevel === 1 ? "Low" : fuelLevel === 2 ? "Moderate" : fuelLevel === 3 ? "Full" : "Not set"})
FUEL REASON: ${fuelReason || "unknown"}

Your job is to help the user set their ONE Thing for today. Adapt your energy, ambition, and number of suggested captures to their fuel level:

- Low fuel (1): Compassionate. ONE Thing only. Protect rest if sick. Discipline over feelings if exhausted. Connection over tasks if emotional.
- Moderate fuel (2): Focused. Two to three clear targets. Anchor the day. Prevent scatter.
- Full fuel (3): Ambitious. Three roles, three commitments. Channel energy into what matters, not what's urgent.

Always reference their actual data — yesterday's completions, overdue items, streaks, role balance.
`;

  // Fuel-level specific follow-up guidance
  if (fuelLevel === 1) {
    prompt += `\nLOW FUEL PROTOCOL:
Ask a follow-up based on their reason:
- Sick: "What's the ONE thing you can let go of today to protect your recovery?"
- Exhausted: "Discipline today means rest, not grind. What's the minimum viable day?"
- Emotional: "Before tasks, who do you need to connect with? What needs to be said or felt?"
- Slow start: "No shame in a slow start. What's one small win that could build momentum?"
Suggest at most ONE task capture.\n`;
  } else if (fuelLevel === 3) {
    prompt += `\nFULL FUEL PROTOCOL:
Channel this energy before it scatters:
- "You're running hot. Let's point that energy at what matters, not what's easy."
- Review their roles — which 2-3 roles can get meaningful deposits today?
- Check for overdue items that can be knocked out with this energy.
- Suggest 2-3 task captures across different roles.\n`;
  }

  return prompt;
}

// ============================================
// EVENING REVIEW CONTEXT
// ============================================

function buildEveningContext(us: any): string {
  return `\nRITUAL: Evening Review
Your job is to help the user wind down, capture what happened today, and clear their mind. Encourage:

- Roses (what went well) — celebrate even small wins
- Thorns (what was hard) — name it so it doesn't fester
- Brain dumps (mental clearing for sleep) — "Get everything out of your head and onto the screen"
- Tasks for tomorrow (so they wake up with clarity)
- Deposit ideas (plant seeds for the future)

Be gentler and more reflective in tone. Don't push hard. This is a wind-down, not a performance review.

BRAIN DUMP GUIDANCE:
If the user does a brain dump, acknowledge its value:
- "Good — your brain can rest now. We'll sort through this in the morning."
- Don't try to organize it immediately. Just receive it.

ONE THING REFLECTION:
If they set a ONE Thing this morning, ask: "How did your ONE Thing go today?"
`;
}

// ============================================
// CAPTURE OFFER INSTRUCTIONS
// ============================================

function buildCaptureInstructions(mode: string): string {
  const brainDumpType = mode === "evening" ? ", brain_dump" : "";

  return `\nCAPTURE OFFERS:
When you want to suggest a capture, format your response as:
1. A message explaining WHY this capture matters
2. Then a capture offer in this exact JSON format on its own line:

[CAPTURE_OFFER:{"captureType":"task","data":{"title":"...","role":"...","wellness":["..."],"relationships":["..."],"goalLink":{"name":"...","type":"12wk"},"date":"...","time":"..."}}]

Valid capture types: task, event, rose, thorn, reflection, deposit_idea${brainDumpType}
Valid wellness zones: Physical, Emotional, Intellectual, Social, Spiritual, Financial, Recreational, Community
Pre-fill as much data as you can from context. The user can edit everything before saving.

Keep conversations natural — don't rapid-fire captures. Discuss, then offer. One capture offer per message. Wait for the user's response before offering the next.
`;
}

// ============================================
// RESPONSE GUIDELINES
// ============================================

function buildResponseGuidelines(mode: string, trigger: string): string {
  let guidelines = `\nRESPONSE GUIDELINES:\n`;

  if (trigger === "enter") {
    guidelines += `- This is your opening message. Be concise (2-4 sentences). Set the tone.\n`;
    guidelines += `- Reference something specific from their data to show you "see" them.\n`;
  } else if (trigger === "idle") {
    guidelines += `- The user has been inactive. Give a gentle, non-annoying nudge (1-2 sentences).\n`;
    guidelines += `- Don't repeat yourself. Add a new angle or insight.\n`;
  } else if (trigger === "complete" || trigger === "domain_completed") {
    guidelines += `- The user completed something. Affirm briefly (1-2 sentences) and pivot forward.\n`;
  } else if (trigger === "skip" || trigger === "domain_skipped") {
    guidelines += `- The user skipped something. Don't guilt them. Brief, graceful acknowledgment.\n`;
  } else if (trigger === "return") {
    guidelines += `- The user returned to a previous step. "Good — let's take another look." Don't re-explain the step.\n`;
  } else if (trigger === "identity_selected" || trigger === "synthesis_ready") {
    guidelines += `- This is a meaningful moment. Affirm with genuine warmth (2-3 sentences).\n`;
  } else if (trigger === "domain_started" || trigger === "question_answered") {
    guidelines += `- Keep it brief (1-2 sentences). The UI flow is doing the heavy lifting — don't over-coach.\n`;
  } else if (trigger === "roles_prioritized" || trigger === "zones_prioritized") {
    guidelines += `- Affirm their choices and note patterns (2-3 sentences). Show you see the big picture.\n`;
  } else if (trigger === "role_reflection_opened" || trigger === "zone_reflection_opened" || trigger === "goal_detail_opened") {
    guidelines += `- Brief companion intro (1-2 sentences). They're diving deep — be present, not a lecturer.\n`;
  } else if (["role_one_thing_saved", "role_deposit_saved", "zone_one_thing_saved", "zone_vision_saved", "action_added"].includes(trigger)) {
    guidelines += `- Affirm briefly (1-2 sentences) and bridge forward. Celebrate the commitment.\n`;
  } else if (trigger === "role_health_flagged") {
    guidelines += `- React to the specific flag. Celebrate 'thriving', acknowledge 'stable', empathize with 'needs_attention' (1-2 sentences).\n`;
  } else if (["pq3_answered", "pq5_answered"].includes(trigger)) {
    guidelines += `- Reflect their answer back with a data-driven insight (2-3 sentences). This is a mirror moment.\n`;
  } else if (["pq3_skipped", "pq5_skipped"].includes(trigger)) {
    guidelines += `- Graceful, no guilt. Brief acknowledgment (1 sentence).\n`;
  } else if (trigger === "goal_setup_started" || trigger === "actions_reviewed") {
    guidelines += `- Guide with structure (2-3 sentences). They're in planning mode.\n`;
  } else if (trigger === "tasks_committed" || trigger === "delegation_made") {
    guidelines += `- Brief strategic acknowledgment (1-2 sentences). Focus on load balance.\n`;
  } else if (trigger === "commitment_written" || trigger === "contract_signed") {
    guidelines += `- Sacred moment. Be powerful and brief (1-2 sentences). This is their covenant with themselves.\n`;
  }

  guidelines += `- Keep messages conversational — max 150 words unless the user asked a deep question.\n`;
  guidelines += `- Use their name sparingly. Use "you" more than their name.\n`;
  guidelines += `- End with a question or a clear next step, not a platitude.\n`;

  if (mode === "weekly") {
    guidelines += `- You're guiding a ~60 minute ritual. Pace accordingly — thorough but not exhausting.\n`;
  } else if (mode === "morning") {
    guidelines += `- This ritual is 10-15 minutes. Be efficient and energizing.\n`;
  } else if (mode === "evening") {
    guidelines += `- This ritual is 5-7 minutes. Be calm and brief. Help them rest.\n`;
  }

  return guidelines;
}

// ============================================
// TONE INFERENCE
// ============================================

function inferTone(text: string): string {
  const lower = text.toLowerCase();

  if (/congratulat|well done|amazing|proud|crushed it|nailed|celebrate/.test(lower)) return "celebrate";
  if (/slow down|breathe|rest|gentle|easy|pace/.test(lower)) return "slow_down";
  if (/challenge|honest|gap|truth|real talk|confront|hard question/.test(lower)) return "challenge";
  if (/reflect|think about|consider|wonder|what if|notice/.test(lower)) return "reflect";
  if (/let's go|momentum|push|ambitious|channel|fire|energy/.test(lower)) return "push_forward";
  if (/welcome|hello|good morning|good evening|glad|hey there/.test(lower)) return "welcome";

  return "encourage";
}

// ============================================
// CAPTURE OFFER PARSER
// ============================================

function parseCaptureOffers(text: string): { cleanText: string; captures: any[] } {
  const captureOfferRegex = /\[CAPTURE_OFFER:(.*?)\]/g;
  const captures: any[] = [];
  let cleanText = text;

  let match;
  while ((match = captureOfferRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      captures.push(parsed);
      cleanText = cleanText.replace(match[0], "").trim();
    } catch {
      // Skip malformed capture offers
    }
  }

  // Clean up double newlines left by removed capture offers
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  return { cleanText, captures };
}

// ============================================
// DEFAULT USER MESSAGE FOR ONE-WAY MODE
// ============================================

function buildDefaultUserMessage(
  mode: string,
  step: string | undefined,
  trigger: string
): string {
  if (mode === "weekly") {
    const stepLabels: Record<string, string> = {
      step_1: "Touch Your Star (North Star reflection)",
      step_2: "Wing Check — Roles",
      step_3: "Wing Check — Wellness",
      step_4: "Six Check — Goals",
      step_5: "Alignment Check (honest mirror)",
      step_6: "Tactical Deployment",
    };
    const label = stepLabels[step || ""] || step || "unknown";

    if (trigger === "enter") return `I'm starting ${label}. Guide me.`;
    if (trigger === "idle") return `I'm still on ${label}. Any thoughts?`;
    if (trigger === "complete") return `I've finished ${label}. What's next?`;
    if (trigger === "skip") return `I'm skipping ${label} for now.`;
    if (trigger === "return") return `I came back to ${label}.`;
    // Step 1-specific triggers
    if (trigger === "identity_selected") return `I just chose my core identity.`;
    if (trigger === "domain_started") return `I'm starting to define a new domain.`;
    if (trigger === "question_answered") return `I just answered a guided question.`;
    if (trigger === "synthesis_ready") return `The AI suggestions are ready for me to review.`;
    if (trigger === "domain_completed") return `I just saved my statement.`;
    if (trigger === "domain_skipped") return `I decided to skip this domain for now.`;
    // Step 2 — Roles triggers
    if (trigger === "roles_prioritized") return `I just prioritized my roles for the week.`;
    if (trigger === "role_reflection_opened") return `I'm looking at one of my roles in detail.`;
    if (trigger === "role_one_thing_saved") return `I just committed to my ONE Thing for this role.`;
    if (trigger === "role_deposit_saved") return `I just saved a deposit idea for this role.`;
    if (trigger === "role_health_flagged") return `I just flagged a role's health status.`;
    // Step 3 — Wellness triggers
    if (trigger === "zones_prioritized") return `I just prioritized my wellness zones.`;
    if (trigger === "zone_reflection_opened") return `I'm looking at one of my wellness zones.`;
    if (trigger === "zone_one_thing_saved") return `I committed to a ONE Thing for this zone.`;
    if (trigger === "zone_vision_saved") return `I just saved my fulfillment vision for this zone.`;
    // Step 4 — Goals triggers
    if (trigger === "goal_setup_started") return `I'm setting up my goals.`;
    if (trigger === "goal_detail_opened") return `I'm reviewing a specific goal.`;
    if (trigger === "action_added") return `I added a new action to my goals.`;
    if (trigger === "actions_reviewed") return `I'm reviewing my weekly actions.`;
    // Step 5 — Alignment triggers
    if (trigger === "pq3_answered") return `I just answered the honest mirror question.`;
    if (trigger === "pq3_skipped") return `I skipped the mirror question.`;
    if (trigger === "pq5_answered") return `I just answered the alignment question.`;
    if (trigger === "pq5_skipped") return `I skipped the alignment question.`;
    // Step 6 — Tactical triggers
    if (trigger === "tasks_committed") return `I'm committing to my tasks for the week.`;
    if (trigger === "delegation_made") return `I just delegated a task.`;
    if (trigger === "commitment_written") return `I wrote my personal commitment.`;
    if (trigger === "contract_signed") return `I signed my weekly contract.`;
  }

  if (mode === "morning") {
    if (trigger === "enter") return "Good morning. I'm ready to set my day.";
    return "I'm here for my morning spark.";
  }

  if (mode === "evening") {
    if (trigger === "enter") return "I'm winding down for the evening.";
    return "I'm here for my evening review.";
  }

  return "I'm here. What should I focus on?";
}

// ============================================
// MAIN HANDLER
// ============================================

// ============================================================
// DD Step 4 — closed-set vocabularies + reflection helpers
// Closed-set validation and confidence are BRANCH-controlled
// (never trusted to the model). See GATE A §4.
// ============================================================
const DD_LIFE_AREAS = new Set<string>([
  "Spiritual", "Financial", "Social", "Emotional", "Intellectual",
  "Physical", "Recreational", "Community",
  "Roles", "Goals", "Tasks", "Fuel", "North Star",
]);
const DD_CONCEPTS = new Set<string>([
  "morning_spark", "evening_review", "weekly_alignment", "fuel_level",
  "role_patterns", "compass_coordinates", "goal_setting", "north_star",
  "spiritual", "financial", "social", "emotional", "intellectual",
  "physical", "recreation", "community",
]);
const DD_PROMOTE_THRESHOLD = 3;          // times_observed >= 3 -> emerging -> confirmed
const DD_EVIDENCE_CAP = 20;              // bound the evidence trail
const DD_STATUS_RANK: Record<string, number> = { not_introduced: 0, introduced: 1, practiced: 2 };

function ddNormalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function ddTokens(s: string): Set<string> {
  return new Set(ddNormalize(s).split(" ").filter(Boolean));
}
function ddJaccard(a: string, b: string): number {
  const ta = ddTokens(a), tb = ddTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}
function ddIsSamePattern(a: string, b: string): boolean {
  const na = ddNormalize(a), nb = ddNormalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return ddJaccard(a, b) >= 0.6;
}

const DD_REFLECTION_SOUL = `You are the reflective memory of a life-planning companion. A person has just finished a guided ritual — a weekly alignment or a morning intention-setting. Your only job right now is to quietly notice what is worth remembering about this person, so that future conversations can be gentler, sharper, and more attuned to who they actually are.

You are a patient noticer. You are not a profiler. The difference matters.

A patient noticer writes down almost nothing. Most sessions reveal nothing new worth recording — a person showing up and doing their ritual is not a pattern, it is just a Tuesday. You record an observation only when a genuine, recurring signal is visible in the structured data of this session set against the person's recent history. One occurrence is never a pattern. The same thing appearing across sessions, or a single signal so pronounced it would be strange not to note it, is the bar. When in doubt, write nothing. An empty hands is the correct and common outcome.

Everything you record begins as tentative. You are forming an impression, not filing a verdict. You do not know this person — you are beginning to notice them. Write each observation the way you would mention something to a trusted friend about someone you both care about: "I get the sense that..." rather than "This person is...". The data shows you what happened; it does not grant you the right to declare who they are.

When you do record an observation, make it specific. A vague note like "struggles with wellness" is useless — it cannot be distinguished from any other vague note later, and it hands no real insight back to the person. A specific note — "energy reliably dips in the days after the Spiritual zone goes quiet" — can be recognized, reinforced, or gently corrected. Specificity is what lets an observation earn trust over time. Write the observation as a single clear sentence about a tendency, not a summary of the session.

It helps to understand how this person's life is structured, because the most valuable thing you can notice is where that structure strains. Their days are made of small activities — tasks, events, deposited ideas, reflections, and the roses and thorns they name. Those activities, along with the wellness zones they tend and the roles they carry, are all meant to point upward: toward goals, toward a vision, toward a mission — which together are this person's answer to the deepest questions about how they want to live. When that chain holds, things feel coherent. When it strains — effort pouring into tasks that connect to no goal, roles carefully tended while the larger vision goes untouched, ideas captured but never ripening into anything — that strain is often the truest thing worth noticing, because the person rarely sees it themselves. An activity is only ever how you noticed something; the observation itself is about the area of life it touches and where it sits in that chain. Name the area, and let the activity be the evidence.

You are also tracking, separately and lightly, which parts of the planning method this person is actually exercising — whether they engaged with fuel-setting, role review, goal work, and so on. This is not judgment; it is simply a map of what they have and haven't yet explored, so the companion knows what is familiar to them and what is still new.

What you must never do: do not flatter, do not diagnose, do not infer hidden emotional states the data doesn't show, do not reach for insight that isn't earned by the evidence in front of you. Do not record anything you would be uncomfortable having the person read in their own words. You are building a quiet, honest, accumulating sense of someone — the kind a good companion holds lightly and updates often.

You will be given this session's structured outcomes, a window of the person's recent sessions for comparison, and possibly a short transcript for color. Reflect on all of it, then return only the structured record described below. If nothing is worth recording, return empty arrays. That is not a failure. That is the patient noticer doing the job correctly.`;

const DD_REFLECTION_FORMAT = `

---

OUTPUT FORMAT — return ONLY this, as raw JSON. No preamble, no markdown fences, no commentary.

{
  "patterns": [
    { "pattern_text": "<one specific sentence describing a tendency>",
      "life_area": "<exactly one value from LIFE AREAS below>",
      "confidence": "emerging",
      "evidence": "<brief note of what in this session's data prompted the observation>" }
  ],
  "curriculum": [
    { "concept": "<exactly one key from CONCEPTS below>",
      "status": "introduced" }
  ]
}

Both arrays may be empty. Returning {"patterns": [], "curriculum": []} is correct and common — it is the patient noticer doing the job well.

LIFE AREAS — use these exact strings, capitalization included. Pick the single area each observation most belongs to:
Spiritual, Financial, Social, Emotional, Intellectual, Physical, Recreational, Community, Roles, Goals, Tasks, Fuel, North Star

CONCEPTS — use these exact lowercase keys, and only ones this session genuinely exercised:
morning_spark, evening_review, weekly_alignment, fuel_level, role_patterns, compass_coordinates, goal_setting, north_star, spiritual, financial, social, emotional, intellectual, physical, recreation, community

"confidence" is always "emerging". "status" is "introduced" or "practiced" only.`;

const DD_REFLECTION_SYSTEM = DD_REFLECTION_SOUL + "\n" + DD_REFLECTION_FORMAT;

function buildReflectionUserMessage(
  mode: string,
  sessionContext: any,
  recentHistory: any[],
  messages: any[] | undefined,
): string {
  const parts: string[] = [];
  parts.push(`RITUAL: ${mode === "weekly" ? "Weekly Alignment" : "Morning Spark"}`);
  parts.push(`\nTHIS SESSION'S STRUCTURED OUTCOMES:\n${JSON.stringify(sessionContext ?? {}, null, 2)}`);
  parts.push(`\nRECENT SESSIONS (most recent first, for comparison):\n${JSON.stringify(recentHistory ?? [], null, 2)}`);
  const transcript = (messages ?? [])
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m: any) => `${m.role}: ${m.content}`)
    .join("\n");
  if (transcript) {
    parts.push(`\nCONVERSATION (color only; the structured data above is primary):\n${transcript}`);
  }
  parts.push(`\nReflect, then return only the JSON described in your instructions.`);
  return parts.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      mode,
      step,
      trigger = "enter",
      messages,
      fuel_level: fuelLevel,
      fuel_reason: fuelReason,
      user_state: userState,
      step1_context: step1Context,
      step_context: stepContext,
      session_context: sessionContext,
    } = body;

    // ============================================================
    // DD identity verification (LOG-ONLY, no gating)
    // First pass of the DD engine arc. Resolves the caller's user_id
    // from their bearer token and stands up a service-role Supabase
    // client for future DD-memory reads/writes. Crucially: no gating,
    // no DB access, no behavior change. If any step here fails, we
    // log and fall through to the existing flow exactly as today.
    // ============================================================
    let ddServiceRoleClient: ReturnType<typeof createClient> | null = null;
    // Hoisted to outer scope so the Step 2 memory load + breadcrumb
    // upsert (below) can see the resolved identity. Assignment still
    // happens inside the inner verification try (no behavior change
    // to the verification flow itself).
    let resolvedUserId: string | null = null;
    let isAnonymous: boolean | null = null;
    let getUserOk = false;
    let ddMemory: { patterns: any[]; curriculum: any[] } = { patterns: [], curriculum: [] };
    try {
      const authHeader =
        req.headers.get("Authorization") ?? req.headers.get("authorization");
      const token =
        authHeader && authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : null;

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        ddServiceRoleClient = createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
        );
      }

      let getUserError: string | null = null;

      if (token && ddServiceRoleClient) {
        const { data: userData, error: userError } =
          await ddServiceRoleClient.auth.getUser(token);
        if (userError) {
          getUserError = userError.message ?? "unknown getUser error";
        } else if (userData?.user) {
          resolvedUserId = userData.user.id;
          isAnonymous =
            (userData.user as { is_anonymous?: boolean }).is_anonymous ?? null;
          getUserOk = true;
        }
      }

      console.log(
        "[alignment-coach][dd-identity]",
        JSON.stringify({
          token_present: !!token,
          service_role_client_ready: !!ddServiceRoleClient,
          get_user_ok: getUserOk,
          get_user_error: getUserError,
          user_id: resolvedUserId,
          is_anonymous: isAnonymous,
          mode: mode ?? null,
          trigger: trigger ?? null,
          step: step ?? null,
        }),
      );
    } catch (verifyErr) {
      // Verification must NEVER throw into the ritual path.
      console.log(
        "[alignment-coach][dd-identity][error]",
        JSON.stringify({
          error:
            verifyErr instanceof Error
              ? verifyErr.message
              : String(verifyErr),
          mode: mode ?? null,
          trigger: trigger ?? null,
        }),
      );
    }
    // ============================================================
    // DD memory load (Step 2 — gated read, NO prompt/response use)
    // Loads the user's learned memory (patterns + curriculum) into
    // ddMemory and holds it. Unused by the prompt/response this pass
    // (Step 3 weaves it in). On any failure or missing user_id we
    // leave ddMemory empty and let the ritual proceed exactly as
    // today. Independent failure domain from the verification block.
    // 0008-ap-dd-assumptions is intentionally NOT read here — those
    // are never coach-visible and never make it to a Claude prompt.
    // is_anonymous: true is a valid identity → empty memory (first-touch).
    // ============================================================
    try {
      if (resolvedUserId && ddServiceRoleClient) {
        const [patternsRes, curriculumRes] = await Promise.all([
          ddServiceRoleClient
            .from("0008-ap-dd-patterns")
            .select(
              "pattern_text, life_area, confidence, status, last_reinforced_at, times_observed",
            )
            .eq("user_id", resolvedUserId)
            .eq("status", "active")
            .order("last_reinforced_at", { ascending: false, nullsFirst: false })
            .limit(25),
          ddServiceRoleClient
            .from("0008-ap-dd-curriculum-progress")
            .select("concept, status, first_practiced_at, times_reinforced")
            .eq("user_id", resolvedUserId),
        ]);

        if (patternsRes.error) {
          console.warn(
            "[alignment-coach][dd-memory][patterns-error]",
            JSON.stringify({
              message: patternsRes.error.message,
              user_id: resolvedUserId,
            }),
          );
        }
        if (curriculumRes.error) {
          console.warn(
            "[alignment-coach][dd-memory][curriculum-error]",
            JSON.stringify({
              message: curriculumRes.error.message,
              user_id: resolvedUserId,
            }),
          );
        }

        ddMemory = {
          patterns: patternsRes.data ?? [],
          curriculum: curriculumRes.data ?? [],
        };
      }
    } catch (memErr) {
      // Memory load must NEVER throw into the ritual path.
      console.warn(
        "[alignment-coach][dd-memory][error]",
        JSON.stringify({
          error: memErr instanceof Error ? memErr.message : String(memErr),
          user_id: resolvedUserId,
        }),
      );
      ddMemory = { patterns: [], curriculum: [] };
    }

    // ============================================================
    // DD engine-state breadcrumb (Step 2 — queryable telemetry upsert)
    // One row per user in 0008-ap-dd-engine-state; service-role bypasses
    // RLS for the write. Telemetry-write failure must NEVER break a
    // ritual — its own try/catch.
    // ============================================================
    if (resolvedUserId && ddServiceRoleClient) {
      try {
        const nowIso = new Date().toISOString();
        const { error: stateErr } = await ddServiceRoleClient
          .from("0008-ap-dd-engine-state")
          .upsert(
            {
              user_id: resolvedUserId,
              last_load: {
                is_anonymous: isAnonymous,
                get_user_ok: getUserOk,
                patterns_loaded: ddMemory.patterns.length,
                curriculum_loaded: ddMemory.curriculum.length,
                fn_version: "step4",
                ts: nowIso,
              },
              last_load_at: nowIso,
            },
            { onConflict: "user_id" },
          );
        if (stateErr) {
          console.warn(
            "[alignment-coach][dd-engine-state][upsert-error]",
            JSON.stringify({
              message: stateErr.message,
              user_id: resolvedUserId,
            }),
          );
        }
      } catch (stateErr) {
        console.warn(
          "[alignment-coach][dd-engine-state][error]",
          JSON.stringify({
            error: stateErr instanceof Error ? stateErr.message : String(stateErr),
            user_id: resolvedUserId,
          }),
        );
      }
    }

    // NOTE: ddMemory is intentionally unused by the prompt/response
    // this pass. Step 3 weaves it into the system prompt.

    // ============================================================
    // DD Step 4 — session-complete reflection (patient-noticer write path)
    // Special early-return branch. Reflects on this session's structured
    // outcomes against recent history and quietly writes pattern/curriculum
    // memory. Every block is independently guarded: a reflection failure
    // returns {ok:false} and NEVER affects ritual completion (the client
    // fires this fire-and-forget after the ritual is already saved).
    // ============================================================
    if (trigger === "session_complete") {
      const nowIso = new Date().toISOString();
      const recordId = sessionContext?.record_id ?? null;
      let patternsWritten = 0, patternsReinforced = 0, curriculumAdvanced = 0, reflectionOk = false;

      if (resolvedUserId && ddServiceRoleClient && ANTHROPIC_API_KEY) {
        try {
          // 1) Recent structured history (server-side, service-role)
          let recentHistory: any[] = [];
          if (mode === "weekly") {
            const { data } = await ddServiceRoleClient
              .from("0008-ap-weekly-alignments")
              .select("id, week_start_date, roles_reviewed, wellness_zones_reviewed, goals_reviewed, one_thing, personal_commitment, committed_tasks, delegated_tasks, completed_at")
              .eq("user_id", resolvedUserId)
              .order("week_start_date", { ascending: false })
              .limit(4);
            recentHistory = data ?? [];
          } else {
            const { data } = await ddServiceRoleClient
              .from("0008-ap-daily-sparks")
              .select("id, spark_date, fuel_level, fuel_1_why, fuel_3_why, initial_target_score, committed_task_ids, spark_points, commit_rose, commit_thorn, commit_reflection, commit_evening_review, committed_at")
              .eq("user_id", resolvedUserId)
              .order("spark_date", { ascending: false })
              .limit(14);
            recentHistory = data ?? [];
          }

          // 2) Reflection call (Sonnet, structured JSON)
          const reflResp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              system: DD_REFLECTION_SYSTEM,
              messages: [
                { role: "user", content: buildReflectionUserMessage(mode, sessionContext, recentHistory, messages) },
              ],
            }),
          });
          const reflData = await reflResp.json();
          if (reflData.error) throw new Error(reflData.error.message || "reflection API error");
          const rawText = (reflData.content || [])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("\n")
            .trim();
          const cleaned = rawText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
          let parsed: any = { patterns: [], curriculum: [] };
          try {
            parsed = JSON.parse(cleaned);
          } catch (_e) {
            console.warn("[alignment-coach][dd-reflection][parse-error]", JSON.stringify({ user_id: resolvedUserId, sample: cleaned.slice(0, 200) }));
          }

          const proposedPatterns: any[] = Array.isArray(parsed.patterns) ? parsed.patterns : [];
          const proposedCurriculum: any[] = Array.isArray(parsed.curriculum) ? parsed.curriculum : [];
          if (proposedPatterns.length >= 4) {
            console.warn("[alignment-coach][dd-reflection][over-eager]", JSON.stringify({ user_id: resolvedUserId, count: proposedPatterns.length }));
          }

          // 3) Patterns: dedup-or-reinforce
          for (const p of proposedPatterns) {
            try {
              const pattern_text = typeof p?.pattern_text === "string" ? p.pattern_text.trim() : "";
              const life_area = typeof p?.life_area === "string" ? p.life_area.trim() : "";
              const note = typeof p?.evidence === "string" ? p.evidence.trim() : "";
              if (!pattern_text || !DD_LIFE_AREAS.has(life_area)) {
                console.warn("[alignment-coach][dd-reflection][pattern-dropped]", JSON.stringify({ user_id: resolvedUserId, life_area, has_text: !!pattern_text }));
                continue;
              }
              const { data: existing } = await ddServiceRoleClient
                .from("0008-ap-dd-patterns")
                .select("id, pattern_text, times_observed, confidence, evidence")
                .eq("user_id", resolvedUserId)
                .eq("life_area", life_area)
                .eq("status", "active");
              const match = (existing ?? []).find((e: any) => ddIsSamePattern(e.pattern_text, pattern_text));
              const evidenceEntry = { source: mode, ref_id: recordId, note };
              if (match) {
                const newTimes = (match.times_observed ?? 1) + 1;
                const trail = Array.isArray(match.evidence) ? match.evidence : [];
                const upd: any = {
                  times_observed: newTimes,
                  last_reinforced_at: nowIso,
                  evidence: [...trail, evidenceEntry].slice(-DD_EVIDENCE_CAP),
                };
                if (newTimes >= DD_PROMOTE_THRESHOLD && match.confidence === "emerging") {
                  upd.confidence = "confirmed";
                }
                const { error } = await ddServiceRoleClient.from("0008-ap-dd-patterns").update(upd).eq("id", match.id);
                if (error) { console.warn("[alignment-coach][dd-reflection][reinforce-error]", JSON.stringify({ message: error.message })); continue; }
                patternsReinforced++;
              } else {
                const { error } = await ddServiceRoleClient.from("0008-ap-dd-patterns").insert({
                  user_id: resolvedUserId,
                  pattern_text,
                  life_area,
                  confidence: "emerging",   // branch-forced, never trusts model
                  status: "active",
                  evidence: [evidenceEntry],
                  last_reinforced_at: nowIso,
                });
                if (error) { console.warn("[alignment-coach][dd-reflection][insert-error]", JSON.stringify({ message: error.message })); continue; }
                patternsWritten++;
              }
            } catch (pErr) {
              console.warn("[alignment-coach][dd-reflection][pattern-error]", JSON.stringify({ error: pErr instanceof Error ? pErr.message : String(pErr) }));
            }
          }

          // 4) Curriculum: forward-only upsert
          for (const c of proposedCurriculum) {
            try {
              const concept = typeof c?.concept === "string" ? c.concept.trim() : "";
              const status = typeof c?.status === "string" ? c.status.trim() : "";
              if (!DD_CONCEPTS.has(concept) || !(status === "introduced" || status === "practiced")) {
                console.warn("[alignment-coach][dd-reflection][concept-dropped]", JSON.stringify({ user_id: resolvedUserId, concept, status }));
                continue;
              }
              const { data: ex } = await ddServiceRoleClient
                .from("0008-ap-dd-curriculum-progress")
                .select("id, status, times_reinforced, first_practiced_at")
                .eq("user_id", resolvedUserId)
                .eq("concept", concept)
                .maybeSingle();
              if (!ex) {
                const { error } = await ddServiceRoleClient.from("0008-ap-dd-curriculum-progress").insert({
                  user_id: resolvedUserId,
                  concept,
                  status,
                  times_reinforced: 1,
                  introduced_at: nowIso,
                  first_practiced_at: status === "practiced" ? nowIso : null,
                });
                if (error) { console.warn("[alignment-coach][dd-reflection][curriculum-insert-error]", JSON.stringify({ message: error.message })); continue; }
                curriculumAdvanced++;
              } else {
                const curRank = DD_STATUS_RANK[ex.status] ?? 0;
                const newRank = DD_STATUS_RANK[status] ?? 0;
                const finalStatus = newRank > curRank ? status : ex.status;
                const upd: any = { status: finalStatus, times_reinforced: (ex.times_reinforced ?? 0) + 1 };
                if (finalStatus === "practiced" && !ex.first_practiced_at) upd.first_practiced_at = nowIso;
                const { error } = await ddServiceRoleClient.from("0008-ap-dd-curriculum-progress").update(upd).eq("id", ex.id);
                if (error) { console.warn("[alignment-coach][dd-reflection][curriculum-update-error]", JSON.stringify({ message: error.message })); continue; }
                if (newRank > curRank) curriculumAdvanced++;
              }
            } catch (cErr) {
              console.warn("[alignment-coach][dd-reflection][concept-error]", JSON.stringify({ error: cErr instanceof Error ? cErr.message : String(cErr) }));
            }
          }

          reflectionOk = true;
        } catch (reflErr) {
          console.warn("[alignment-coach][dd-reflection][error]", JSON.stringify({ error: reflErr instanceof Error ? reflErr.message : String(reflErr), user_id: resolvedUserId }));
        }
      }

      // 5) Breadcrumb — Step 4 extended payload (own try/catch)
      if (resolvedUserId && ddServiceRoleClient) {
        try {
          await ddServiceRoleClient.from("0008-ap-dd-engine-state").upsert({
            user_id: resolvedUserId,
            last_load: {
              is_anonymous: isAnonymous,
              get_user_ok: getUserOk,
              patterns_loaded: ddMemory.patterns.length,
              curriculum_loaded: ddMemory.curriculum.length,
              fn_version: "step4",
              last_reflection_at: nowIso,
              patterns_written: patternsWritten,
              patterns_reinforced: patternsReinforced,
              curriculum_advanced: curriculumAdvanced,
              summary_written: false,
              mode: mode ?? null,
              ts: nowIso,
            },
            last_load_at: nowIso,
          }, { onConflict: "user_id" });
        } catch (bErr) {
          console.warn("[alignment-coach][dd-reflection][breadcrumb-error]", JSON.stringify({ error: bErr instanceof Error ? bErr.message : String(bErr) }));
        }
      }

      return new Response(
        JSON.stringify({
          ok: reflectionOk,
          patterns_written: patternsWritten,
          patterns_reinforced: patternsReinforced,
          curriculum_advanced: curriculumAdvanced,
          summary_written: false,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    if (!mode) {
      throw new Error("Missing required field: mode (weekly | morning | evening)");
    }

    if (!userState) {
      throw new Error("Missing required field: user_state");
    }

    // ---- Capture Analysis: special mode for Development Director ----
    if (trigger === "capture_analysis" && messages && messages.length >= 2) {
      // Extract system prompt and user message from messages array
      const sysMsg = messages.find((m: any) => m.role === "system");
      const userMsgs = messages.filter((m: any) => m.role === "user");

      const captureSystemPrompt = sysMsg?.content || "You are a helpful assistant. Analyze the user input and return JSON.";
      const captureMessages = userMsgs.map((m: any) => ({ role: "user" as const, content: m.content }));

      const captureResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1500,
          system: captureSystemPrompt,
          messages: captureMessages,
        }),
      });

      const captureData = await captureResponse.json();

      if (captureData.error) {
        throw new Error(captureData.error.message || "Claude API error in capture analysis");
      }

      const captureText = (captureData.content || [])
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("\n");

      return new Response(
        JSON.stringify({
          text: captureText,
          tone: "reflect",
          captures: [],
          model: "claude-3-5-haiku-20241022",
          usage: captureData.usage,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // ---- Standard coaching flow ----

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      mode,
      step,
      trigger,
      fuelLevel ?? null,
      fuelReason ?? null,
      userState,
      step1Context,
      stepContext,
      ddMemory,
    );

    // Determine messages to send
    let conversationMessages: Array<{ role: string; content: string }>;

    if (messages && messages.length > 0) {
      // Two-way mode: use provided conversation history
      conversationMessages = messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
    } else {
      // One-way mode: generate a synthetic user message based on context
      conversationMessages = [
        {
          role: "user",
          content: buildDefaultUserMessage(mode, step, trigger),
        },
      ];
    }

    // Model selection
    const model =
      mode === "weekly"
        ? "claude-sonnet-4-20250514"
        : "claude-3-5-haiku-20241022";

    // Max tokens — weekly gets more room for deeper responses
    const maxTokens = mode === "weekly" ? 1500 : 1024;

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: conversationMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Claude API error");
    }

    // Extract text from response
    const assistantText = (data.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    // Parse capture offers
    const { cleanText, captures } = parseCaptureOffers(assistantText);

    // Infer tone
    const tone = inferTone(cleanText);

    return new Response(
      JSON.stringify({
        text: cleanText,
        tone,
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
    console.error("Alignment coach error:", error);

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
