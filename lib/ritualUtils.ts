import { getSupabaseClient } from './supabase';
import { calculateTaskPoints } from './taskUtils';
import { getUserPreferences } from './userPreferences';
import { formatLocalDate } from './dateUtils';

export type RitualType = 'morning_spark' | 'evening_review' | 'weekly_alignment';

export interface RitualSettings {
  id: string;
  user_id: string;
  ritual_type: RitualType;
  is_enabled: boolean;
  available_from: string;
  available_until: string;
  created_at: string;
  updated_at: string;
}

export interface CardinalInvestment {
  north: number;
  east: number;
  west: number;
  south: number;
}

export async function getRitualSettings(
  userId: string,
  ritualType: RitualType
): Promise<RitualSettings | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('0008-ap-user-ritual-settings')
      .select('*')
      .eq('user_id', userId)
      .eq('ritual_type', ritualType)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching ritual settings for ${ritualType}:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Exception in getRitualSettings for ${ritualType}:`, error);
    return null;
  }
}

export function isWithinTimeWindow(from: string, until: string): boolean {
  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);

    console.log(`[isWithinTimeWindow] Current time: ${currentTime}, Window: ${from} - ${until}`);

    if (from <= until) {
      const result = currentTime >= from && currentTime <= until;
      console.log(`[isWithinTimeWindow] Normal window check result: ${result}`);
      return result;
    } else {
      const result = currentTime >= from || currentTime <= until;
      console.log(`[isWithinTimeWindow] Overnight window check result: ${result}`);
      return result;
    }
  } catch (error) {
    console.error('Error checking time window:', error);
    return true;
  }
}

export function isRitualAvailable(settings: RitualSettings | null): boolean {
  try {
    console.log('[isRitualAvailable] Checking settings:', settings);

    if (!settings) {
      console.log('[isRitualAvailable] No settings, returning true');
      return true;
    }

    if (!settings.is_enabled) {
      console.log('[isRitualAvailable] Ritual is disabled');
      return false;
    }

    if (settings.ritual_type === 'weekly_alignment') {
      const now = new Date();
      const dayOfWeek = now.getDay();
      console.log('[isRitualAvailable] Checking weekly_alignment, day of week:', dayOfWeek);

      const isInBonusWindow = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1;
      console.log('[isRitualAvailable] Is in bonus window (Fri-Mon):', isInBonusWindow);

      if (!isInBonusWindow) {
        console.log('[isRitualAvailable] Not in bonus window, ritual not available');
        return false;
      }
    }

    const inTimeWindow = isWithinTimeWindow(settings.available_from, settings.available_until);
    console.log('[isRitualAvailable] In time window:', inTimeWindow);

    return inTimeWindow;
  } catch (error) {
    console.error('Error checking ritual availability:', error);
    return true;
  }
}

export async function updateRitualSettings(
  userId: string,
  ritualType: RitualType,
  updates: Partial<Pick<RitualSettings, 'is_enabled' | 'available_from' | 'available_until'>>
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('0008-ap-user-ritual-settings')
      .upsert(
        {
          user_id: userId,
          ritual_type: ritualType,
          ...updates,
        },
        { onConflict: 'user_id,ritual_type' }
      );

    if (error) {
      console.error(`Error updating ritual settings for ${ritualType}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Exception in updateRitualSettings for ${ritualType}:`, error);
    return false;
  }
}

export async function hasCompletedRitualToday(
  userId: string,
  ritualType: RitualType
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const today = formatLocalDate(new Date());

    if (ritualType === 'morning_spark') {
      const { data, error } = await supabase
        .from('0008-ap-daily-sparks')
        .select('id')
        .eq('user_id', userId)
        .eq('spark_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking morning spark completion:', error);
        return false;
      }

      return data !== null;
    }

    if (ritualType === 'evening_review') {
      const { data, error } = await supabase
        .from('0008-ap-daily-reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('review_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking evening review completion:', error);
        return false;
      }

      return data !== null;
    }

    if (ritualType === 'weekly_alignment') {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const weekStartDate = formatLocalDate(startOfWeek);

      const { data, error } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('id')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (error) {
        console.error('Error checking weekly alignment completion:', error);
        return false;
      }

      return data !== null;
    }

    return false;
  } catch (error) {
    console.error(`Exception in hasCompletedRitualToday for ${ritualType}:`, error);
    return false;
  }
}

export function getDefaultRitualSettings(ritualType: RitualType): Pick<RitualSettings, 'available_from' | 'available_until' | 'is_enabled'> {
  switch (ritualType) {
    case 'morning_spark':
      return {
        is_enabled: true,
        available_from: '00:00:00',
        available_until: '23:59:59',
      };
    case 'evening_review':
      return {
        is_enabled: true,
        available_from: '17:00:00',
        available_until: '23:59:59',
      };
    case 'weekly_alignment':
      return {
        is_enabled: true,
        available_from: '00:00:00',
        available_until: '23:59:59',
      };
  }
}

export async function shouldShowRitual(
  userId: string,
  ritualType: RitualType
): Promise<boolean> {
  try {
    console.log(`[shouldShowRitual] Checking ${ritualType} for user ${userId}`);

    const settings = await getRitualSettings(userId, ritualType);
    console.log(`[shouldShowRitual] Settings for ${ritualType}:`, settings);

    const settingsToUse = settings || {
      ...getDefaultRitualSettings(ritualType),
      id: '',
      user_id: userId,
      ritual_type: ritualType,
      created_at: '',
      updated_at: '',
    };

    console.log(`[shouldShowRitual] Using settings for ${ritualType}:`, settingsToUse);

    const isAvailable = isRitualAvailable(settingsToUse);
    console.log(`[shouldShowRitual] Is ${ritualType} available:`, isAvailable);

    if (!isAvailable) {
      return false;
    }

    const hasCompleted = await hasCompletedRitualToday(userId, ritualType);
    console.log(`[shouldShowRitual] Has completed ${ritualType} today:`, hasCompleted);

    const shouldShow = !hasCompleted;
    console.log(`[shouldShowRitual] Should show ${ritualType}:`, shouldShow);

    return shouldShow;
  } catch (error) {
    console.error(`Error in shouldShowRitual for ${ritualType}:`, error);
    return true;
  }
}

export async function hasCompletedEveningReviewToday(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const today = formatLocalDate(new Date());

    const { data, error } = await supabase
      .from('0008-ap-daily-reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('review_date', today)
      .maybeSingle();

    if (error) {
      console.error('Error checking evening review completion:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('Exception in hasCompletedEveningReviewToday:', error);
    return false;
  }
}

export async function hasCompletedWeeklyAlignmentThisWeek(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const prefs = await getUserPreferences(userId);

    const weekStartDay = prefs?.week_start_day || 'sunday';
    const today = new Date();
    const dayOfWeek = today.getDay();

    let daysToWeekStart: number;
    if (weekStartDay === 'sunday') {
      daysToWeekStart = -dayOfWeek;
    } else {
      daysToWeekStart = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    }

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToWeekStart);
    weekStart.setHours(0, 0, 0, 0);

    const weekStartDate = formatLocalDate(weekStart);

    const { data, error } = await supabase
      .from('0008-ap-weekly-alignments')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    if (error) {
      console.error('Error checking weekly alignment completion:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('Exception in hasCompletedWeeklyAlignmentThisWeek:', error);
    return false;
  }
}

export async function calculateDominantCardinal(
  userId: string,
  date: string
): Promise<'north' | 'east' | 'west' | 'south' | null> {
  try {
    const supabase = getSupabaseClient();

    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: completedTasks, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('completed_at', startOfDay)
      .lte('completed_at', endOfDay);

    if (tasksError) {
      console.error('Error fetching completed tasks:', tasksError);
      return null;
    }

    if (!completedTasks || completedTasks.length === 0) {
      return null;
    }

    const taskIds = completedTasks.map(t => t.id);

    const [goalsResult, domainsResult, rolesResult] = await Promise.all([
      supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id')
        .in('parent_id', taskIds)
        .eq('parent_type', 'task'),
      supabase
        .from('0008-ap-universal-domains-join')
        .select('parent_id')
        .in('parent_id', taskIds)
        .eq('parent_type', 'task'),
      supabase
        .from('0008-ap-universal-roles-join')
        .select('parent_id')
        .in('parent_id', taskIds)
        .eq('parent_type', 'task'),
    ]);

    if (goalsResult.error || domainsResult.error || rolesResult.error) {
      console.error('Error fetching task linkages:', {
        goals: goalsResult.error,
        domains: domainsResult.error,
        roles: rolesResult.error,
      });
      return null;
    }

    const goalsSet = new Set((goalsResult.data || []).map(g => g.parent_id));
    const domainsSet = new Set((domainsResult.data || []).map(d => d.parent_id));
    const rolesSet = new Set((rolesResult.data || []).map(r => r.parent_id));

    const cardinalCounts: CardinalInvestment = {
      north: 0,
      east: 0,
      west: 0,
      south: 0,
    };

    taskIds.forEach(taskId => {
      const hasGoals = goalsSet.has(taskId);
      const hasDomains = domainsSet.has(taskId);
      const hasRoles = rolesSet.has(taskId);
      const hasNoLinks = !hasGoals && !hasDomains && !hasRoles;

      if (hasGoals) cardinalCounts.north++;
      if (hasDomains) cardinalCounts.east++;
      if (hasRoles) cardinalCounts.west++;
      if (hasNoLinks) cardinalCounts.south++;
    });

    const maxCount = Math.max(
      cardinalCounts.north,
      cardinalCounts.east,
      cardinalCounts.west,
      cardinalCounts.south
    );

    if (maxCount === 0) {
      return null;
    }

    const dominants = [
      cardinalCounts.north === maxCount ? 'north' as const : null,
      cardinalCounts.east === maxCount ? 'east' as const : null,
      cardinalCounts.west === maxCount ? 'west' as const : null,
      cardinalCounts.south === maxCount ? 'south' as const : null,
    ].filter(Boolean);

    if (dominants.length > 1) {
      return null;
    }

    return dominants[0] || null;
  } catch (error) {
    console.error('Exception in calculateDominantCardinal:', error);
    return null;
  }
}

export async function calculateDailyScore(
  userId: string,
  date: string
): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    let totalScore = 0;

    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: completedTasks, error: tasksError } = await supabase
      .from('0008-ap-tasks')
      .select('id, is_urgent, is_important')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('completed_at', startOfDay)
      .lte('completed_at', endOfDay);

    if (tasksError) {
      console.error('Error fetching completed tasks for scoring:', tasksError);
      return 0;
    }

    if (completedTasks && completedTasks.length > 0) {
      const taskIds = completedTasks.map(t => t.id);

      const [rolesResult, domainsResult, goalsResult] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(id, label)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain:0008-ap-domains(id, name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, goal_type, tw:0008-ap-goals-12wk(id, status), cg:0008-ap-goals-custom(id, status)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
      ]);

      const rolesMap = new Map<string, any[]>();
      (rolesResult.data || []).forEach(r => {
        if (!rolesMap.has(r.parent_id)) rolesMap.set(r.parent_id, []);
        if (r.role) rolesMap.get(r.parent_id)!.push(r.role);
      });

      const domainsMap = new Map<string, any[]>();
      (domainsResult.data || []).forEach(d => {
        if (!domainsMap.has(d.parent_id)) domainsMap.set(d.parent_id, []);
        if (d.domain) domainsMap.get(d.parent_id)!.push(d.domain);
      });

      const goalsMap = new Map<string, any[]>();
      (goalsResult.data || []).forEach(g => {
        if (!goalsMap.has(g.parent_id)) goalsMap.set(g.parent_id, []);
        const goal = g.goal_type === 'twelve_wk_goal' ? g.tw : g.cg;
        if (goal && goal.status !== 'archived' && goal.status !== 'cancelled') {
          goalsMap.get(g.parent_id)!.push({ ...goal, goal_type: g.goal_type });
        }
      });

      completedTasks.forEach(task => {
        const roles = rolesMap.get(task.id) || [];
        const domains = domainsMap.get(task.id) || [];
        const goals = goalsMap.get(task.id) || [];

        const taskPoints = calculateTaskPoints(task, roles, domains, goals);
        totalScore += taskPoints;
      });
    }

    const { data: sparkData, error: sparkError } = await supabase
      .from('0008-ap-daily-sparks')
      .select('id')
      .eq('user_id', userId)
      .eq('spark_date', date)
      .maybeSingle();

    if (!sparkError && sparkData !== null) {
      totalScore += 10;
    }

    const { data: reviewData, error: reviewError } = await supabase
      .from('0008-ap-daily-reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('review_date', date)
      .maybeSingle();

    if (!reviewError && reviewData !== null) {
      totalScore += 10;
    }

    return Math.round(totalScore * 10) / 10;
  } catch (error) {
    console.error('Exception in calculateDailyScore:', error);
    return 0;
  }
}

export function isWeeklyAlignmentWindowOpen(): boolean {
  const today = new Date().getDay();
  return today === 5 || today === 6 || today === 0 || today === 1;
}

export function getWeeklyAlignmentPoints(): number {
  const today = new Date().getDay();
  const isInWindow = today === 5 || today === 6 || today === 0 || today === 1;
  return isInWindow ? 50 : 10;
}

export async function calculateWeekBounds(userId: string): Promise<{ weekStart: string; weekEnd: string }> {
  try {
    const prefs = await getUserPreferences(userId);
    const weekStartDay = prefs?.week_start_day || 'sunday';

    const today = new Date();
    const dayOfWeek = today.getDay();

    let daysToWeekStart: number;
    if (weekStartDay === 'sunday') {
      daysToWeekStart = -dayOfWeek;
    } else {
      daysToWeekStart = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    }

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToWeekStart);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return {
      weekStart: formatLocalDate(weekStart),
      weekEnd: formatLocalDate(weekEnd)
    };
  } catch (error) {
    console.error('Exception in calculateWeekBounds:', error);
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToSunday = -dayOfWeek;

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToSunday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return {
      weekStart: formatLocalDate(weekStart),
      weekEnd: formatLocalDate(weekEnd)
    };
  }
}
