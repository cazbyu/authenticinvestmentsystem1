import { SupabaseClient } from '@supabase/supabase-js';
import { calculateAuthenticScoreForPeriod } from './taskUtils';
import { formatLocalDate } from './dateUtils';
import { computeStreak } from './zoneActivity';
import {
  fetchRoleActivity30Days,
  fetchActivityDaySetForRoleStreak,
} from './roleActivity';

export interface RoleStatistics {
  completedDeposits: number;
  totalScheduled: number;
  scheduledByWeek: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  reflectionStats: {
    roses: number;
    thorns: number;
    depositIdeas: number;
    reflectionsAndNotes: number;
  };
  authenticScore: number;
}

export interface DomainStatistics {
  completedDeposits: number;
  totalScheduled: number;
  scheduledByWeek: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  reflectionStats: {
    roses: number;
    thorns: number;
    depositIdeas: number;
    reflectionsAndNotes: number;
  };
  authenticScore: number;
}

function getDateRange(period: 'today' | 'week' | 'month' | 'all'): { startDate: Date | null; endDate: Date } {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  if (period === 'all') {
    return { startDate: null, endDate };
  }

  const startDate = new Date();

  if (period === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    startDate.setDate(endDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setDate(endDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

function getWeekRanges(): Array<{ start: Date; end: Date }> {
  const ranges = [];
  const now = new Date();

  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + (i * 7));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    ranges.push({ start: weekStart, end: weekEnd });
  }

  return ranges;
}

export async function getCompletedDepositsCount(
  supabase: SupabaseClient,
  userId: string,
  period: 'today' | 'week' | 'month' | 'all',
  scopeType: 'role' | 'domain' | 'key_relationship',
  scopeId: string
): Promise<number> {
  try {
    const { startDate, endDate } = getDateRange(period);

    let tasksQuery = supabase
      .from('0008-ap-tasks')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('completed_at', 'is', null);

    if (startDate) {
      tasksQuery = tasksQuery.gte('completed_at', startDate.toISOString());
    }
    tasksQuery = tasksQuery.lte('completed_at', endDate.toISOString());

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) return 0;

    const taskIds = tasks.map(t => t.id);

    const joinTable = scopeType === 'role'
      ? '0008-ap-universal-roles-join'
      : scopeType === 'domain'
      ? '0008-ap-universal-domains-join'
      : '0008-ap-universal-key-relationships-join';

    const idField = scopeType === 'role'
      ? 'role_id'
      : scopeType === 'domain'
      ? 'domain_id'
      : 'key_relationship_id';

    const { data: joinData, error: joinError } = await supabase
      .from(joinTable)
      .select('parent_id')
      .in('parent_id', taskIds)
      .eq('parent_type', 'task')
      .eq(idField, scopeId);

    if (joinError) throw joinError;

    return joinData?.length || 0;
  } catch (error) {
    console.error('Error getting completed deposits count:', error);
    return 0;
  }
}

export async function getScheduledDepositsByWeek(
  supabase: SupabaseClient,
  userId: string,
  scopeType: 'role' | 'domain' | 'key_relationship',
  scopeId: string
): Promise<{ week1: number; week2: number; week3: number; week4: number }> {
  try {
    const weekRanges = getWeekRanges();

    const { data: tasks, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('id, due_date')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .is('deleted_at', null)
      .not('due_date', 'is', null)
      .gte('due_date', weekRanges[0].start.toISOString())
      .lte('due_date', weekRanges[3].end.toISOString());

    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) {
      return { week1: 0, week2: 0, week3: 0, week4: 0 };
    }

    const taskIds = tasks.map(t => t.id);

    const joinTable = scopeType === 'role'
      ? '0008-ap-universal-roles-join'
      : scopeType === 'domain'
      ? '0008-ap-universal-domains-join'
      : '0008-ap-universal-key-relationships-join';

    const idField = scopeType === 'role'
      ? 'role_id'
      : scopeType === 'domain'
      ? 'domain_id'
      : 'key_relationship_id';

    const { data: joinData, error: joinError } = await supabase
      .from(joinTable)
      .select('parent_id')
      .in('parent_id', taskIds)
      .eq('parent_type', 'task')
      .eq(idField, scopeId);

    if (joinError) throw joinError;

    const filteredTaskIds = new Set(joinData?.map(j => j.parent_id) || []);
    const filteredTasks = tasks.filter(t => filteredTaskIds.has(t.id));

    const counts = { week1: 0, week2: 0, week3: 0, week4: 0 };

    filteredTasks.forEach(task => {
      const dueDate = new Date(task.due_date);

      for (let i = 0; i < weekRanges.length; i++) {
        if (dueDate >= weekRanges[i].start && dueDate <= weekRanges[i].end) {
          if (i === 0) counts.week1++;
          else if (i === 1) counts.week2++;
          else if (i === 2) counts.week3++;
          else if (i === 3) counts.week4++;
          break;
        }
      }
    });

    return counts;
  } catch (error) {
    console.error('Error getting scheduled deposits by week:', error);
    return { week1: 0, week2: 0, week3: 0, week4: 0 };
  }
}

export async function getScheduledDepositsForPeriod(
  supabase: SupabaseClient,
  userId: string,
  period: 'today' | 'week' | 'month' | 'all',
  scopeType: 'role' | 'domain' | 'key_relationship',
  scopeId: string
): Promise<number> {
  try {
    const now = new Date();
    let startDate: Date;
    let endDate: Date | null = null;

    if (period === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setDate(now.getDate() + 7);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setDate(now.getDate() + 30);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    }

    let tasksQuery = supabase
      .from('0008-ap-tasks')
      .select('id, due_date')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .is('deleted_at', null)
      .not('due_date', 'is', null)
      .gte('due_date', startDate.toISOString());

    if (endDate) {
      tasksQuery = tasksQuery.lte('due_date', endDate.toISOString());
    }

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) return 0;

    const taskIds = tasks.map(t => t.id);

    const joinTable = scopeType === 'role'
      ? '0008-ap-universal-roles-join'
      : scopeType === 'domain'
      ? '0008-ap-universal-domains-join'
      : '0008-ap-universal-key-relationships-join';

    const idField = scopeType === 'role'
      ? 'role_id'
      : scopeType === 'domain'
      ? 'domain_id'
      : 'key_relationship_id';

    const { data: joinData, error: joinError } = await supabase
      .from(joinTable)
      .select('parent_id')
      .in('parent_id', taskIds)
      .eq('parent_type', 'task')
      .eq(idField, scopeId);

    if (joinError) throw joinError;

    return joinData?.length || 0;
  } catch (error) {
    console.error('Error getting scheduled deposits for period:', error);
    return 0;
  }
}

