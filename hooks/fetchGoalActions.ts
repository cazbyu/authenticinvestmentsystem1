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
 * Fetch recurring actions (leading indicators) and one-time actions (boosts) for a specific goal
 *
 * @param goalId - The ID of the goal
 * @param goalType - The type of goal ('1y', '12week', or 'custom')
 * @param weekStart - Optional week start date (defaults to current week Monday)
 * @param weekEnd - Optional week end date (defaults to current week Sunday)
 * @returns Object containing recurring and one-time actions
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

    console.log('[fetchGoalActions] Fetching for:', {
      goalId,
      goalType,
      weekStart: wStart,
      weekEnd: wEnd,
    });

    // Determine the correct column name for the goal join
    const goalJoinColumn =
      goalType === '1y' ? 'one_yr_goal_id' :
      goalType === '12week' ? 'twelve_wk_goal_id' :
      'custom_goal_id';

    // ============================================
    // STEP 1: Fetch Recurring Actions (Leading Indicators)
    // ============================================

    // 1a. Get task IDs linked to this goal
    const { data: recurringJoins, error: recurringJoinsError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id')
      .eq(goalJoinColumn, goalId)
      .eq('parent_type', 'task');

    if (recurringJoinsError) {
      console.error('[fetchGoalActions] Error fetching recurring joins:', recurringJoinsError);
      throw recurringJoinsError;
    }

    const recurringTaskIds = recurringJoins?.map(j => j.parent_id).filter(Boolean) || [];

    console.log('[fetchGoalActions] Found task IDs:', recurringTaskIds.length);

    let recurringActions: RecurringActionResult[] = [];

    if (recurringTaskIds.length > 0) {
      // 1b. Fetch parent recurring tasks (only those with recurrence_rule)
      const { data: recurringTasks, error: recurringTasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('id', recurringTaskIds)
        .eq('user_id', user.id)
        .not('recurrence_rule', 'is', null)
        .is('deleted_at', null)
        .is('parent_task_id', null) // Only parent tasks, not occurrences
        .order('title');

      if (recurringTasksError) {
        console.error('[fetchGoalActions] Error fetching recurring tasks:', recurringTasksError);
        throw recurringTasksError;
      }

      console.log('[fetchGoalActions] Recurring tasks found:', recurringTasks?.length || 0);

      if (recurringTasks && recurringTasks.length > 0) {
        // 1c. For each recurring task, fetch completed occurrences in the week
        for (const task of recurringTasks) {
          const { data: completedOccurrences, error: occurrencesError } = await supabase
            .from('0008-ap-tasks')
            .select('id, due_date, completed_at, status')
            .eq('parent_task_id', task.id)
            .eq('status', 'completed')
            .gte('due_date', wStart)
            .lte('due_date', wEnd)
            .is('deleted_at', null)
            .order('due_date');

          if (occurrencesError) {
            console.error('[fetchGoalActions] Error fetching occurrences for task:', task.id, occurrencesError);
            continue;
          }

          const completedDates = completedOccurrences?.map(occ => occ.due_date) || [];
          const weeklyActual = completedOccurrences?.length || 0;

          // Get weekly target from task metadata or default to recurrence frequency
          // This could be enhanced by fetching from 0008-ap-task-week-plan if available
          let weeklyTarget = 0;
          if (task.recurrence_rule) {
            // Simple heuristic: if DAILY, target is 7, if WEEKLY, target is 1
            const rule = task.recurrence_rule.toUpperCase();
            if (rule.includes('FREQ=DAILY')) {
              weeklyTarget = 7;
            } else if (rule.includes('FREQ=WEEKLY')) {
              weeklyTarget = 1;
            } else if (rule.includes('BYDAY')) {
              // Count the days in BYDAY
              const byDayMatch = rule.match(/BYDAY=([^;]+)/);
              if (byDayMatch) {
                const days = byDayMatch[1].split(',');
                weeklyTarget = days.length;
              }
            }
          }

          // Fetch associations (roles, domains, key relationships)
          const [rolesData, domainsData, krData] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('role:0008-ap-roles(id, label, color)')
              .eq('parent_id', task.id)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('domain:0008-ap-domains(id, name)')
              .eq('parent_id', task.id)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('key_relationship:0008-ap-key-relationships(id, name)')
              .eq('parent_id', task.id)
              .eq('parent_type', 'task'),
          ]);

          const roles = rolesData.data?.map((r: any) => r.role).filter(Boolean) || [];
          const domains = domainsData.data?.map((d: any) => d.domain).filter(Boolean) || [];
          const keyRelationships = krData.data?.map((kr: any) => kr.key_relationship).filter(Boolean) || [];

          const logs = completedOccurrences?.map(occ => ({
            id: occ.id,
            measured_on: occ.due_date,
            completed: true,
            due_date: occ.due_date,
          })) || [];

          recurringActions.push({
            ...task,
            weeklyTarget,
            weeklyActual,
            completedDates,
            logs,
            roles,
            domains,
            keyRelationships,
          });
        }
      }
    }

    // ============================================
    // STEP 2: Fetch One-Time Actions (Boosts)
    // ============================================

    // 2a. Get task IDs for one-time actions
    const { data: oneTimeJoins, error: oneTimeJoinsError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id')
      .eq(goalJoinColumn, goalId)
      .eq('parent_type', 'task');

    if (oneTimeJoinsError) {
      console.error('[fetchGoalActions] Error fetching one-time joins:', oneTimeJoinsError);
      throw oneTimeJoinsError;
    }

    const oneTimeTaskIds = oneTimeJoins?.map(j => j.parent_id).filter(Boolean) || [];

    let oneTimeActions: OneTimeActionResult[] = [];

    if (oneTimeTaskIds.length > 0) {
      // 2b. Fetch one-time tasks (no recurrence_rule, both pending and completed)
      const { data: oneTimeTasks, error: oneTimeTasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('id', oneTimeTaskIds)
        .eq('user_id', user.id)
        .is('recurrence_rule', null)
        .neq('status', 'cancelled')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (oneTimeTasksError) {
        console.error('[fetchGoalActions] Error fetching one-time tasks:', oneTimeTasksError);
        throw oneTimeTasksError;
      }

      console.log('[fetchGoalActions] One-time tasks found:', oneTimeTasks?.length || 0);

      if (oneTimeTasks && oneTimeTasks.length > 0) {
        for (const task of oneTimeTasks) {
          // Calculate points for this boost
          const pointsEarned = calculateTaskPoints(task);

          // Fetch associations
          const [rolesData, domainsData, krData] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('role:0008-ap-roles(id, label, color)')
              .eq('parent_id', task.id)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('domain:0008-ap-domains(id, name)')
              .eq('parent_id', task.id)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-key-relationships-join')
              .select('key_relationship:0008-ap-key-relationships(id, name)')
              .eq('parent_id', task.id)
              .eq('parent_type', 'task'),
          ]);

          const roles = rolesData.data?.map((r: any) => r.role).filter(Boolean) || [];
          const domains = domainsData.data?.map((d: any) => d.domain).filter(Boolean) || [];
          const keyRelationships = krData.data?.map((kr: any) => kr.key_relationship).filter(Boolean) || [];

          oneTimeActions.push({
            ...task,
            completedAt: task.completed_at,
            pointsEarned,
            roles,
            domains,
            keyRelationships,
          });
        }
      }
    }

    console.log('[fetchGoalActions] Final result:', {
      recurringActionsCount: recurringActions.length,
      oneTimeActionsCount: oneTimeActions.length,
    });

    return {
      recurringActions,
      oneTimeActions,
    };

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
