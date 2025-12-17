import { supabase } from './supabase';
import { formatLocalDate, getWeekStart, getWeekEnd } from './dateUtils';

export type TimePeriod = 'today' | 'week' | 'month';

export interface ActionMetrics {
  completed: number;
  total: number;
  completionRate: number;
}

export interface GoalMetrics {
  inProgress: number;
  completed: number;
  total: number;
}

export interface RoleMetrics {
  activeRoles: number;
  totalRoles: number;
  balanceScore: number;
}

export interface ReflectionMetrics {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
}

export interface DashboardMetrics {
  actions: ActionMetrics;
  goals: GoalMetrics;
  roles: RoleMetrics;
  reflections: ReflectionMetrics;
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

async function fetchActionMetrics(
  profileId: string,
  period: TimePeriod
): Promise<ActionMetrics> {
  const { start, end } = getDateRange(period);

  const { data: actions, error } = await supabase
    .from('actions')
    .select('id, completed_at')
    .eq('profile_id', profileId)
    .eq('is_deleted', false)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) {
    console.error('Error fetching action metrics:', error);
    return { completed: 0, total: 0, completionRate: 0 };
  }

  const total = actions?.length || 0;
  const completed = actions?.filter(a => a.completed_at !== null).length || 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, completionRate };
}

async function fetchGoalMetrics(
  profileId: string,
  period: TimePeriod
): Promise<GoalMetrics> {
  const { start, end } = getDateRange(period);

  const { data: goals, error } = await supabase
    .from('goals')
    .select('id, status')
    .eq('profile_id', profileId)
    .eq('is_deleted', false)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) {
    console.error('Error fetching goal metrics:', error);
    return { inProgress: 0, completed: 0, total: 0 };
  }

  const total = goals?.length || 0;
  const inProgress = goals?.filter(g => g.status === 'in_progress').length || 0;
  const completed = goals?.filter(g => g.status === 'completed').length || 0;

  return { inProgress, completed, total };
}

async function fetchRoleMetrics(profileId: string): Promise<RoleMetrics> {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, is_active')
    .eq('profile_id', profileId)
    .eq('is_deleted', false);

  if (error) {
    console.error('Error fetching role metrics:', error);
    return { activeRoles: 0, totalRoles: 0, balanceScore: 0 };
  }

  const totalRoles = roles?.length || 0;
  const activeRoles = roles?.filter(r => r.is_active).length || 0;

  const balanceScore = totalRoles > 0 ? Math.round((activeRoles / totalRoles) * 100) : 0;

  return { activeRoles, totalRoles, balanceScore };
}

async function fetchReflectionMetrics(
  profileId: string,
  period: TimePeriod
): Promise<ReflectionMetrics> {
  const { start, end } = getDateRange(period);

  const { data: reflections, error } = await supabase
    .from('reflections')
    .select('id, reflection_type')
    .eq('profile_id', profileId)
    .eq('is_deleted', false)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (error) {
    console.error('Error fetching reflection metrics:', error);
    return { daily: 0, weekly: 0, monthly: 0, total: 0 };
  }

  const daily = reflections?.filter(r => r.reflection_type === 'daily').length || 0;
  const weekly = reflections?.filter(r => r.reflection_type === 'weekly').length || 0;
  const monthly = reflections?.filter(r => r.reflection_type === 'monthly').length || 0;
  const total = reflections?.length || 0;

  return { daily, weekly, monthly, total };
}

export async function fetchDashboardMetrics(
  profileId: string,
  period: TimePeriod = 'week'
): Promise<DashboardMetrics> {
  const [actions, goals, roles, reflections] = await Promise.all([
    fetchActionMetrics(profileId, period),
    fetchGoalMetrics(profileId, period),
    fetchRoleMetrics(profileId),
    fetchReflectionMetrics(profileId, period)
  ]);

  return {
    actions,
    goals,
    roles,
    reflections
  };
}
