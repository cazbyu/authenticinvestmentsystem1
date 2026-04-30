import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Role activity service — R-1 sibling of lib/zoneActivity.ts.
 *
 * Powers role-landing's stats row (Day Streak / Last 30 Day Actions tiles).
 *
 * Four deposit sources, joined via 0008-ap-universal-roles-join:
 *   - tasks (status='completed', deleted_at IS NULL)
 *   - commitments (date in window)
 *   - deposit-ideas (created_at in window, archived=false)
 *   - reflections (created_at in window, archived=false)
 *
 * Task activity-date semantics (locked, mirrors zoneActivity):
 *   - Goal-tied (parent_task_id IS NOT NULL) → use due_date
 *   - Regular  (parent_task_id IS NULL)     → COALESCE(due_date, completed_at)
 *
 * computeStreak is reused from lib/zoneActivity.ts (already scope-agnostic).
 */

export interface RoleActivityWindow {
  count: number;
  daysWithActivity: Set<string>;
}

/**
 * 30-day count + day-set for a role. Powers the "Last 30 Day Actions" tile
 * and contributes to the streak's recent days.
 */
export async function fetchRoleActivity30Days(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  abortSignal?: AbortSignal,
): Promise<RoleActivityWindow> {
  return fetchRoleActivityWindow(supabase, roleId, userId, 30, abortSignal);
}

/**
 * Day-set over a longer window (default 365 days) for streak computation.
 * Discards count.
 */
export async function fetchActivityDaySetForRoleStreak(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  lookbackDays: number = 365,
  abortSignal?: AbortSignal,
): Promise<Set<string>> {
  const { daysWithActivity } = await fetchRoleActivityWindow(
    supabase, roleId, userId, lookbackDays, abortSignal,
  );
  return daysWithActivity;
}

// ============================================================================
// Internals
// ============================================================================

async function fetchRoleActivityWindow(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  lookbackDays: number,
  abortSignal?: AbortSignal,
): Promise<RoleActivityWindow> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - (lookbackDays - 1));
  const cutoffIso = cutoff.toISOString();
  const cutoffDate = formatLocalDate(cutoff);
  const todayDate = formatLocalDate(now);

  const [taskRows, commitmentRows, depositIdeaRows, reflectionRows] =
    await Promise.all([
      fetchTaskRows(supabase, roleId, userId, cutoffIso, abortSignal),
      fetchCommitmentRows(supabase, roleId, userId, cutoffDate, todayDate, abortSignal),
      fetchDepositIdeaRows(supabase, roleId, userId, cutoffIso, abortSignal),
      fetchReflectionRows(supabase, roleId, userId, cutoffIso, abortSignal),
    ]);

  const days = new Set<string>();
  let count = 0;

  // Tasks — derive activity_date per locked semantics, JS-side filter
  // to handle backfilled rows (completed_at recent but due_date old).
  for (const t of taskRows) {
    const activityDate = computeTaskActivityDate(t);
    if (!activityDate) continue;
    if (activityDate < cutoffDate) continue;
    days.add(activityDate);
    count++;
  }

  // Commitments — `date` is already YYYY-MM-DD from a DATE column.
  for (const c of commitmentRows) {
    if (!c.date) continue;
    days.add(c.date);
    count++;
  }

  // Deposit-ideas — created_at is timestamptz; convert to local day.
  for (const i of depositIdeaRows) {
    if (!i.created_at) continue;
    const d = formatLocalDate(new Date(i.created_at));
    if (d < cutoffDate) continue;
    days.add(d);
    count++;
  }

  // Reflections — created_at is timestamptz; convert to local day.
  for (const r of reflectionRows) {
    if (!r.created_at) continue;
    const d = formatLocalDate(new Date(r.created_at));
    if (d < cutoffDate) continue;
    days.add(d);
    count++;
  }

  return { count, daysWithActivity: days };
}

function computeTaskActivityDate(t: {
  due_date: string | null;
  completed_at: string | null;
  parent_task_id: string | null;
}): string | null {
  if (t.parent_task_id !== null) {
    return t.due_date ?? null;
  }
  if (t.due_date) return t.due_date;
  if (t.completed_at) return formatLocalDate(new Date(t.completed_at));
  return null;
}

async function fetchTaskRows(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{
  id: string;
  due_date: string | null;
  completed_at: string | null;
  parent_task_id: string | null;
}>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id')
    .eq('parent_type', 'task')
    .eq('role_id', roleId);
  if (joinErr) throw joinErr;
  if (abortSignal?.aborted) return [];

  const taskIds = (joinData ?? [])
    .map(j => j.parent_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (taskIds.length === 0) return [];

  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .select('id, due_date, completed_at, parent_task_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .not('completed_at', 'is', null)
    .gte('completed_at', cutoffIso)
    .in('id', taskIds);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function fetchCommitmentRows(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  cutoffDate: string,
  todayDate: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; date: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id')
    .eq('parent_type', 'commitment')
    .eq('role_id', roleId);
  if (joinErr) throw joinErr;
  if (abortSignal?.aborted) return [];

  const ids = (joinData ?? [])
    .map(j => j.parent_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('0008-ap-commitments')
    .select('id, date')
    .eq('user_id', userId)
    .gte('date', cutoffDate)
    .lte('date', todayDate)
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function fetchDepositIdeaRows(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; created_at: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id')
    .eq('parent_type', 'depositIdea')
    .eq('role_id', roleId);
  if (joinErr) throw joinErr;
  if (abortSignal?.aborted) return [];

  const ids = (joinData ?? [])
    .map(j => j.parent_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('0008-ap-deposit-ideas')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('archived', false)
    .gte('created_at', cutoffIso)
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function fetchReflectionRows(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; created_at: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id')
    .eq('parent_type', 'reflection')
    .eq('role_id', roleId);
  if (joinErr) throw joinErr;
  if (abortSignal?.aborted) return [];

  const ids = (joinData ?? [])
    .map(j => j.parent_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('0008-ap-reflections')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('archived', false)
    .gte('created_at', cutoffIso)
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as any[];
}
