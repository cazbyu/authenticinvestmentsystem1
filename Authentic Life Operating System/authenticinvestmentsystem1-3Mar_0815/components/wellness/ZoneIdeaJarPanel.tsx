import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchZoneIdeas } from '@/lib/zoneDataService';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';

/**
 * ZoneIdeaJarPanel — Minimalist Executive design system
 * Renders the deposit-idea list for the MY SPACE > Idea Jar tile.
 *
 * Owns its own data fetching (calls fetchZoneIdeas, caches in local
 * state, refetches on relevant eventBus signals). Modal-opening
 * handlers come from props since modals live in wellness.tsx.
 *
 * Subscribes to:
 *   - DEPOSIT_IDEA_CREATED  (a new idea was added)
 *   - DEPOSIT_IDEA_UPDATED  (an existing idea changed; e.g., cancel)
 *   - TASK_CREATED          (an idea was activated → became a task,
 *                            which makes it disappear from the jar)
 *   - REFRESH_ALL_TASKS     (broad refresh signal)
 *
 * Note: DepositIdeaCard's prop interface declares onActivate as
 * required, but its body destructures only { depositIdea, onUpdate,
 * onCancel, onPress, isDragging }. wellness.tsx omits onActivate
 * (one of the 16 pre-existing tsc errors). This panel matches that
 * pattern — same omission, same baseline tsc count.
 */

export interface ZoneIdeaJarPanelProps {
  domainId: string;
  userId: string;
  onUpdate: (depositIdea: any) => void;
  onCancel: (depositIdea: any) => void;
  onPress: (depositIdea: any) => void;
}

export function ZoneIdeaJarPanel({
  domainId,
  userId,
  onUpdate,
  onCancel,
  onPress,
}: ZoneIdeaJarPanelProps) {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseClient();
        const data = await fetchZoneIdeas(supabase, domainId, userId, signal);
        if (signal?.aborted) return;
        setIdeas(data ?? []);
      } catch (e: any) {
        if (signal?.aborted) return;
        console.error('[ZoneIdeaJarPanel] load failed', e);
        setError('Could not load ideas.');
        setIdeas([]);
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
