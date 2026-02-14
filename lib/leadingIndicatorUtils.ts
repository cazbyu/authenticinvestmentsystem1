/**
 * Leading Indicators Utility for Morning Spark
 *
 * Leading indicators are recurring tasks linked to active goals via the
 * universal-goals-join table.  They represent "if I do X times per week I
 * will achieve my goal".  This module fetches the indicators relevant for
 * *today* so Morning Spark can surface them to the user.
 */

import { getSupabaseClient } from '@/lib/supabase';
import {
  formatLocalDate,
  getWeekStart,
  getWeekEnd,
  getCurrentWeekNumber,
} from '@/lib/dateUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadingIndicator {
  taskId: string;
  title: string;
  goalId: string;
  goalTitle: string;
  goalType: '12week' | 'custom';
  weeklyTarget: number;
  weeklyCompleted: number;
  remainingNeeded: number;
  recurrenceRule?: string;
  isTodayScheduledDay: boolean;
}

// ---------------------------------------------------------------------------
// RRULE helpers
// ---------------------------------------------------------------------------

/** Map from RFC 5545 BYDAY abbreviations to JS Date.getDay() values. */
const BYDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/**
 * Parse an RFC 5545 RRULE string and extract the BYDAY values as JS day-of-
 * week numbers (0 = Sunday .. 6 = Saturday).
 *
 * Example: "FREQ=WEEKLY;BYDAY=MO,WE,FR" -> [1, 3, 5]
 *
 * Returns `null` when the RRULE does not contain a BYDAY component.
 */
export function parseBYDAY(rrule?: string | null): number[] | null {
  if (!rrule) return null;

  // RRULE may or may not have the "RRULE:" prefix
  const normalized = rrule.replace(/^RRULE:/i, '');

  const parts = normalized.split(';');
  const bydayPart = parts.find((p) => p.toUpperCase().startsWith('BYDAY='));
  if (!bydayPart) return null;

  const dayTokens = bydayPart.split('=')[1].split(',');
  const days: number[] = [];

  for (const token of dayTokens) {
    // Strip any leading numeric modifier (e.g. "1MO" -> "MO")
    const abbr = token.replace(/^-?\d+/, '').toUpperCase();
    if (abbr in BYDAY_MAP) {
      days.push(BYDAY_MAP[abbr]);
    }
  }

  return days.length > 0 ? days : null;
}

/**
 * Returns `true` when a given date falls on one of the BYDAY days encoded in
 * the RRULE.  When the RRULE has no BYDAY component the function returns
 * `true` (any day is valid).
 */
