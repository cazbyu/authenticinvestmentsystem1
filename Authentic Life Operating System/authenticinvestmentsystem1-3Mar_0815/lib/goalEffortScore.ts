import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Effort Score computation for a single goal.
 *
 * One source of truth for Effort Score across Goal Bank, zone Goals,
 * GoalDetailView, MyGoalsView, and (eventually) the Roles page.
 *
 * Definitions (3b-4c-iv lock — supersedes earlier variants):
 *
 *   Per-action contribution per day:
 *     • Standard recurring task: binary 1 if a child task with
 *       status='completed' has due_date == that day; else 0.
 *     • Session task (parent has a row in 0008-ap-gl-sessions): fractional.
 *       For each step of the session (rows in 0008-ap-gl-session-steps):
 *         - target_sets > 0  → step_fraction = min(distinct set_numbers
 *                              logged for that day, target_sets) / target_sets
 *         - target_sets NULL or 0 → step_fraction = 1 if any step_log row
 *                                   exists for that step on that day, else 0
 *       Day fraction = AVG(step_fractions across ALL steps in the session).
 *       Steps with no logs that day contribute 0 to the average.
 *
 *   Per-action weekly contribution: SUM of per-day contributions across days
 *   in the week, capped at the action's target_days from
 *   0008-ap-task-week-plan (week_number = W).
 *
 *   Weekly Effort Score (per goal, per week):
 *     planCount      = SUM of target_days across the goal's leading-indicator
 *                      actions for that week
 *     completedCount = SUM of per-action capped weekly contribution
 *     score          = planCount > 0 ? round(100 * completedCount / planCount) : 0
 *     By construction completedCount ≤ planCount → score is naturally 0..100.
 *
 *   Cumulative Effort Score (through currentWeek):
 *     SUM(weeklyBreakdown[1..currentWeek].completedCount) /
 *     SUM(weeklyBreakdown[1..currentWeek].planCount) × 100
 *     Sum-of-numerators over sum-of-denominators — NOT average of weekly
 *     scores. A perfect single week doesn't dominate a partial average.
 *
 *   currentWeekEffortScore: the weekly score for `currentWeek`.
 *
 * Timeline resolution: 12wk goals use `goal.user_global_timeline_id` against
 * `v_unified_timeline_weeks`; custom goals use `goal.custom_timeline_id`
 * against `v_custom_timeline_weeks`. Mirrors useGoalProgress.fetchCycleWeeks.
 *
 * Deliberate design decisions:
 *   - Standard child completions filter `deleted_at IS NULL`. Departure from
 *     3b-4c-i (which intentionally counted deleted-completed). 3b-4c-iv smoke
 *     values were derived from live data; production has no tidy-up pattern
 *     that warrants the prior allowance.
 *   - Session contribution counts step_log rows directly, NOT the
 *     0008-ap-gl-session-log roll-up. The roll-up table has stale auto-
 *     generated rows (`completion_source='auto'`) and lacks per-step
 *     fractional information. SessionRow.tsx still reads the roll-up —
 *     pending alignment in backlog #21.
 *   - `goal_type` accepts both DB-join form ('twelve_wk_goal' | 'custom_goal')
 *     and useGoals UI form ('12week' | 'custom'). Normalized internally.
 */

export interface GoalInputForEffort {
  id: string;
  goal_type: 'twelve_wk_goal' | 'custom_goal' | '12week' | 'custom';
  user_global_timeline_id?: string | null;
  custom_timeline_id?: string | null;
}

export interface WeeklyEffort {
  weekNumber: number;
  weekStart: string;        // YYYY-MM-DD
  weekEnd: string;          // YYYY-MM-DD
  planCount: number;        // SUM of target_days across the goal's actions for this week
  completedCount: number;   // SUM of per-action capped contributions (may be float)
  effortScore: number;      // 0-100, integer
}

