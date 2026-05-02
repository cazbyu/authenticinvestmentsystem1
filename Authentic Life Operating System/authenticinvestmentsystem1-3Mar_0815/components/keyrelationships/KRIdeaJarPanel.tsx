import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchKRIdeas } from '@/lib/zoneDataService';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';

/**
 * KRIdeaJarPanel — R-6-components-B sibling of components/roles/RoleIdeaJarPanel.tsx.
 *
 * Renders the deposit-idea list for the KR-side MY SPACE > Idea Jar tile.
 *
 * Owns its own data fetching (calls fetchKRIdeas from R-6-lib's
 * zoneDataService extension, caches in local state, refetches on relevant
 * eventBus signals). Modal-opening handlers come from props since modals
 * live in roles.tsx.
 *
 * Subscribes to:
 *   - DEPOSIT_IDEA_CREATED  (a new idea was added)
 *   - DEPOSIT_IDEA_UPDATED  (an existing idea changed; e.g., cancel)
 *   - TASK_CREATED          (an idea was activated → became a task,
 *                            which makes it disappear from the jar)
 *   - REFRESH_ALL_TASKS     (broad refresh signal)
 *
 * B18 inheritance: explicitly pass no-op onActivate handler to satisfy
 * DepositIdeaCard's prop interface. The wellness twin (ZoneIdeaJarPanel)
 * omits this prop and carries the resulting tsc error as B18; the role
 * twin and KR twin both ship clean with the no-op workaround. When B18
 * is fixed in wellness, all three IdeaJarPanels (Zone/Role/KR) should
 * converge on the canonical handler shape (likely a panel-owned
 * activation flow rather than a no-op).
 */

export interface KRIdeaJarPanelProps {
  krId: string;
  userId: string;
  onUpdate: (depositIdea: any) => void;
  onCancel: (depositIdea: any) => void;
  onPress: (depositIdea: any) => void;
}

export function KRIdeaJarPanel({
  krId,
  userId,
  onUpdate,
  onCancel,
  onPress,
}: KRIdeaJarPanelProps) {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const data = await fetchKRIdeas(supabase, krId, userId, signal);
        if (signal?.aborted) return;
        setIdeas(data ?? []);
      } catch (e: any) {
        if (signal?.aborted) return;
        console.error('[KRIdeaJarPanel] load failed', e);
        setError('Could not load ideas.');
        setIdeas([]);
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

  // Refresh on relevant eventBus signals.
  useEffect(() => {
    const refresh = () => {
      const controller = new AbortController();
      load(controller.signal);
    };
    eventBus.on(EVENTS.DEPOSIT_IDEA_CREATED, refresh);
    eventBus.on(EVENTS.DEPOSIT_IDEA_UPDATED, refresh);
    eventBus.on(EVENTS.TASK_CREATED, refresh);
    eventBus.on(EVENTS.REFRESH_ALL_TASKS, refresh);
    return () => {
      eventBus.off(EVENTS.DEPOSIT_IDEA_CREATED, refresh);
      eventBus.off(EVENTS.DEPOSIT_IDEA_UPDATED, refresh);
      eventBus.off(EVENTS.TASK_CREATED, refresh);
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

  if (ideas.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No ideas yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {ideas.map((idea) => (
        <DepositIdeaCard
          key={idea.id}
          depositIdea={idea}
          onUpdate={onUpdate}
          onCancel={onCancel}
          onPress={onPress}
          // B18 inheritance: no-op onActivate satisfies the required prop
          // on DepositIdeaCardProps. Component body never reads it.
          // Same workaround as RoleIdeaJarPanel; all three Zone/Role/KR
          // IdeaJarPanels should converge when B18 is fixed in wellness.
          onActivate={() => {}}
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
