import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Zone journal count — counts the total number of journal entries for a
 * given zone, mirroring the 5-source union that
 * components/journal/JournalView.tsx renders for scope.type='domain'.
 *
 * Sources (locked — match JournalView exactly):
 *   1a) Completed tasks       — 0008-ap-tasks
 *   1b) Completed commitments — 0008-ap-commitments, joined via
 *                                parent_type='task' to mirror JournalView's
 *                                shared-task-pipeline shape (lines 213-249
 *                                of JournalView). Note: commitment rows are
 *                                actually tagged with parent_type='commitment'
 *                                in the join table, so this lookup will
 *                                consistently return 0 — same behavior
 *                                JournalView exhibits today for zone-scoped
 *                                views. Locked decision: mirror exactly.
 *   2)  Withdrawals           — 0008-ap-withdrawals
 *   3)  Reflections           — 0008-ap-reflections (archived=false)
 *   4)  Deposit-ideas         — 0008-ap-deposit-ideas (archived=false,
 *                                is_active=true)
 *
 * No date filter applied — returns the all-time count for the supplied zone
 * (locked decision; JournalView itself supports a per-period selector but the
 * tile badge stays stable across panel-internal range changes).
 *
 * Note on overlap: deposit-ideas are also surfaced in the Idea Jar tile via
 * fetchZoneIdeas (lib/zoneDataService.ts). By design — matching JournalView —
 * a single deposit-idea contributes to BOTH the Idea Jar count and the
 * Journal count.
 *
 * Pattern: per-source two-step lookup (universal-domains-join filtered to
 * parent_type, then source table filtered by id IN list with the source's
 * own filters). Counts via Supabase's count: 'exact', head: true (no row
 * data returned — efficient).
 *
 * abortSignal is advisory (Supabase HTTP is not cancellable); caller still
 * owns its outer state-gate on abort.
 */

async function getDomainScopedIds(
  supabase: SupabaseClient,
  parentType: string,
  domainId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', parentType)
    .eq('domain_id', domainId);
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

export async function fetchZoneJournalCount(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  // 1. Resolve domain-scoped parent_id sets in parallel. Tasks and
  //    commitments share the same scoped pool (parent_type='task') because
  //    JournalView merges their IDs before the domain-join lookup
  //    (line 213-216 of JournalView).
  const [
    taskAndCommitmentIds,
    withdrawalIds,
    reflectionIds,
    depositIdeaIds,
  ] = await Promise.all([
    getDomainScopedIds(supabase, 'task', domainId),
    getDomainScopedIds(supabase, 'withdrawal', domainId),
    getDomainScopedIds(supabase, 'reflection', domainId),
    getDomainScopedIds(supabase, 'depositIdea', domainId),
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
    // 1b) Completed commitments — same scoped ID pool, different table
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