export interface GoalEffortProgress {
  currentWeek: number;       // 1-based; clamps to 1 pre-cycle, to totalWeeks post-cycle
  totalWeeks: number;
  cycleStart: string;        // YYYY-MM-DD (== week 1 start)
  cycleEnd: string;          // YYYY-MM-DD (== last week end)
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

  if (!timelineId) return EMPTY_RESULT;

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
  let currentWeek = weekRows[weekRows.length - 1].week_number;
  const currentWeekRow = weekRows.find(
    w => w.week_start <= todayStr && todayStr <= w.week_end,
  );
  if (currentWeekRow) {
    currentWeek = currentWeekRow.week_number;
  } else if (todayStr < weekRows[0].week_start) {
    currentWeek = 1;
  }

  const totalWeeks = weekRows.length;
  const cycleStart = weekRows[0].week_start;
  const cycleEnd = weekRows[weekRows.length - 1].week_end;

  // 3. Resolve goal-linked parent task IDs via universal-goals-join,
  //    then filter to actual leading-indicator parents (parent_task_id IS
  //    NULL, deleted_at IS NULL). Excludes child occurrences accidentally
  //    linked to the goal.
  const { data: joinRows, error: joinError } = await supabase
    .from('0008-ap-universal-goals-join')
    .select('parent_id')
    .eq('goal_id', goal.id)
    .eq('goal_type', goalTypeForJoin)
    .eq('parent_type', 'task');
  if (joinError) throw joinError;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const candidateIds = (joinRows ?? [])
    .map(r => r.parent_id as string)
    .filter(Boolean);
  if (candidateIds.length === 0) {
    return buildEmptyBreakdown(weekRows, currentWeek, totalWeeks, cycleStart, cycleEnd);
  }

  const { data: parentTasks, error: parentErr } = await supabase
    .from('0008-ap-tasks')
    .select('id')
    .in('id', candidateIds)
    .is('parent_task_id', null)
    .is('deleted_at', null);
  if (parentErr) throw parentErr;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const parentIds = (parentTasks ?? []).map(p => p.id as string);
  if (parentIds.length === 0) {
    return buildEmptyBreakdown(weekRows, currentWeek, totalWeeks, cycleStart, cycleEnd);
  }

  // 4. Identify which parents are session tasks (have a row in
  //    0008-ap-gl-sessions). Standard parents are everything else.
  const { data: sessionRows, error: sessErr } = await supabase
    .from('0008-ap-gl-sessions')
    .select('id, task_id')
    .in('task_id', parentIds);
  if (sessErr) throw sessErr;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const sessionByParentId = new Map<string, string>(); // parent_id -> session_id
  for (const s of sessionRows ?? []) {
    if (s.task_id && s.id) {
      sessionByParentId.set(s.task_id as string, s.id as string);
    }
  }
  const sessionIds = Array.from(sessionByParentId.values());

  // 5. Parallel: week-plans, completed children, session steps
  const [weekPlansRes, completedChildrenRes, sessionStepsRes] = await Promise.all([
    supabase
      .from('0008-ap-task-week-plan')
      .select('task_id, week_number, target_days')
      .in('task_id', parentIds)
      .lte('week_number', currentWeek)
      .is('deleted_at', null),
    supabase
      .from('0008-ap-tasks')
      .select('parent_task_id, due_date')
      .in('parent_task_id', parentIds)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .gte('due_date', cycleStart)
      .lte('due_date', cycleEnd),
    sessionIds.length > 0
      ? supabase
          .from('0008-ap-gl-session-steps')
          .select('id, milestone_id, target_sets')
          .in('milestone_id', sessionIds)
      : { data: [] as any[], error: null },
  ]);

  if (weekPlansRes.error) throw weekPlansRes.error;
  if (completedChildrenRes.error) throw completedChildrenRes.error;
  if (sessionStepsRes.error) throw sessionStepsRes.error;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const weekPlans = (weekPlansRes.data ?? []) as Array<{
    task_id: string; week_number: number; target_days: number;
  }>;
  const completedChildren = (completedChildrenRes.data ?? []) as Array<{
    parent_task_id: string; due_date: string;
  }>;
  const sessionSteps = (sessionStepsRes.data ?? []) as Array<{
    id: string; milestone_id: string; target_sets: number | null;
  }>;

