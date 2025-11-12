import { getSupabaseClient } from './supabase';

export interface MonthlyStatistics {
  monthStart: string;
  monthYear: string;
  year: number;
  month: number;
  reflectionsCount: number;
  tasksCount: number;
  eventsCount: number;
  depositIdeasCount: number;
  withdrawalsCount: number;
  totalItems: number;
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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchMonthlyStatistics(
  forceRefresh: boolean = false
): Promise<MonthlyStatistics[]> {
  const now = Date.now();

  if (
    !forceRefresh &&
    monthlyStatsCache &&
    cacheTimestamp &&
    now - cacheTimestamp < CACHE_DURATION
  ) {
    return monthlyStatsCache;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // 🔹 This must call the new SQL function we just fixed
    const { data, error } = await supabase.rpc('get_history_month_summaries', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Error fetching monthly statistics:', error);
      throw error;
    }

    const formattedData: MonthlyStatistics[] = (data || []).map((item: any) => ({
      monthStart: item.month_start,
      monthYear: formatMonthYear(item.year, item.month),
      year: item.year,
      month: item.month,
      reflectionsCount: Number(item.reflections_count),
      tasksCount: Number(item.tasks_count),
      eventsCount: Number(item.events_count),
      depositIdeasCount: Number(item.deposit_ideas_count),
      withdrawalsCount: Number(item.withdrawals_count),
      totalItems: Number(item.total_items),
    }));

    monthlyStatsCache = formattedData;
    cacheTimestamp = now;

    return formattedData;
  } catch (error) {
    console.error('Error in fetchMonthlyStatistics:', error);
    return [];
  }
}

export async function fetchMonthlyDates(
  year: number,
  month: number
): Promise<DateWithContent[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('get_month_dates_with_items', {
      p_year: year,
      p_month: month,
      p_user_id: user.id,
    });

    if (error) {
      console.error('Error fetching monthly dates:', error);
      throw error;
    }

    return (data || []).map((item: any) => ({
      itemDate: item.item_date,
      reflectionsCount: Number(item.reflections_count),
      tasksCount: Number(item.tasks_count),
      eventsCount: Number(item.events_count),
      depositIdeasCount: Number(item.deposit_ideas_count),
      withdrawalsCount: Number(item.withdrawals_count),
      notesCount: Number(item.notes_count),
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

// 🔹 This is what the card & hover should use
export function getTotalItemsForMonth(stats: MonthlyStatistics): number {
  return stats.totalItems;
}
