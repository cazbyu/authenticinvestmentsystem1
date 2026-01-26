/**
 * Week Utilities for Action Effort Modal
 * Handles partial week calculations and availability
 */

export interface ProcessedWeek {
  week_number: number;
  start_date: string;
  end_date: string;
  available_days: number;
  is_partial: boolean;
}

/**
 * Calculate the number of days in a week based on start and end dates
 * Only used for custom timelines where weeks might be partial
 */
export function calculateDaysInWeek(weekStart: string, weekEnd: string): number {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(weekEnd + 'T23:59:59');
  
  // Calculate difference in days (inclusive of both start and end)
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Clamp to 1-7 days
  return Math.max(1, Math.min(7, diffDays));
}

/**
 * Get effective target days based on selected frequency and available days in the week
 * Only applies capping for partial weeks
 */
export function getEffectiveTargetDays(
  selectedTargetDays: number,
  weekStart: string,
  weekEnd: string,
  isPartialWeek: boolean
): number {
  if (!isPartialWeek) {
    return selectedTargetDays;
  }
  
  const availableDays = calculateDaysInWeek(weekStart, weekEnd);
  return Math.min(selectedTargetDays, availableDays);
}

/**
 * Process weeks and calculate availability for each
 * 
 * @param cycleWeeks - Array of weeks from the timeline
 * @param timelineSource - 'global' or 'custom' - global timelines always have full weeks
 * @returns Array of processed weeks with availability info
 */
export function processWeeksWithAvailability(
  cycleWeeks: Array<{ week_number: number; start_date: string; end_date: string }>,
  timelineSource: 'global' | 'custom' = 'global'
): ProcessedWeek[] {
  // Global 12-week cycles always have full 7-day weeks
  if (timelineSource === 'global') {
    return cycleWeeks.map(week => ({
      week_number: week.week_number,
      start_date: week.start_date,
      end_date: week.end_date,
      available_days: 7,
      is_partial: false,
    }));
  }

  // For custom timelines, check first and last weeks for partial days
  return cycleWeeks.map((week, index) => {
    const isFirstWeek = index === 0;
    const isLastWeek = index === cycleWeeks.length - 1;
    
    // Only first and last weeks of custom timelines can be partial
    let available_days = 7;
    let is_partial = false;
    
    if (isFirstWeek || isLastWeek) {
      available_days = calculateDaysInWeek(week.start_date, week.end_date);
      is_partial = available_days < 7;
    }
    
    return {
      week_number: week.week_number,
      start_date: week.start_date,
      end_date: week.end_date,
      available_days,
      is_partial,
    };
  });
}