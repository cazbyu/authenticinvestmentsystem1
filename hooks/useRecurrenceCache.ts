import { useMemo } from 'react';
import { expandEventsForDate } from '@/lib/recurrenceUtils';

interface Task {
  id: string;
  recurrence_rule?: string;
  start_date?: string;
  due_date?: string;
  [key: string]: any;
}

const uniqByIdAndDate = <T extends { id: string; start_date?: string; due_date?: string; occurrence_date?: string }>(arr: T[]) => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const dateKey = (item as any).occurrence_date || (item as any).date || item.start_date || item.due_date || '';
    const k = `${item.id}::${dateKey}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
};

export function useExpandedTasksForDate(tasks: Task[], date: string) {
  return useMemo(() => {
    return expandEventsForDate(tasks, date);
  }, [tasks, date]);
}

export function useExpandedTasksForWeek(tasks: Task[], weekDates: Date[]) {
  return useMemo(() => {
    const resultByDate: Record<string, Task[]> = {};

    weekDates.forEach(date => {
      const dateString = date.toISOString().split('T')[0];
      const expandedEvents = expandEventsForDate(tasks, dateString);
      const anytimeTasks = tasks.filter(t =>
        (t.type === 'task') &&
        (t.due_date === dateString) &&
        (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time))
      );
      resultByDate[dateString] = uniqByIdAndDate([...expandedEvents, ...anytimeTasks]);
    });

    return resultByDate;
  }, [tasks, weekDates]);
}

export function useExpandedTasksWithAnytime(
  tasks: Task[],
  date: string,
  includeAnytime: boolean = true
) {
  return useMemo(() => {
    const expandedEvents = expandEventsForDate(tasks, date);

    if (!includeAnytime) {
      return expandedEvents;
    }

    const anytimeTasks = tasks.filter(t =>
      (t.type === 'task') &&
      (t.due_date === date) &&
      (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time))
    );

    return uniqByIdAndDate([...expandedEvents, ...anytimeTasks]);
  }, [tasks, date, includeAnytime]);
}
