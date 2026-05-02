import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertCircle, Calendar, Lightbulb } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchKRIdeas } from '@/lib/zoneDataService';
import { fetchKRUpcoming } from '@/lib/krUpcoming';
import { fetchKROverdue } from '@/lib/krOverdue';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { Task } from '@/components/tasks/TaskCard';
import { KRIdeaJarPanel } from './KRIdeaJarPanel';
import { KRUpcomingPanel } from './KRUpcomingPanel';
import { KROverduePanel } from './KROverduePanel';

/**
 * KRMySpaceSection — R-6-components-B sibling of components/roles/RoleMySpaceSection.tsx.
 *
 * 3-tile grid (Upcoming / Overdue / Idea Jar) with one inline-expand
 * panel below. One panel open at a time (controlled by parent — R-6-mount
 * holds openTile state to coordinate with KRToolshed openSurface, same
 * pattern role side uses with RoleMySpaceSection + RoleToolshed).
 *
 * Position: between KRStatsRow (R-6-components-A) and KRToolshed
 * (R-6-components-C) on the KR-detail page. R-6-mount mounts.
 *
 * accentColor is an explicit prop per Q6 lock — KRs inherit parent role
 * accent color. Used for tile active border, tile icon color, and badge
 * background.
 *
 * Theme-aware backgrounds/borders/text per the C-2/R-1/R-2/R-3 convention
 * (matches role-side; KR side keeps the same theme-aware approach for
 * visual coherence in dark mode).
 *
 * Counts refetch on relevant eventBus signals. Each panel additionally
 * owns its own data fetch (lazy load on first expand) — the redundancy
 * keeps panels self-contained and matches the role/zone twin pattern.
 *
 * Section header copy: "MY {krName.toUpperCase()} SPACE" — e.g.,
 * "MY ANNE SPACE". If krName is null (DB allows; rare in practice since
 * UI flow always populates name on creation), falls back to "MY SPACE"
 * for graceful omission rather than a placeholder like "MY KR SPACE"
 * which would insert noise the user wouldn't recognize.
 */

type TileKey = 'upcoming' | 'overdue' | 'idea';

export interface KRMySpaceSectionProps {
  krId: string;
  userId: string;
  krName: string | null;
  accentColor: string;
  // Idea Jar handlers
  onIdeaUpdate: (depositIdea: any) => void;
  onIdeaCancel: (depositIdea: any) => void;
  onIdeaPress: (depositIdea: any) => void;
  // Upcoming + Overdue (task) handlers
  onTaskComplete: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskPress: (task: Task) => void;
  // Open-tile state lifted to parent. R-6-mount will coordinate with
  // KRToolshed's openSurface (R-6-components-C) so only one panel is
  // open at a time across MY SPACE + Toolshed.
  openTile: TileKey | null;
  onTileChange: (next: TileKey | null) => void;
}