export async function getReflectionStatistics(
  supabase: SupabaseClient,
  userId: string,
  period: 'today' | 'week' | 'month' | 'all',
  scopeType: 'role' | 'domain' | 'key_relationship',
  scopeId: string
): Promise<{ roses: number; thorns: number; depositIdeas: number; reflectionsAndNotes: number }> {
  try {
    const { startDate, endDate } = getDateRange(period);

    let reflectionsQuery = supabase
      .from('0008-ap-reflections')
      .select('id, daily_rose, daily_thorn, date')
      .eq('user_id', userId)
      .is('archived', false);

    if (startDate) {
      reflectionsQuery = reflectionsQuery.gte('date', formatLocalDate(startDate));
    }
    reflectionsQuery = reflectionsQuery.lte('date', formatLocalDate(endDate));

    const { data: reflections, error: reflectionsError } = await reflectionsQuery;

    if (reflectionsError) throw reflectionsError;

    const joinTable = scopeType === 'role'
      ? '0008-ap-universal-roles-join'
      : scopeType === 'domain'
      ? '0008-ap-universal-domains-join'
      : '0008-ap-universal-key-relationships-join';

    const idField = scopeType === 'role'
      ? 'role_id'
      : scopeType === 'domain'
      ? 'domain_id'
      : 'key_relationship_id';

    let roses = 0;
    let thorns = 0;
    let reflectionsAndNotes = 0;

    if (reflections && reflections.length > 0) {
      const reflectionIds = reflections.map(r => r.id);

      const { data: reflectionJoins, error: reflectionJoinsError } = await supabase
        .from(joinTable)
        .select('parent_id')
        .in('parent_id', reflectionIds)
        .eq('parent_type', 'reflection')
        .eq(idField, scopeId);

      if (reflectionJoinsError) throw reflectionJoinsError;

      const linkedReflectionIds = new Set(reflectionJoins?.map(j => j.parent_id) || []);

      reflections.forEach(reflection => {
        if (linkedReflectionIds.has(reflection.id)) {
          if (reflection.daily_rose) {
            roses++;
          } else if (reflection.daily_thorn) {
            thorns++;
          } else {
            reflectionsAndNotes++;
          }
        }
      });
    }

    let tasksQuery = supabase
      .from('0008-ap-tasks')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('completed_at', 'is', null);

    if (startDate) {
      tasksQuery = tasksQuery.gte('completed_at', startDate.toISOString());
    }
    tasksQuery = tasksQuery.lte('completed_at', endDate.toISOString());

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) throw tasksError;

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);

      const { data: taskJoins, error: taskJoinsError } = await supabase
        .from(joinTable)
        .select('parent_id')
        .in('parent_id', taskIds)
        .eq('parent_type', 'task')
        .eq(idField, scopeId);

      if (taskJoinsError) throw taskJoinsError;

      const linkedTaskIds = taskJoins?.map(j => j.parent_id) || [];

      if (linkedTaskIds.length > 0) {
        const { data: noteJoins, error: noteJoinsError } = await supabase
          .from('0008-ap-universal-notes-join')
          .select('note_id')
          .in('parent_id', linkedTaskIds)
          .eq('parent_type', 'task');

        if (noteJoinsError) throw noteJoinsError;

        reflectionsAndNotes += noteJoins?.length || 0;
      }
    }

    let depositIdeasQuery = supabase
      .from('0008-ap-deposit-ideas')
      .select('id, created_at')
      .eq('user_id', userId);

    if (startDate) {
      depositIdeasQuery = depositIdeasQuery.gte('created_at', startDate.toISOString());
    }
    depositIdeasQuery = depositIdeasQuery.lte('created_at', endDate.toISOString());

    const { data: depositIdeas, error: depositIdeasError } = await depositIdeasQuery;

    if (depositIdeasError) throw depositIdeasError;

    let depositIdeasCount = 0;
    if (depositIdeas && depositIdeas.length > 0) {
      const depositIdeaIds = depositIdeas.map(d => d.id);

      const { data: depositIdeaJoins, error: depositIdeaJoinsError } = await supabase
        .from(joinTable)
        .select('parent_id')
        .in('parent_id', depositIdeaIds)
        .eq('parent_type', 'deposit_idea')
        .eq(idField, scopeId);

      if (depositIdeaJoinsError) throw depositIdeaJoinsError;

      depositIdeasCount = depositIdeaJoins?.length || 0;
    }

    return {
      roses,
      thorns,
      depositIdeas: depositIdeasCount,
      reflectionsAndNotes
    };
  } catch (error) {
    console.error('Error getting reflection statistics:', error);
    return { roses: 0, thorns: 0, depositIdeas: 0, reflectionsAndNotes: 0 };
  }
}

