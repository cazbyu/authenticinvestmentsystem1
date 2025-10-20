export interface ParsedRRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  byday?: string[];
  bymonthday?: number;
  bysetpos?: number;
  count?: number;
  until?: string;
}

export function parseRRule(rrule: string): ParsedRRule | null {
  if (!rrule) return null;

  const parts = rrule.split(';');
  const parsed: Partial<ParsedRRule> = {
    interval: 1,
  };

  for (const part of parts) {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        parsed.freq = value as ParsedRRule['freq'];
        break;
      case 'INTERVAL':
        parsed.interval = parseInt(value, 10);
        break;
      case 'BYDAY':
        parsed.byday = value.split(',');
        break;
      case 'BYMONTHDAY':
        parsed.bymonthday = parseInt(value, 10);
        break;
      case 'BYSETPOS':
        parsed.bysetpos = parseInt(value, 10);
        break;
      case 'COUNT':
        parsed.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        parsed.until = value;
        break;
    }
  }

  if (!parsed.freq) return null;
  return parsed as ParsedRRule;
}

export function buildRRule(options: {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  byday?: string[];
  bymonthday?: number;
  bysetpos?: number;
  count?: number;
  until?: string;
}): string {
  const parts: string[] = [`FREQ=${options.freq}`];

  if (options.interval && options.interval > 1) {
    parts.push(`INTERVAL=${options.interval}`);
  }

  if (options.byday && options.byday.length > 0) {
    parts.push(`BYDAY=${options.byday.join(',')}`);
  }

  if (options.bymonthday !== undefined) {
    parts.push(`BYMONTHDAY=${options.bymonthday}`);
  }

  if (options.bysetpos !== undefined) {
    parts.push(`BYSETPOS=${options.bysetpos}`);
  }

  if (options.count !== undefined) {
    parts.push(`COUNT=${options.count}`);
  }

  if (options.until) {
    parts.push(`UNTIL=${options.until}`);
  }

  return parts.join(';');
}

export function calculateNextOccurrence(
  startDate: Date,
  rrule: string,
  recurrenceEndDate?: string | null,
  recurrenceExceptions?: string[]
): Date | null {
  const parsed = parseRRule(rrule);
  if (!parsed) return null;

  const endDate = recurrenceEndDate ? new Date(recurrenceEndDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const exceptions = new Set(recurrenceExceptions || []);
  let currentDate = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let iterations = 0;
  const maxIterations = 1000;

  while (currentDate <= endDate && iterations < maxIterations) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (currentDate >= today && !exceptions.has(dateStr)) {
      return currentDate;
    }

    currentDate = getNextDate(currentDate, parsed);
    iterations++;
  }

  return null;
}

function getNextDate(date: Date, parsed: ParsedRRule): Date {
  const next = new Date(date);

  switch (parsed.freq) {
    case 'DAILY':
      next.setDate(next.getDate() + parsed.interval);
      break;

    case 'WEEKLY':
      if (parsed.byday && parsed.byday.length > 0) {
        const dayMap: Record<string, number> = {
          SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
        };
        const targetDays = parsed.byday.map(d => dayMap[d]).sort((a, b) => a - b);
        const currentDay = next.getDay();

        let nextDay = targetDays.find(d => d > currentDay);
        if (nextDay === undefined) {
          nextDay = targetDays[0];
          next.setDate(next.getDate() + (7 * parsed.interval) - currentDay + nextDay);
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay));
        }
      } else {
        next.setDate(next.getDate() + (7 * parsed.interval));
      }
      break;

    case 'MONTHLY':
      if (parsed.bymonthday !== undefined) {
        next.setMonth(next.getMonth() + parsed.interval);
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(parsed.bymonthday > 0 ? parsed.bymonthday : lastDay + parsed.bymonthday + 1, lastDay));
      } else if (parsed.byday && parsed.bysetpos !== undefined) {
        next.setMonth(next.getMonth() + parsed.interval);
        const nthWeekday = getNthWeekdayOfMonth(next.getFullYear(), next.getMonth(), parsed.byday[0], parsed.bysetpos);
        if (nthWeekday) {
          next.setDate(nthWeekday.getDate());
        }
      } else {
        const dayOfMonth = date.getDate();
        next.setMonth(next.getMonth() + parsed.interval);
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDay));
      }
      break;

    case 'YEARLY':
      next.setFullYear(next.getFullYear() + parsed.interval);
      break;
  }

  return next;
}

