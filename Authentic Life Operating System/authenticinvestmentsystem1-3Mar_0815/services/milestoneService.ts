// services/milestoneService.ts
import { getSupabaseClient } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────

export type ExerciseType = 'reps' | 'timed' | 'distance';
export type CompletionSource = 'auto' | 'manual';

export interface MilestoneExercise {
  exercise_id: string;
  milestone_id: string;
  exercise_name: string;
  muscle_group: string | null;
  exercise_type: ExerciseType;
  target_sets: number | null;
  target_reps: number | null;
  target_value: number | null;
  unit: string | null;
  sort_order: number;
  // from v_exercise_progress:
  last_logged: string | null;
  sets_completed: number | null;
  max_reps: number | null;
  max_value: number | null;
}

export interface ExerciseSet {
  set_number: number;
  reps_completed: number | null;
  value: number | null;
  unit: string | null;
  notes: string | null;
}

export interface DayExerciseLog {
  exercise_id: string;
  sets: ExerciseSet[];
}

export interface MilestoneSummary {
  milestone_id: string;
  user_id: string;
  goal_id: string | null;
  task_id: string | null;
  milestone_name: string;
  milestone_type: string;
  completion_rule: { type: string; required?: number; of?: number };
  sort_order: number;
  exercise_count: number;
  last_completed_date: string | null;
  total_completions: number;
  completions_this_week: number;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getMilestonesForGoal(
  goalId: string
): Promise<MilestoneSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('v_milestone_summary')
    .select('*')
    .eq('goal_id', goalId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function getExercisesForMilestone(
  milestoneId: string
): Promise<MilestoneExercise[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('v_exercise_progress')
    .select('*')
    .eq('milestone_id', milestoneId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function getExerciseLogsForDate(
  milestoneId: string,
  logDate: string
): Promise<DayExerciseLog[]> {
  const supabase = getSupabaseClient();

  const { data: milestoneLog } = await supabase
    .from('0008-ap-gl-milestone-log')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('completed_date', logDate)
    .maybeSingle();

  if (!milestoneLog) return [];

  const { data, error } = await supabase
    .from('0008-ap-gl-exercise-log')
    .select('exercise_id, set_number, reps_completed, value, unit, notes')
    .eq('milestone_log_id', milestoneLog.id)
    .order('exercise_id')
    .order('set_number');

  if (error) throw error;

  const grouped: Record<string, ExerciseSet[]> = {};
  for (const row of data ?? []) {
    if (!grouped[row.exercise_id]) grouped[row.exercise_id] = [];
    grouped[row.exercise_id].push({
      set_number: row.set_number,
      reps_completed: row.reps_completed,
      value: row.value,
      unit: row.unit,
      notes: row.notes,
    });
  }

  return Object.entries(grouped).map(([exercise_id, sets]) => ({
    exercise_id,
    sets,
  }));
}

// ── Writes ───────────────────────────────────────────────────────────

export async function saveExerciseLogs(
  userId: string,
  milestoneId: string,
  taskId: string,
  logDate: string,
  logs: DayExerciseLog[],
  completionRule: { type: string; required?: number; of?: number },
  totalExercises: number,
  taskOccurrenceId?: string
): Promise<{ completed: boolean; milestoneLogId: string }> {
  const supabase = getSupabaseClient();

  const exercisesLogged = logs.filter(l => l.sets.length > 0).length;

  // Upsert milestone-log row for this date
  // onConflict uses the UNIQUE(milestone_id, completed_date) constraint
  const { data: mlData, error: mlError } = await supabase
    .from('0008-ap-gl-milestone-log')
    .upsert({
      user_id: userId,
      milestone_id: milestoneId,
      task_occurrence_id: taskOccurrenceId ?? null,
      completed_date: logDate,
      completion_source: 'auto' as CompletionSource,
      exercises_completed: exercisesLogged,
      exercises_total: totalExercises,
    }, { onConflict: 'milestone_id,completed_date' })
    .select('id')
    .single();

  if (mlError) throw mlError;
  const milestoneLogId = mlData.id;

  // Delete existing exercise logs then reinsert (clean replace for set-level data)
  await supabase
    .from('0008-ap-gl-exercise-log')
    .delete()
    .eq('milestone_log_id', milestoneLogId);

  const insertRows = logs.flatMap(log =>
    log.sets.map(set => ({
      user_id: userId,
      exercise_id: log.exercise_id,
      milestone_log_id: milestoneLogId,
      task_occurrence_id: taskOccurrenceId ?? null,
      log_date: logDate,
      set_number: set.set_number,
      reps_completed: set.reps_completed,
      value: set.value,
      unit: set.unit,
      notes: set.notes,
    }))
  );

  if (insertRows.length > 0) {
    const { error: elError } = await supabase
      .from('0008-ap-gl-exercise-log')
      .insert(insertRows);
    if (elError) throw elError;
  }

  const completed = evaluateCompletionRule(
    completionRule,
    exercisesLogged,
    totalExercises
  );

  return { completed, milestoneLogId };
}

function evaluateCompletionRule(
  rule: { type: string; required?: number; of?: number },
  exercisesCompleted: number,
  totalExercises: number
): boolean {
  if (rule.type === 'all') {
    return exercisesCompleted >= totalExercises;
  }
  if (rule.type === 'threshold' && rule.required != null) {
    return exercisesCompleted >= rule.required;
  }
  return exercisesCompleted > 0;
}

// Create a new milestone via the Postgres function
export async function createMilestone(params: {
  userId: string;
  goalId: string;
  name: string;
  milestoneType: string;
  completionRule: object;
  recurrenceRule: string;
  targetDays: number;
  timelineId: string;
  timelineType: 'global' | 'custom';
  weekNumberStart?: number;
  sortOrder?: number;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_milestone', {
    p_user_id: params.userId,
    p_goal_id: params.goalId,
    p_name: params.name,
    p_milestone_type: params.milestoneType,
    p_completion_rule: params.completionRule,
    p_recurrence_rule: params.recurrenceRule,
    p_target_days: params.targetDays,
    p_timeline_id: params.timelineId,
    p_timeline_type: params.timelineType,
    p_week_number_start: params.weekNumberStart ?? 1,
    p_sort_order: params.sortOrder ?? 0,
  });
  if (error) throw error;
  return data as string;
}

// Add an exercise to a milestone
export async function addExerciseToMilestone(
  userId: string,
  milestoneId: string,
  exercise: Omit<MilestoneExercise, 'exercise_id' | 'milestone_id' | 'last_logged' | 'sets_completed' | 'max_reps' | 'max_value'>
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('0008-ap-gl-milestone-exercises')
    .insert({ user_id: userId, milestone_id: milestoneId, ...exercise })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// Get milestone completion dates for a specific week range
export async function getMilestoneCompletionsForWeek(
  milestoneId: string,
  weekStart: string,
  weekEnd: string
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('0008-ap-gl-milestone-log')
    .select('completed_date')
    .eq('milestone_id', milestoneId)
    .gte('completed_date', weekStart)
    .lte('completed_date', weekEnd);
  if (error) throw error;
  return (data ?? []).map(row => row.completed_date);
}
