import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Role upcoming service — R-1 sibling of lib/zoneUpcoming.ts (which sources
 * its docstring; see that file for full rationale on filter semantics).
 *
 * Definitions (locked, mirrors zoneUpcoming exactly with role-scope):
 *   - Tasks: type='task', deleted_at IS NULL, parent_task_id IS NULL,
 *     status IN ('pending','in_progress'), AND (due_date IS NULL OR
 *     due_date >= today).
 *   - Past-due pending/in_progress tasks → excluded; live in Overdue
 *     (lib/roleOverdue.ts).
 *   - Completed and cancelled → excluded (post-B31 semantics).
 *   - Goal-tied (any row in 0008-ap-universal-goals-join with parent_type='task')
 *     → excluded.
 *   - Events: 0008-ap-commitments where date >= today AND status != 'archived'.
 *
 * Both sources scoped via 0008-ap-universal-roles-join (parent_type='task' for
 * tasks; parent_type='commitment' for commitments).
 */

export interface RoleUpcomingTask {
  id: string;
  title: string | null;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  due_time: string | null;
  is_urgent: boolean | null;
  is_important: boolean | null;
  is_all_day: boolean | null;
  type: string | null;
  status: string | null;
  parent_task_id: string | null;
  user_id: string;
  description: string | null;
  location: string | null;
  [key: string]: unknown;
}

export interface RoleUpcomingEvent {
  id: string;
  title: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean | null;
  is_urgent: boolean | null;
  status: string | null;
  external_source: string | null;
  external_event_id: string | null;
  external_calendar_id: string | null;
  location: string | null;
  description: string | null;
  user_id: string;
  [key: string]: unknown;
}

export interface RoleUpcomingResult {
  tasks: RoleUpcomingTask[];
  events: RoleUpcomingEvent[];
  count: number;
}

const EMPTY: RoleUpcomingResult = { tasks: [], events: [], count: 0 };

export async function fetchRoleUpcoming(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<RoleUpcomingResult> {
  const today = formatLocalDate(new Date());

  // 1. Resolve role-scoped IDs for both source types in parallel.
  const [taskJoinRes, commitmentJoinRes] = await Promise.all([
    supabase
      .from('0008-ap-universal-roles-join')
      .select('parent_id')
      .eq('parent_type', 'task')
      .eq('role_id', roleId),
    supabase
      .from('0008-ap-universal-roles-join')
      .select('parent_id')
      .eq('parent_type', 'commitment')
      .eq('role_id', roleId),
  ]);

  if (taskJoinRes.error) throw taskJoinRes.error;
  if (commitmentJoinRes.error) throw commitmentJoinRes.error;
  if (signal?.aborted) return EMPTY;

  const taskIds = (taskJoinRes.data ?? [])
    .map(r => r.parent_id as string | null)
    .filter((v): v is string => Boolean(v));
  const commitmentIds = (commitmentJoinRes.data ?? [])
    .map(r => r.parent_id as string | null)
    .filter((v): v is string => Boolean(v));

  // 1b. Goal-tied exclusion (mirrors zoneUpcoming 1+6a-fix2 logic).
  let filteredTaskIds = taskIds;
  if (taskIds.length > 0) {
    const { data: goalJoinData, error: goalJoinErr } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('parent_id')
      .eq('parent_type', 'task')
      .in('parent_id', taskIds);
    if (goalJoinErr) throw goalJoinErr;
    if (signal?.aborted) return EMPTY;

    const goalTiedTaskIds = new Set(
      (goalJoinData ?? [])
        .map(r => r.parent_id as string | null)
        .filter((v): v is string => Boolean(v)),
    );
    filteredTaskIds = taskIds.filter(id => !goalTiedTaskIds.has(id));
  }

  // 2. Fetch source rows in parallel.
  const [tasksRes, eventsRes] = await Promise.all([
    filteredTaskIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'task')
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .in('status', ['pending', 'in_progress'])
          .or(`due_date.is.null,due_date.gte.${today}`)
          .in('id', filteredTaskIds)
          .order('due_date', { ascending: true }),
    commitmentIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-commitments')
          .select('*')
          .eq('user_id', userId)
          .neq('status', 'archived')
          .gte('date', today)
          .in('id', commitmentIds)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true }),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (signal?.aborted) return EMPTY;

  const tasks = (tasksRes.data ?? []) as RoleUpcomingTask[];
  const events = (eventsRes.data ?? []) as RoleUpcomingEvent[];

  return {
    tasks,
    events,
    count: tasks.length + events.length,
  };
}
