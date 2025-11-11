import { getSupabaseClient } from './supabase';

export interface MonthlyStatistics {
  monthYear: string;
  year: number;
  month: number;
  reflectionsCount: number;
  tasksCount: number;
  eventsCount: number;
  depositIdeasCount: number;
  withdrawalsCount: number;
  followUpItemsCount: number;
}

export interface DateWithContent {
  itemDate: string;
  reflectionsCount: number;
  tasksCount: number;
  eventsCount: number;
  depositIdeasCount: number;
  withdrawalsCount: number;
  notesCount: number;
  contentSummary: string;
}

let monthlyStatsCache: MonthlyStatistics[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

export async function fetchMonthlyStatistics(forceRefresh: boolean = false): Promise<MonthlyStatistics[]> {
  const now = Date.now();

  if (!forceRefresh && monthlyStatsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return monthlyStatsCache;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('get_monthly_item_counts', {
      p_user_id: user.id
    });

    if (error) {
      console.error('Error fetching monthly statistics:', error);
      throw error;
    }

    const formattedData: MonthlyStatistics[] = (data || []).map((item: any) => ({
      monthYear: item.month_year,
      year: item.year,
      month: item.month,
      reflectionsCount: parseInt(item.reflections_count, 10),
      tasksCount: parseInt(item.tasks_count, 10),
      eventsCount: parseInt(item.events_count, 10),
      depositIdeasCount: parseInt(item.deposit_ideas_count, 10),
      withdrawalsCount: parseInt(item.withdrawals_count, 10),
      followUpItemsCount: parseInt(item.follow_up_items_count, 10),
    }));

    monthlyStatsCache = formattedData;
    cacheTimestamp = now;

    return formattedData;
  } catch (error) {
    console.error('Error in fetchMonthlyStatistics:', error);
    return [];
  }
}

export async function fetchMonthlyDates(year: number, month: number): Promise<DateWithContent[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('get_month_dates_with_items', {
      p_year: year,
      p_month: month,
      p_user_id: user.id
    });

    if (error) {
      console.error('Error fetching monthly dates:', error);
      throw error;
    }

    return (data || []).map((item: any) => ({
      itemDate: item.item_date,
      reflectionsCount: parseInt(item.reflections_count, 10),
      tasksCount: parseInt(item.tasks_count, 10),
      eventsCount: parseInt(item.events_count, 10),
      depositIdeasCount: parseInt(item.deposit_ideas_count, 10),
      withdrawalsCount: parseInt(item.withdrawals_count, 10),
      notesCount: parseInt(item.notes_count, 10),
      contentSummary: item.content_summary,
    }));
  } catch (error) {
    console.error('Error in fetchMonthlyDates:', error);
    return [];
  }
}

export function invalidateMonthlyStatsCache(): void {
  monthlyStatsCache = null;
  cacheTimestamp = null;
}

export function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getTotalItemsForMonth(stats: MonthlyStatistics): number {
  return (
    stats.reflectionsCount +
    stats.tasksCount +
    stats.eventsCount +
    stats.depositIdeasCount +
    stats.withdrawalsCount
  );
}
