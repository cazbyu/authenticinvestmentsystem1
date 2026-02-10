import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, getWeekStart } from '@/lib/dateUtils';

interface AttentionState {
  needsAttention: boolean;
  showOnboardingArrow: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAttentionState(): AttentionState {
  const [needsAttention, setNeedsAttention] = useState(false);
  const [showOnboardingArrow, setShowOnboardingArrow] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAttentionState = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Calculate current week start date (using Monday as week start)
      const today = new Date();
      const startOfWeek = getWeekStart(today, 'monday');
      const currentWeekStartDate = formatLocalDate(startOfWeek);
      const todayStr = formatLocalDate(today);

      // === CONDITION 1: Weekly Alignment NOT completed this week ===
      const { data: weeklyAlignment } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('step_1_completed')
        .eq('user_id', user.id)
        .eq('week_start_date', currentWeekStartDate)
        .not('step_1_completed', 'is', null)
        .limit(1);

      const weeklyAlignmentDone = weeklyAlignment && weeklyAlignment.length > 0;

      // === CONDITION 2: Morning Spark NOT done today ===
      const { data: todaySpark } = await supabase
        .from('0008-ap-daily-sparks')
        .select('id')
        .eq('user_id', user.id)
        .eq('spark_date', todayStr)
        .limit(1);

      const morningSparkDone = todaySpark && todaySpark.length > 0;

      // === CORE LOGIC: Compass spins only when BOTH are incomplete ===
      const shouldSpin = !weeklyAlignmentDone && !morningSparkDone;

      // === CHECK ONBOARDING STATUS (for arrow) ===
      const { data: onboarding } = await supabase
        .from('0008-ap-onboarding')
        .select('completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const onboardingComplete = !!onboarding?.completed_at;

      setNeedsAttention(shouldSpin);
      setShowOnboardingArrow(!onboardingComplete);
      setLoading(false);

    } catch (error) {
      console.error('Error checking attention state:', error);
      setNeedsAttention(false);
      setShowOnboardingArrow(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAttentionState();
  }, [checkAttentionState]);

  return {
    needsAttention,
    showOnboardingArrow,
    loading,
    refresh: checkAttentionState,
  };
}