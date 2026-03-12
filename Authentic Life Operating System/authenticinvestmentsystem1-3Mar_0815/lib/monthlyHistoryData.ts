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

export interface ItemDetail {
  type: 'rose' | 'thorn' | 'reflection' | 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'note';
  title: string;
  has_notes?: boolean;
  goal_title?: string | null;
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
  itemDetails: ItemDetail[];
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
      itemDetails: item.item_details || [],
    }));
  } catch (error) {
    console.error('Error in fetchMonthlyDates:', error);
    return [];
  }
}

export async function fetchDatesByRange(
  startDate: Date,
  endDate: Date
): Promise<DateWithContent[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const { data, error } = await supabase.rpc('get_dates_with_items_by_range', {
      p_start_date: formatDate(startDate),
      p_end_date: formatDate(endDate),
      p_user_id: user.id,
    });

    if (error) {
      console.error('Error fetching dates by range:', error);
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
      itemDetails: item.item_details || [],
    }));
  } catch (error) {
    console.error('Error in fetchDatesByRange:', error);
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