export async function getRoleStatistics(
  supabase: SupabaseClient,
  userId: string,
  roleId: string,
  period: 'today' | 'week' | 'month' | 'all'
): Promise<RoleStatistics> {
  try {
    const [completedDeposits, totalScheduled, scheduledByWeek, reflectionStats, authenticScore] = await Promise.all([
      getCompletedDepositsCount(supabase, userId, period, 'role', roleId),
      getScheduledDepositsForPeriod(supabase, userId, period, 'role', roleId),
      getScheduledDepositsByWeek(supabase, userId, 'role', roleId),
      getReflectionStatistics(supabase, userId, period, 'role', roleId),
      calculateAuthenticScoreForPeriod(supabase, userId, period, { type: 'role', id: roleId })
    ]);

    return {
      completedDeposits,
      totalScheduled,
      scheduledByWeek,
      reflectionStats,
      authenticScore
    };
  } catch (error) {
    console.error('Error getting role statistics:', error);
    return {
      completedDeposits: 0,
      totalScheduled: 0,
      scheduledByWeek: { week1: 0, week2: 0, week3: 0, week4: 0 },
      reflectionStats: { roses: 0, thorns: 0, depositIdeas: 0, reflectionsAndNotes: 0 },
      authenticScore: 0
    };
  }
}

