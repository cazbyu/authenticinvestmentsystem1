import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import {
  fetchZoneOverdue,
  ZoneOverdueResult,
  ZoneOverdueTask,
} from '@/lib/zoneOverdue';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { Task, TaskCard } from '@/components/tasks/TaskCard';

/**
 * ZoneOverduePanel — Minimalist Executive design system
 * Renders past-due pending/in_progress tasks for the MY SPACE >
 * Overdue tile.
 *
 * Owns its own data fetching (calls fetchZoneOverdue, caches in
 * local state, refetches on TASK_* eventBus signals). Modal-opening
 * and completion handlers come from props since modals + score
 * recompute live in wellness.tsx — same pattern as ZoneUpcomingPanel.
 *
 * Single source: tasks (no events — overdue is a task-only concept;
 * see lib/zoneOverdue.ts header for rationale). Adapter mirrors the
 * spread+override approach from ZoneUpcomingPanel so every source
 * column flows through to TaskCard untouched.
 */

export interface ZoneOverduePanelProps {
  domainId: string;
  userId: string;
  onTaskComplete: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskPress: (task: Task) => void;
}

function taskRowToTask(row: ZoneOverdueTask): Task {
  return {
    ...row,
    title: row.title ?? '',
    type: row.type ?? 'task',
  } as Task;
}

export function ZoneOverduePanel({
  domainId,
  userId,
  onTaskComplete,
  onTaskDelete,
  onTaskPress,
}: ZoneOverduePanelProps) {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const result: ZoneOverdueResult = await fetchZoneOverdue(
          supabase, domainId, userId, signal,
        );
        if (signal?.aborted) return;
        setItems(result.tasks.map(taskRowToTask));
      } catch (e: any) {
        if (signal?.aborted) return;
        console.error('[ZoneOverduePanel] load failed', e);
        setError('Could not load overdue items.');
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

  // Refresh on task-bus signals.
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
        <Text style={styles.emptyText}>Nothing overdue. Nice.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <TaskCard
          key={item.id}
          task={item}
          onComplete={onTaskComplete}
          onDelete={onTaskDelete}
          onPress={onTaskPress}
        />
      ))}
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
