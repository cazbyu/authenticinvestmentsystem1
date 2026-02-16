import { getSupabaseClient } from '@/lib/supabase';

export interface WeeklySummaryRow {
  user_id: string;
  task_id: string;
  task_title: string;
  template_type: string;
  week_start: string;
  entry_count: number;
  total_metric: number | null;
  avg_metric: number | null;
  min_metric: number | null;
  max_metric: number | null;
}

export interface DailySummaryRow {
  user_id: string;
  task_id: string;
  task_title: string;
  log_date: string;
  template_type: string;
  entry_count: number;
  total_metric: number | null;
  entries: Array<{
    id: string;
    primary_metric: number | null;
    details: Record<string, any>;
    notes: string | null;
    created_at: string;
  }>;
}

export async function fetchActivityLogWeeklySummary(
  taskId: string,
  weekCount: number = 12
): Promise<WeeklySummaryRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('v_activity_log_weekly_summary')
    .select('*')
    .eq('task_id', taskId)
    .order('week_start', { ascending: false })
    .limit(weekCount);

  if (error) {
    console.error('[useActivityLogAnalytics] Weekly summary error:', error);
    return [];
  }
  return data || [];
}

export async function fetchActivityLogDailySummary(
  taskId: string,
  startDate: string,
  endDate: string
): Promise<DailySummaryRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('v_activity_log_daily_summary')
    .select('*')
    .eq('task_id', taskId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)
    .order('log_date', { ascending: true });

  if (error) {
    console.error('[useActivityLogAnalytics] Daily summary error:', error);
    return [];
  }
  return data || [];
}