export async function getDomainStatistics(
  supabase: SupabaseClient,
  userId: string,
  domainId: string,
  period: 'today' | 'week' | 'month' | 'all'
): Promise<DomainStatistics> {
  try {
    const [completedDeposits, totalScheduled, scheduledByWeek, reflectionStats, authenticScore] = await Promise.all([
      getCompletedDepositsCount(supabase, userId, period, 'domain', domainId),
      getScheduledDepositsForPeriod(supabase, userId, period, 'domain', domainId),
      getScheduledDepositsByWeek(supabase, userId, 'domain', domainId),
      getReflectionStatistics(supabase, userId, period, 'domain', domainId),
      calculateAuthenticScoreForPeriod(supabase, userId, period, { type: 'domain', id: domainId })
    ]);

    return {
      completedDeposits,
      totalScheduled,
      scheduledByWeek,
      reflectionStats,
      authenticScore
    };
  } catch (error) {
    console.error('Error getting domain statistics:', error);
    return {
      completedDeposits: 0,
      totalScheduled: 0,
      scheduledByWeek: { week1: 0, week2: 0, week3: 0, week4: 0 },
      reflectionStats: { roses: 0, thorns: 0, depositIdeas: 0, reflectionsAndNotes: 0 },
      authenticScore: 0
    };
  }
}

/**
 * R-1: 4-source upgrade. Was tasks-only pre-R-1 (single query against
 * 0008-ap-tasks via 0008-ap-universal-roles-join). Now mirrors
 * getLastActivityPerDomain's gold-standard pattern: tasks + reflections +
 * depositIdeas + commitments, merged by max timestamp per role.
 *
 * Date semantics (locked):
 *   - tasks         → completed_at (status='completed', not deleted)
 *   - reflections   → created_at (archived=false)
 *   - deposit-ideas → created_at (archived=false)
 *   - commitments   → date (date <= today)
 */
export async function getLastActivityPerRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string | null>> {
  const [taskMap, reflectionMap, depositIdeaMap, commitmentMap] = await Promise.all([
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-tasks',
      'task',
      'completed_at',
      (q) => q
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('completed_at', 'is', null),
      'role',
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-reflections',
      'reflection',
      'created_at',
      (q) => q.eq('archived', false),
      'role',
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-deposit-ideas',
      'depositIdea',
      'created_at',
      (q) => q.eq('archived', false),
      'role',
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-commitments',
      'commitment',
      'date',
      (q) => q.lte('date', formatLocalDate(new Date())),
      'role',
    ),
  ]);

  const merged = new Map<string, string | null>();
  for (const src of [taskMap, reflectionMap, depositIdeaMap, commitmentMap]) {
    for (const [roleId, ts] of src) {
      const existing = merged.get(roleId);
      if (!existing || (ts !== null && ts > existing)) {
        merged.set(roleId, ts);
      }
    }
  }
  return merged;
}

/**
 * R-1: 4-source upgrade. Same pattern as getLastActivityPerRole, scope='key_relationship'.
 * Per universal-key-relationships-join production data: KRs have task,
 * reflection, commitment, depositIdea joins (no twelve_wk_goal / 1y_goal).
 */