function getNthWeekdayOfMonth(year: number, month: number, dayCode: string, n: number): Date | null {
  const dayMap: Record<string, number> = {
    SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
  };
  const targetDay = dayMap[dayCode];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const occurrences: Date[] = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === targetDay) {
      occurrences.push(new Date(d));
    }
  }

  if (n > 0 && n <= occurrences.length) {
    return occurrences[n - 1];
  } else if (n < 0 && Math.abs(n) <= occurrences.length) {
    return occurrences[occurrences.length + n];
  }

  return null;
}

export function generateOccurrenceDates(
  startDate: Date,
  rrule: string,
  recurrenceEndDate?: string | null,
  recurrenceExceptions?: string[],
  maxCount: number = 100
): Date[] {
  const parsed = parseRRule(rrule);
  if (!parsed) return [];

  const endDate = recurrenceEndDate
    ? new Date(recurrenceEndDate)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const exceptions = new Set(recurrenceExceptions || []);
  const occurrences: Date[] = [];
  let currentDate = new Date(startDate);
  let count = 0;

  while (currentDate <= endDate && count < maxCount && (!parsed.count || count < parsed.count)) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (!exceptions.has(dateStr)) {
      occurrences.push(new Date(currentDate));
      count++;
    }

    currentDate = getNextDate(currentDate, parsed);
  }

  return occurrences;
}

export function calculateEndDateFromCount(
  startDate: Date,
  rrule: string,
  count: number
): Date | null {
  const parsed = parseRRule(rrule);
  if (!parsed) return null;

  let currentDate = new Date(startDate);
  let occurrenceCount = 1; // Start counting from 1, as startDate is the first occurrence

  // If count is 1, the end date is the start date
  if (count === 1) {
    return currentDate;
  }

  // Advance through remaining occurrences
  while (occurrenceCount < count) {
    currentDate = getNextDate(currentDate, parsed);
    occurrenceCount++;
  }

  return currentDate;
}

export function describeRRule(rrule: string): string {
  const parsed = parseRRule(rrule);
  if (!parsed) return 'No recurrence';

  const parts: string[] = [];

  switch (parsed.freq) {
    case 'DAILY':
      parts.push(parsed.interval === 1 ? 'Daily' : `Every ${parsed.interval} days`);
      break;
    case 'WEEKLY':
      if (parsed.byday) {
        const dayNames: Record<string, string> = {
          SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat'
        };
        const days = parsed.byday.map(d => dayNames[d]).join(', ');
        parts.push(parsed.interval === 1 ? `Weekly on ${days}` : `Every ${parsed.interval} weeks on ${days}`);
      } else {
        parts.push(parsed.interval === 1 ? 'Weekly' : `Every ${parsed.interval} weeks`);
      }
      break;
    case 'MONTHLY':
      if (parsed.bymonthday) {
        const suffix = getOrdinalSuffix(parsed.bymonthday);
        parts.push(parsed.interval === 1 ? `Monthly on the ${parsed.bymonthday}${suffix}` : `Every ${parsed.interval} months on the ${parsed.bymonthday}${suffix}`);
      } else if (parsed.byday && parsed.bysetpos) {
        const dayNames: Record<string, string> = {
          SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday'
        };
        const ordinal = parsed.bysetpos === -1 ? 'last' : `${parsed.bysetpos}${getOrdinalSuffix(parsed.bysetpos)}`;
        parts.push(parsed.interval === 1 ? `Monthly on the ${ordinal} ${dayNames[parsed.byday[0]]}` : `Every ${parsed.interval} months on the ${ordinal} ${dayNames[parsed.byday[0]]}`);
      } else {
        parts.push(parsed.interval === 1 ? 'Monthly' : `Every ${parsed.interval} months`);
      }
      break;
    case 'YEARLY':
      parts.push(parsed.interval === 1 ? 'Yearly' : `Every ${parsed.interval} years`);
      break;
  }

  if (parsed.count) {
    parts.push(`(${parsed.count} times)`);
  } else if (parsed.until) {
    const date = new Date(parsed.until);
    parts.push(`until ${date.toLocaleDateString()}`);
  }

  return parts.join(' ');
}

function getOrdinalSuffix(n: number): string {
  const absN = Math.abs(n);
  const lastDigit = absN % 10;
  const lastTwoDigits = absN % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