  // 6. Step logs (depends on session_steps having returned step IDs)
  const stepIds = sessionSteps.map(s => s.id);
  const stepLogsRes = stepIds.length > 0
    ? await supabase
        .from('0008-ap-gl-step-log')
        .select('exercise_id, log_date, set_number')
        .in('exercise_id', stepIds)
        .gte('log_date', cycleStart)
        .lte('log_date', cycleEnd)
    : { data: [] as any[], error: null };
  if (stepLogsRes.error) throw stepLogsRes.error;
  if (abortSignal?.aborted) return EMPTY_RESULT;

  const stepLogs = (stepLogsRes.data ?? []) as Array<{
    exercise_id: string; log_date: string; set_number: number | null;
  }>;

  // 7. Build indices for aggregation
  // 7a. target_days by (parent_id, week_number)
  const targetMap = new Map<string, number>();
  for (const wp of weekPlans) {
    targetMap.set(`${wp.task_id}|${wp.week_number}`, wp.target_days || 0);
  }

  // 7b. STANDARD parent contributions: count completed children per
  // (parent_id, week_number), bucketed by due_date.
  const standardCount = new Map<string, number>();
  for (const c of completedChildren) {
    if (!c.parent_task_id || !c.due_date) continue;
    if (sessionByParentId.has(c.parent_task_id)) continue;  // skip session parents
    const wk = weekRows.find(w =>
      c.due_date >= w.week_start && c.due_date <= w.week_end,
    );
    if (!wk || wk.week_number > currentWeek) continue;
    const key = `${c.parent_task_id}|${wk.week_number}`;
    standardCount.set(key, (standardCount.get(key) ?? 0) + 1);
  }

  // 7c. SESSION parent contributions: compute day_fraction per (session,
  // log_date), then sum per (parent_id, week_number).

  // (i) Group steps by session, capture target_sets per step.
  const stepsBySession = new Map<string, Array<{ id: string; target_sets: number | null }>>();
  for (const s of sessionSteps) {
    if (!s.milestone_id) continue;
    if (!stepsBySession.has(s.milestone_id)) stepsBySession.set(s.milestone_id, []);
    stepsBySession.get(s.milestone_id)!.push({ id: s.id, target_sets: s.target_sets });
  }

  // (ii) Index step_logs: distinct non-null set_numbers per (step, day),
  // and "had any log at all" flag per (step, day) for binary steps.
  const distinctSetsByStepDay = new Map<string, Set<number>>();
  const stepDayHasLog = new Set<string>();
  for (const l of stepLogs) {
    if (!l.exercise_id || !l.log_date) continue;
    const key = `${l.exercise_id}|${l.log_date}`;
    stepDayHasLog.add(key);
    if (l.set_number !== null && l.set_number !== undefined) {
      if (!distinctSetsByStepDay.has(key)) distinctSetsByStepDay.set(key, new Set());
      distinctSetsByStepDay.get(key)!.add(l.set_number);
    }
  }

  // (iii) Days each session had any logs on (cross-step union).
  const daysBySession = new Map<string, Set<string>>();
  for (const [sessionId, steps] of stepsBySession) {
    const stepIdSet = new Set(steps.map(s => s.id));
    const days = new Set<string>();
    for (const key of stepDayHasLog) {
      const [stepId, logDate] = key.split('|');
      if (stepIdSet.has(stepId)) days.add(logDate);
    }
    daysBySession.set(sessionId, days);
  }

