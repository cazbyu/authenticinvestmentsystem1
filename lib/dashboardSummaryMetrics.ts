import { supabase } from './supabase';
import { formatLocalDate, getWeekStart, getWeekEnd } from './dateUtils';

export type TimePeriod = 'today' | 'week' | 'month';

export interface DashboardMetrics {
  tasks: number;
  events: number;
  depositIdeas: number;
  roses: number;
  thorns: number;
  reflections: number;
}

function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();

  switch (period) {
    case 'today':
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return { start: todayStart, end: todayEnd };

    case 'week':
      return {
        start: getWeekStart(now, 'monday'),
        end: getWeekEnd(now, 'monday')
      };

    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: monthStart, end: monthEnd };
  }
}

export async function fetchDashboardMetrics(
  userId: string,
  period: TimePeriod = 'week'
): Promise<DashboardMetrics> {
  const { start, end } = getDateRange(period);
  const startStr = formatLocalDate(start);
  const endStr = formatLocalDate(end);

  try {
    const [
      tasksResult,
      eventsResult,
      depositIdeasResult,
      rosesResult,
      thornsResult,
      reflectionsResult
    ] = await Promise.all([
      supabase
        .from('0008-ap-tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'task')
        .in('status', ['pending', 'in_progress'])
        .is('deleted_at', null)
        .gte('due_date', startStr)
        .lte('due_date', endStr),

      supabase
        .from('0008-ap-tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'event')
        .in('status', ['pending', 'in_progress'])
        .is('deleted_at', null)
        .gte('due_date', startStr)
        .lte('due_date', endStr),

      supabase
        .from('0008-ap-deposit-ideas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('archived', false),

      supabase
        .from('0008-ap-reflections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('reflection_type', 'rose')
        .is('deleted_at', null)
        .gte('reflection_date', startStr)
        .lte('reflection_date', endStr),

      supabase
        .from('0008-ap-reflections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('reflection_type', 'thorn')
        .is('deleted_at', null)
        .gte('reflection_date', startStr)
        .lte('reflection_date', endStr),

      supabase
        .from('0008-ap-reflections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('reflection_type', 'reflection')
        .is('deleted_at', null)
        .gte('reflection_date', startStr)
        .lte('reflection_date', endStr)
    ]);

    return {
      tasks: tasksResult.count || 0,
      events: eventsResult.count || 0,
      depositIdeas: depositIdeasResult.count || 0,
      roses: rosesResult.count || 0,
      thorns: thornsResult.count || 0,
      reflections: reflectionsResult.count || 0
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return {
      tasks: 0,
      events: 0,
      depositIdeas: 0,
      roses: 0,
      thorns: 0,
      reflections: 0
    };
  }
}
