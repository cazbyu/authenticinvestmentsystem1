import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import {
  fetchZoneUpcoming,
  ZoneUpcomingEvent,
  ZoneUpcomingResult,
  ZoneUpcomingTask,
} from '@/lib/zoneUpcoming';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { Task, TaskCard } from '@/components/tasks/TaskCard';

/**
 * ZoneUpcomingPanel — Minimalist Executive design system
 * Renders the forward-looking task + event list for the MY SPACE >
 * Upcoming tile.
 *
 * Owns its own data fetching (calls fetchZoneUpcoming from 3a, caches
 * in local state, refetches on TASK_* eventBus signals). Tasks use
 * handlers from props (modals + score recompute live in wellness.tsx).
 * Events are read-only in MVP — tap shows an Alert pointing the user
 * at the Calendar tab. No COMMITMENT_* events exist on the bus, so
 * commitment changes don't trigger refetch — acceptable for MVP since
 * upcoming events shouldn't change frequently mid-session.
 *
 * Both rendered as <TaskCard> via type='event' shape mapping (same
 * pattern JournalView and v_user_tasks already use). Adapter functions
 * use spread+override so every source column flows through to TaskCard
 * (description, location, has_notes, has_attachments, delegates, etc.) —
 * the `as Task` cast bridges the null-vs-undefined typing gap at the
 * type boundary.
 */

export interface ZoneUpcomingPanelProps {
  domainId: string;
  userId: string;
  onTaskComplete: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskPress: (task: Task) => void;
}

function taskRowToTask(row: ZoneUpcomingTask): Task {
  return {
    ...row,
    title: row.title ?? '',
    type: row.type ?? 'task',
  } as Task;
}

function eventToTaskShape(event: ZoneUpcomingEvent): Task {
  return {
    ...event,
    type: 'event',
    title: event.title ?? '',
    due_date: event.date ?? undefined,
    start_date: event.date ?? undefined,
  } as Task;
}

function dateKey(t: Task): string {
  return t.due_date ?? '9999-12-31';
}

export function ZoneUpcomingPanel({
  domainId,
  userId,
  onTaskComplete,
  onTaskDelete,
  onTaskPress,
}: ZoneUpcomingPanelProps) {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const result: ZoneUpcomingResult = await fetchZoneUpcoming(
          supabase, domainId, userId, signal,
        );
        if (signal?.aborted) return;
        const merged = [
          ...result.tasks.map(taskRowToTask),
          ...result.events.map(eventToTaskShape),
        ].sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
        setItems(merged);
      } catch (e: any) {
        if (signal?.aborted) return;
        console.error('[ZoneUpcomingPanel] load failed', e);
        setError('Could not load upcoming items.');
        setItems([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [domainId, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Refresh on task-bus signals. No commitment events exist on the bus.
  useEffect(() => {
    const refresh = () => {
      const controller = new AbortController();
      load(controller.signal);
    };
    eventBus.on(EVENTS.TASK_CREATED, refresh);
    eventBus.on(EVENTS.TASK_UPDATED, refresh);
    eventBus.on(EVENTS.TASK_DELETED, refresh);
    eventBus.on(EVENTS.TASK_COMPLETED, refresh);
    eventBus.on(EVENTS.REFRESH_ALL_TASKS, refresh);
    return () => {
      eventBus.off(EVENTS.TASK_CREATED, refresh);
      eventBus.off(EVENTS.TASK_UPDATED, refresh);
      eventBus.off(EVENTS.TASK_DELETED, refresh);
      eventBus.off(EVENTS.TASK_COMPLETED, refresh);
      eventBus.off(EVENTS.REFRESH_ALL_TASKS, refresh);
    };
  }, [load]);

  const handleEventPress = useCallback((_task: Task) => {
    const title = 'Calendar event';
    const message = 'Events are managed from the Calendar tab.';
    if (Platform.OS === 'web') {
      // Alert.alert() does not render on React Native Web; use the
      // browser's native modal (single OK button).
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const handleEventComplete = useCallback((_task: Task) => {
    // Read-only events in MVP — completion is not supported from this
    // panel; calendar tab handles event lifecycle.
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#9ca3af" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Nothing upcoming for this zone.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const isEvent = item.type === 'event';
        return (
          <TaskCard
            key={item.id}
            task={item}
            onComplete={isEvent ? handleEventComplete : onTaskComplete}
            onDelete={isEvent ? undefined : onTaskDelete}
            onPress={isEvent ? handleEventPress : onTaskPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
