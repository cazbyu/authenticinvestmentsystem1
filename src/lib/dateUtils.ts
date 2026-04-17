/**
 * Date utilities for handling local dates without timezone shifts
 */

/**
 * Checks if a string is a valid ISO date string
 */
export function isValidISODate(dateString?: string | null): boolean {
  if (!dateString || dateString === 'null' || typeof dateString !== 'string') {
    return false;
  }
  return !isNaN(Date.parse(dateString));
}

/**
 * Formats a date as YYYY-MM-DD using local time (no UTC conversion)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date as an ISO string with local timezone offset
 */
export function toLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  const timezoneOffset = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const offsetMinutes = Math.abs(timezoneOffset) % 60;
  const offsetSign = timezoneOffset >= 0 ? '+' : '-';
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
}

/**
 * Parses a YYYY-MM-DD string as a local date (no timezone conversion)
 */
export function parseLocalDate(dateString: string): Date {
  if (typeof dateString !== 'string' || dateString.trim() === '') {
    return new Date(NaN);
  }
  const datePart = dateString.split('T')[0];

  const parts = datePart.split('-');
  if (parts.length !== 3) {
    return new Date(NaN);
  }

  const [year, month, day] = parts.map(Number);
  if ([year, month, day].some((n) => Number.isNaN(n))) {
    return new Date(NaN);
  }

  return new Date(year, month - 1, day);
}

/**
 * Gets the start of the week for a given date and week start preference
 */
export function getWeekStart(date: Date, weekStartDay: 'sunday' | 'monday' = 'sunday'): Date {
  const d = new Date(date);
  const currentDay = d.getDay();
  const targetDay = weekStartDay === 'sunday' ? 0 : 1;

  let daysToSubtract = currentDay - targetDay;
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }

  d.setDate(d.getDate() - daysToSubtract);
  return d;
}

/**
 * Gets the end of the week for a given date and week start preference
 */
export function getWeekEnd(date: Date, weekStartDay: 'sunday' | 'monday' = 'sunday'): Date {
  const weekStart = getWeekStart(date, weekStartDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
}
