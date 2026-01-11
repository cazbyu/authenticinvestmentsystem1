import { SupabaseClient } from '@supabase/supabase-js';
import { toLocalISOString } from '@/lib/dateUtils';

/**
 * Weekly Scoring System
 * Implements weekly bonuses for the Authentic Investment System v1.0
 *
 * IMPORTANT: Execution scoring ONLY applies to 12-Week Goals (Varsity League),
 * NOT Custom Goals (Open League)
 */

export interface WeeklyStats {
  daysMetTarget: number;
  totalDays: number;
  keystoneCompleted: boolean;
  milestonesHit: number;
  twelveWeekGoalExecution: number; // Percentage (0-100)
}

/**
 * Calculate Weekly Bonus Points
 *
 * Components:
 * - Alignment: +50 for completing Weekly Alignment
 * - Consistency: +5 per day target met (max +35 for 7 days)
 * - Keystone: +20 for 100% adherence to weekly focus
 * - Milestones: +10 per milestone hit
 * - Execution: Tiered rewards for 12-Week Goals ONLY
 *   - 85%+: +25
 *   - 70%+: +10
 *   - 50%+: +5
 */
export function calculateWeeklyBonus(stats: WeeklyStats): number {
  let weeklyPoints = 0;

  // Alignment: +50 for completing Weekly Alignment
  // This is awarded when the user completes the weekly-alignment ritual
  weeklyPoints += 50;

  // Consistency: +5 per day the user met their target (max 7 days = +35)
  const consistencyBonus = Math.min(stats.daysMetTarget, 7) * 5;
  weeklyPoints += consistencyBonus;

  // Keystone: +20 for 100% adherence to weekly focus
  if (stats.keystoneCompleted) {
    weeklyPoints += 20;
  }

  // Milestones: +10 per milestone hit
  weeklyPoints += stats.milestonesHit * 10;

  // Execution: Tiered rewards for 12-Week Goals ONLY
  const execution = stats.twelveWeekGoalExecution;
  if (execution >= 85) {
    weeklyPoints += 25;
  } else if (execution >= 70) {
    weeklyPoints += 10;
  } else if (execution >= 50) {
    weeklyPoints += 5;
  }

  return weeklyPoints;
}

/**
 * Calculate execution percentage for 12-Week Goals
 * This EXCLUDES custom goals (Open League)
 *
 * Formula: (Completed tasks / Planned tasks) * 100
 * Only counts tasks from 12-week goals within the specified week
 */
export async function calculate12WeekGoalExecution(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<number> {
  try {
    // 1. Get all ACTIVE 12-week goals for this user
    const { data: goals, error: goalsError } = await supabase
      .from('0008-ap-goals-12wk')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'in_progress']);

    if (goalsError) throw goalsError;
    if (!goals || goals.length === 0) return 0;

    const goalIds = goals.map(g => g.id);

    // 2. Get all tasks linked to these 12-week goals
    const { data: taskJoins, error: taskJoinsError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id')
      .in('twelve_wk_goal_id', goalIds)
      .eq('goal_type', 'twelve_wk_goal')
      .eq('parent_type', 'task');

    if (taskJoinsError) throw taskJoinsError;
    if (!taskJoins || taskJoins.length === 0) return 0;

    const taskIds = taskJoins.map(j => j.parent_id);

    // 3. Count completed tasks this week
    const { data: completedTasks, error: completedError } = await supabase
      .from('0008-ap-tasks')
      .select('id', { count: 'exact', head: true })
      .in('id', taskIds)
      .eq('status', 'completed')
      .gte('completed_at', weekStartDate)
      .lte('completed_at', weekEndDate)
      .is('deleted_at', null);

    if (completedError) throw completedError;

    const completed = completedTasks?.length || 0;

    // 4. Count planned tasks this week (from week plans)
    const { data: plannedTasks, error: plannedError } = await supabase
      .from('0008-ap-task-week-plan')
      .select('task_id', { count: 'exact', head: true })
      .in('task_id', taskIds)
      .gte('week_start_date', weekStartDate)
      .lte('week_start_date', weekEndDate);

    if (plannedError) throw plannedError;

    const planned = plannedTasks?.length || 0;

    if (planned === 0) return 0;

    return Math.round((completed / planned) * 100);
  } catch (error) {
    console.error('Error calculating 12-week goal execution:', error);
    return 0;
  }
}

/**
 * Get or create weekly alignment record
 * Returns the alignment record for the specified week
 */
export async function getOrCreateWeeklyAlignment(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<any | null> {
  try {
    // Try to get existing record
    const { data: existing, error: existingError } = await supabase
      .from('0008-ap-weekly-alignments')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return existing;
    }

    // Create new record
    const { data: newRecord, error: insertError } = await supabase
      .from('0008-ap-weekly-alignments')
      .insert({
        user_id: userId,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        alignment_points: 50,
        consistency_points: 0,
        keystone_points: 0,
        milestone_points: 0,
        execution_points: 0,
        total_weekly_points: 0,
        days_met_target: 0,
        keystone_completed: false,
        milestones_hit: 0,
        execution_percentage: 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return newRecord;
  } catch (error) {
    console.error('Error getting/creating weekly alignment:', error);
    return null;
  }
}

/**
 * Update weekly alignment with calculated bonuses
 */
export async function updateWeeklyAlignment(
  supabase: SupabaseClient,
  alignmentId: string,
  stats: WeeklyStats
): Promise<boolean> {
  try {
    const weeklyBonus = calculateWeeklyBonus(stats);

    // Calculate individual point components
    const consistencyPoints = Math.min(stats.daysMetTarget, 7) * 5;
    const keystonePoints = stats.keystoneCompleted ? 20 : 0;
    const milestonePoints = stats.milestonesHit * 10;

    let executionPoints = 0;
    if (stats.twelveWeekGoalExecution >= 85) {
      executionPoints = 25;
    } else if (stats.twelveWeekGoalExecution >= 70) {
      executionPoints = 10;
    } else if (stats.twelveWeekGoalExecution >= 50) {
      executionPoints = 5;
    }

    const { error } = await supabase
      .from('0008-ap-weekly-alignments')
      .update({
        consistency_points: consistencyPoints,
        keystone_points: keystonePoints,
        milestone_points: milestonePoints,
        execution_points: executionPoints,
        days_met_target: stats.daysMetTarget,
        keystone_completed: stats.keystoneCompleted,
        milestones_hit: stats.milestonesHit,
        execution_percentage: stats.twelveWeekGoalExecution,
        total_weekly_points: weeklyBonus,
        completed_at: toLocalISOString(new Date()),
      })
      .eq('id', alignmentId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error updating weekly alignment:', error);
    return false;
  }
}

/**
 * Count days user met their daily target this week
 */
export async function countDaysMetTarget(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string,
  weekEndDate: string,
  targetScore: number = 10 // Default target
): Promise<number> {
  try {
    const { data: sparks, error } = await supabase
      .from('0008-ap-daily-sparks')
      .select('date, daily_score')
      .eq('user_id', userId)
      .gte('date', weekStartDate)
      .lte('date', weekEndDate);

    if (error) throw error;

    if (!sparks) return 0;

    // Count days where daily_score >= target
    const daysMetTarget = sparks.filter(s => s.daily_score >= targetScore).length;

    return daysMetTarget;
  } catch (error) {
    console.error('Error counting days met target:', error);
    return 0;
  }
}
