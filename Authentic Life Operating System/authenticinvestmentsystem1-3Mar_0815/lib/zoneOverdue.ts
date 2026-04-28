import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Zone overdue service — past-due actionable tasks for the
 * Physical-zone-landing's MY SPACE > Overdue tile.
 *
 * Definitions (locked):
 *   - Tasks: 0008-ap-tasks rows where due_date < local-midnight
 *     today AND status IN ('pending', 'in_progress'). type='task',
 *     deleted_at IS NULL, parent_task_id IS NULL (top-level only —
 *     mirrors Upcoming's filter shape).
 *   - NO events. Commitments are date-based and a "past-due
 *     commitment" semantic doesn't exist on this surface — only
 *     tasks have an actionable overdue concept.
 *
 *   Goal-tied tasks (post 1+6a-fix2): any task with a row in
 *   0008-ap-universal-goals-join (parent_type='task') is EXCLUDED,
 *   regardless of which goal it links to. Goal-driven work belongs
 *   to the Goals tile (relocates to Toolshed Surfaces in 1+6b),
 *   not to Upcoming/Overdue. Implemented as a second pre-fetch step
 *   that resolves the goal-tied subset of the zone's task pool; the
 *   final task query uses the filtered (non-goal-tied) ID list.
 *
 * Strict less-than on due_date: today's due tasks belong in
 * Upcoming, not Overdue. The boundary at midnight is what flips a
 * task from upcoming to overdue.
 *
 * Sort: due_date DESC — most-recently-overdue at top so the user
 * sees the freshest miss first. Older overdue items sink down.
 *
 * Scoped to the given domain via 0008-ap-universal-domains-join
 * (parent_type='task', domain_id=domainId).
 *
 * `today` is local-midnight today (user's timezone) formatted as
 * YYYY-MM-DD via formatLocalDate. Compared lexicographically against
 * the DATE column due_date — equivalent to a date-only comparison.
 *
 * abortSignal is advisory (Supabase HTTP is not cancellable); caller
 * still owns its outer state-gate on abort.
 *
 * Pattern: two-step lookup (universal-domains-join filtered to
 * parent_type='task' + domain_id, then source table filtered by id
 * IN list with the source's own filters). Sibling helper to
 * lib/zoneUpcoming.ts:fetchZoneUpcoming — same shape, opposite
 * temporal direction.
 */

export interface ZoneOverdueTask {
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

export interface ZoneOverdueResult {
  tasks: ZoneOverdueTask[];
  count: number;
}

const EMPTY: ZoneOverdueResult = { tasks: [], count: 0 };

export async function fetchZoneOverdue(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ZoneOverdueResult> {
  const today = formatLocalDate(new Date());

  // 1. Resolve domain-scoped task IDs.
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'task')
    .eq('domain_id', domainId);

  if (joinErr) throw joinErr;
  if (signal?.aborted) return EMPTY;

  const taskIds = (joinData ?? [])
    .map(r => r.parent_id as string | null)
    .filter((v): v is string => Boolean(v));

  if (taskIds.length === 0) return EMPTY;

  // 1b. Resolve the goal-tied subset of the zone's task pool, then
  //     derive the non-goal-tied list. Goal-driven work belongs to
  //     the Goals tile, not Overdue.
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
  const filteredTaskIds = taskIds.filter(id => !goalTiedTaskIds.has(id));

  if (filteredTaskIds.length === 0) return EMPTY;

  // 2. Fetch overdue task rows. Strict less-than on due_date so
  //    today's due tasks don't appear here (they belong in Upcoming).
  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'task')
    .is('deleted_at', null)
    .is('parent_task_id', null)
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', today)
    .in('id', filteredTaskIds)
    .order('due_date', { ascending: false });

  if (error) throw error;
  if (signal?.aborted) return EMPTY;

  const tasks = (data ?? []) as ZoneOverdueTask[];

  return {
    tasks,
    count: tasks.length,
  };
}
