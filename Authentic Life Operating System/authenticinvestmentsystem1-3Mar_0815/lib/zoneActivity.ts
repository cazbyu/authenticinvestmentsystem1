import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';

/**
 * Zone activity service — counts and day-set helpers for the wellness
 * zone landing's stats row (Day Streak / Last 30 Day Actions tiles).
 *
 * Four deposit sources per locked spec, joined to a zone via
 * 0008-ap-universal-domains-join:
 *   - tasks (status='completed', deleted_at IS NULL)
 *   - commitments (date in window)
 *   - deposit-ideas (created_at in window, archived=false)
 *   - reflections (created_at in window, archived=false)
 *
 * Task activity-date semantics (locked):
 *   - Goal-tied (parent_task_id IS NOT NULL) → use due_date
 *   - Regular  (parent_task_id IS NULL)     → COALESCE(due_date, completed_at)
 *
 * Excluded from "Actions" per locked spec: step-log, question-responses,
 * tracker logs.
 *
 * Patterns mirror lib/roleStatistics.ts:fetchDepositCountsForSource —
 * two-step lookup (universal-domains-join filtered to parent_type, then
 * source-table filtered by id IN list) for consistency with the rest of
 * the codebase. abortSignal is advisory (Supabase HTTP is not cancellable);
 * caller still owns its outer state-gate.
 */

export interface ZoneActivityWindow {
  count: number;
  daysWithActivity: Set<string>;  // YYYY-MM-DD local-day strings
}

/**
 * 30-day count + day-set for the zone. Powers the "Last 30 Day Actions"
 * tile and contributes to the streak's recent days.
 */
export async function fetchZoneActivity30Days(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  abortSignal?: AbortSignal,
): Promise<ZoneActivityWindow> {
  return fetchZoneActivityWindow(supabase, domainId, userId, 30, abortSignal);
}

/**
 * Day-set over a longer window (default 365 days) for streak computation.
 * Discards count.
 */
export async function fetchActivityDaySetForStreak(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  lookbackDays: number = 365,
  abortSignal?: AbortSignal,
): Promise<Set<string>> {
  const { daysWithActivity } = await fetchZoneActivityWindow(
    supabase, domainId, userId, lookbackDays, abortSignal,
  );
  return daysWithActivity;
}

/**
 * Walk back from `today` counting consecutive YYYY-MM-DD days present
 * in `days`. Returns 0 if today AND yesterday are both empty.
 *
 * Edge case (locked): if today is not in the set but yesterday is,
 * the streak starts at yesterday — a user who was active yesterday but
 * hasn't tapped anything today still has a streak.
 *
 * Cap at 365 iterations as a safety stop.
 */
export function computeStreak(
  days: Set<string>,
  today: Date = new Date(),
): number {
  if (days.size === 0) return 0;

  // Local-midnight cursor — clones Date to avoid mutating caller's value.
  const cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // If today is empty, allow yesterday to anchor the streak. If neither
  // today nor yesterday is in the set, the loop below exits at iter 0
  // and we return 0.
  if (!days.has(formatLocalDate(cur))) {
    cur.setDate(cur.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (!days.has(formatLocalDate(cur))) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// ============================================================================
// Internals
// ============================================================================

async function fetchZoneActivityWindow(
  supabase: SupabaseClient,
  domainId: string,
  userId: string,
  lookbackDays: number,
  abortSignal?: AbortSignal,
): Promise<ZoneActivityWindow> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - (lookbackDays - 1));
  const cutoffIso = cutoff.toISOString();
  const cutoffDate = formatLocalDate(cutoff);
  const todayDate = formatLocalDate(now);

  const [taskRows, commitmentRows, depositIdeaRows, reflectionRows] =
    await Promise.all([
      fetchTaskRows(supabase, domainId, userId, cutoffIso, abortSignal),
      fetchCommitmentRows(supabase, domainId, userId, cutoffDate, todayDate, abortSignal),
      fetchDepositIdeaRows(supabase, domainId, userId, cutoffIso, abortSignal),
      fetchReflectionRows(supabase, domainId, userId, cutoffIso, abortSignal),
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
  domainId: string,
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
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'task')
    .eq('domain_id', domainId);
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
  domainId: string,
  userId: string,
  cutoffDate: string,
  todayDate: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; date: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'commitment')
    .eq('domain_id', domainId);
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
  domainId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; created_at: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'depositIdea')
    .eq('domain_id', domainId);
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
  domainId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; created_at: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id')
    .eq('parent_type', 'reflection')
    .eq('domain_id', domainId);
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
