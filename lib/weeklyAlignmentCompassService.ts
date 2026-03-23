import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

// ============ TYPES ============

export interface WeeklyReportData {
  avg_day_score: number | null;
  morning_sparks_count: number;
  evening_reviews_count: number;
  most_active_role: { role_id: string; role_name: string; count: number } | null;
  goal_execution_rate: number | null;
  active_goal_title: string | null;
}

export interface GoalReviewItem {
  id: string;
  title: string;
  execution_rate: number;
  weeks_remaining: number | null;
  status_tap?: 'on_track' | 'needs_attention' | 'pivoting';
  pivot_note?: string;
}

export interface BigRock {
  title: string;
  task_id: string | null;
  has_calendar_block: boolean;
}

// ============ WEEKLY REPORT ============

export async function getWeeklyReport(userId: string): Promise<WeeklyReportData> {
  const supabase = getSupabaseClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = toLocalISOString(sevenDaysAgo).split('T')[0];

  // Average day score from evening reviews this week
  const { data: scores } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('day_score')
    .eq('user_id', userId)
    .eq('ritual_type', 'evening_review')
    .gte('session_date', sevenDaysAgoStr)
    .not('day_score', 'is', null);

  const avg_day_score = scores && scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + (s.day_score || 0), 0) / scores.length * 100)
    : null;

  // Count morning sparks this week
  const { count: morningCount } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ritual_type', 'morning_spark')
    .gte('session_date', sevenDaysAgoStr);

  // Count evening reviews this week
  const { count: eveningCount } = await supabase
    .from('0008-ap-ritual-sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ritual_type', 'evening_review')
    .gte('session_date', sevenDaysAgoStr);

  // Most active role this week (by role join count)
  const { data: roleJoins } = await supabase
    .from('0008-ap-universal-roles-join')
    .select('role_id')
    .eq('user_id', userId)
    .gte('created_at', toLocalISOString(sevenDaysAgo));

  let most_active_role: WeeklyReportData['most_active_role'] = null;
  if (roleJoins && roleJoins.length > 0) {
    const roleCounts = new Map<string, number>();
    roleJoins.forEach(j => {
      roleCounts.set(j.role_id, (roleCounts.get(j.role_id) || 0) + 1);
    });
    let maxId = '';
    let maxCount = 0;
    roleCounts.forEach((count, id) => {
      if (count > maxCount) { maxId = id; maxCount = count; }
    });
    if (maxId) {
      const { data: roleData } = await supabase
        .from('0008-ap-roles')
        .select('label')
        .eq('id', maxId)
        .maybeSingle();
      most_active_role = {
        role_id: maxId,
        role_name: roleData?.label || 'Unknown',
        count: maxCount,
      };
    }
  }

  // Goal execution rate (same as morning spark)
  let goal_execution_rate: number | null = null;
  let active_goal_title: string | null = null;

  const { data: goal } = await supabase
    .from('0008-ap-goals-12wk')
    .select('id, title')
    .eq('user_id', userId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (goal) {
    active_goal_title = goal.title;
    const { count: completedCount } = await supabase
      .from('0008-ap-tasks')
      .select('id', { count: 'exact', head: true })
      .eq('goal_12wk_id', goal.id)
      .eq('status', 'completed')
      .gte('completed_at', toLocalISOString(sevenDaysAgo));

    const { count: totalCount } = await supabase
      .from('0008-ap-tasks')
      .select('id', { count: 'exact', head: true })
      .eq('goal_12wk_id', goal.id)
      .gte('created_at', toLocalISOString(sevenDaysAgo));

    const total = totalCount || 0;
    const completed = completedCount || 0;
    goal_execution_rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  return {
    avg_day_score,
    morning_sparks_count: morningCount || 0,
    evening_reviews_count: eveningCount || 0,
    most_active_role,
    goal_execution_rate,
    active_goal_title,
  };
}

// ============ GOALS REVIEW ============

export async function getGoalsForReview(userId: string): Promise<GoalReviewItem[]> {
  const supabase = getSupabaseClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: goals } = await supabase
    .from('0008-ap-goals-12wk')
    .select('id, title, end_date')
    .eq('user_id', userId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false });

  if (!goals || goals.length === 0) return [];

  const items: GoalReviewItem[] = [];
  for (const goal of goals) {
    const { count: completedCount } = await supabase
      .from('0008-ap-tasks')
      .select('id', { count: 'exact', head: true })
      .eq('goal_12wk_id', goal.id)
      .eq('status', 'completed')
      .gte('completed_at', toLocalISOString(sevenDaysAgo));

    const { count: totalCount } = await supabase
      .from('0008-ap-tasks')
      .select('id', { count: 'exact', head: true })
      .eq('goal_12wk_id', goal.id)
      .gte('created_at', toLocalISOString(sevenDaysAgo));

    const total = totalCount || 0;
    const completed = completedCount || 0;
    const executionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let weeksRemaining: number | null = null;
    if (goal.end_date) {
      const endDate = new Date(goal.end_date);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      weeksRemaining = Math.ceil(daysRemaining / 7);
    }

    items.push({
      id: goal.id,
      title: goal.title,
      execution_rate: executionRate,
      weeks_remaining: weeksRemaining,
    });
  }

  return items;
}

// ============ BIG ROCKS ============

export async function createBigRockTask(
  userId: string,
  title: string,
  weeklyAlignmentId: string | null,
  dueDate?: string,
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('0008-ap-tasks')
    .insert({
      title,
      user_id: userId,
      status: 'pending',
      type: 'task',
      due_date: dueDate || null,
      weekly_alignment_id: weeklyAlignmentId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ============ DIRECTION TIMESTAMPS ============

export async function updateDirectionTimestamp(
  userId: string,
  weekStartDate: string,
  weekEndDate: string,
  column: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // Try update first
  const { data: existing } = await supabase
    .from('0008-ap-weekly-alignments')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('0008-ap-weekly-alignments')
      .update({ [column]: now })
      .eq('id', existing.id);
  }
}

// ============ SAVE ADDITIONS ============

export async function saveWeeklyAlignmentAdditions(
  userId: string,
  weekStartDate: string,
  data: {
    big_rocks?: BigRock[];
    one_thing?: string;
    weekly_report_data?: WeeklyReportData;
    goals_reviewed?: GoalReviewItem[];
    total_duration_minutes?: number;
  },
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('0008-ap-weekly-alignments')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (existing) {
    const update: Record<string, any> = {};
    if (data.big_rocks !== undefined) update.big_rocks = data.big_rocks;
    if (data.one_thing !== undefined) update.one_thing = data.one_thing;
    if (data.weekly_report_data !== undefined) update.weekly_report_data = data.weekly_report_data;
    if (data.goals_reviewed !== undefined) update.goals_reviewed = data.goals_reviewed;
    if (data.total_duration_minutes !== undefined) update.total_duration_minutes = data.total_duration_minutes;

    if (Object.keys(update).length > 0) {
      await supabase
        .from('0008-ap-weekly-alignments')
        .update(update)
        .eq('id', existing.id);
    }
  }
}
