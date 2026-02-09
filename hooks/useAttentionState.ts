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

      let shouldSpin = false;

      // === CONDITION 1: MVV Status ===
      const { data: northStar } = await supabase
        .from('0008-ap-north-star')
        .select('mission_statement, 5yr_vision, core_values')
        .eq('user_id', user.id)
        .maybeSingle();

      const hasMission = !!(northStar?.mission_statement?.trim());
      const hasVision = !!(northStar?.['5yr_vision']?.trim());
      const hasValues = northStar?.core_values && 
        Array.isArray(northStar.core_values) && 
        northStar.core_values.length > 0;
      const mvvComplete = hasMission && hasVision && hasValues;

      // Check for recent MVV-related visits (72hr pause for incomplete, 30 days for complete)
      const pauseHours = mvvComplete ? 720 : 72; // 720 hours = 30 days
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - pauseHours);

      const { data: recentVisits } = await supabase
        .from('0008-ap-north-star-visits')
        .select('id')
        .eq('user_id', user.id)
        .in('visit_type', [
          'mission_edit', 
          'vision_edit', 
          'values_edit', 
          'weekly_alignment_step', 
          'morning_spark_step'
        ])
        .gte('visited_at', cutoff.toISOString())
        .limit(1);

      const hasRecentVisit = recentVisits && recentVisits.length > 0;

      // Condition 1a: MVV incomplete and no 72hr pause
      if (!mvvComplete && !hasRecentVisit) {
        shouldSpin = true;
      }

      // Condition 1b: MVV complete but stale (no review in 30 days)
      if (mvvComplete && !hasRecentVisit) {
        shouldSpin = true;
      }

      // === CONDITION 2: Weekly Alignment - Check if step_1_completed exists for current week ===
      // Get user's week start preference
      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('week_start_day')
        .eq('id', user.id)
        .maybeSingle();
      
      const weekStartDay = (userData?.week_start_day === 'monday' ? 'monday' : 'sunday') as 'sunday' | 'monday';
      
      // Calculate current week's start date
      const today = new Date();
      const startOfWeek = getWeekStart(today, weekStartDay);
      const currentWeekStartDate = formatLocalDate(startOfWeek);

      // Check if step_1_completed exists for current week
      const { data: currentWeekAlignment } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('step_1_completed')
        .eq('user_id', user.id)
        .eq('week_start_date', currentWeekStartDate)
        .not('step_1_completed', 'is', null)
        .limit(1);

      if (!currentWeekAlignment || currentWeekAlignment.length === 0) {
        shouldSpin = true;
      }

      // === CONDITION 3: Morning Spark Streak Broken (3+ consecutive days) ===
      const todayStr = formatLocalDate(today);
      
      // Check the last 3 days (today, yesterday, day before)
      const sparkDates: string[] = [];
      for (let i = 0; i < 3; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        sparkDates.push(formatLocalDate(checkDate));
      }

      const { data: recentSparks } = await supabase
        .from('0008-ap-daily-sparks')
        .select('spark_date')
        .eq('user_id', user.id)
        .in('spark_date', sparkDates);

      const foundSparkDates = new Set(recentSparks?.map(s => s.spark_date) || []);
      const missedDays = sparkDates.filter(d => !foundSparkDates.has(d)).length;

      if (missedDays >= 3) {
        shouldSpin = true;
      }

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