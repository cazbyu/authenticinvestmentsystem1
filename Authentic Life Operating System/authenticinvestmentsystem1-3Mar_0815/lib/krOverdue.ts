import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * KR overdue service — R-6-lib sibling of lib/roleOverdue.ts. Strict —
 * past-due pending/in_progress tasks only. Goal-tied tasks excluded
 * (live in Goals surface, not Overdue). No commitments — overdue is a
 * task-only concept; commitments that pass without completion get
 * status='missed' rather than appearing in Overdue.
 *
 * KRs DO tag custom goals (6 live rows per audit); the goal-tied
 * exclusion still applies — those tasks belong in the Toolshed Goals
 * surface, not MY SPACE Overdue.
 */

export interface KROverdueTask {
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

export interface KROverdueResult {
  tasks: KROverdueTask[];
  count: number;
}

const EMPTY: KROverdueResult = { tasks: [], count: 0 };

export async function fetchKROverdue(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<KROverdueResult> {
  const today = formatLocalDate(new Date());

  // 1. Resolve KR-scoped task IDs.
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-key-relationships-join')
    .select('parent_id')
    .eq('parent_type', 'task')
    .eq('key_relationship_id', krId);

  if (joinErr) throw joinErr;
  if (signal?.aborted) return EMPTY;

  const taskIds = (joinData ?? [])
    .map(r => r.parent_id as string | null)
    .filter((v): v is string => Boolean(v));

  if (taskIds.length === 0) return EMPTY;

  // 1b. Goal-tied exclusion. Mirrors roleOverdue: goal-tied tasks live
  // in the Toolshed Goals surface, not MY SPACE Overdue.
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

  // 2. Fetch overdue task rows. Strict less-than on due_date.
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

  const tasks = (data ?? []) as KROverdueTask[];

  return {
    tasks,
    count: tasks.length,
  };
}
