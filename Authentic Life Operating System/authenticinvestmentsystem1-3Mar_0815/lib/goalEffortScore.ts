import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Effort Score computation for a single goal.
 *
 * Replaces the broken `calculateGoalProgress` in `lib/taskUtils.ts`, which
 * queried a nonexistent column (`0008-ap-task-log.completed`) and silently
 * returned 0% via internal error-swallow. This function is the one source
 * of truth for Effort Score across Goal Bank, zone Goals, and (eventually)
 * the Roles page.
 *
 * Definitions (locked with Paul in 3b-4c):
 *   Weekly Effort Score (per week W):
 *     planCount      = rows in 0008-ap-task-week-plan for (goal's tasks, week_number=W),
 *                      where tasks are resolved via universal-goals-join.
 *     completedCount = subset where the linked task has status='completed' AND
 *                      completed_at falls within week W's [week_start, week_end].
 *     score          = planCount > 0 ? min(100, round(completedCount/planCount * 100)) : 0
 *
 *   Cumulative Effort Score:
 *     Average of weekly scores from Week 1 through `currentWeek` inclusive.
 *     Future weeks excluded. Past weeks count even if 0.
 *
 *   currentWeekEffortScore:
 *     The weekly score for `currentWeek`.
 *
 * Timeline resolution: 12wk goals use `goal.user_global_timeline_id` against
 * `v_unified_timeline_weeks`; custom goals use `goal.custom_timeline_id`
 * against `v_custom_timeline_weeks`. Mirrors useGoalProgress.fetchCycleWeeks.
 *
 * Deliberate design decisions:
 *   - Deleted-but-completed tasks still count. The completed-tasks query
 *     intentionally omits a `deleted_at IS NULL` filter — effort score
 *     measures what the user DID at the time, not the current visibility
 *     of the task. Tidying up old tasks shouldn't retroactively lower a
 *     past week's score. Revisit if this causes user-visible unfairness.
 *   - `goal_type` accepts both DB-join form ('twelve_wk_goal' | 'custom_goal')
 *     and useGoals UI form ('12week' | 'custom'). Normalized internally.
 *
 * Completion counting (updated 3b-4c-i-fix): counts ALL completed tasks
 * linked to the goal whose completed_at falls within a given week's
 * date range, regardless of whether the completed task is a parent
 * (with a week_plan row) or a child (created via
 * completeActionSuggestion, no week_plan row). Prior implementation
 * iterated week_plans and missed child completions — the dominant
 * pattern for recurring goals. See backlog #12 history.
 */

export interface GoalInputForEffort {
  id: string;
  // Accept both the DB join-column convention ('twelve_wk_goal' | 'custom_goal')
  // and the useGoals UI convention ('12week' | 'custom'). Normalized internally.
  goal_type: 'twelve_wk_goal' | 'custom_goal' | '12week' | 'custom';
  user_global_timeline_id?: string | null;
  custom_timeline_id?: string | null;
}

export interface WeeklyEffort {
  weekNumber: number;
  weekStart: string;  // YYYY-MM-DD
  weekEnd: string;    // YYYY-MM-DD
  planCount: number;
  completedCount: number;
  effortScore: number;  // 0-100, integer
}

export interface GoalEffortProgress {
  currentWeek: number;       // 1-based; clamps to 1 pre-cycle, to totalWeeks post-cycle
  totalWeeks: number;
  cycleStart: string;         // YYYY-MM-DD (== week 1 start)
  cycleEnd: string;           // YYYY-MM-DD (== last week end)
  currentWeekEffortScore: number;  // 0-100
  cumulativeEffortScore: number;   // 0-100
  weeklyBreakdown: WeeklyEffort[]; // weeks 1..currentWeek inclusive
}

const EMPTY_RESULT: GoalEffortProgress = {
  currentWeek: 1,
  totalWeeks: 0,
  cycleStart: '',
  cycleEnd: '',
  currentWeekEffortScore: 0,
  cumulativeEffortScore: 0,
  weeklyBreakdown: [],
};

export async function calculateGoalEffortProgress(
  supabase: SupabaseClient,
  goal: GoalInputForEffort,
  abortSignal?: AbortSignal,
): Promise<GoalEffortProgress> {
  // Normalize goal_type to the DB join-column convention
  const isCustom = goal.goal_type === 'custom' || goal.goal_type === 'custom_goal';
  const goalTypeForJoin = isCustom ? 'custom_goal' : 'twelve_wk_goal';
  const timelineId = isCustom ? goal.custom_timeline_id : goal.user_global_timeline_id;

  if (!timelineId) {
    // No timeline linkage — can't compute weeks. Return empty.
    return EMPTY_RESULT;
  }

  // 1. Fetch all weeks for this goal's timeline
  const weeksQuery = isCustom
    ? supabase
        .from('v_custom_timeline_weeks')
        .select('week_number, week_start, week_end')
        .eq('custom_timeline_id', timelineId)
        .order('week_number', { ascending: true })
    : supabase
        .from('v_unified_timeline_weeks')
        .select('week_number, week_start, week_end')
        .eq('timeline_id', timelineId)
        .order('week_number', { ascending: true });

  const { data: weeks, error: weeksError } = await weeksQuery;
  if (weeksError) throw weeksError;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const weekRows = (weeks ?? []) as Array<{
    week_number: number;
    week_start: string;
    week_end: string;
  }>;
  if (weekRows.length === 0) return EMPTY_RESULT;

  // 2. Determine current week by local date
  const todayStr = formatLocalDate(new Date());
  let currentWeek = weekRows[weekRows.length - 1].week_number; // default: past cycle end
  const currentWeekRow = weekRows.find(
    w => w.week_start <= todayStr && todayStr <= w.week_end,
  );
  if (currentWeekRow) {
    currentWeek = currentWeekRow.week_number;
  } else if (todayStr < weekRows[0].week_start) {
    currentWeek = 1; // before cycle start
  }

  const totalWeeks = weekRows.length;
  const cycleStart = weekRows[0].week_start;
  const cycleEnd = weekRows[weekRows.length - 1].week_end;

  // 3. Resolve the goal's linked task IDs via universal-goals-join
  const { data: joinRows, error: joinError } = await supabase
    .from('0008-ap-universal-goals-join')
    .select('parent_id')
    .eq('goal_id', goal.id)
    .eq('goal_type', goalTypeForJoin)
    .eq('parent_type', 'task');

  if (joinError) throw joinError;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const taskIds = (joinRows ?? []).map(r => r.parent_id as string).filter(Boolean);
  if (taskIds.length === 0) {
    // No tasks linked: every past/current week is 0%
    return buildResult(weekRows, currentWeek, totalWeeks, cycleStart, cycleEnd, [], new Map());
  }

  // 4. Parallel: fetch week-plans (for weeks 1..currentWeek) + completed tasks in cycle range
  const [weekPlansResult, completedTasksResult] = await Promise.all([
    supabase
      .from('0008-ap-task-week-plan')
      .select('task_id, week_number')
      .in('task_id', taskIds)
      .is('deleted_at', null)
      .lte('week_number', currentWeek),
    // Intentionally no deleted_at filter: effort score measures historic
    // completion, not current task list state. See docblock note above.
    supabase
      .from('0008-ap-tasks')
      .select('id, completed_at')
      .in('id', taskIds)
      .eq('status', 'completed')
      .not('completed_at', 'is', null),
  ]);

  if (weekPlansResult.error) throw weekPlansResult.error;
  if (completedTasksResult.error) throw completedTasksResult.error;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const weekPlans = (weekPlansResult.data ?? []) as Array<{
    task_id: string;
    week_number: number;
  }>;
  const completed = (completedTasksResult.data ?? []) as Array<{
    id: string;
    completed_at: string;
  }>;

  // Index completed tasks: id -> YYYY-MM-DD (local) for week-range comparison
  const completedDateByTaskId = new Map<string, string>();
  for (const t of completed) {
    if (t.id && t.completed_at) {
      completedDateByTaskId.set(t.id, formatLocalDate(new Date(t.completed_at)));
    }
  }

  return buildResult(
    weekRows, currentWeek, totalWeeks, cycleStart, cycleEnd,
    weekPlans, completedDateByTaskId,
  );
}

// Aggregate weekly breakdown + summary scores. Extracted so the no-tasks
// early return can reuse the same shape-building logic.
function buildResult(
  weekRows: Array<{ week_number: number; week_start: string; week_end: string }>,
  currentWeek: number,
  totalWeeks: number,
  cycleStart: string,
  cycleEnd: string,
  weekPlans: Array<{ task_id: string; week_number: number }>,
  completedDateByTaskId: Map<string, string>,
): GoalEffortProgress {
  const weeklyBreakdown: WeeklyEffort[] = [];

  for (const week of weekRows) {
    if (week.week_number > currentWeek) break;

    const plansThisWeek = weekPlans.filter(wp => wp.week_number === week.week_number);
    const planCount = plansThisWeek.length;

    // Count ALL goal-linked completions whose date falls in this week's
    // range. Prior version iterated plansThisWeek (parents only) — that
    // missed child occurrences, which carry the real completion data for
    // recurring goals. completedDateByTaskId already contains parents +
    // children (the universal-goals-join fetch returns both).
    let completedCount = 0;
    for (const d of completedDateByTaskId.values()) {
      if (d >= week.week_start && d <= week.week_end) {
        completedCount += 1;
      }
    }

    const effortScore = planCount > 0
      ? Math.min(100, Math.round((completedCount / planCount) * 100))
      : 0;

    weeklyBreakdown.push({
      weekNumber: week.week_number,
      weekStart: week.week_start,
      weekEnd: week.week_end,
      planCount,
      completedCount,
      effortScore,
    });
  }

  const currentWeekEffortScore =
    weeklyBreakdown[weeklyBreakdown.length - 1]?.effortScore ?? 0;

  const cumulativeEffortScore = weeklyBreakdown.length > 0
    ? Math.round(
        weeklyBreakdown.reduce((sum, w) => sum + w.effortScore, 0) /
          weeklyBreakdown.length,
      )
    : 0;

  return {
    currentWeek,
    totalWeeks,
    cycleStart,
    cycleEnd,
    currentWeekEffortScore,
    cumulativeEffortScore,
    weeklyBreakdown,
  };
}
