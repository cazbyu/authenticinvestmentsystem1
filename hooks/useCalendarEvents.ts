import { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export type CalendarViewMode = 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  user_id: string;
  parent_task_id: string | null;
  type: 'task' | 'event';
  title: string;
  status: string;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  completed_at: string | null;
  is_urgent: boolean;
  is_important: boolean;
  is_all_day: boolean;
  is_anytime: boolean;
  is_authentic_deposit: boolean;
  user_global_timeline_id: string | null;
  custom_timeline_id: string | null;
  input_kind: string | null;
  recurrence_rule: string | null;
  recurrence_end_date: string | null;
  recurrence_exceptions: any;
  created_at: string;
  updated_at: string;
  occurrence_date: string;
  is_virtual_occurrence: boolean;
  source_task_id: string;
}

export interface CategorizedEvents {
  allDayEvents: CalendarEvent[];
  anytimeTasks: CalendarEvent[];
  timedEvents: CalendarEvent[];
  noTimeTasks: CalendarEvent[];
  allEvents: CalendarEvent[];
}

interface UseCalendarEventsOptions {
  viewMode: CalendarViewMode;
  currentDate: Date;
  weekStartDay?: number; // 0 = Sunday, 1 = Monday
}

function getDateRange(viewMode: CalendarViewMode, currentDate: Date, weekStartDay: number = 0) {
  switch (viewMode) {
    case 'daily':
      return {
        start: startOfDay(currentDate),
        end: endOfDay(currentDate),
      };
    case 'weekly':
      return {
        start: startOfWeek(currentDate, { weekStartsOn: weekStartDay as any }),
        end: endOfWeek(currentDate, { weekStartsOn: weekStartDay as any }),
      };
    case 'monthly':
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
  }
}

function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.id}::${event.occurrence_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function categorizeEvents(events: CalendarEvent[]): CategorizedEvents {
  const allDayEvents: CalendarEvent[] = [];
  const anytimeTasks: CalendarEvent[] = [];
  const timedEvents: CalendarEvent[] = [];
  const noTimeTasks: CalendarEvent[] = [];

  events.forEach((event) => {
    // Events with is_all_day flag
    if (event.type === 'event' && event.is_all_day) {
      allDayEvents.push(event);
    }
    // Tasks with is_anytime flag
    else if (event.type === 'task' && event.is_anytime) {
      anytimeTasks.push(event);
    }
    // Events/Tasks with specific times
    else if (event.start_time || event.end_time) {
      timedEvents.push(event);
    }
    // Tasks without specific times (but not marked as anytime)
    else {
      noTimeTasks.push(event);
    }
  });

  // Sort timed events by start time
  timedEvents.sort((a, b) => {
    const timeA = a.start_time || '00:00:00';
    const timeB = b.start_time || '00:00:00';
    return timeA.localeCompare(timeB);
  });

  return {
    allDayEvents,
    anytimeTasks,
    timedEvents,
    noTimeTasks,
    allEvents: events,
  };
}

export function useCalendarEvents({
  viewMode,
  currentDate,
  weekStartDay = 0,
}: UseCalendarEventsOptions) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        const dateRange = getDateRange(viewMode, currentDate, weekStartDay);

        // Query the unified view with proper filtering
        const { data, error: queryError } = await supabase
          .from('v_tasks_with_recurrence_expanded')
          .select('*')
          .eq('user_id', user.id)
          .gte('occurrence_date', dateRange.start.toISOString().split('T')[0])
          .lte('occurrence_date', dateRange.end.toISOString().split('T')[0])
          .or('is_virtual_occurrence.eq.true,recurrence_rule.is.null'); // Only virtual occurrences OR non-recurring

        if (queryError) throw queryError;

        // Deduplicate and set events
        const deduped = deduplicateEvents((data || []) as CalendarEvent[]);
        setEvents(deduped);
      } catch (err) {
        console.error('Error fetching calendar events:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [viewMode, currentDate, weekStartDay]);

  // Memoize categorized events
  const categorized = useMemo(() => categorizeEvents(events), [events]);

  // Memoize pending tasks for priority calculations
  const pendingTasks = useMemo(
    () => events.filter((e) => e.status !== 'completed'),
    [events]
  );

  return {
    events,
    loading,
    error,
    categorized,
    pendingTasks,
    refetch: () => {
      setLoading(true);
    },
  };
}
