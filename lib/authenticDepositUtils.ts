import { SupabaseClient } from '@supabase/supabase-js';

export const WEEKLY_AUTHENTIC_LIMIT = 14;

export interface AuthenticUsageData {
  used: number;
  remaining: number;
  weekStart: Date;
  weekEnd: Date;
}

export interface ScopedAuthenticUsage extends AuthenticUsageData {
  scopeCount: number;
  scopeName: string;
}

export type WeekStartDay = 'sunday' | 'monday';

export interface WeekBoundaries {
  weekStart: Date;
  weekEnd: Date;
}

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(pattern?: string): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

export function calculateWeekBoundaries(
  weekStartDay: WeekStartDay,
  referenceDate: Date = new Date()
): WeekBoundaries {
  const current = new Date(referenceDate);
  current.setHours(0, 0, 0, 0);

  const currentDay = current.getDay();
  const targetDay = weekStartDay === 'sunday' ? 0 : 1;

  let daysToSubtract = currentDay - targetDay;
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }

  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setHours(0, 0, 0, 0);

  return { weekStart, weekEnd };
}

export async function fetchUserWeekStartDay(
  supabase: SupabaseClient,
  userId: string
): Promise<WeekStartDay> {
  const cacheKey = `week-start-${userId}`;
  const cached = getCached<WeekStartDay>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('fn_get_user_week_start_day', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error fetching week start day:', error);
    return 'sunday';
  }

  const weekStartDay = (data || 'sunday') as WeekStartDay;
  setCache(cacheKey, weekStartDay);
  return weekStartDay;
}

export async function fetchWeeklyAuthenticCount(
  supabase: SupabaseClient,
  userId: string,
  weekStart?: Date,
  weekEnd?: Date
): Promise<number> {
  let start = weekStart;
  let end = weekEnd;

  if (!start || !end) {
    const weekStartDay = await fetchUserWeekStartDay(supabase, userId);
    const boundaries = calculateWeekBoundaries(weekStartDay);
    start = boundaries.weekStart;
    end = boundaries.weekEnd;
  }

  const cacheKey = `authentic-count-${userId}-${start.toISOString()}-${end.toISOString()}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  const { data, error } = await supabase.rpc('fn_count_weekly_authentic_deposits', {
    p_user_id: userId,
    p_week_start: start.toISOString(),
    p_week_end: end.toISOString(),
  });

  if (error) {
    console.error('Error fetching authentic count:', error);
    return 0;
  }

  const count = data || 0;
  setCache(cacheKey, count);
  return count;
}

export async function fetchAuthenticUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<AuthenticUsageData> {
  const weekStartDay = await fetchUserWeekStartDay(supabase, userId);
  const { weekStart, weekEnd } = calculateWeekBoundaries(weekStartDay);

  const used = await fetchWeeklyAuthenticCount(supabase, userId, weekStart, weekEnd);
  const remaining = Math.max(0, WEEKLY_AUTHENTIC_LIMIT - used);

  return {
    used,
    remaining,
    weekStart,
    weekEnd,
  };
}

export async function fetchScopedAuthenticCount(
  supabase: SupabaseClient,
  userId: string,
  scope: {
    type: 'role' | 'domain' | 'key_relationship';
    id: string;
    name?: string;
  },
  weekStart?: Date,
  weekEnd?: Date
): Promise<number> {
  let start = weekStart;
  let end = weekEnd;

  if (!start || !end) {
    const weekStartDay = await fetchUserWeekStartDay(supabase, userId);
    const boundaries = calculateWeekBoundaries(weekStartDay);
    start = boundaries.weekStart;
    end = boundaries.weekEnd;
  }

  const cacheKey = `scoped-${scope.type}-${scope.id}-${userId}-${start.toISOString()}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  const { data, error } = await supabase.rpc('fn_count_scoped_authentic_deposits', {
    p_user_id: userId,
    p_week_start: start.toISOString(),
    p_week_end: end.toISOString(),
    p_scope_type: scope.type,
    p_scope_id: scope.id,
  });

  if (error) {
    console.error('Error fetching scoped authentic count:', error);
    return 0;
  }

  const count = data || 0;
  setCache(cacheKey, count);
  return count;
}

export async function fetchScopedAuthenticUsage(
  supabase: SupabaseClient,
  userId: string,
  scope: {
    type: 'role' | 'domain' | 'key_relationship';
    id: string;
    name?: string;
  }
): Promise<ScopedAuthenticUsage> {
  const weekStartDay = await fetchUserWeekStartDay(supabase, userId);
  const { weekStart, weekEnd } = calculateWeekBoundaries(weekStartDay);

  const [scopeCount, totalUsed] = await Promise.all([
    fetchScopedAuthenticCount(supabase, userId, scope, weekStart, weekEnd),
    fetchWeeklyAuthenticCount(supabase, userId, weekStart, weekEnd),
  ]);

  const remaining = Math.max(0, WEEKLY_AUTHENTIC_LIMIT - totalUsed);

  return {
    used: totalUsed,
    remaining,
    weekStart,
    weekEnd,
    scopeCount,
    scopeName: scope.name || scope.type,
  };
}

export function canAddAuthenticDeposit(usage: AuthenticUsageData): boolean {
  return usage.remaining > 0;
}

export function getWeekResetDay(weekStartDay: WeekStartDay): string {
  return weekStartDay === 'sunday' ? 'Saturday' : 'Sunday';
}

export function formatAuthenticUsageText(usage: AuthenticUsageData): string {
  return `${usage.used} of ${WEEKLY_AUTHENTIC_LIMIT} used this week`;
}

export function formatScopedAuthenticUsageText(usage: ScopedAuthenticUsage): string {
  return `${usage.scopeCount} for ${usage.scopeName} • ${usage.remaining} of ${WEEKLY_AUTHENTIC_LIMIT} available overall`;
}
