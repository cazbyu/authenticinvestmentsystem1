// hooks/fetchGoalActionsForWeek.ts
import { getSupabaseClient } from '@/lib/supabase';

/** Minimal shapes so this helper stands alone. */
export type TimelineWeekInput = {
  week_number?: number;
  weekNumber?: number;
  week_start?: string;
  start_date?: string;
  startDate?: string;
  week_end?: string;
  end_date?: string;
  endDate?: string;
  [k: string]: any;
};

export type TaskLog = {
  id: string;
  task_id: string;
  measured_on: string;
  week_number: number;
  day_of_week?: number;
  value: number;
  created_at: string;
  completed?: boolean;
};

export type TaskWithLogs = {
  id: string;
  title: string;
  recurrence_rule?: string;
  tracking_template?: string | null;
  data_schema?: any;
  logs: TaskLog[];
  weeklyActual: number;
  weeklyTarget: number;
  goal_type?: '12week' | 'custom';
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  selectedWeeks?: number[]; // Array of week numbers this action is scheduled for
  [k: string]: any; // carry through task fields from DB
};

/**
 * Fetch action tasks + occurrences for given goals within a specific week.
 *
 * Uses the v_goal_detail_week_actions DB view for a single-query fetch.
 * The view pre-computes weekly_actual, completed_dates, occurrences,
 * selected_weeks, and associations (roles, domains, key relationships)
 * all server-side, replacing 7+ sequential client queries.
 */
export async function fetchGoalActionsForWeek(
  goalIds: string[],
  weekNumber: number,
  timeline: { id: string; source: 'global' | 'custom' },
  cycleWeeks: TimelineWeekInput[]
): Promise<Record<string, TaskWithLogs[]>> {
  try {
    console.log('[fetchGoalActionsForWeek] called with:', {
      goalIdsCount: goalIds?.length ?? 0,
      goalIds,
      weekNumber,
      timelineId: timeline.id,
      timelineSource: timeline.source,
      cycleWeeksCount: cycleWeeks?.length ?? 0,
    });

    const supabase = getSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) {
      console.log('[fetchGoalActionsForWeek] no authenticated user — returning {}');
      return {};
    }
    if (!goalIds || goalIds.length === 0) {
      console.log('[fetchGoalActionsForWeek] empty goalIds — returning {}');
      return {};
    }

    // ---- Single query using DB view (replaces 7+ sequential queries) ----
    // The view joins tasks → goal joins → week plans → timeline weeks
    // and pre-computes weekly_actual, occurrences, selected_weeks, and associations
    const timelineCol = timeline.source === 'global'
      ? 'user_global_timeline_id'
      : 'user_custom_timeline_id';

    let query = supabase
      .from('v_goal_detail_week_actions')
      .select('*')
      .in('goal_id', goalIds)
      .eq('week_number', weekNumber)
      .eq('user_id', user.id)
      .eq(timelineCol, timeline.id);

    const { data: viewData, error: viewError } = await query;

    if (viewError) {
      console.error('[fetchGoalActionsForWeek] error fetching from view:', viewError);
      return {};
    }

    const rows = viewData ?? [];
    console.log('[fetchGoalActionsForWeek] view returned:', rows.length, 'rows');

    if (rows.length === 0) {
      return {};
    }

    // ---- Group results by goal ----
    const grouped: Record<string, TaskWithLogs[]> = {};

    for (const row of rows) {
      const goalId = row.goal_id;
      if (!goalId) continue;

      // Parse pre-aggregated JSON arrays from the view
      const occurrences: any[] = Array.isArray(row.occurrences) ? row.occurrences : [];
      const selectedWeeks: number[] = Array.isArray(row.selected_weeks) ? row.selected_weeks : [];
      const roles = Array.isArray(row.roles) ? row.roles : [];
      const domains = Array.isArray(row.domains) ? row.domains : [];
      const keyRelationships = Array.isArray(row.key_relationships) ? row.key_relationships : [];

      const weeklyTarget = row.target_days ?? 0;
      const weeklyActual = Math.min(row.weekly_actual ?? 0, weeklyTarget);

      const taskLogs: TaskLog[] = occurrences.map((occ: any) => ({
        id: occ.id,
        task_id: row.task_id,
        measured_on: occ.due_date,
        week_number: weekNumber,
        day_of_week: new Date(occ.due_date).getDay(),
        value: 1,
        completed: true,
        created_at: occ.completed_at || row.created_at,
      }));

      const taskWithLogs: TaskWithLogs = {
        id: row.task_id,
        title: row.title,
        description: row.description,
        status: row.status,
        type: row.type,
        recurrence_rule: row.recurrence_rule,
        input_kind: row.input_kind,
        unit: row.unit,
        is_urgent: row.is_urgent,
        is_important: row.is_important,
        due_date: row.due_date,
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        is_all_day: row.is_all_day,
        is_anytime: row.is_anytime,
        sort_order: row.sort_order,
        tags: row.tags,
        one_thing: row.one_thing,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        location: row.location,
        times_rescheduled: row.times_rescheduled,
        goal_type: row.goal_join_type === 'twelve_wk_goal' ? '12week' : 'custom',
        logs: taskLogs,
        weeklyActual,
        weeklyTarget,
        roles: roles as Array<{ id: string; label: string; color?: string }>,
        domains: domains as Array<{ id: string; name: string }>,
        keyRelationships: keyRelationships as Array<{ id: string; name: string }>,
        selectedWeeks: selectedWeeks.sort((a, b) => a - b),
      };

      if (!grouped[goalId]) grouped[goalId] = [];
      grouped[goalId].push(taskWithLogs);
    }

    console.log('[fetchGoalActionsForWeek] final grouped result:', {
      goalBuckets: Object.keys(grouped).length,
      countsPerGoal: Object.fromEntries(
        Object.entries(grouped).map(([g, arr]) => [g, arr.length])
      ),
    });

    return grouped;
  } catch (err) {
    console.error('[fetchGoalActionsForWeek] unexpected error:', err);
    return {};
  }
}
