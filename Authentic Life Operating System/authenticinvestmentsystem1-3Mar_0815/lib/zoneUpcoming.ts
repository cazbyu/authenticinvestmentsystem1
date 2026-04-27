import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Zone upcoming service — forward-looking tasks + events for the
 * Physical-zone-landing's MY SPACE > Upcoming tile.
 *
 * Definitions (locked):
 *   - Future tasks: 0008-ap-tasks rows where status is NOT
 *     'completed' or 'cancelled', deleted_at IS NULL,
 *     parent_task_id IS NULL (top-level only — per locked spec,
 *     Upcoming excludes recurring goal-related child occurrences,
 *     e.g., daily children of a recurring parent goal task),
 *     due_date >= local-midnight today.
 *   - Future events: 0008-ap-commitments rows where date >= local-midnight
 *     today. No status filter (per locked spec).
 *
 * Both sources scoped to the given domain via 0008-ap-universal-domains-join
 * (parent_type='task' for tasks; parent_type='commitment' for commitments).
 *
 * `today` is local-midnight today (user's timezone) formatted as YYYY-MM-DD
 * via formatLocalDate. Compared lexicographically against the DATE columns
 * due_date / date — equivalent to a date-only comparison.
 *
 * abortSignal is advisory (Supabase HTTP is not cancellable); caller still
 * owns its outer state-gate on abort.
 *
 * Pattern mirrors lib/zoneActivity.ts:fetchTaskRows — two-step lookup
 * (universal-domains-join filtered to parent_type, then source table filtered
 * by id IN list).
 */

export interface ZoneUpcomingTask {
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
  // Forward compatibility — TaskCard reads many columns; allow extras
  [key: string]: unknown;
}

export interface ZoneUpcomingEvent {
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
  // Forward compatibility — commitment renderers may read more columns
  [key: string]: unknown;
}

export interface ZoneUpcomingResult {
  tasks: ZoneUpcomingTask[];
  events: ZoneUpcomingEvent[];
  count: number;  // tasks.length + events.length
}

const EMPTY: ZoneUpcomingResult = { tasks: [], events: [], count: 0 };

export async function fetchZoneUpcoming(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ZoneUpcomingResult> {
  const today = formatLocalDate(new Date());

  // 1. Resolve domain-scoped IDs for both source types in parallel.
  const [taskJoinRes, commitmentJoinRes] = await Promise.all([
    supabase
      .from('0008-ap-universal-domains-join')
      .select('parent_id')
      .eq('parent_type', 'task')
      .eq('domain_id', domainId),
    supabase
      .from('0008-ap-universal-domains-join')
      .select('parent_id')
      .eq('parent_type', 'commitment')
      .eq('domain_id', domainId),
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

  // 2. Fetch upcoming source rows in parallel. Skip the source query
  //    entirely if there are no scoped IDs.
  const [tasksRes, eventsRes] = await Promise.all([
    taskIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', userId)
          // Excludes both completed and cancelled tasks. Status filter
          // is strict — only active (non-completed, non-cancelled) tasks
          // with a future due_date appear in Upcoming.
          .not('status', 'in', '("completed","cancelled")')
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .gte('due_date', today)
          .in('id', taskIds)
          .order('due_date', { ascending: true }),
    commitmentIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-commitments')
          .select('*')
          .eq('user_id', userId)
          .gte('date', today)
          .in('id', commitmentIds)
          .order('date', { ascending: true }),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (signal?.aborted) return EMPTY;

  const tasks = (tasksRes.data ?? []) as ZoneUpcomingTask[];
  const events = (eventsRes.data ?? []) as ZoneUpcomingEvent[];

  return {
    tasks,
    events,
    count: tasks.length + events.length,
  };
}
