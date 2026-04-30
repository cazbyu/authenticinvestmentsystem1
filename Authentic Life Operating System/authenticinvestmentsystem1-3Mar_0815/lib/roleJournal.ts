import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Role journal count — R-1 sibling of lib/zoneJournal.ts.
 *
 * Sources (locked — match zoneJournal exactly with role scope):
 *   1a) Completed tasks       — 0008-ap-tasks
 *   1b) Completed commitments — 0008-ap-commitments, joined via
 *                                parent_type='task' to mirror zoneJournal's
 *                                shared-task-pipeline shape (which itself
 *                                mirrors JournalView lines 213-249). Note:
 *                                commitment rows are actually tagged with
 *                                parent_type='commitment' in the roles-join
 *                                table, so this lookup will consistently
 *                                return 0 — same documented behavior as
 *                                zoneJournal. Locked decision: mirror exactly.
 *                                Backlog B38 covers the future fix to source
 *                                commitment IDs separately; both zoneJournal
 *                                and roleJournal would update together.
 *   2)  Withdrawals           — 0008-ap-withdrawals
 *   3)  Reflections           — 0008-ap-reflections (archived=false)
 *   4)  Deposit-ideas         — 0008-ap-deposit-ideas (archived=false,
 *                                is_active=true)
 *
 * No date filter applied — returns the all-time count for the supplied role.
 *
 * abortSignal is advisory (Supabase HTTP is not cancellable); caller still
 * owns its outer state-gate on abort.
 */

async function getRoleScopedIds(
  supabase: SupabaseClient,
  parentType: string,
  roleId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id')
    .eq('parent_type', parentType)
    .eq('role_id', roleId);
  if (error) throw error;
  return (data ?? [])
    .map(r => r.parent_id as string | null)
    .filter((v): v is string => Boolean(v));
}

async function countWithIds(
  supabase: SupabaseClient,
  table: string,
  applyFilters: (q: any) => any,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  query = applyFilters(query);
  query = query.in('id', ids);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchRoleJournalCount(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  // 1. Resolve role-scoped parent_id sets in parallel. Tasks and
  //    commitments share the same scoped pool (parent_type='task') —
  //    locked mirror of zoneJournal which itself mirrors JournalView.
  //    See header docstring for the consistent-zero commitment behavior.
  const [
    taskAndCommitmentIds,
    withdrawalIds,
    reflectionIds,
    depositIdeaIds,
  ] = await Promise.all([
    getRoleScopedIds(supabase, 'task', roleId),
    getRoleScopedIds(supabase, 'withdrawal', roleId),
    getRoleScopedIds(supabase, 'reflection', roleId),
    getRoleScopedIds(supabase, 'depositIdea', roleId),
  ]);
  if (signal?.aborted) return 0;

  // 2. Per-source filtered count. Tasks and commitments share the same
  //    scoped ID pool; the source-specific filters discriminate which IDs
  //    belong to which table.
  const [
    taskCount,
    commitmentCount,
    withdrawalCount,
    reflectionCount,
    depositIdeaCount,
  ] = await Promise.all([
    // 1a) Completed tasks
    countWithIds(
      supabase,
      '0008-ap-tasks',
      (q) => q
        .eq('user_id', userId)
        .eq('type', 'task')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .not('completed_at', 'is', null),
      taskAndCommitmentIds,
    ),
    // 1b) Completed commitments — same scoped ID pool, different table.
    //     Returns 0 today (B38) — see header.
    countWithIds(
      supabase,
      '0008-ap-commitments',
      (q) => q
        .eq('user_id', userId)
        .eq('status', 'completed'),
      taskAndCommitmentIds,
    ),
    // 2) Withdrawals
    countWithIds(
      supabase,
      '0008-ap-withdrawals',
      (q) => q.eq('user_id', userId),
      withdrawalIds,
    ),
    // 3) Reflections
    countWithIds(
      supabase,
      '0008-ap-reflections',
      (q) => q.eq('user_id', userId).eq('archived', false),
      reflectionIds,
    ),
    // 4) Deposit-ideas
    countWithIds(
      supabase,
      '0008-ap-deposit-ideas',
      (q) => q
        .eq('user_id', userId)
        .eq('archived', false)
        .eq('is_active', true),
      depositIdeaIds,
    ),
  ]);
  if (signal?.aborted) return 0;

  return (
    taskCount +
    commitmentCount +
    withdrawalCount +
    reflectionCount +
    depositIdeaCount
  );
}
