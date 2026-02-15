import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

export interface RecurringActionResult {
  id: string;
  title: string;
  description?: string;
  recurrence_rule: string;
  input_kind: string;
  weeklyTarget: number;
  weeklyActual: number;
  completedDates: string[];
  logs: Array<{
    id: string;
    measured_on: string;
    completed: boolean;
    due_date: string;
  }>;
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  // Full task data
  [key: string]: any;
}

export interface OneTimeActionResult {
  id: string;
  title: string;
  description?: string;
  completedAt: string;
  pointsEarned: number;
  status: string;
  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
  keyRelationships?: Array<{ id: string; name: string }>;
  // Full task data
  [key: string]: any;
}

export interface GoalActionsResult {
  recurringActions: RecurringActionResult[];
  oneTimeActions: OneTimeActionResult[];
}

/**
 * Calculate points for a completed task (boost)
 * Based on task effort and importance
 */
function calculateTaskPoints(task: any): number {
  // Base points
  let points = 10;

  // Effort multiplier (if available)
  if (task.effort_level) {
    const effortMultipliers: Record<string, number> = {
      'low': 1,
      'medium': 1.5,
      'high': 2,
      'very_high': 3,
    };
    points *= effortMultipliers[task.effort_level] || 1;
  }

  // Priority/importance multiplier (if available)
  if (task.priority) {
    const priorityMultipliers: Record<string, number> = {
      'low': 1,
      'medium': 1.25,
      'high': 1.5,
      'urgent': 2,
    };
    points *= priorityMultipliers[task.priority] || 1;
  }

  return Math.round(points);
}

/**
 * Get week start and end dates based on user's preferred week start day
 * For now, defaults to Monday (can be enhanced to fetch user preference)
 */
function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Calculate days to Monday (1 = Monday, 0 = Sunday)
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    weekStart: toLocalISOString(monday),
    weekEnd: toLocalISOString(sunday),
  };
}

/**
 * Fetch recurring actions (leading indicators) and one-time actions (boosts) for a specific goal.
 *
 * Uses the v_goal_detail_actions DB view for a single-query fetch with pre-aggregated
 * associations (roles, domains, key relationships). Falls back to multi-query approach
 * only for 1y goals (which aggregate from child goals).
 *
 * For recurring tasks, a second query fetches completed occurrences in the current week
 * to compute weeklyActual and completedDates.
 */
