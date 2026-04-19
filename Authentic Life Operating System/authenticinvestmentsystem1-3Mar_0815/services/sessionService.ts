// services/sessionService.ts
import { getSupabaseClient } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────

export type ExerciseType = 'reps' | 'timed' | 'distance';
export type CompletionSource = 'auto' | 'manual';

export interface SessionExercise {
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
  // from v_step_progress:
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

export interface SessionSummary {
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
  target_days: number;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getSessionsForGoal(
  goalId: string
): Promise<SessionSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('v_session_summary')
    .select('*')
    .eq('goal_id', goalId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function getExercisesForSession(
  milestoneId: string
): Promise<SessionExercise[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('v_step_progress')
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
    .from('0008-ap-gl-session-log')
    .select('id')
    .eq('milestone_id', milestoneId)
    .eq('completed_date', logDate)
    .maybeSingle();

  if (!milestoneLog) return [];

  const { data, error } = await supabase
    .from('0008-ap-gl-step-log')
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

  // Upsert session-log row for this date
  // onConflict uses the UNIQUE(milestone_id, completed_date) constraint
  const { data: mlData, error: mlError } = await supabase
    .from('0008-ap-gl-session-log')
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
    .from('0008-ap-gl-step-log')
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
      .from('0008-ap-gl-step-log')
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

// Create a new session via the Postgres function
export async function createSession(params: {
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
  const { data, error } = await supabase.rpc('create_session', {
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

// Add an exercise to a session
export async function addExerciseToSession(
  userId: string,
  milestoneId: string,
  exercise: Omit<SessionExercise, 'exercise_id' | 'milestone_id' | 'last_logged' | 'sets_completed' | 'max_reps' | 'max_value'>
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('0008-ap-gl-session-steps')
    .insert({ user_id: userId, milestone_id: milestoneId, ...exercise })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// Update session metadata (name). Recurrence and target_days live
// on the linked task row, not on sessions — they're updated via
// createTaskWithWeekPlan at the caller.
export async function updateSession(
  milestoneId: string,
  params: {
    name?: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('0008-ap-gl-sessions')
    .update(params)
    .eq('id', milestoneId);
  if (error) throw error;
}

// Update a single exercise row on a session
export async function updateExercise(
  exerciseId: string,
  params: {
    name?: string;
    muscle_group?: string | null;
    exercise_type?: ExerciseType;
    target_sets?: number | null;
    target_reps?: number | null;
    target_value?: number | null;
    unit?: string | null;
    sort_order?: number;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('0008-ap-gl-session-steps')
    .update(params)
    .eq('id', exerciseId);
  if (error) throw error;
}

// Remove an exercise from a session. The FK from 0008-ap-gl-step-log
// to this row has ON DELETE CASCADE, so any completion history for
// the removed exercise is intentionally deleted along with it.
export async function removeExerciseFromSession(
  exerciseId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('0008-ap-gl-session-steps')
    .delete()
    .eq('id', exerciseId);
  if (error) throw error;
}

// Delete a session row. Cascades (DB-level ON DELETE CASCADE) clean up:
//   - 0008-ap-gl-session-log (via milestone_id FK)
//   - 0008-ap-gl-session-steps (via milestone_id FK)
//   - 0008-ap-gl-step-log (transitively via both of the above)
// Also: 0008-ap-tasks.milestone_id auto-nulls via ON DELETE SET NULL.
export async function deleteSession(milestoneId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('0008-ap-gl-sessions')
    .delete()
    .eq('id', milestoneId);
  if (error) throw error;
}

// Convert a Pattern 1 task into a Pattern 2 session by:
//   1. Inserting a new session row linked to the existing task
//   2. Flipping the task's task_type to 'milestone', clearing
//      tracking_template, and back-linking to the new session
// The caller is responsible for task metadata + week-plan
// (via createTaskWithWeekPlan) and exercise inserts.
//
// Two-call operation without atomic guarantee. If the session INSERT
// succeeds but the task UPDATE fails, the task retains
// task_type='standard' with an orphan session row pointing at it.
// Caller should guard against re-entry by checking for an existing
// linked session before calling. See handleSave P1→P2 branch.
export async function convertTaskToSession(
  userId: string,
  taskId: string,
  params: {
    goalId: string;
    name: string;
    milestoneType: string;
    completionRule: object;
  }
): Promise<string> {
  const supabase = getSupabaseClient();

  // Insert session row linked to the existing task
  const { data: session, error: sessErr } = await supabase
    .from('0008-ap-gl-sessions')
    .insert({
      user_id: userId,
      goal_id: params.goalId,
      task_id: taskId,
      name: params.name,
      milestone_type: params.milestoneType,
      completion_rule: params.completionRule,
    })
    .select('id')
    .single();
  if (sessErr) throw sessErr;

  // Flip task: task_type='milestone', clear tracking_template, back-link
  const { error: flipErr } = await supabase
    .from('0008-ap-tasks')
    .update({
      task_type: 'milestone',
      tracking_template: null,
      milestone_id: session.id,
    })
    .eq('id', taskId);
  if (flipErr) throw flipErr;

  return session.id;
}

// Revert a Pattern 2 task back to Pattern 1 after its session has
// been deleted. Flips task_type back to 'standard' and restores the
// caller-chosen tracking_template (typically 'workout' to preserve
// the user's original Detail Tracking intent).
// Note: 0008-ap-tasks.milestone_id is NOT updated here — it is
// auto-nulled by the ON DELETE SET NULL cascade when deleteSession
// removed the session row.
export async function revertSessionToTask(
  taskId: string,
  params: {
    trackingTemplate: string | null;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('0008-ap-tasks')
    .update({
      task_type: 'standard',
      tracking_template: params.trackingTemplate,
    })
    .eq('id', taskId);
  if (error) throw error;
}

// Get session completion dates for a specific week range
export async function getSessionCompletionsForWeek(
  milestoneId: string,
  weekStart: string,
  weekEnd: string
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('0008-ap-gl-session-log')
    .select('completed_date')
    .eq('milestone_id', milestoneId)
    .gte('completed_date', weekStart)
    .lte('completed_date', weekEnd);
  if (error) throw error;
  return (data ?? []).map(row => row.completed_date);
}
