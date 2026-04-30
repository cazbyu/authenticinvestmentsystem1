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
import { fetchRoleIdeas } from '@/lib/zoneDataService';
import { fetchRoleUpcoming } from '@/lib/roleUpcoming';
import { fetchRoleOverdue } from '@/lib/roleOverdue';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { Task } from '@/components/tasks/TaskCard';
import { RoleIdeaJarPanel } from './RoleIdeaJarPanel';
import { RoleUpcomingPanel } from './RoleUpcomingPanel';
import { RoleOverduePanel } from './RoleOverduePanel';

/**
 * RoleMySpaceSection — R-3 sibling of components/wellness/ZoneMySpaceSection.tsx.
 *
 * 3-tile grid (Upcoming / Overdue / Idea Jar) with one inline-expand
 * panel below. One panel open at a time (controlled by parent).
 *
 * Position: between RoleStatsRow (R-2) and RoleToolshed (R-4) on the
 * role-detail page. R-5 mounts.
 *
 * accentColor is an explicit prop — per the wellness twin's docstring
 * (lines 38-41): "future port to Roles / KRs will need an explicit
 * color prop". Each role carries its own color on the row, not derived
 * from a constants map like wellness's getDomainColor.
 *
 * Theme-aware backgrounds/borders/text per the C-2/R-1/R-2 convention
 * (deviation from the wellness twin's hardcoded grays — internal
 * consistency with R-2's RoleStatsRow + RoleIdentityHeader on the role
 * detail page wins over sibling-pattern purity for visual coherence in
 * dark mode).
 *
 * Counts refetch on relevant eventBus signals. Each panel additionally
 * owns its own data fetch (lazy load on first expand) — the redundancy
 * keeps panels self-contained and matches the wellness twin's pattern.
 */

type TileKey = 'upcoming' | 'overdue' | 'idea';

export interface RoleMySpaceSectionProps {
  roleId: string;
  userId: string;
  roleName: string;
  accentColor: string;
  // Idea Jar handlers
  onIdeaUpdate: (depositIdea: any) => void;
  onIdeaCancel: (depositIdea: any) => void;
  onIdeaPress: (depositIdea: any) => void;
  // Upcoming + Overdue (task) handlers
  onTaskComplete: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskPress: (task: Task) => void;
  // Open-tile state lifted to parent. R-5 will coordinate with
  // RoleToolshed's openSurface (R-4) so only one panel is open at a
  // time across MY SPACE + Toolshed.
  openTile: TileKey | null;
  onTileChange: (next: TileKey | null) => void;
}

export function RoleMySpaceSection({
  roleId,
  userId,
  roleName,
  accentColor,
  onIdeaUpdate,
  onIdeaCancel,
  onIdeaPress,
  onTaskComplete,
  onTaskDelete,
  onTaskPress,
  openTile,
  onTileChange,
}: RoleMySpaceSectionProps) {
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
        fetchRoleIdeas(supabase, roleId, userId, signal),
        fetchRoleUpcoming(supabase, roleId, userId, signal),
        fetchRoleOverdue(supabase, roleId, userId, signal),
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
    [roleId, userId],
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

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        MY {roleName.toUpperCase()} SPACE
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
              <RoleIdeaJarPanel
                roleId={roleId}
                userId={userId}
                onUpdate={onIdeaUpdate}
                onCancel={onIdeaCancel}
                onPress={onIdeaPress}
              />
            )}
            {openTile === 'upcoming' && (
              <RoleUpcomingPanel
                roleId={roleId}
                userId={userId}
                onTaskComplete={onTaskComplete}
                onTaskDelete={onTaskDelete}
                onTaskPress={onTaskPress}
              />
            )}
            {openTile === 'overdue' && (
              <RoleOverduePanel
                roleId={roleId}
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
