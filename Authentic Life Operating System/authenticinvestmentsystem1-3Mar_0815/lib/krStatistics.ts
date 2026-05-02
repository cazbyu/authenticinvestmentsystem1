import { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from './dateUtils';
import { computeStreak } from './zoneActivity';
import { getDaysSince } from './roleStatistics';

/**
 * KR statistics service — R-6-lib sibling of lib/roleStatistics.ts +
 * lib/roleActivity.ts (combined per audit v2 lock — no separate
 * lib/krActivity.ts).
 *
 * Powers KR detail page's stats row (Day Streak / 30-Day Actions /
 * Last Contact tiles) per audit v2 Q2 lock.
 *
 * Public API (3 functions):
 *   - getKRStreak         — days in a row with at least one KR-tagged
 *                           deposit across 4 sources
 *   - getKRActionCount30d — count of KR-tagged deposits in last 30 days
 *   - getKRLastEngagement — most recent activity across all 6 KR activity
 *                           categories: Task, Event (captured + commitments),
 *                           Deposit Idea, Reflection, Rose, Thorn
 *                           (audit v2 Q2 REVISED FINAL May 1, 2026)
 *
 * The activity-window engine (Day Streak + 30-Day Actions + Last Engagement)
 * powers all 3 public functions. Same 4-source pattern as roleActivity.ts:
 * tasks (status='completed'), commitments (date in window), deposit-ideas
 * (created_at, archived=false), reflections (created_at, archived=false).
 *
 * Last Engagement uses a separate query path optimized for "most recent"
 * — `.order(...).limit(1)` per source, JS-side max across all 4 — rather
 * than fetching a full lookback window. Avoids special-casing infinite
 * lookback in the activity-window engine.
 */

// ============================================================================
// Public types
// ============================================================================

export interface KRActivityWindow {
  count: number;
  daysWithActivity: Set<string>;
}

export interface KRLastEngagement {
  date: string | null;
  daysAgo: number | null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * R-6-lib: Day Streak for a KR.
 *
 * Composes fetchKRActivityWindow with 365-day lookback + computeStreak
 * (from zoneActivity.ts — scope-agnostic, reused as-is). Returns the count
 * of consecutive days back from today with at least one KR-tagged deposit
 * across all 4 sources.
 *
 * Mirrors lib/roleStatistics.ts's getRoleStreak / lib/roleActivity.ts's
 * fetchActivityDaySetForRoleStreak composition.
 */
export async function getKRStreak(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  const { daysWithActivity } = await fetchKRActivityWindow(supabase, krId, userId, 365, signal);
  if (signal?.aborted) return 0;
  return computeStreak(daysWithActivity);
}

/**
 * R-6-lib: Last 30 day actions count for a KR.
 *
 * Returns the count of KR-tagged deposits across 4 sources within the
 * last 30 days (inclusive of today). Mirrors getRoleActionCount30d.
 */
export async function getKRActionCount30d(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  const result = await fetchKRActivityWindow(supabase, krId, userId, 30, signal);
  if (signal?.aborted) return 0;
  return result.count;
}

/**
 * R-6-lib: Most recent KR engagement across all 6 KR activity categories.
 *
 * Audit v2 Q2 REVISED FINAL (May 1, 2026): expanded from "Last Contact"
 * (2 sources, excluded reflections) to "Last Engagement" — the wider scope
 * is "activity toward relationship," not just direct contact.
 *
 * 6 KR activity categories (Paul's mental model):
 *   1. Task          — 0008-ap-tasks (type='task', incl Actions within Goals)
 *   2. Event         — 0008-ap-tasks (type='event' Captured Events) +
 *                      0008-ap-commitments (kept Google Calendar events)
 *   3. Deposit Idea  — 0008-ap-deposit-ideas
 *   4. Reflection    — 0008-ap-reflections (regular daily/non-rose/non-thorn)
 *   5. Rose          — 0008-ap-reflections (daily_rose=true)
 *   6. Thorn         — 0008-ap-reflections (daily_thorn=true)
 *
 * Implementation: 4 efficient queries cover all 6 categories.
 *   - Tasks query has no type filter → catches Task + Captured Event subtypes
 *   - Commitments query → catches Event (Google Cal kept events)
 *   - Deposit-ideas query → catches Deposit Idea
 *   - Reflections query has no daily_rose/daily_thorn filter → catches
 *     Reflection + Rose + Thorn subtypes
 *
 * Sources & filters (the 4 queries):
 *   - Tasks (0008-ap-tasks):           status='completed', completed_at NOT NULL
 *   - Commitments (0008-ap-commitments): date <= today, status != 'missed'
 *   - Deposit ideas (0008-ap-deposit-ideas): archived=false
 *   - Reflections (0008-ap-reflections): archived=false
 *
 * Query strategy: 4 parallel join lookups + 4 parallel data fetches with
 * `.order(...).limit(1)` per source. JS-side max across the 4 dates.
 * Bounded query cost regardless of data size.
 *
 * Returns { date, daysAgo }:
 *   - date: ISO date string of the most recent activity, or null if never
 *   - daysAgo: integer days from today, or null if never
 */
export async function getKRLastEngagement(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<KRLastEngagement> {
  const todayDate = formatLocalDate(new Date());

  // 1. Resolve KR-scoped IDs for all 4 source types in parallel.
  const [taskJoinRes, commitmentJoinRes, depositIdeaJoinRes, reflectionJoinRes] =
    await Promise.all([
      supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('parent_id')
        .eq('parent_type', 'task')
        .eq('key_relationship_id', krId)
        .eq('user_id', userId),
      supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('parent_id')
        .eq('parent_type', 'commitment')
        .eq('key_relationship_id', krId)
        .eq('user_id', userId),
      supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('parent_id')
        .eq('parent_type', 'depositIdea')
        .eq('key_relationship_id', krId)
        .eq('user_id', userId),
      supabase
        .from('0008-ap-universal-key-relationships-join')
        .select('parent_id')
        .eq('parent_type', 'reflection')
        .eq('key_relationship_id', krId)
        .eq('user_id', userId),
    ]);

  if (taskJoinRes.error) throw taskJoinRes.error;
  if (commitmentJoinRes.error) throw commitmentJoinRes.error;
  if (depositIdeaJoinRes.error) throw depositIdeaJoinRes.error;
  if (reflectionJoinRes.error) throw reflectionJoinRes.error;
  if (signal?.aborted) return { date: null, daysAgo: null };

  const extractIds = (data: any[] | null) =>
    (data ?? [])
      .map(r => r.parent_id as string | null)
      .filter((v): v is string => Boolean(v));

  const taskIds = extractIds(taskJoinRes.data);
  const commitmentIds = extractIds(commitmentJoinRes.data);
  const depositIdeaIds = extractIds(depositIdeaJoinRes.data);
  const reflectionIds = extractIds(reflectionJoinRes.data);

  // 2. Fetch most recent activity per source in parallel.
  // No type filter on tasks → catches type='task' AND type='event' (captured).
  // No daily_rose/daily_thorn filter on reflections → catches all subtypes.
  const [taskRes, commitmentRes, depositIdeaRes, reflectionRes] = await Promise.all([
    taskIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-tasks')
          .select('completed_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .not('completed_at', 'is', null)
          .in('id', taskIds)
          .order('completed_at', { ascending: false })
          .limit(1),
    commitmentIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-commitments')
          .select('date')
          .eq('user_id', userId)
          .neq('status', 'missed')
          .lte('date', todayDate)
          .in('id', commitmentIds)
          .order('date', { ascending: false })
          .limit(1),
    depositIdeaIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-deposit-ideas')
          .select('created_at')
          .eq('user_id', userId)
          .eq('archived', false)
          .in('id', depositIdeaIds)
          .order('created_at', { ascending: false })
          .limit(1),
    reflectionIds.length === 0
      ? { data: [] as any[], error: null }
      : supabase
          .from('0008-ap-reflections')
          .select('created_at')
          .eq('user_id', userId)
          .eq('archived', false)
          .in('id', reflectionIds)
          .order('created_at', { ascending: false })
          .limit(1),
  ]);

  if (taskRes.error) throw taskRes.error;
  if (commitmentRes.error) throw commitmentRes.error;
  if (depositIdeaRes.error) throw depositIdeaRes.error;
  if (reflectionRes.error) throw reflectionRes.error;
  if (signal?.aborted) return { date: null, daysAgo: null };

  // 3. Reduce to the single most-recent activity date.
  // Tasks/deposit-ideas/reflections return timestamptz → convert to local date.
  // Commitments return YYYY-MM-DD already (DATE column).
  const taskDate = taskRes.data?.[0]?.completed_at
    ? formatLocalDate(new Date(taskRes.data[0].completed_at))
    : null;
  const commitmentDate = commitmentRes.data?.[0]?.date ?? null;
  const depositIdeaDate = depositIdeaRes.data?.[0]?.created_at
    ? formatLocalDate(new Date(depositIdeaRes.data[0].created_at))
    : null;
  const reflectionDate = reflectionRes.data?.[0]?.created_at
    ? formatLocalDate(new Date(reflectionRes.data[0].created_at))
    : null;

  // ISO YYYY-MM-DD strings sort lexicographically === chronologically.
  const candidates = [taskDate, commitmentDate, depositIdeaDate, reflectionDate]
    .filter((d): d is string => Boolean(d));

  if (candidates.length === 0) return { date: null, daysAgo: null };

  const mostRecent = candidates.reduce((max, d) => (d > max ? d : max));

  return {
    date: mostRecent,
    daysAgo: getDaysSince(mostRecent),
  };
}

// ============================================================================
// Internals — activity-window engine (mirrors lib/roleActivity.ts inline)
// ============================================================================

/**
 * Fetches KR-tagged activity within the last `lookbackDays` days. Returns
 * both the unique days set (for streak computation) and total count (for
 * 30-day actions tile).
 *
 * 4 sources joined via 0008-ap-universal-key-relationships-join:
 *   - tasks (status='completed', deleted_at IS NULL)
 *   - commitments (date in window)
 *   - deposit-ideas (created_at in window, archived=false)
 *   - reflections (created_at in window, archived=false)
 *
 * Task activity-date semantics (locked, mirrors zoneActivity / roleActivity):
 *   - Goal-tied (parent_task_id IS NOT NULL) → use due_date
 *   - Regular  (parent_task_id IS NULL)     → COALESCE(due_date, completed_at)
 */
async function fetchKRActivityWindow(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  lookbackDays: number,
  abortSignal?: AbortSignal,
): Promise<KRActivityWindow> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - (lookbackDays - 1));
  const cutoffIso = cutoff.toISOString();
  const cutoffDate = formatLocalDate(cutoff);
  const todayDate = formatLocalDate(now);

  const [taskRows, commitmentRows, depositIdeaRows, reflectionRows] =
    await Promise.all([
      fetchKRTaskRows(supabase, krId, userId, cutoffIso, abortSignal),
      fetchKRCommitmentRows(supabase, krId, userId, cutoffDate, todayDate, abortSignal),
      fetchKRDepositIdeaRows(supabase, krId, userId, cutoffIso, abortSignal),
      fetchKRReflectionRows(supabase, krId, userId, cutoffIso, abortSignal),
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

async function fetchKRTaskRows(
  supabase: SupabaseClient,
  krId: string,
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
    .from('0008-ap-universal-key-relationships-join')
    .select('parent_id')
    .eq('parent_type', 'task')
    .eq('key_relationship_id', krId);
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

async function fetchKRCommitmentRows(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  cutoffDate: string,
  todayDate: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; date: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-key-relationships-join')
    .select('parent_id')
    .eq('parent_type', 'commitment')
    .eq('key_relationship_id', krId);
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

async function fetchKRDepositIdeaRows(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; created_at: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-key-relationships-join')
    .select('parent_id')
    .eq('parent_type', 'depositIdea')
    .eq('key_relationship_id', krId);
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

async function fetchKRReflectionRows(
  supabase: SupabaseClient,
  krId: string,
  userId: string,
  cutoffIso: string,
  abortSignal?: AbortSignal,
): Promise<Array<{ id: string; created_at: string | null }>> {
  const { data: joinData, error: joinErr } = await supabase
    .from('0008-ap-universal-key-relationships-join')
    .select('parent_id')
    .eq('parent_type', 'reflection')
    .eq('key_relationship_id', krId);
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
