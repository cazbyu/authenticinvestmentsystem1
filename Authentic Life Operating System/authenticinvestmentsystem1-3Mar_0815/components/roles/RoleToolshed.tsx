import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Target, Compass, BookOpen, BarChart3 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { fireComingSoonAlert } from '@/lib/comingSoonAlert';
import { RoleGoalsToolshedPanel } from './RoleGoalsToolshedPanel';
import { RoleJournalToolshedPanel } from './RoleJournalToolshedPanel';
import { RoleAnalyticsToolshedPanel } from './RoleAnalyticsToolshedPanel';

/**
 * RoleToolshed — R-4 sibling of components/wellness/ZoneToolshed.tsx
 * (Surfaces section only; no tracker grid — wellness-only concept).
 *
 * 4 tiles:
 *   - Goals (real)         — RoleGoalsToolshedPanel renders goal cards
 *   - Power Q Journal      — Coming Soon placeholder (fires alert)
 *   - Journal (real)       — RoleJournalToolshedPanel wraps JournalView
 *   - Analytics (real)     — RoleAnalyticsToolshedPanel wraps AnalyticsView
 *
 * Surfaces other than the placeholder open a CollapsiblePanel beneath
 * the row. Power Q Journal fires fireComingSoonAlert(roleName) directly
 * on tap — no panel toggle, no openSurface state change. Tile uses the
 * Compass icon for cross-page consistency with W-0's wellness North
 * Star Questions placeholder (same conceptual surface).
 *
 * accentColor is an explicit prop (per R-3 precedent — role.color
 * comes from the role row, not derived from a constants map).
 *
 * openSurface + onSurfaceChange are controlled-from-parent so R-5 can
 * coordinate single-open across MY SPACE + Toolshed (both clear when
 * either opens — same pattern wellness uses at 1+6c).
 *
 * Theme-aware backgrounds/borders/text per the C-2/R-1/R-2/R-3
 * convention (deviation from wellness twin's hardcoded grays — internal
 * consistency with the rest of the role page).
 */

export type SurfaceKey = 'goals' | 'journal' | 'analytics';

export interface RoleToolshedProps {
  roleId: string;
  userId: string;
  roleName: string;
  accentColor: string;
  // Goals surface props (data owned by R-5, passed in)
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask?: (goalId: string) => void;
  onGoalPress?: (goal: any) => void;
  // Journal surface props (callbacks owned by R-5)
  onJournalEntryPress: (entry: any) => void;
  journalDateRange?: 'today' | 'week' | 'month' | 'all';
  onJournalDateRangeChange?: (dateRange: 'today' | 'week' | 'month' | 'all') => void;
  // Coordinator state (R-5 cross-clears with openMySpaceTile)
  openSurface: SurfaceKey | null;
  onSurfaceChange: (next: SurfaceKey | null) => void;
}

export function RoleToolshed({
  roleId,
  userId,
  roleName,
  accentColor,
  goals,
  goalProgress,
  onAddGoalTask,
  onGoalPress,
  onJournalEntryPress,
  journalDateRange,
  onJournalDateRangeChange,
  openSurface,
  onSurfaceChange,
}: RoleToolshedProps) {
  const { colors } = useTheme();

  const toggle = (key: SurfaceKey) => {
    onSurfaceChange(openSurface === key ? null : key);
  };

  // 4 tiles. The 'placeholder' key marks the Power Q Journal tile, which
  // fires the Coming Soon alert directly on tap (no panel opens for it).
  // Compass icon mirrors wellness W-0's North Star Questions tile for
  // cross-page consistency — same conceptual placeholder.
  const surfaces: Array<{
    key: SurfaceKey | 'placeholder';
    name: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
    onPress: () => void;
  }> = [
    {
      key: 'goals',
      name: 'Goals',
      Icon: Target,
      onPress: () => toggle('goals'),
    },
    {
      key: 'placeholder',
      name: 'Power Q Journal',
      Icon: Compass,
      onPress: () => fireComingSoonAlert(roleName),
    },
    {
      key: 'journal',
      name: 'Journal',
      Icon: BookOpen,
      onPress: () => toggle('journal'),
    },
    {
      key: 'analytics',
      name: 'Analytics',
      Icon: BarChart3,
      onPress: () => toggle('analytics'),
    },
  ];

  const panelTitle = (key: SurfaceKey): string => {
    if (key === 'goals') return 'Goals';
    if (key === 'journal') return 'Journal';
    return 'Analytics';
  };

  const panelIcon = (key: SurfaceKey): React.ReactNode => {
    if (key === 'goals') return <Target size={18} color={accentColor} />;
    if (key === 'journal') return <BookOpen size={18} color={accentColor} />;
    return <BarChart3 size={18} color={accentColor} />;
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        TOOLSHED
      </Text>

      <View style={styles.tileRow}>
        {surfaces.map(({ key, name, Icon, onPress }) => {
          const isOpen = key !== 'placeholder' && openSurface === key;
          return (
            <Pressable
              key={key}
              onPress={onPress}
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
            </Pressable>
          );
        })}
      </View>

      {openSurface && (
        <View style={styles.panelWrap}>
          <CollapsiblePanel
            title={panelTitle(openSurface)}
            icon={panelIcon(openSurface)}
            accentColor={accentColor}
            isOpen={true}
            onToggle={() => onSurfaceChange(null)}
          >
            {openSurface === 'goals' && (
              <RoleGoalsToolshedPanel
                goals={goals}
                goalProgress={goalProgress}
                onAddGoalTask={onAddGoalTask}
                onGoalPress={onGoalPress}
              />
            )}
            {openSurface === 'journal' && (
              <RoleJournalToolshedPanel
                roleId={roleId}
                userId={userId}
                roleName={roleName}
                accentColor={accentColor}
                onEntryPress={onJournalEntryPress}
                dateRange={journalDateRange}
                onDateRangeChange={onJournalDateRangeChange}
              />
            )}
            {openSurface === 'analytics' && (
              <RoleAnalyticsToolshedPanel
                roleId={roleId}
                userId={userId}
                roleName={roleName}
                accentColor={accentColor}
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
  tileRow: {
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
  },
  tileName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  panelWrap: {
    marginTop: 4,
  },
});