export function isTodayInRRule(date: Date, rrule?: string | null): boolean {
  const days = parseBYDAY(rrule);
  if (!days) return true; // no BYDAY constraint => any day is ok
  return days.includes(date.getDay());
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

/**
 * Fetch leading indicators for today.
 *
 * Returns an array of `LeadingIndicator` objects sorted by urgency
 * (most remaining completions needed first).
 */
export async function fetchLeadingIndicatorsForToday(
  userId: string
): Promise<LeadingIndicator[]> {
  const LOG_TAG = '[fetchLeadingIndicatorsForToday]';

  try {
    const supabase = getSupabaseClient();
    const today = new Date();
    const todayStr = formatLocalDate(today);

    // Week bounds (Sunday – Saturday)
    const weekStart = getWeekStart(today, 'sunday');
    const weekEnd = getWeekEnd(today, 'sunday');
    const weekStartStr = formatLocalDate(weekStart);
    const weekEndStr = formatLocalDate(weekEnd);

    console.debug(LOG_TAG, 'today:', todayStr, 'week:', weekStartStr, '-', weekEndStr);

    // ------------------------------------------------------------------
    // 1. Fetch active goals (12-week + custom) for the user
    // ------------------------------------------------------------------
    const [goals12wkRes, goalsCustomRes] = await Promise.all([
      supabase
        .from('0008-ap-goals-12wk')
        .select('id, title')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('archived', false),
      supabase
        .from('0008-ap-goals-custom')
        .select('id, title')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('archived', false),
    ]);

    if (goals12wkRes.error) {
      console.error(LOG_TAG, '12wk goals error:', goals12wkRes.error);
      return [];
    }
    if (goalsCustomRes.error) {
      console.error(LOG_TAG, 'custom goals error:', goalsCustomRes.error);
      return [];
    }

    const goals12wk = goals12wkRes.data ?? [];
    const goalsCustom = goalsCustomRes.data ?? [];

    const goalMap12wk = new Map(goals12wk.map((g) => [g.id, g.title]));
    const goalMapCustom = new Map(goalsCustom.map((g) => [g.id, g.title]));

    const allGoalIds = [...goalMap12wk.keys(), ...goalMapCustom.keys()];

    console.debug(LOG_TAG, 'active goals:', allGoalIds.length);

    if (allGoalIds.length === 0) return [];

    // ------------------------------------------------------------------
    // 2. Get goal joins linking tasks to these goals
    // ------------------------------------------------------------------
    const twelveWkFilter = `twelve_wk_goal_id.in.(${allGoalIds.join(',')})`;
    const customFilter = `custom_goal_id.in.(${allGoalIds.join(',')})`;

    const { data: goalJoins, error: joinsErr } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id, twelve_wk_goal_id, custom_goal_id, goal_type')
      .or(`${twelveWkFilter},${customFilter}`)
      .eq('parent_type', 'task');

    if (joinsErr) {
      console.error(LOG_TAG, 'goal joins error:', joinsErr);
      return [];
    }

    const taskIds = (goalJoins ?? []).map((j) => j.parent_id);
    console.debug(LOG_TAG, 'linked task ids:', taskIds.length);

    if (taskIds.length === 0) return [];

    // ------------------------------------------------------------------
    // 3. Load the parent recurring tasks (recurrence_rule IS NOT NULL)
    // ------------------------------------------------------------------
    const { data: tasksData, error: tasksErr } = await supabase
      .from('0008-ap-tasks')
      .select('id, title, recurrence_rule')
      .eq('user_id', userId)
      .in('id', taskIds)
      .not('recurrence_rule', 'is', null)
      .is('deleted_at', null)
      .not('status', 'in', '(completed,cancelled)');

    if (tasksErr) {
      console.error(LOG_TAG, 'tasks error:', tasksErr);
      return [];
    }

    const tasks = tasksData ?? [];
    console.debug(LOG_TAG, 'recurring tasks:', tasks.length);

    if (tasks.length === 0) return [];

    const recurringTaskIds = tasks.map((t) => t.id);

    // ------------------------------------------------------------------
    // 4. Resolve the user's global timeline to derive week number
    // ------------------------------------------------------------------
    const { data: timelineData, error: timelineErr } = await supabase
      .from('0008-ap-user-global-timeline')
      .select('id, start_date')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (timelineErr) {
      console.error(LOG_TAG, 'timeline error:', timelineErr);
      return [];
    }

    let weekNumber: number | null = null;
    let timelineId: string | null = null;

    if (timelineData) {
      timelineId = timelineData.id;
      weekNumber = getCurrentWeekNumber(timelineData.start_date, todayStr, 'sunday');
      console.debug(LOG_TAG, 'timeline:', timelineId, 'weekNumber:', weekNumber);
    }

    // ------------------------------------------------------------------
    // 5. Week-plan rows for the current week (target_days per task)
    // ------------------------------------------------------------------
    let weekPlanMap = new Map<string, number>(); // taskId -> target_days

    if (weekNumber != null && timelineId) {
      const { data: weekPlans, error: wpErr } = await supabase
        .from('0008-ap-task-week-plan')
        .select('task_id, target_days')
        .in('task_id', recurringTaskIds)
        .eq('week_number', weekNumber)
        .eq('user_global_timeline_id', timelineId)
        .is('deleted_at', null);

      if (wpErr) {
        console.error(LOG_TAG, 'week plans error:', wpErr);
        // Continue without week plans — we'll default target to 0
      } else {
        for (const wp of weekPlans ?? []) {
          weekPlanMap.set(wp.task_id, wp.target_days ?? 0);
        }
      }
    }

    console.debug(LOG_TAG, 'week plans found:', weekPlanMap.size);

    // ------------------------------------------------------------------
    // 6. Count completed occurrences this week (using recurrence-expanded view)
    // ------------------------------------------------------------------
    const { data: occurrences, error: occErr } = await supabase
      .from('v_tasks_with_recurrence_expanded')
      .select('source_task_id')
      .eq('user_id', userId)
      .in('source_task_id', recurringTaskIds)
      .not('completed_at', 'is', null)
      .gte('occurrence_date', weekStartStr)
      .lte('occurrence_date', weekEndStr);

    if (occErr) {
      console.error(LOG_TAG, 'occurrences error:', occErr);
      return [];
    }

    // Build a count map: source_task_id (template) -> completions this week
    const completionMap = new Map<string, number>();
    for (const occ of occurrences ?? []) {
      const pid = occ.source_task_id as string;
      completionMap.set(pid, (completionMap.get(pid) ?? 0) + 1);
    }

    console.debug(LOG_TAG, 'tasks with completions this week:', completionMap.size);

    // ------------------------------------------------------------------
    // 7. Assemble indicators, applying filtering logic
    // ------------------------------------------------------------------
    const indicators: LeadingIndicator[] = [];

    for (const task of tasks) {
      const weeklyTarget = weekPlanMap.get(task.id) ?? 0;
      const weeklyCompleted = completionMap.get(task.id) ?? 0;
      const remainingNeeded = Math.max(0, weeklyTarget - weeklyCompleted);

      // Skip if target already met
      if (remainingNeeded <= 0) continue;

      // Skip if RRULE specifies certain days and today is not one of them
      const todayIsScheduled = isTodayInRRule(today, task.recurrence_rule);
      if (!todayIsScheduled) continue;

      // Resolve goal info from the join
      const join = (goalJoins ?? []).find((j) => j.parent_id === task.id);
      if (!join) continue;

      let goalId: string;
      let goalTitle: string;
      let goalType: '12week' | 'custom';

      if (join.goal_type === 'twelve_wk_goal' && join.twelve_wk_goal_id) {
        goalId = join.twelve_wk_goal_id;
        goalTitle = goalMap12wk.get(goalId) ?? 'Untitled Goal';
        goalType = '12week';
      } else if (join.custom_goal_id) {
        goalId = join.custom_goal_id;
        goalTitle = goalMapCustom.get(goalId) ?? 'Untitled Goal';
        goalType = 'custom';
      } else {
        continue; // no recognized goal link
      }

      indicators.push({
        taskId: task.id,
        title: task.title,
        goalId,
        goalTitle,
        goalType,
        weeklyTarget,
        weeklyCompleted,
        remainingNeeded,
        recurrenceRule: task.recurrence_rule ?? undefined,
        isTodayScheduledDay: todayIsScheduled,
      });
    }

    // Sort by urgency: most remaining needed first
    indicators.sort((a, b) => b.remainingNeeded - a.remainingNeeded);

    console.debug(LOG_TAG, 'indicators returned:', indicators.length);

    return indicators;
  } catch (err) {
    console.error('[fetchLeadingIndicatorsForToday] unexpected error:', err);
    return [];
  }
}
