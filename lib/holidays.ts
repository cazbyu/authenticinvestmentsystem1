export interface Holiday {
  id: string;
  name: string;
  month: number;
  day: number;
  color: string;
  category: 'federal' | 'religious' | 'observance';
  enabled: boolean;
}

export const US_HOLIDAYS: Holiday[] = [
  { id: 'new-year', name: "New Year's Day", month: 1, day: 1, color: '#0078d4', category: 'federal', enabled: true },
  { id: 'mlk-day', name: 'Martin Luther King Jr. Day', month: 1, day: 15, color: '#6b7280', category: 'federal', enabled: true },
  { id: 'presidents-day', name: "Presidents' Day", month: 2, day: 19, color: '#dc2626', category: 'federal', enabled: true },
  { id: 'memorial-day', name: 'Memorial Day', month: 5, day: 27, color: '#dc2626', category: 'federal', enabled: true },
  { id: 'juneteenth', name: 'Juneteenth', month: 6, day: 19, color: '#059669', category: 'federal', enabled: true },
  { id: 'independence-day', name: 'Independence Day', month: 7, day: 4, color: '#dc2626', category: 'federal', enabled: true },
  { id: 'labor-day', name: 'Labor Day', month: 9, day: 2, color: '#0078d4', category: 'federal', enabled: true },
  { id: 'columbus-day', name: 'Columbus Day', month: 10, day: 14, color: '#0078d4', category: 'federal', enabled: true },
  { id: 'veterans-day', name: 'Veterans Day', month: 11, day: 11, color: '#dc2626', category: 'federal', enabled: true },
  { id: 'thanksgiving', name: 'Thanksgiving', month: 11, day: 28, color: '#f59e0b', category: 'federal', enabled: true },
  { id: 'christmas', name: 'Christmas Day', month: 12, day: 25, color: '#dc2626', category: 'religious', enabled: true },
  { id: 'valentines-day', name: "Valentine's Day", month: 2, day: 14, color: '#ec4899', category: 'observance', enabled: false },
  { id: 'st-patricks-day', name: "St. Patrick's Day", month: 3, day: 17, color: '#059669', category: 'observance', enabled: false },
  { id: 'easter', name: 'Easter Sunday', month: 4, day: 20, color: '#a855f7', category: 'religious', enabled: false },
  { id: 'mothers-day', name: "Mother's Day", month: 5, day: 12, color: '#ec4899', category: 'observance', enabled: false },
  { id: 'fathers-day', name: "Father's Day", month: 6, day: 16, color: '#3b82f6', category: 'observance', enabled: false },
  { id: 'halloween', name: 'Halloween', month: 10, day: 31, color: '#f97316', category: 'observance', enabled: false },
];

export function getHolidaysForMonth(year: number, month: number, enabledHolidays: string[]): Array<{ date: string; name: string; color: string }> {
  return US_HOLIDAYS
    .filter(holiday => holiday.month === month && enabledHolidays.includes(holiday.id))
    .map(holiday => ({
      date: `${year}-${String(month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`,
      name: holiday.name,
      color: holiday.color,
    }));
}

export function getHolidaysForYear(year: number, enabledHolidays: string[]): Array<{ date: string; name: string; color: string }> {
  const holidays: Array<{ date: string; name: string; color: string }> = [];

  for (let month = 1; month <= 12; month++) {
    holidays.push(...getHolidaysForMonth(year, month, enabledHolidays));
  }

  return holidays;
}
