import { useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

type OnboardingStep = 
  | 'welcome'
  | 'mission_intro'
  | 'vision_intro'
  | 'values_intro'
  | 'roles_intro'
  | 'wellness_intro'
  | 'goals_intro'
  | 'capture_options_intro'
  | 'weekly_alignment_intro';

interface StepData {
  acknowledged_at: string;
  content_added?: boolean;
  options_explored?: string[];
  [key: string]: any;
}

export function useOnboarding() {
  const supabase = getSupabaseClient();

  // Mark a step as acknowledged (user clicked "I understand")
  const acknowledgeStep = useCallback(async (
    step: OnboardingStep,
    extraData?: Partial<StepData>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      // Get current onboarding record
      const { data: existing } = await supabase
        .from('0008-ap-onboarding')
        .select('steps_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentSteps = existing?.steps_completed || {};
      
      const updatedSteps = {
        ...currentSteps,
        [step]: {
          acknowledged_at: new Date().toISOString(),
          ...extraData,
        },
      };

      // Upsert the onboarding record
      const { error } = await supabase
        .from('0008-ap-onboarding')
        .upsert({
          user_id: user.id,
          steps_completed: updatedSteps,
          current_step: step,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      return { success: true };

    } catch (error) {
      console.error('Error acknowledging step:', error);
      return { success: false, error };
    }
  }, [supabase]);

  // Mark content as added for a step
  const markContentAdded = useCallback(async (step: OnboardingStep) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      const { data: existing } = await supabase
        .from('0008-ap-onboarding')
        .select('steps_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentSteps = existing?.steps_completed || {};
      const currentStepData = currentSteps[step] || {};

      const updatedSteps = {
        ...currentSteps,
        [step]: {
          ...currentStepData,
          content_added: true,
          content_added_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from('0008-ap-onboarding')
        .upsert({
          user_id: user.id,
          steps_completed: updatedSteps,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      return { success: true };

    } catch (error) {
      console.error('Error marking content added:', error);
      return { success: false, error };
    }
  }, [supabase]);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      const { error } = await supabase
        .from('0008-ap-onboarding')
        .upsert({
          user_id: user.id,
          completed_at: new Date().toISOString(),
          current_step: 'completed',
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      return { success: true };

    } catch (error) {
      console.error('Error completing onboarding:', error);
      return { success: false, error };
    }
  }, [supabase]);

  // Check if onboarding is complete
  const isOnboardingComplete = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('0008-ap-onboarding')
        .select('completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      return !!data?.completed_at;

    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }, [supabase]);

  // Get current onboarding state
  const getOnboardingState = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('0008-ap-onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      return data;

    } catch (error) {
      console.error('Error getting onboarding state:', error);
      return null;
    }
  }, [supabase]);

  return {
    acknowledgeStep,
    markContentAdded,
    completeOnboarding,
    isOnboardingComplete,
    getOnboardingState,
  };
}