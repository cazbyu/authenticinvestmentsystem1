/**
 * Alignment Coach Service - Client-side facade
 *
 * Combines state building (from tour-guide-state.ts) and edge function invocation
 * into a single clean API. Also re-exports session/message/capture management
 * from chatBubbleService.ts so consumers have a one-stop import.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { buildStep1State, buildStep2State, buildFullState } from './tour-guide-state';
import type {
  AlignmentCoachRequest,
  AlignmentCoachResponse,
  AlignmentCoachUserState,
  AlignmentStep,
  CoachMode,
  CoachTone,
  CoachTrigger,
  ConversationMessage,
  Step1Context,
  StepContext,
} from '@/types/alignmentCoach';

// Re-export state builders for direct use
export { buildStep1State, buildStep2State, buildFullState };

// Re-export session management from chatBubbleService
export {
  getOrCreateSession,
  loadSessionMessages,
  saveMessage,
  saveCapture,
  completeSession,
} from './chatBubbleService';

// ============================================
// EDGE FUNCTION CALLS
// ============================================

/**
 * Get a one-way guidance message from the coach (no conversation history).
 * Use this for step entry/exit guidance, idle nudges, etc.
 */
export async function getCoachGuidance(params: {
  mode: CoachMode;
  step?: AlignmentStep;
  trigger: CoachTrigger;
  userState: AlignmentCoachUserState;
  fuelLevel?: number;
  fuelReason?: string;
  step1Context?: Step1Context;
  stepContext?: StepContext;
}): Promise<AlignmentCoachResponse> {
  try {
    const supabase = getSupabaseClient();

    const request: AlignmentCoachRequest = {
      mode: params.mode,
      step: params.step,
      trigger: params.trigger,
      user_state: params.userState,
      fuel_level: params.fuelLevel,
      fuel_reason: params.fuelReason,
      step1_context: params.step1Context,
      step_context: params.stepContext,
    };

    const { data, error } = await supabase.functions.invoke('alignment-coach', {
      body: request,
    });

    if (error) {
      console.error('Alignment coach guidance error:', error);
      return getLocalFallback(params.mode, params.step, params.trigger);
    }

    return data as AlignmentCoachResponse;
  } catch (err) {
    console.error('Alignment coach network error:', err);
    return getLocalFallback(params.mode, params.step, params.trigger);
  }
}

/**
 * Send a message in a 2-way conversation with the coach.
 * Pass the full message history for context continuity.
 */
export async function sendCoachMessage(params: {
  mode: CoachMode;
  step?: AlignmentStep;
  messages: ConversationMessage[];
  userState: AlignmentCoachUserState;
  fuelLevel?: number;
  fuelReason?: string;
  step1Context?: Step1Context;
  stepContext?: StepContext;
}): Promise<AlignmentCoachResponse> {
  try {
    const supabase = getSupabaseClient();

    const request: AlignmentCoachRequest = {
      mode: params.mode,
      step: params.step,
      trigger: 'user_message',
      messages: params.messages,
      user_state: params.userState,
      fuel_level: params.fuelLevel,
      fuel_reason: params.fuelReason,
      step1_context: params.step1Context,
      step_context: params.stepContext,
    };

    const { data, error } = await supabase.functions.invoke('alignment-coach', {
      body: request,
    });

    if (error) {
      console.error('Alignment coach message error:', error);
      return {
        text: "I'm having trouble connecting right now. Let's continue — what's on your mind?",
        tone: 'encourage',
        captures: [],
        model: 'fallback',
      };
    }

    return data as AlignmentCoachResponse;
  } catch (err) {
    console.error('Alignment coach network error:', err);
    return {
      text: "I'm having trouble connecting right now. Let's continue — what's on your mind?",
      tone: 'encourage',
      captures: [],
      model: 'fallback',
    };
  }
}

// ============================================
// CONVENIENCE WRAPPERS
// ============================================

/**
 * Auto-builds the appropriate user state and fetches guidance for a weekly step.
 * Convenience wrapper that handles state building automatically.
 */
export async function getStepGuidance(
  userId: string,
  step: AlignmentStep,
  trigger: CoachTrigger
): Promise<AlignmentCoachResponse> {
  // Build state appropriate to the step
  let userState: AlignmentCoachUserState;

  switch (step) {
    case 'step_1':
      // Step 1 only needs North Star + alignment count
      userState = await buildStep1State(userId);
      break;
    case 'step_2':
    case 'step_3':
      // Steps 2-3 need roles + activity
      userState = await buildStep2State(userId);
      break;
    default:
      // Steps 4-6 need everything
      userState = await buildFullState(userId);
      break;
  }

  return getCoachGuidance({
    mode: 'weekly',
    step,
    trigger,
    userState,
  });
}

/**
 * Get morning spark guidance with fuel level.
 * Automatically builds user state.
 */
export async function getMorningGuidance(
  userId: string,
  fuelLevel: number,
  fuelReason: string
): Promise<AlignmentCoachResponse> {
  const userState = await buildFullState(userId);

  return getCoachGuidance({
    mode: 'morning',
    trigger: 'enter',
    userState,
    fuelLevel,
    fuelReason,
  });
}

/**
 * Get evening review guidance.
 * Automatically builds user state.
 */
export async function getEveningGuidance(
  userId: string
): Promise<AlignmentCoachResponse> {
  const userState = await buildFullState(userId);

  return getCoachGuidance({
    mode: 'evening',
    trigger: 'enter',
    userState,
  });
}

// ============================================
// LOCAL FALLBACKS
// ============================================

const STEP_FALLBACKS: Record<string, { message: string; tone: CoachTone }> = {
  step_1: {
    message: "Let's check in with your compass. Does your north star still feel true?",
    tone: 'reflect',
  },
  step_2: {
    message: "Now let's look at your roles. Who needs your attention this week?",
    tone: 'encourage',
  },
  step_3: {
    message: "Time for an honest check. Where are you strong? Where are you stretched thin?",
    tone: 'reflect',
  },
  step_4: {
    message: "Let's review your goals. Are your weekly actions moving the needle on what matters?",
    tone: 'challenge',
  },
  step_5: {
    message: "Look at the full picture. Does this week reflect who you want to be?",
    tone: 'challenge',
  },
  step_6: {
    message: "Time to commit. What are the actions that will make this week count?",
    tone: 'push_forward',
  },
};

const MODE_FALLBACKS: Record<string, { message: string; tone: CoachTone }> = {
  morning: {
    message: "Good morning. What matters most today?",
    tone: 'welcome',
  },
  evening: {
    message: "The day is done. What went well? What do you want to clear from your mind?",
    tone: 'reflect',
  },
};

function getLocalFallback(
  mode: CoachMode,
  step?: AlignmentStep,
  trigger?: CoachTrigger
): AlignmentCoachResponse {
  // Try step-specific fallback first
  if (step && STEP_FALLBACKS[step]) {
    const fb = STEP_FALLBACKS[step];
    return {
      text: fb.message,
      tone: fb.tone,
      captures: [],
      model: 'fallback',
    };
  }

  // Mode fallback
  if (MODE_FALLBACKS[mode]) {
    const fb = MODE_FALLBACKS[mode];
    return {
      text: fb.message,
      tone: fb.tone,
      captures: [],
      model: 'fallback',
    };
  }

  // Ultimate fallback
  return {
    text: "I'm here. What would you like to focus on?",
    tone: 'encourage',
    captures: [],
    model: 'fallback',
  };
}