  // (iv) Compute day_fraction per (session, log_date).
  const sessionDayFrac = new Map<string, number>();  // `${session_id}|${log_date}` -> fraction
  for (const [sessionId, steps] of stepsBySession) {
    const logDays = daysBySession.get(sessionId) ?? new Set<string>();
    if (steps.length === 0) continue;
    for (const logDate of logDays) {
      let sumStepFrac = 0;
      for (const step of steps) {
        const stepDayKey = `${step.id}|${logDate}`;
        if (!stepDayHasLog.has(stepDayKey)) continue;  // step contributes 0
        if (step.target_sets !== null && step.target_sets > 0) {
          const distinctSets = distinctSetsByStepDay.get(stepDayKey)?.size ?? 0;
          if (distinctSets > 0) {
            sumStepFrac += Math.min(distinctSets, step.target_sets) / step.target_sets;
          }
        } else {
          sumStepFrac += 1;  // binary
        }
      }
      sessionDayFrac.set(`${sessionId}|${logDate}`, sumStepFrac / steps.length);
    }
  }

  // (v) Per (session-parent, week), sum day_fractions for days in the week.
  const sessionWeekContrib = new Map<string, number>();
  for (const [parentId, sessionId] of sessionByParentId) {
    for (const w of weekRows) {
      if (w.week_number > currentWeek) break;
      let weekSum = 0;
      for (const [key, frac] of sessionDayFrac) {
        const [sId, logDate] = key.split('|');
        if (sId !== sessionId) continue;
        if (logDate >= w.week_start && logDate <= w.week_end) {
          weekSum += frac;
        }
      }
      if (weekSum > 0) sessionWeekContrib.set(`${parentId}|${w.week_number}`, weekSum);
    }
  }

  // 8. Build weeklyBreakdown — per-action capped contributions summed,
  //    target_days summed, then per-week ratio.
  const weeklyBreakdown: WeeklyEffort[] = [];
  for (const w of weekRows) {
    if (w.week_number > currentWeek) break;

    let weekPlan = 0;
    let weekCapped = 0;

    for (const parentId of parentIds) {
      const target = targetMap.get(`${parentId}|${w.week_number}`) ?? 0;

      let raw: number;
      if (sessionByParentId.has(parentId)) {
        raw = sessionWeekContrib.get(`${parentId}|${w.week_number}`) ?? 0;
      } else {
        raw = standardCount.get(`${parentId}|${w.week_number}`) ?? 0;
      }

      weekPlan += target;
      weekCapped += Math.min(raw, target);
    }

    const effortScore = weekPlan > 0
      ? Math.round((weekCapped / weekPlan) * 100)
      : 0;

    weeklyBreakdown.push({
      weekNumber: w.week_number,
      weekStart: w.week_start,
      weekEnd: w.week_end,
      planCount: weekPlan,
      completedCount: weekCapped,
      effortScore,
    });
  }

  // 9. Cumulative: sum-num/sum-denom × 100. NOT average of weekly scores.
  const sumPlan = weeklyBreakdown.reduce((s, w) => s + w.planCount, 0);
  const sumCapped = weeklyBreakdown.reduce((s, w) => s + w.completedCount, 0);
  const cumulativeEffortScore = sumPlan > 0
    ? Math.round((sumCapped / sumPlan) * 100)
    : 0;

  const currentWeekEffortScore =
    weeklyBreakdown[weeklyBreakdown.length - 1]?.effortScore ?? 0;

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

// Build a result with weekly entries for past/current weeks but all
// scores zero — used when the goal has no linked parent tasks.
function buildEmptyBreakdown(
  weekRows: Array<{ week_number: number; week_start: string; week_end: string }>,
  currentWeek: number,
  totalWeeks: number,
  cycleStart: string,
  cycleEnd: string,
): GoalEffortProgress {
  const weeklyBreakdown: WeeklyEffort[] = weekRows
    .filter(w => w.week_number <= currentWeek)
    .map(w => ({
      weekNumber: w.week_number,
      weekStart: w.week_start,
      weekEnd: w.week_end,
      planCount: 0,
      completedCount: 0,
      effortScore: 0,
    }));
  return {
    currentWeek,
    totalWeeks,
    cycleStart,
    cycleEnd,
    currentWeekEffortScore: 0,
    cumulativeEffortScore: 0,
    weeklyBreakdown,
  };
}
