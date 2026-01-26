// lib/timePickerUtils.ts

/**
 * Round a time to the nearest 15-minute interval
 */
export function roundToNearest15Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 15;
  
  if (remainder !== 0) {
    // Round up to next 15-minute mark
    rounded.setMinutes(minutes + (15 - remainder));
  }
  
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  
  return rounded;
}

/**
 * Get default start time (current time rounded to nearest 15 min)
 */
export function getDefaultStartTime(): { hours: number; minutes: number } {
  const now = new Date();
  const rounded = roundToNearest15Minutes(now);
  return {
    hours: rounded.getHours(),
    minutes: rounded.getMinutes(),
  };
}

/**
 * Get default end time (start time + 30 minutes)
 */
export function getDefaultEndTime(startHours: number, startMinutes: number): { hours: number; minutes: number } {
  let endHours = startHours;
  let endMinutes = startMinutes + 30;
  
  if (endMinutes >= 60) {
    endMinutes -= 60;
    endHours += 1;
  }
  
  if (endHours >= 24) {
    endHours = 23;
    endMinutes = 59;
  }
  
  return { hours: endHours, minutes: endMinutes };
}

/**
 * Format hours and minutes for display (12-hour format with AM/PM)
 */
export function formatTimeDisplay(hours: number, minutes: number): string {
  const isPM = hours >= 12;
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${isPM ? 'PM' : 'AM'}`;
}

/**
 * Format hours and minutes for database storage (HH:MM:SS)
 */
export function formatTimeForDB(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/**
 * Parse a database time string (HH:MM:SS) into hours and minutes
 */
export function parseDBTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  
  return { hours, minutes };
}

/**
 * Generate time options for picker (15-minute intervals)
 */
export function generateTimeOptions(): Array<{ label: string; hours: number; minutes: number }> {
  const options: Array<{ label: string; hours: number; minutes: number }> = [];
  
  for (let hours = 0; hours < 24; hours++) {
    for (let minutes = 0; minutes < 60; minutes += 15) {
      options.push({
        label: formatTimeDisplay(hours, minutes),
        hours,
        minutes,
      });
    }
  }
  
  return options;
}