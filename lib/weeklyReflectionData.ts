import { getSupabaseClient } from './supabase';
import {
  WeeklyGoalProgress,
  WeeklyRoleInvestment,
  WeeklyDomainBalance,
  WeeklyWithdrawalAnalysis,
  WeeklyAggregationData,
  DailyAggregationData,
  GoalActionSummary,
} from '@/types/reflections';
import { formatLocalDate } from './dateUtils';

/**
 * Get week date range using database function
 * This ensures consistency with database week calculations
 */
export const getWeekDateRange = (date: Date = new Date()): { start: string; end: string } => {
  const current = new Date(date);
  const dayOfWeek = current.getDay();

  const start = new Date(current);
  start.setDate(current.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const getDayDateRange = (date: Date = new Date()): { start: string; end: string } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

/**
 * Fetch goal actions summary using v_weekly_goal_actions view
 * MUCH faster than the old implementation - single query instead of N queries in loop
 */
export const fetchGoalActionsSummary = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<GoalActionSummary[]> => {
  const supabase = getSupabaseClient();

  // Extract date-only part for view query
  const weekStartDate = startDate.split('T')[0];

  console.log('[fetchGoalActionsSummary] Querying view with date:', weekStartDate);

  const { data, error } = await supabase
    .from('v_weekly_goal_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .eq('goal_status', 'active')
    .gt('action_count', 0);

  if (error) {
    console.error('Error fetching goal actions from view:', error);
    return [];
  }

  console.log('[fetchGoalActionsSummary] Found', data?.length || 0, 'goals with actions');

  return (data || []).map(row => ({
    goal_id: row.goal_id,
    goal_title: row.goal_title,
    action_count: row.action_count,
  }));
};

/**
 * Fetch weekly goal progress using v_weekly_goal_actions view
 */
export const fetchWeeklyGoalProgress = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyGoalProgress[]> => {
  const supabase = getSupabaseClient();
  const weekStartDate = weekStart.split('T')[0];

  const { data, error } = await supabase
    .from('v_weekly_goal_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .eq('goal_status', 'active');

  if (error) {
    console.error('Error fetching weekly goal progress:', error);
    return [];
  }

  return (data || []).map(row => ({
    goal_id: row.goal_id,
    goal_title: row.goal_title,
    goal_type: row.goal_type,
    weekly_target: row.weekly_target || 0,
    actual_completion: row.action_count,
    completion_percentage: row.weekly_target > 0
      ? Math.round((row.action_count / row.weekly_target) * 100)
      : 0,
  }));
};

/**
 * Fetch weekly role investments using v_weekly_role_investments view
 */
export const fetchWeeklyRoleInvestments = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyRoleInvestment[]> => {
  const supabase = getSupabaseClient();
  const weekStartDate = weekStart.split('T')[0];

  const { data, error } = await supabase
    .from('v_weekly_role_investments')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .gt('total_activities', 0)
    .order('total_activities', { ascending: false });

  if (error) {
    console.error('Error fetching role investments:', error);
    return [];
  }

  return (data || []).map(row => ({
    role_id: row.role_id,
    role_label: row.role_label,
    role_color: row.role_color,
    task_count: row.task_count,
    deposit_idea_count: row.deposit_idea_count,
  }));
};

/**
 * Fetch weekly domain balance using v_weekly_domain_balance view
 */
export const fetchWeeklyDomainBalance = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyDomainBalance[]> => {
  const supabase = getSupabaseClient();
  const weekStartDate = weekStart.split('T')[0];

  const { data, error } = await supabase
    .from('v_weekly_domain_balance')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .order('activity_count', { ascending: false });

  if (error) {
    console.error('Error fetching domain balance:', error);
    return [];
  }

  return (data || []).map(row => ({
    domain_id: row.domain_id,
    domain_name: row.domain_name,
    domain_color: null, // Domain table doesn't have color column
    activity_count: row.activity_count,
  }));
};

/**
 * Fetch weekly withdrawal analysis using v_weekly_withdrawal_by_role view
 */
export const fetchWeeklyWithdrawalAnalysis = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyWithdrawalAnalysis[]> => {
  const supabase = getSupabaseClient();
  const weekStartDate = weekStart.split('T')[0];

  const { data, error } = await supabase
    .from('v_weekly_withdrawal_by_role')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .order('withdrawal_count', { ascending: false });

  if (error) {
    console.error('Error fetching withdrawal analysis:', error);
    return [];
  }

  return (data || []).map(row => ({
    role_id: row.role_id,
    role_label: row.role_label,
    withdrawal_count: row.withdrawal_count,
    total_amount: row.total_amount,
  }));
};

/**
 * Fetch complete weekly aggregation data
 * Now uses views for much better performance
 */
export const fetchWeeklyAggregationData = async (
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyAggregationData> => {
  const [goalProgress, roleInvestments, domainBalance, withdrawalAnalysis] = await Promise.all([
    fetchWeeklyGoalProgress(userId, weekStart, weekEnd),
    fetchWeeklyRoleInvestments(userId, weekStart, weekEnd),
    fetchWeeklyDomainBalance(userId, weekStart, weekEnd),
    fetchWeeklyWithdrawalAnalysis(userId, weekStart, weekEnd),
  ]);

  const totalTargetsHit = goalProgress.filter(g => g.completion_percentage >= 100).length;
  const totalGoalsTracked = goalProgress.length;

  return {
    goalProgress,
    roleInvestments,
    domainBalance,
    withdrawalAnalysis,
    totalTargetsHit,
    totalGoalsTracked,
  };
};

/**
 * Fetch daily goal actions summary using v_daily_goal_actions view
 */
export const fetchDailyGoalActionsSummary = async (
  userId: string,
  date: string
): Promise<GoalActionSummary[]> => {
  const supabase = getSupabaseClient();

  // Extract date-only part for daily view query
  const activityDate = date.split('T')[0];

  console.log('[fetchDailyGoalActionsSummary] Querying view with date:', activityDate);

  const { data, error } = await supabase
    .from('v_daily_goal_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('completion_date', activityDate)
    .eq('goal_status', 'active')
    .gt('action_count', 0);

  if (error) {
    console.error('Error fetching daily goal actions from view:', error);
    return [];
  }

  console.log('[fetchDailyGoalActionsSummary] Found', data?.length || 0, 'goals with actions');

  return (data || []).map(row => ({
    goal_id: row.goal_id,
    goal_title: row.goal_title,
    action_count: row.action_count,
  }));
};

/**
 * Fetch daily role investments using v_daily_role_investments view
 */
export const fetchDailyRoleInvestments = async (
  userId: string,
  date: string
): Promise<WeeklyRoleInvestment[]> => {
  const supabase = getSupabaseClient();
  const activityDate = date.split('T')[0];

  const { data, error } = await supabase
    .from('v_daily_role_investments')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_date', activityDate)
    .gt('total_activities', 0)
    .order('total_activities', { ascending: false });

  if (error) {
    console.error('Error fetching daily role investments:', error);
    return [];
  }

  return (data || []).map(row => ({
    role_id: row.role_id,
    role_label: row.role_label,
    role_color: row.role_color,
    task_count: row.task_count,
    deposit_idea_count: row.deposit_idea_count,
  }));
};

/**
 * Fetch daily domain balance using v_daily_domain_balance view
 */
export const fetchDailyDomainBalance = async (
  userId: string,
  date: string
): Promise<WeeklyDomainBalance[]> => {
  const supabase = getSupabaseClient();
  const activityDate = date.split('T')[0];

  const { data, error } = await supabase
    .from('v_daily_domain_balance')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_date', activityDate)
    .order('activity_count', { ascending: false });

  if (error) {
    console.error('Error fetching daily domain balance:', error);
    return [];
  }

  return (data || []).map(row => ({
    domain_id: row.domain_id,
    domain_name: row.domain_name,
    domain_color: null,
    activity_count: row.activity_count,
  }));
};

/**
 * Fetch daily aggregation data
 */
export const fetchDailyAggregationData = async (
  userId: string,
  dayStart: string,
  dayEnd: string,
  targetDate?: string
): Promise<DailyAggregationData> => {
  const supabase = getSupabaseClient();

  const normalizedTargetDate = targetDate ? targetDate.split('T')[0] : dayStart.split('T')[0];

  console.log('[fetchDailyAggregationData] Fetching data for date:', normalizedTargetDate);

  const goalSummaries = await fetchDailyGoalActionsSummary(userId, targetDate ?? dayStart);
  const roleInvestments = await fetchDailyRoleInvestments(userId, targetDate ?? dayStart);
  const domainBalance = await fetchDailyDomainBalance(userId, targetDate ?? dayStart);

  console.log('[fetchDailyAggregationData] Data fetched:', {
    goalSummaries: goalSummaries.length,
    roleInvestments: roleInvestments.length,
    domainBalance: domainBalance.length,
  });

  const { data: withdrawals, error: withdrawalsError } = await supabase
    .from('0008-ap-withdrawals')
    .select('id, amount, withdrawn_at')
    .eq('user_id', userId)
    .gte('withdrawn_at', dayStart)
    .lt('withdrawn_at', dayEnd);

  if (withdrawalsError) {
    console.error('Error fetching withdrawals:', withdrawalsError);
  }

  const filteredWithdrawals = (withdrawals || []).filter((withdrawal) => {
    if (!withdrawal.withdrawn_at) {
      return false;
    }

    const withdrawalDate = new Date(withdrawal.withdrawn_at);
    const withdrawalDateString = formatLocalDate(withdrawalDate);
    return withdrawalDateString === normalizedTargetDate;
  });

  console.log('[fetchDailyAggregationData] Found', filteredWithdrawals.length, 'withdrawals for', normalizedTargetDate);

  let withdrawalRoles: { role_label: string; count: number }[] = [];
  let withdrawalDomains: { domain_name: string; count: number }[] = [];
  const totalWithdrawals = filteredWithdrawals.length;

  if (filteredWithdrawals.length > 0) {
    const roleMap = new Map<string, { label: string; count: number }>();
    const domainMap = new Map<string, { name: string; count: number }>();

    for (const withdrawal of filteredWithdrawals) {
      const [{ data: roleJoins }, { data: domainJoins }] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('role_id, 0008-ap-roles(label)')
          .eq('parent_type', 'withdrawal')
          .eq('parent_id', withdrawal.id),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('domain_id, 0008-ap-domains(name)')
          .eq('parent_type', 'withdrawal')
          .eq('parent_id', withdrawal.id),
      ]);

      if (roleJoins) {
        for (const join of roleJoins) {
          const roleLabel = (join as any)['0008-ap-roles']?.label || 'Unknown';
          const existing = roleMap.get(join.role_id) || { label: roleLabel, count: 0 };
          existing.count += 1;
          roleMap.set(join.role_id, existing);
        }
      }

      if (domainJoins) {
        for (const join of domainJoins) {
          const domainName = (join as any)['0008-ap-domains']?.name || 'Unknown';
          const existing = domainMap.get(join.domain_id) || { name: domainName, count: 0 };
          existing.count += 1;
          domainMap.set(join.domain_id, existing);
        }
      }
    }

    withdrawalRoles = Array.from(roleMap.values())
      .map(r => ({ role_label: r.label, count: r.count }))
      .sort((a, b) => b.count - a.count);

    withdrawalDomains = Array.from(domainMap.values())
      .map(d => ({ domain_name: d.name, count: d.count }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    goalSummaries,
    roleInvestments,
    domainBalance,
    withdrawalRoles,
    withdrawalDomains,
    totalWithdrawals,
  };
};
