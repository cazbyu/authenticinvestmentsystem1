import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/dateUtils';

export interface AttentionState {
  needsAttention: boolean;
  weeklyAlignmentOverdue: boolean;
  morningSparkDue: boolean;
  showOnboardingArrow: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  skipWeeklyAlignment: () => Promise<void>;
  skipMorningSpark: () => Promise<void>;
}

export function useAttentionState(): AttentionState {
  const [weeklyAlignmentOverdue, setWeeklyAlignmentOverdue] = useState(false);
  const [morningSparkDue, setMorningSparkDue] = useState(false);
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

      // === CHECK 1: Weekly Alignment for current week ===
      // Calculate the start of the current week (Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStartStr = formatLocalDate(startOfWeek);

      const { data: thisWeekAlignment } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('id, signed_at, skipped_at')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStartStr)
        .maybeSingle();

      // Overdue if no record, or record exists but not signed and not skipped
      const waComplete = !!(thisWeekAlignment?.signed_at);
      const waSkipped = !!(thisWeekAlignment?.skipped_at);
      const isWeeklyOverdue = !waComplete && !waSkipped;
      setWeeklyAlignmentOverdue(isWeeklyOverdue);

      // === CHECK 2: Morning Spark for today ===
      const todayStr = formatLocalDate(today);

      const { data: todaySpark } = await supabase
        .from('0008-ap-daily-sparks')
        .select('id, skipped')
        .eq('user_id', user.id)
        .eq('spark_date', todayStr)
        .maybeSingle();

      const sparkComplete = !!todaySpark;
      const sparkSkipped = !!(todaySpark?.skipped);
      const isSparkDue = !sparkComplete;
      setMorningSparkDue(isSparkDue);

      // === CHECK ONBOARDING STATUS (for arrow) ===
      const { data: onboarding } = await supabase
        .from('0008-ap-onboarding')
        .select('completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const onboardingComplete = !!onboarding?.completed_at;
      setShowOnboardingArrow(!onboardingComplete);
      setLoading(false);

    } catch (error) {
      console.error('Error checking attention state:', error);
      setWeeklyAlignmentOverdue(false);
      setMorningSparkDue(false);
      setShowOnboardingArrow(false);
      setLoading(false);
    }
  }, []);

  // Skip Weekly Alignment for this week
  const skipWeeklyAlignment = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const weekStartStr = formatLocalDate(startOfWeek);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const weekEndStr = formatLocalDate(endOfWeek);

      // Upsert: create or update with skipped_at
      await supabase
        .from('0008-ap-weekly-alignments')
        .upsert({
          user_id: user.id,
          week_start_date: weekStartStr,
          week_end_date: weekEndStr,
          skipped_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,week_start_date',
        });

      setWeeklyAlignmentOverdue(false);
    } catch (error) {
      console.error('Error skipping weekly alignment:', error);
    }
  }, []);

  // Skip Morning Spark for today
  const skipMorningSpark = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = formatLocalDate(new Date());

      // Insert a minimal spark record marked as skipped
      await supabase
        .from('0008-ap-daily-sparks')
        .upsert({
          user_id: user.id,
          spark_date: todayStr,
          fuel_level: 2,
          mode: 'Steady',
          initial_target_score: 35,
          skipped: true,
        }, {
          onConflict: 'user_id,spark_date',
        });

      setMorningSparkDue(false);
    } catch (error) {
      console.error('Error skipping morning spark:', error);
    }
  }, []);

  useEffect(() => {
    checkAttentionState();
  }, [checkAttentionState]);

  // Derived: needsAttention is true when either is overdue (backward compat)
  const needsAttention = weeklyAlignmentOverdue || morningSparkDue;

  return {
    needsAttention,
    weeklyAlignmentOverdue,
    morningSparkDue,
    showOnboardingArrow,
    loading,
    refresh: checkAttentionState,
    skipWeeklyAlignment,
    skipMorningSpark,
  };
}
