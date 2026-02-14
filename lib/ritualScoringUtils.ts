import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ritual and Reflection Scoring Utilities
 * Implements Special Teams scoring for the Authentic Investment System v1.0
 */

/**
 * Calculate Morning Spark Points
 * Early Spark: +10 if before user's set time
 * Late Spark: +5 if after set time (same day)
 */
export function calculateMorningSparkPoints(
  completedAt: Date,
  userSetTime: string // e.g. "06:00:00"
): number {
  const completionTime = completedAt.getHours() * 60 + completedAt.getMinutes();
  const [setHours, setMinutes] = userSetTime.split(':').map(Number);
  const setTimeMinutes = setHours * 60 + setMinutes;

  if (completionTime < setTimeMinutes) {
    return 10; // Early Spark
  } else {
    return 5; // Late Spark
  }
}

/**
 * Calculate Evening Review Points
 * The Closer: +10 if completed before midnight
 */
export function calculateEveningReviewPoints(completedAt: Date): number {
  const hour = completedAt.getHours();

  // Before midnight (00:00 next day)
  // Since we're checking same-day completion, hour should be < 24
  if (hour < 24 && hour >= 0) {
    return 10; // The Closer
  }

  return 0; // No points if completed after midnight
}

/**
 * Calculate Reflection Points
 * Base: +1 per reflection (max 10/day)
 * First Rose Bonus: +1 additional for first rose of the day
 * Total possible from first rose: +2 (base +1, bonus +1)
 */
export function calculateReflectionPoints(
  reflectionType: 'rose' | 'thorn' | 'reflection',
  isFirstRoseToday: boolean,
  totalReflectionsToday: number
): number {
  // Max 10 reflections per day count for points
  if (totalReflectionsToday >= 10) {
    return 0;
  }

  let points = 1; // Base reflection point

  // First Rose bonus
  if (reflectionType === 'rose' && isFirstRoseToday) {
    points += 1; // First Rose bonus
  }

  return points;
}

/**
 * Calculate Aspiration Points
 * Tiered rewards: 1st: +5, 2nd: +3, 3rd: +1
 * Max 3 aspirations per day earn points (total +9 possible)
 */
export function calculateAspirationPoints(
  aspirationCountToday: number
): number {
  // Tiered rewards based on count for today
  if (aspirationCountToday === 0) {
    return 5; // First aspiration
  } else if (aspirationCountToday === 1) {
    return 3; // Second aspiration
  } else if (aspirationCountToday === 2) {
    return 1; // Third aspiration
  }

  return 0; // Max 3 aspirations per day earn points
}

/**
 * Calculate Question Response Points
 * Same as reflection: +1 per response (max 10/day combined with reflections)
 * Questions answered during Morning Spark earn the same points as creating a reflection.
 */
export function calculateQuestionResponsePoints(
  totalQuestionsAndReflectionsToday: number
): number {
  // Max 10 combined reflections + question responses per day count for points
  if (totalQuestionsAndReflectionsToday >= 10) {
    return 0;
  }
  return 1; // Same as base reflection point
}

/**
 * Calculate Beat the Target Bonus
 * Awarded at midnight if daily score > target score
 * Returns +10 if target was beaten, 0 otherwise
 */
export function calculateBeatTargetBonus(
  dailyScore: number,
  targetScore: number
): number {
  return dailyScore > targetScore ? 10 : 0;
}

/**
 * Get user's morning spark time preference
 */
export async function getUserMorningSparkTime(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('0008-ap-user-preferences')
    .select('morning_spark_time')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data || !data.morning_spark_time) {
    return '06:00:00'; // Default
  }

  return data.morning_spark_time;
}

/**
 * Check if this is the first rose of the day for a user
 */
export async function isFirstRoseOfDay(
  supabase: SupabaseClient,
  userId: string,
  date: string // ISO date string (YYYY-MM-DD)
): Promise<boolean> {
  const { data, error } = await supabase
    .from('0008-ap-reflections')
    .select('id')
    .eq('user_id', userId)
    .eq('note_type', 'rose')
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`)
    .eq('is_first_rose_of_day', true)
    .maybeSingle();

  if (error) {
    console.error('Error checking first rose of day:', error);
    return false;
  }

  // If no rose exists yet, this will be the first
  return !data;
}

/**
 * Get total reflection count for a day
 */
export async function getTotalReflectionsToday(
  supabase: SupabaseClient,
  userId: string,
  date: string // ISO date string (YYYY-MM-DD)
): Promise<number> {
  const { data, error } = await supabase
    .from('0008-ap-reflections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`);

  if (error) {
    console.error('Error getting total reflections:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get aspiration count for today
 */
export async function getAspirationCountToday(
  supabase: SupabaseClient,
  userId: string,
  date: string // ISO date string (YYYY-MM-DD)
): Promise<number> {
  const { data, error } = await supabase
    .from('0008-ap-aspirations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`);

  if (error) {
    console.error('Error getting aspiration count:', error);
    return 0;
  }

  return data?.length || 0;
}
