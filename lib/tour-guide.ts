// lib/tour-guide.ts
// Service layer for calling the generate-tour-guide Edge Function

import { getSupabaseClient } from './supabase';
import type { TourGuideRequest, TourGuideResponse, TourGuideUserState } from '../types/tour-guide';

export async function getTourGuideMessage(
  step: TourGuideRequest['step'],
  trigger: TourGuideRequest['trigger'],
  userState: TourGuideUserState
): Promise<TourGuideResponse> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.functions.invoke('generate-tour-guide', {
      body: { step, trigger, user_state: userState },
    });

    if (error) {
      console.error('Tour guide error:', error);
      return getLocalFallback(step, trigger);
    }

    return data as TourGuideResponse;
  } catch (err) {
    console.error('Tour guide network error:', err);
    return getLocalFallback(step, trigger);
  }
}

function getLocalFallback(step: string, trigger: string): TourGuideResponse {
  // Ultra-minimal fallback if edge function AND its built-in fallbacks both fail
  const messages: Record<string, string> = {
    step_1: "Let's check in with your compass. Does your north star still feel true?",
    step_2: "Now let's look at your roles. Who needs your attention this week?",
    step_3: "Time for an honest check. Where are you strong? Where are you stretched thin?",
    step_4: "What will you commit to this week? What actions match your purpose?",
    step_5: "Look at your plan. Does this week reflect who you want to be?",
    morning_spark: "Good morning. What matters most today?",
    evening_review: "The day is done. Did you act in alignment?",
  };

  return {
    message: messages[step] || messages.step_1,
    tone: "encourage",
    thread_reference: "none",
  };
}