export async function getLastActivityPerKR(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string | null>> {
  const [taskMap, reflectionMap, depositIdeaMap, commitmentMap] = await Promise.all([
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-tasks',
      'task',
      'completed_at',
      (q) => q
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('completed_at', 'is', null),
      'key_relationship',
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-reflections',
      'reflection',
      'created_at',
      (q) => q.eq('archived', false),
      'key_relationship',
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-deposit-ideas',
      'depositIdea',
      'created_at',
      (q) => q.eq('archived', false),
      'key_relationship',
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-commitments',
      'commitment',
      'date',
      (q) => q.lte('date', formatLocalDate(new Date())),
      'key_relationship',
    ),
  ]);

  const merged = new Map<string, string | null>();
  for (const src of [taskMap, reflectionMap, depositIdeaMap, commitmentMap]) {
    for (const [krId, ts] of src) {
      const existing = merged.get(krId);
      if (!existing || (ts !== null && ts > existing)) {
        merged.set(krId, ts);
      }
    }
  }
  return merged;
}

export async function fetchRoleLinkedGoalIds(
  supabase: SupabaseClient,
  userId: string,
  roleId: string,
): Promise<Set<string>> {
  try {
    const { data: roleTaskLinks, error: roleError } = await supabase
      .from('0008-ap-universal-roles-join')
      .select('parent_id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('parent_type', 'task');

    if (roleError) throw roleError;
    if (!roleTaskLinks?.length) return new Set();

    const taskIds = roleTaskLinks.map(r => r.parent_id);

    const { data: goalLinks, error: goalError } = await supabase
      .from('0008-ap-universal-goals-join')
      .select('goal_id')
      .eq('user_id', userId)
      .eq('parent_type', 'task')
      .in('parent_id', taskIds);

    if (goalError) throw goalError;
    return new Set(goalLinks?.map(g => g.goal_id).filter(Boolean) ?? []);
  } catch (error) {
    console.error('Error fetching role-linked goal IDs:', error);
    return new Set();
  }
}

export async function getLastActivityPerDomain(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string | null>> {
  // Fan out across the four deposit-source tables. Per-source failures are
  // logged and dropped so a single table outage doesn't nuke the whole hub.
  const [taskMap, reflectionMap, depositIdeaMap, commitmentMap] = await Promise.all([
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-tasks',
      'task',
      'completed_at',
      (q) => q
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('completed_at', 'is', null),
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-reflections',
      'reflection',
      'created_at',
      (q) => q.eq('archived', false),
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-deposit-ideas',
      'depositIdea',
      'created_at',
      (q) => q.eq('archived', false),
    ),
    fetchLastActivityForSource(
      supabase, userId,
      '0008-ap-commitments',
      'commitment',
      'date',
      (q) => q.lte('date', formatLocalDate(new Date())),
    ),
  ]);

  const merged = new Map<string, string | null>();
  for (const src of [taskMap, reflectionMap, depositIdeaMap, commitmentMap]) {
    for (const [domainId, ts] of src) {
      const existing = merged.get(domainId);
      if (!existing || (ts !== null && ts > existing)) {
        merged.set(domainId, ts);
      }
    }
  }
  return merged;
}

/**
 * Fan-out helper for last-activity-per-scope queries.
 *
 * R-1: generalized to accept a scopeType discriminator. Default 'domain'
 * preserves existing callers (getLastActivityPerDomain). New role and
 * key-relationship variants (getLastActivityPerRole, getLastActivityPerKR)
 * pass scopeType='role' or 'key_relationship' respectively.
 *
 * The returned Map's keys are the scope-discriminated IDs (domain_id /
 * role_id / key_relationship_id). Values are the latest timestamp per
 * scope.
 */
async function fetchLastActivityForSource(
  supabase: SupabaseClient,
  userId: string,
  sourceTable: string,
  parentType: string,
  timestampField: string,
  applyFilter: (q: any) => any,
  scopeType: 'role' | 'domain' | 'key_relationship' = 'domain',
): Promise<Map<string, string | null>> {
  const joinTable =
    scopeType === 'role' ? '0008-ap-universal-roles-join' :
    scopeType === 'domain' ? '0008-ap-universal-domains-join' :
    '0008-ap-universal-key-relationships-join';
  const idField =
    scopeType === 'role' ? 'role_id' :
    scopeType === 'domain' ? 'domain_id' :
    'key_relationship_id';
  try {
    let sourceQuery = supabase
      .from(sourceTable)
      .select(`id, ${timestampField}`)
      .eq('user_id', userId);
    sourceQuery = applyFilter(sourceQuery);

    const { data: rows, error: rowsError } = await sourceQuery;
    if (rowsError) throw rowsError;
    if (!rows || rows.length === 0) return new Map();

    const tsById = new Map<string, string>();
    for (const r of rows as any[]) {
      const ts = r[timestampField];
      if (ts) tsById.set(r.id as string, String(ts));
    }
    if (tsById.size === 0) return new Map();

    const { data: joinData, error: joinError } = await supabase
      .from(joinTable)
      .select(`${idField}, parent_id`)
      .eq('user_id', userId)
      .eq('parent_type', parentType)
      .in('parent_id', Array.from(tsById.keys()));
    if (joinError) throw joinError;
    if (!joinData) return new Map();

    const result = new Map<string, string | null>();
    for (const row of joinData as any[]) {
      const scopeId = row[idField];
      if (!scopeId) continue;
      const ts = tsById.get(row.parent_id);
      if (!ts) continue;
      const existing = result.get(scopeId);
      if (!existing || ts > existing) {
        result.set(scopeId, ts);
      }
    }
    return result;
  } catch (error) {
    console.error(`Error getting last activity from ${sourceTable} (scope=${scopeType}):`, error);
    return new Map();
  }
}

export async function getToolCountsPerDomain(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, number>> {
  try {
    const { data, error } = await supabase
      .from('0008-ap-tracker-instances')
      .select('domain_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    const result = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.domain_id) continue;
      result.set(row.domain_id, (result.get(row.domain_id) ?? 0) + 1);
    }
    return result;
  } catch (error) {
    console.error('Error getting tool counts per domain:', error);
    return new Map();
  }
}

export function getDaysSince(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
  let then: Date;
  if (isDateOnly) {
    const [y, m, d] = isoDate.split('-').map(Number);
    then = new Date(y, m - 1, d); // local midnight
  } else {
    then = new Date(isoDate);
  }
  if (Number.isNaN(then.getTime())) return null;

  const now = new Date();
  const thenMid = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowMid.getTime() - thenMid.getTime()) / 86_400_000);
}

