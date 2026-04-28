import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate, toLocalISOString } from './dateUtils';

/**
 * Zone upcoming service — actionable items + future events for the
 * Physical-zone-landing's MY SPACE > Upcoming tile.
 *
 * Definitions (locked):
 *   - Tasks (post 1+6a-fix): type='task', deleted_at IS NULL,
 *     parent_task_id IS NULL (top-level only), AND one of two clauses:
 *     (a) status pending/in_progress AND (due_date IS NULL OR
 *         due_date >= today) — today, future, or no-date active work
 *     (b) status completed AND completed_at >= today's local
 *         midnight — Act-tab-style "today's progress stays visible"
 *     Past-due pending/in_progress tasks are EXCLUDED — they live in
 *     Overdue (lib/zoneOverdue.ts) so the two panels stay strictly
 *     disjoint. Cancelled / completed-not-today / deleted also
 *     excluded.
 *
 *     Goal-tied tasks (post 1+6a-fix2): any task with a row in
 *     0008-ap-universal-goals-join (parent_type='task') is EXCLUDED,
 *     regardless of which goal it links to. Goal-driven work belongs
 *     to the Goals tile (relocates to Toolshed Surfaces in 1+6b),
 *     not to Upcoming/Overdue. Implemented as a third pre-fetch step
 *     that resolves the goal-tied subset of the zone's task pool;
 *     the final task query uses the filtered (non-goal-tied) ID list.
 *   - Events: 0008-ap-commitments rows where date >= local-midnight
 *     today AND status != 'archived' (mirror Act tab).
 *
 * Both sources scoped to the given domain via 0008-ap-universal-domains-join
 * (parent_type='task' for tasks; parent_type='commitment' for commitments).
 *
 * `today` is local-midnight today (user's timezone) formatted as YYYY-MM-DD
 * via formatLocalDate (used for the events lower bound). For the task
 * status carve-out, todayStartISO is the local-midnight ISO timestamp
 * via toLocalISOString — same composition Act tab uses
 * (ActionsTableView.tsx:457-459).
 *
 * abortSignal is advisory (Supabase HTTP is not cancellable); caller still
 * owns its outer state-gate on abort.
 *
 * Pattern: two-step lookup (universal-domains-join filtered to parent_type,
 * then source table filtered by id IN list). Status filter chain partially
 * mirrors Dashboard Act tab's filter='all' branch (ActionsTableView.tsx:472-535)
 * — same completed-today carve-out, but Upcoming additionally requires
 * future-or-no-date for active tasks (Act admits all due_date <= period.end
 * including past-due; we hand past-due to Overdue instead).
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

  // todayStartISO — local-midnight today as ISO timestamp. Used in the
  // task status .or() clause to keep tasks completed today visible.
  // Composition mirrors ActionsTableView.tsx:457-459 verbatim.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = toLocalISOString(todayStart);

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

  // 1b. Resolve the goal-tied subset of the zone's task pool, then
  //     derive the non-goal-tied list. Goal-driven work belongs to
  //     the Goals tile, not Upcoming. Skip the lookup entirely if
  //     no zone-scoped tasks exist.
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

  // 2. Fetch source rows in parallel. Skip the source query entirely if
  //    there are no scoped IDs.
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
          // Strict separation from Overdue (1+6a-fix):
          //   - Branch 1: pending/in_progress AND (due_date IS NULL
          //     OR due_date >= today) — today/future/no-date active work
          //   - Branch 2: completed AND completed_at >= today's local
          //     midnight — today's progress carve-out (Act-tab style)
          //   - Past-due pending/in_progress tasks fail Branch 1's
          //     due_date condition and are excluded; they live in
          //     Overdue (lib/zoneOverdue.ts).
          //   - Cancelled / completed-not-today drop out via Branch 2.
          .or(
            `and(or(due_date.is.null,due_date.gte.${today}),status.in.(pending,in_progress)),` +
            `and(status.eq.completed,completed_at.gte.${todayStartISO})`
          )
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

  const tasks = (tasksRes.data ?? []) as ZoneUpcomingTask[];
  const events = (eventsRes.data ?? []) as ZoneUpcomingEvent[];

  return {
    tasks,
    events,
    count: tasks.length + events.length,
  };
}
