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
    const hasVirtualOccurrences = tasks.some(t => (t as any).is_virtual_occurrence);

    if (hasVirtualOccurrences) {
      // Tasks are already expanded by the database view
      return tasks.filter(t => {
        const taskDate = (t as any).occurrence_date || t.start_date || t.due_date;
        return taskDate === date;
      });
    }

    // Legacy path: expand recurrence client-side
    return expandEventsForDate(tasks, date);
  }, [tasks, date]);
}

export function useExpandedTasksForWeek(tasks: Task[], weekDates: Date[]) {
  return useMemo(() => {
    const resultByDate: Record<string, Task[]> = {};
    const hasVirtualOccurrences = tasks.some(t => (t as any).is_virtual_occurrence);

    weekDates.forEach(date => {
      // Get local date string (YYYY-MM-DD) instead of UTC
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      let matchingTasks: Task[];
      if (hasVirtualOccurrences) {
        // Tasks are already expanded by the database view
        matchingTasks = tasks.filter(t => {
          const taskDate = (t as any).occurrence_date || t.start_date || t.due_date;
          // Also include completed tasks where completion date (in local time) matches this date
          if (t.status === 'completed' && (t as any).completed_at) {
            const completedDate = new Date((t as any).completed_at);
            // Get local date string (YYYY-MM-DD) instead of UTC
            const year = completedDate.getFullYear();
            const month = String(completedDate.getMonth() + 1).padStart(2, '0');
            const day = String(completedDate.getDate()).padStart(2, '0');
            const completedDateStr = `${year}-${month}-${day}`;
            if (completedDateStr === dateString) return true;
          }
          return taskDate === dateString;
        });
      } else {
        // Legacy path: expand recurrence client-side
        matchingTasks = expandEventsForDate(tasks, dateString);
      }

      const anytimeTasks = tasks.filter(t =>
        (t.type === 'task') &&
        (t.due_date === dateString || (t as any).occurrence_date === dateString) &&
        (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time))
      );
      resultByDate[dateString] = uniqByIdAndDate([...matchingTasks, ...anytimeTasks]);
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
    // If tasks already contain virtual occurrences from the database view,
    // don't expand them again - just filter by date
    const hasVirtualOccurrences = tasks.some(t => (t as any).is_virtual_occurrence);

    let matchingTasks: Task[];
    if (hasVirtualOccurrences) {
      // Tasks are already expanded by the database view, just filter by date
      matchingTasks = tasks.filter(t => {
        const taskDate = (t as any).occurrence_date || t.start_date || t.due_date;
        // Also include completed tasks where completion date (in local time) matches this date
        if (t.status === 'completed' && (t as any).completed_at) {
          const completedDate = new Date((t as any).completed_at);
          // Get local date string (YYYY-MM-DD) instead of UTC
          const year = completedDate.getFullYear();
          const month = String(completedDate.getMonth() + 1).padStart(2, '0');
          const day = String(completedDate.getDate()).padStart(2, '0');
          const completedDateStr = `${year}-${month}-${day}`;
          if (completedDateStr === date) return true;
        }
        return taskDate === date;
      });
    } else {
      // Legacy path: expand recurrence client-side
      matchingTasks = expandEventsForDate(tasks, date);
    }

    if (!includeAnytime) {
      return matchingTasks;
    }

    // Add anytime tasks for this specific date
    const anytimeTasks = tasks.filter(t =>
      (t.type === 'task') &&
      (t.due_date === date || (t as any).occurrence_date === date) &&
      (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time))
    );

    return uniqByIdAndDate([...matchingTasks, ...anytimeTasks]);
  }, [tasks, date, includeAnytime]);
}