export function formatDaysAgo(daysSince: number | null): string | null {
  if (daysSince === null) return null;
  if (daysSince <= 0) return 'today';
  if (daysSince === 1) return 'yesterday';
  return `${daysSince} days ago`;
}

export async function getDepositCountsPerDomain(
  supabase: SupabaseClient,
  userId: string,
  days: number = 7,
): Promise<Map<string, number>> {
  // Window: [today - (days-1), today] inclusive, day precision.
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceTimestamp = since.toISOString();
  const sinceDate = formatLocalDate(since);
  const todayDate = formatLocalDate(new Date());

  const [taskMap, reflectionMap, depositIdeaMap, commitmentMap] = await Promise.all([
    fetchDepositCountsForSource(
      supabase, userId,
      '0008-ap-tasks',
      'task',
      (q) => q
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .gte('completed_at', sinceTimestamp),
    ),
    fetchDepositCountsForSource(
      supabase, userId,
      '0008-ap-reflections',
      'reflection',
      (q) => q.eq('archived', false).gte('created_at', sinceTimestamp),
    ),
    fetchDepositCountsForSource(
      supabase, userId,
      '0008-ap-deposit-ideas',
      'depositIdea',
      (q) => q.eq('archived', false).gte('created_at', sinceTimestamp),
    ),
    fetchDepositCountsForSource(
      supabase, userId,
      '0008-ap-commitments',
      'commitment',
      (q) => q.gte('date', sinceDate).lte('date', todayDate),
    ),
  ]);

  const merged = new Map<string, number>();
  for (const src of [taskMap, reflectionMap, depositIdeaMap, commitmentMap]) {
    for (const [domainId, count] of src) {
      merged.set(domainId, (merged.get(domainId) ?? 0) + count);
    }
  }
  return merged;
}