export async function fetchGoalActions(
  goalId: string,
  goalType: '1y' | '12week' | 'custom',
  weekStart?: string,
  weekEnd?: string
): Promise<GoalActionsResult> {
  const supabase = getSupabaseClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[fetchGoalActions] No authenticated user');
      return { recurringActions: [], oneTimeActions: [] };
    }

    // Get week bounds
    const bounds = weekStart && weekEnd ? { weekStart, weekEnd } : getWeekBounds();
    const { weekStart: wStart, weekEnd: wEnd } = bounds;

    console.log('[fetchGoalActions] Fetching for:', { goalId, goalType, weekStart: wStart, weekEnd: wEnd });

    // Annual goals aggregate from child 12-week goals
    if (goalType === '1y') {
      const { data: childGoals, error: childError } = await supabase
        .from('0008-ap-goals-12wk')
        .select('id')
        .eq('parent_goal_id', goalId)
        .is('deleted_at', null);

      if (childError || !childGoals || childGoals.length === 0) {
        return { recurringActions: [], oneTimeActions: [] };
      }

      // Fetch all child goals in parallel
      const childResults = await Promise.all(
        childGoals.map(cg => fetchGoalActions(cg.id, '12week', weekStart, weekEnd))
      );

      return {
        recurringActions: childResults.flatMap(r => r.recurringActions),
        oneTimeActions: childResults.flatMap(r => r.oneTimeActions),
      };
    }

    // ---- Single query using DB view (replaces 4+ separate queries) ----
    const { data: viewData, error: viewError } = await supabase
      .from('v_goal_detail_actions')
      .select('*')
      .eq('goal_id', goalId)
      .eq('user_id', user.id);

    if (viewError) {
      console.error('[fetchGoalActions] Error fetching from view:', viewError);
      throw viewError;
    }

    const allRows = viewData ?? [];
    console.log('[fetchGoalActions] View returned:', allRows.length, 'rows');

    if (allRows.length === 0) {
      return { recurringActions: [], oneTimeActions: [] };
    }

    // Split into recurring vs one-time
    const recurringRows = allRows.filter(r => r.recurrence_rule != null);
    const oneTimeRows = allRows.filter(r => r.recurrence_rule == null && r.status !== 'cancelled');

    // For recurring tasks, fetch completed occurrences in the current week (single bulk query)
    let allOccurrences: any[] = [];
    const recurringIds = recurringRows.map(r => r.task_id);

    if (recurringIds.length > 0) {
      const { data: occData, error: occError } = await supabase
        .from('0008-ap-tasks')
        .select('id, parent_task_id, due_date, completed_at, status')
        .in('parent_task_id', recurringIds)
        .eq('status', 'completed')
        .gte('due_date', wStart)
        .lte('due_date', wEnd)
        .is('deleted_at', null)
        .order('due_date');

      if (!occError) {
        allOccurrences = occData ?? [];
      }
    }

    // Assemble recurring actions
    const recurringActions: RecurringActionResult[] = recurringRows.map(row => {
      const taskOccurrences = allOccurrences.filter(occ => occ.parent_task_id === row.task_id);
      const completedDates = taskOccurrences.map(occ => occ.due_date);
      const weeklyActual = taskOccurrences.length;

      let weeklyTarget = 0;
      if (row.recurrence_rule) {
        const rule = row.recurrence_rule.toUpperCase();
        if (rule.includes('FREQ=DAILY')) {
          weeklyTarget = 7;
        } else if (rule.includes('FREQ=WEEKLY')) {
          weeklyTarget = 1;
        } else if (rule.includes('BYDAY')) {
          const byDayMatch = rule.match(/BYDAY=([^;]+)/);
          if (byDayMatch) {
            weeklyTarget = byDayMatch[1].split(',').length;
          }
        }
      }

      // Associations come pre-aggregated from the view as JSON arrays
      const roles = Array.isArray(row.roles) ? row.roles : [];
      const domains = Array.isArray(row.domains) ? row.domains : [];
      const keyRelationships = Array.isArray(row.key_relationships) ? row.key_relationships : [];

      const logs = taskOccurrences.map(occ => ({
        id: occ.id,
        measured_on: occ.due_date,
        completed: true,
        due_date: occ.due_date,
      }));

      return {
        id: row.task_id,
        title: row.title,
        description: row.description,
        recurrence_rule: row.recurrence_rule,
        input_kind: row.input_kind,
        status: row.status,
        type: row.type,
        due_date: row.due_date,
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        is_urgent: row.is_urgent,
        is_important: row.is_important,
        is_all_day: row.is_all_day,
        is_anytime: row.is_anytime,
        sort_order: row.sort_order,
        tags: row.tags,
        unit: row.unit,
        one_thing: row.one_thing,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        location: row.location,
        times_rescheduled: row.times_rescheduled,
        weeklyTarget,
        weeklyActual,
        completedDates,
        logs,
        roles,
        domains,
        keyRelationships,
      };
    });

    // Assemble one-time actions (no occurrences needed)
    const oneTimeActions: OneTimeActionResult[] = oneTimeRows.map(row => {
      const pointsEarned = calculateTaskPoints(row);
      const roles = Array.isArray(row.roles) ? row.roles : [];
      const domains = Array.isArray(row.domains) ? row.domains : [];
      const keyRelationships = Array.isArray(row.key_relationships) ? row.key_relationships : [];

      return {
        id: row.task_id,
        title: row.title,
        description: row.description,
        status: row.status,
        type: row.type,
        due_date: row.due_date,
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        is_urgent: row.is_urgent,
        is_important: row.is_important,
        is_all_day: row.is_all_day,
        is_anytime: row.is_anytime,
        sort_order: row.sort_order,
        tags: row.tags,
        unit: row.unit,
        one_thing: row.one_thing,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        completedAt: row.completed_at,
        pointsEarned,
        location: row.location,
        times_rescheduled: row.times_rescheduled,
        roles,
        domains,
        keyRelationships,
      };
    });

    console.log('[fetchGoalActions] Final result:', {
      recurringActionsCount: recurringActions.length,
      oneTimeActionsCount: oneTimeActions.length,
    });

    return { recurringActions, oneTimeActions };

  } catch (error) {
    console.error('[fetchGoalActions] Unexpected error:', error);
    return { recurringActions: [], oneTimeActions: [] };
  }
}

/**
 * Fetch goal actions for multiple goals
 */
export async function fetchMultipleGoalActions(
  goals: Array<{ id: string; goal_type: '1y' | '12week' | 'custom' }>,
  weekStart?: string,
  weekEnd?: string
): Promise<Record<string, GoalActionsResult>> {
  const results: Record<string, GoalActionsResult> = {};

  for (const goal of goals) {
    results[goal.id] = await fetchGoalActions(goal.id, goal.goal_type, weekStart, weekEnd);
  }

  return results;
}
