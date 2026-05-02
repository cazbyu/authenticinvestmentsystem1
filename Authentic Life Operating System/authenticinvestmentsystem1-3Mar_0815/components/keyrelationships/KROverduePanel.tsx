import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import {
  fetchKROverdue,
  KROverdueResult,
  KROverdueTask,
} from '@/lib/krOverdue';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { Task, TaskCard } from '@/components/tasks/TaskCard';

/**
 * KROverduePanel — R-6-components-B sibling of components/roles/RoleOverduePanel.tsx.
 *
 * Renders past-due pending/in_progress tasks for the KR-side
 * MY SPACE > Overdue tile.
 *
 * Owns its own data fetching (calls fetchKROverdue from R-6-lib, caches
 * in local state, refetches on TASK_* eventBus signals). Modal-opening
 * and completion handlers come from props since modals + score recompute
 * live in roles.tsx — same pattern as KRUpcomingPanel.
 *
 * Single source: tasks (no events — overdue is a task-only concept;
 * see lib/krOverdue.ts header for rationale, mirroring zoneOverdue.ts /
 * roleOverdue.ts).
 */

export interface KROverduePanelProps {
  krId: string;
  userId: string;
  onTaskComplete: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskPress: (task: Task) => void;
}

function taskRowToTask(row: KROverdueTask): Task {
  return {
    ...row,
    title: row.title ?? '',
    type: row.type ?? 'task',
  } as Task;
}

export function KROverduePanel({
  krId,
  userId,
  onTaskComplete,
  onTaskDelete,
  onTaskPress,
}: KROverduePanelProps) {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const result: KROverdueResult = await fetchKROverdue(
          supabase, krId, userId, signal,
        );
        if (signal?.aborted) return;
        setItems(result.tasks.map(taskRowToTask));
      } catch (e: any) {
        if (signal?.aborted) return;
        console.error('[KROverduePanel] load failed', e);
        setError('Could not load overdue items.');
        setItems([]);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [krId, userId],
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