export function KRMySpaceSection({
  krId,
  userId,
  krName,
  accentColor,
  onIdeaUpdate,
  onIdeaCancel,
  onIdeaPress,
  onTaskComplete,
  onTaskDelete,
  onTaskPress,
  openTile,
  onTileChange,
}: KRMySpaceSectionProps) {
  const { colors } = useTheme();
  const [ideaCount, setIdeaCount] = useState<number | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);

  const loadCounts = useCallback(
    async (signal?: AbortSignal) => {
      const supabase = getSupabaseClient();
      // Promise.allSettled so a single source's failure doesn't blank
      // the other two badges. Failures fall back to '–' display.
      const [ideasResult, upcomingResult, overdueResult] = await Promise.allSettled([
        fetchKRIdeas(supabase, krId, userId, signal),
        fetchKRUpcoming(supabase, krId, userId, signal),
        fetchKROverdue(supabase, krId, userId, signal),
      ]);
      if (signal?.aborted) return;
      setIdeaCount(
        ideasResult.status === 'fulfilled' ? (ideasResult.value?.length ?? 0) : null,
      );
      setUpcomingCount(
        upcomingResult.status === 'fulfilled' ? upcomingResult.value.count : null,
      );
      setOverdueCount(
        overdueResult.status === 'fulfilled' ? overdueResult.value.count : null,
      );
    },
    [krId, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadCounts(controller.signal);
    return () => controller.abort();
  }, [loadCounts]);

  // Refresh counts on relevant eventBus signals.
  useEffect(() => {
    const refresh = () => {
      const controller = new AbortController();
      loadCounts(controller.signal);
    };
    const subs = [
      EVENTS.TASK_CREATED,
      EVENTS.TASK_UPDATED,
      EVENTS.TASK_DELETED,
      EVENTS.TASK_COMPLETED,
      EVENTS.DEPOSIT_IDEA_CREATED,
      EVENTS.DEPOSIT_IDEA_UPDATED,
      EVENTS.REFRESH_ALL_TASKS,
    ];
    for (const e of subs) eventBus.on(e, refresh);
    return () => {
      for (const e of subs) eventBus.off(e, refresh);
    };
  }, [loadCounts]);

  const toggle = (key: TileKey) => {
    onTileChange(openTile === key ? null : key);
  };

  const tiles: Array<{
    key: TileKey;
    name: string;
    count: number | null;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
  }> = [
    { key: 'upcoming', name: 'Upcoming', count: upcomingCount, Icon: Calendar },
    { key: 'overdue', name: 'Overdue', count: overdueCount, Icon: AlertCircle },
    { key: 'idea', name: 'Idea Jar', count: ideaCount, Icon: Lightbulb },
  ];

  const panelTitle = (key: TileKey): string => {
    if (key === 'idea') return 'Idea Jar';
    if (key === 'upcoming') return 'Upcoming';
    return 'Overdue';
  };

  const panelIcon = (key: TileKey): React.ReactNode => {
    if (key === 'idea') return <Lightbulb size={18} color={accentColor} />;
    if (key === 'upcoming') return <Calendar size={18} color={accentColor} />;
    return <AlertCircle size={18} color={accentColor} />;
  };

  // Section header: "MY {KR_NAME} SPACE" with graceful null fallback.
  // See docstring for rationale on choosing omission over placeholder.
  const sectionHeaderText = krName
    ? `MY ${krName.toUpperCase()} SPACE`
    : 'MY SPACE';

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        {sectionHeaderText}
      </Text>

      <View style={styles.tileGrid}>
        {tiles.map(({ key, name, count, Icon }) => {
          const isOpen = openTile === key;
          return (
            <Pressable
              key={key}
              onPress={() => toggle(key)}
              style={[
                styles.tile,
                { borderColor: colors.border, backgroundColor: colors.surface },
                isOpen && { borderColor: accentColor, borderWidth: 1.5 },
              ]}
            >
              <Icon size={22} color={accentColor} />
              <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              <View style={[styles.tileBadge, { backgroundColor: accentColor }]}>
                <Text style={styles.tileBadgeText}>
                  {count === null ? '–' : count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {openTile && (
        <View style={styles.panelWrap}>
          <CollapsiblePanel
            title={panelTitle(openTile)}
            icon={panelIcon(openTile)}
            accentColor={accentColor}
            isOpen={true}
            onToggle={() => onTileChange(null)}
          >
            {openTile === 'idea' && (
              <KRIdeaJarPanel
                krId={krId}
                userId={userId}
                onUpdate={onIdeaUpdate}
                onCancel={onIdeaCancel}
                onPress={onIdeaPress}
              />
            )}
            {openTile === 'upcoming' && (
              <KRUpcomingPanel
                krId={krId}
                userId={userId}
                onTaskComplete={onTaskComplete}
                onTaskDelete={onTaskDelete}
                onTaskPress={onTaskPress}
              />
            )}
            {openTile === 'overdue' && (
              <KROverduePanel
                krId={krId}
                userId={userId}
                onTaskComplete={onTaskComplete}
                onTaskDelete={onTaskDelete}
                onTaskPress={onTaskPress}
              />
            )}
          </CollapsiblePanel>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tileGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  tileName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  tileBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tileBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  panelWrap: {
    marginTop: 4,
  },
});
