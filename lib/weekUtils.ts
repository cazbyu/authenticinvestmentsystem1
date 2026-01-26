// lib/weekUtils.ts
import { parseLocalDate } from './dateUtils';

/**
 * Calculate the number of days available in a week
 * For partial weeks (first/last week of a timeline), this may be less than 7
 */
export function calculateDaysInWeek(weekStart: string, weekEnd: string): number {
  const start = parseLocalDate(weekStart);
  const end = parseLocalDate(weekEnd);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 7; // Default to full week if dates are invalid
  }
  
  // Calculate difference in days (inclusive, so add 1)
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Clamp between 1 and 7
  return Math.max(1, Math.min(7, diffDays));
}

/**
 * Get the effective target days for a week, capping at available days
 * Example: User selects "Daily" (7) but week only has 3 days → returns 3
 */
export function getEffectiveTargetDays(
  selectedTargetDays: number,
  weekStart: string,
  weekEnd: string
): number {
  const availableDays = calculateDaysInWeek(weekStart, weekEnd);
  return Math.min(selectedTargetDays, availableDays);
}

/**
 * Process cycle weeks to include available days information
 */
export interface ProcessedWeek {
  week_number: number;
  start_date: string;
  end_date: string;
  available_days: number;
  is_partial: boolean;
}

export function processWeeksWithAvailability(
  cycleWeeks: Array<{ week_number: number; start_date: string; end_date: string }>
): ProcessedWeek[] {
  return cycleWeeks.map(week => {
    const availableDays = calculateDaysInWeek(week.start_date, week.end_date);
    return {
      ...week,
      available_days: availableDays,
      is_partial: availableDays < 7,
    };
  });
}