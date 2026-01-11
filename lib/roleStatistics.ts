import { SupabaseClient } from '@supabase/supabase-js';
import { calculateAuthenticScoreForPeriod } from './taskUtils';

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
      reflectionsQuery = reflectionsQuery.gte('date', startDate.toISOString().split('T')[0]);
    }
    reflectionsQuery = reflectionsQuery.lte('date', endDate.toISOString().split('T')[0]);

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