async function fetchDepositCountsForSource(
  supabase: SupabaseClient,
  userId: string,
  sourceTable: string,
  parentType: string,
  applyFilter: (q: any) => any,
): Promise<Map<string, number>> {
  try {
    let sourceQuery = supabase
      .from(sourceTable)
      .select('id')
      .eq('user_id', userId);
    sourceQuery = applyFilter(sourceQuery);

    const { data: rows, error: rowsError } = await sourceQuery;
    if (rowsError) throw rowsError;
    if (!rows || rows.length === 0) return new Map();

    const ids = rows.map((r: any) => r.id as string).filter(Boolean);
    if (ids.length === 0) return new Map();

    const { data: joinData, error: joinError } = await supabase
      .from('0008-ap-universal-domains-join')
      .select('domain_id, parent_id')
      .eq('user_id', userId)
      .eq('parent_type', parentType)
      .in('parent_id', ids);
    if (joinError) throw joinError;
    if (!joinData) return new Map();

    const result = new Map<string, number>();
    for (const row of joinData) {
      if (!row.domain_id) continue;
      result.set(row.domain_id, (result.get(row.domain_id) ?? 0) + 1);
    }
    return result;
  } catch (error) {
    console.error(`Error getting deposit counts from ${sourceTable}:`, error);
    return new Map();
  }
}

/**
 * R-1: Day Streak for a role.
 *
 * Composes fetchActivityDaySetForRoleStreak (lib/roleActivity.ts) with
 * computeStreak (lib/zoneActivity.ts — already scope-agnostic, reused as-is).
 * Returns the count of consecutive days back from today with at least one
 * role-tagged deposit across all 4 sources.
 *
 * Mirrors lib/zoneActivity.ts's streak composition for parity with wellness.
 */
export async function getRoleStreak(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  const days = await fetchActivityDaySetForRoleStreak(supabase, roleId, userId, 365, signal);
  if (signal?.aborted) return 0;
  return computeStreak(days);
}

/**
 * R-1: Last 30 day actions count for a role.
 *
 * Returns the count of role-tagged deposits across 4 sources within the
 * last 30 days (inclusive of today). Thin wrapper over
 * fetchRoleActivity30Days's .count field.
 */
export async function getRoleActionCount30d(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  const result = await fetchRoleActivity30Days(supabase, roleId, userId, signal);
  if (signal?.aborted) return 0;
  return result.count;
}

/**
 * R-1: Active goals count for a role.
 *
 * Counts 12wk + custom goals linked to this role with status='active' AND
 * today within the goal's date window. 1y goals are excluded — per the
 * Spine, 1y goals are planning containers (tasks never link to 1y), and
 * the Stats Row tile counts only "actionable" goals consistent with
 * fetchZoneGoals semantics.
 *
 * Mirrors fetchZoneGoals's date-gating logic (lib/zoneDataService.ts:259-285).
 */
export async function getRoleActiveGoalsCount(
  supabase: SupabaseClient,
  roleId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<number> {
  // Get goal IDs tagged to this role, split by goal type
  const { data: roleJoinData, error: roleJoinError } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id, parent_type')
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .in('parent_type', ['twelve_wk_goal', 'custom_goal']);

  if (roleJoinError) throw roleJoinError;
  if (signal?.aborted) return 0;

  const twelveWkIds: string[] = [];
  const customIds: string[] = [];
  for (const row of roleJoinData ?? []) {
    if (row.parent_type === 'twelve_wk_goal') twelveWkIds.push(row.parent_id);
    else if (row.parent_type === 'custom_goal') customIds.push(row.parent_id);
  }

  if (twelveWkIds.length === 0 && customIds.length === 0) return 0;

  // Date-gate to current cycle: status='active' AND today within window.
  const todayStr = formatLocalDate(new Date());

  const [twelveWkResult, customResult] = await Promise.all([
    twelveWkIds.length
      ? supabase
          .from('0008-ap-goals-12wk')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .in('id', twelveWkIds)
      : { count: 0, error: null },
    customIds.length
      ? supabase
          .from('0008-ap-goals-custom')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .in('id', customIds)
      : { count: 0, error: null },
  ]);

  if (twelveWkResult.error) throw twelveWkResult.error;
  if (customResult.error) throw customResult.error;
  if (signal?.aborted) return 0;

  return (twelveWkResult.count ?? 0) + (customResult.count ?? 0);
}
