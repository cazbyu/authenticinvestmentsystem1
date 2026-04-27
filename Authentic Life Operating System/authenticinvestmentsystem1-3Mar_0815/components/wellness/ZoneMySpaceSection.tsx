import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BookOpen, Calendar, Lightbulb } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchZoneIdeas } from '@/lib/zoneDataService';
import { fetchZoneUpcoming } from '@/lib/zoneUpcoming';
import { fetchZoneJournalCount } from '@/lib/zoneJournal';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { getDomainColor } from '@/constants/wellnessColors';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { Task } from '@/components/tasks/TaskCard';
import { ZoneIdeaJarPanel } from './ZoneIdeaJarPanel';
import { ZoneUpcomingPanel } from './ZoneUpcomingPanel';
import { ZoneJournalPanel } from './ZoneJournalPanel';

/**
 * ZoneMySpaceSection — Minimalist Executive design system
 * 3-tile grid (Idea Jar / Upcoming / Journal) with one inline-expand
 * panel below. One panel open at a time.
 *
 * Position: between ZoneStatsRow and ZoneToolshed in the
 * physicalLandingTop block. Tile counts come from the 3a data layer.
 *
 * Tap a tile → if same tile is already open, close it; if different
 * tile, switch (close old, open new). Tap the X icon in the open
 * panel header → close.
 *
 * Counts refetch on relevant eventBus signals. Each panel additionally
 * owns its own data fetch (lazy load on first expand) — there's a
 * small redundancy with the count fetch but it keeps the panels
 * self-contained.
 *
 * accentColor derived from zoneName via getDomainColor — single
 * source of truth, fewer props for wellness.tsx to wire. Locked for
 * 3b (Physical-only); future port to Roles / KRs will need an
 * explicit color prop.
 */

type TileKey = 'idea' | 'upcoming' | 'journal';

export interface ZoneMySpaceSectionProps {
  domainId: string;
  userId: string;
  zoneName: string;
  // Idea Jar handlers
  onIdeaUpdate: (depositIdea: any) => void;
  onIdeaCancel: (depositIdea: any) => void;
  onIdeaPress: (depositIdea: any) => void;
  // Upcoming (task) handlers
  onTaskComplete: (task: Task) => void;
  onTaskDelete: (task: Task) => void;
  onTaskPress: (task: Task) => void;
  // Journal handler
  onJournalEntryPress: (entry: any) => void;
}

export function ZoneMySpaceSection({
  domainId,
  userId,
  zoneName,
  onIdeaUpdate,
  onIdeaCancel,
  onIdeaPress,
  onTaskComplete,
  onTaskDelete,
  onTaskPress,
  onJournalEntryPress,
}: ZoneMySpaceSectionProps) {
  const accentColor = getDomainColor(zoneName);

  const [openTile, setOpenTile] = useState<TileKey | null>(null);
  const [ideaCount, setIdeaCount] = useState<number | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [journalCount, setJournalCount] = useState<number | null>(null);

  const loadCounts = useCallback(
    async (signal?: AbortSignal) => {
      const supabase = getSupabaseClient();
      // Promise.allSettled so a single source's failure doesn't blank
      // the other two badges. Failures fall back to '–' display.
      const [ideasResult, upcomingResult, journalResult] = await Promise.allSettled([
        fetchZoneIdeas(supabase, domainId, userId, signal),
        fetchZoneUpcoming(supabase, domainId, userId, signal),
        fetchZoneJournalCount(supabase, domainId, userId, signal),
      ]);
      if (signal?.aborted) return;
      setIdeaCount(
        ideasResult.status === 'fulfilled' ? (ideasResult.value?.length ?? 0) : null,
      );
      setUpcomingCount(
        upcomingResult.status === 'fulfilled' ? upcomingResult.value.count : null,
      );
      setJournalCount(
        journalResult.status === 'fulfilled' ? journalResult.value : null,
      );
    },
    [domainId, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadCounts(controller.signal);
    return () => controller.abort();
  }, [loadCounts]);

  // Refresh counts on relevant eventBus signals. Cover all 5 source
  // families that feed into the 3 tile counts.
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
      EVENTS.REFLECTION_CREATED,
      EVENTS.REFLECTION_UPDATED,
      EVENTS.REFLECTION_DELETED,
      EVENTS.WITHDRAWAL_CREATED,
      EVENTS.REFRESH_ALL_TASKS,
    ];
    for (const e of subs) eventBus.on(e, refresh);
    return () => {
      for (const e of subs) eventBus.off(e, refresh);
    };
  }, [loadCounts]);

  const toggle = (key: TileKey) => {
    setOpenTile(prev => (prev === key ? null : key));
  };

  const tiles: Array<{
    key: TileKey;
    name: string;
    count: number | null;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
  }> = [
    { key: 'idea', name: 'Idea Jar', count: ideaCount, Icon: Lightbulb },
    { key: 'upcoming', name: 'Upcoming', count: upcomingCount, Icon: Calendar },
    { key: 'journal', name: 'Journal', count: journalCount, Icon: BookOpen },
  ];

  const panelTitle = (key: TileKey): string => {
    if (key === 'idea') return 'Idea Jar';
    if (key === 'upcoming') return 'Upcoming';
    return 'Journal';
  };

  const panelIcon = (key: TileKey): React.ReactNode => {
    if (key === 'idea') return <Lightbulb size={18} color={accentColor} />;
    if (key === 'upcoming') return <Calendar size={18} color={accentColor} />;
    return <BookOpen size={18} color={accentColor} />;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>MY {zoneName.toUpperCase()} SPACE</Text>

      <View style={styles.tileGrid}>
        {tiles.map(({ key, name, count, Icon }) => {
          const isOpen = openTile === key;
          return (
            <Pressable
              key={key}
              onPress={() => toggle(key)}
              style={[
                styles.tile,
                isOpen && { borderColor: accentColor, borderWidth: 1.5 },
              ]}
            >
              <Icon size={22} color={accentColor} />
              <Text style={styles.tileName} numberOfLines={1}>{name}</Text>
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
            onToggle={() => setOpenTile(null)}
          >
            {openTile === 'idea' && (
              <ZoneIdeaJarPanel
                domainId={domainId}
                userId={userId}
                onUpdate={onIdeaUpdate}
                onCancel={onIdeaCancel}
                onPress={onIdeaPress}
              />
            )}
            {openTile === 'upcoming' && (
              <ZoneUpcomingPanel
                domainId={domainId}
                userId={userId}
                onTaskComplete={onTaskComplete}
                onTaskDelete={onTaskDelete}
                onTaskPress={onTaskPress}
              />
            )}
            {openTile === 'journal' && (
              <ZoneJournalPanel
                domainId={domainId}
                zoneName={zoneName}
                onEntryPress={onJournalEntryPress}
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
    color: '#6b7280',
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
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  tileName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
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
