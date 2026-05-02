import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Target, Compass, BookOpen, BarChart3 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { fireComingSoonAlert } from '@/lib/comingSoonAlert';
import { KRGoalsToolshedPanel } from './KRGoalsToolshedPanel';
import { KRJournalToolshedPanel } from './KRJournalToolshedPanel';
import { KRAnalyticsToolshedPanel } from './KRAnalyticsToolshedPanel';

/**
 * KRToolshed — R-6-components-C sibling of components/roles/RoleToolshed.tsx.
 *
 * 4 tiles:
 *   - Goals (real)         — KRGoalsToolshedPanel renders goal cards
 *   - Power Q Journal      — Coming Soon placeholder (fires alert)
 *   - Journal (real)       — KRJournalToolshedPanel wraps JournalView
 *   - Analytics (real)     — KRAnalyticsToolshedPanel wraps AnalyticsView
 *
 * Surfaces other than the placeholder open a CollapsiblePanel beneath
 * the row. Power Q Journal fires fireComingSoonAlert(krName ?? 'this
 * relationship') directly on tap — no panel toggle, no openSurface
 * state change. Tile uses the Compass icon for cross-page consistency
 * with role-side W-0's wellness North Star Questions placeholder
 * (same conceptual surface).
 *
 * Per audit Q1 lock: Power Q content lives HERE in the Toolshed tile,
 * NOT in KRIdentityHeader. Role-side currently has Power Q in both
 * surfaces (R-2 era IdentityHeader + R-4 Toolshed placeholder); KR side
 * establishes the cleaner pattern by placing it only in Toolshed.
 *
 * accentColor is an explicit prop per Q6 lock (KRs inherit parent role
 * accent color — passed from R-6-mount via selectedRole.color).
 *
 * openSurface + onSurfaceChange are controlled-from-parent so R-6-mount
 * can coordinate single-open across MY SPACE + Toolshed (both clear
 * when either opens — same pattern role-side uses at R-5 mount).
 *
 * Theme-aware backgrounds/borders/text per the C-2/R-1/R-2/R-3/R-6
 * convention (matches role-side; KR side keeps the same theme-aware
 * approach for visual coherence in dark mode).
 *
 * Section header is "TOOLSHED" verbatim — not KR-name-scoped (role-side
 * template uses bare "TOOLSHED" and that's the audit lock; only MY SPACE
 * gets the scope-name prefix).
 */

export type SurfaceKey = 'goals' | 'journal' | 'analytics';

export interface KRToolshedProps {
  krId: string;
  userId: string;
  krName: string | null;
  accentColor: string;
  // Goals surface props (data owned by R-6-mount, passed in)
  goals: any[];
  goalProgress: Record<string, any>;
  onAddGoalTask?: (goalId: string) => void;
  onGoalPress?: (goal: any) => void;
  // Journal surface props (callbacks owned by R-6-mount)
  onJournalEntryPress: (entry: any) => void;
  journalDateRange?: 'today' | 'week' | 'month' | 'all';
  onJournalDateRangeChange?: (dateRange: 'today' | 'week' | 'month' | 'all') => void;
  // Coordinator state (R-6-mount cross-clears with openMySpaceTile)
  openSurface: SurfaceKey | null;
  onSurfaceChange: (next: SurfaceKey | null) => void;
}

export function KRToolshed({
  krId,
  userId,
  krName,
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
}: KRToolshedProps) {
  const { colors } = useTheme();

  const toggle = (key: SurfaceKey) => {
    onSurfaceChange(openSurface === key ? null : key);
  };

  // 4 tiles. The 'placeholder' key marks the Power Q Journal tile, which
  // fires the Coming Soon alert directly on tap (no panel opens for it).
  // Compass icon mirrors role-side / wellness W-0's North Star Questions
  // tile for cross-page consistency — same conceptual placeholder.
  // krName ?? 'this relationship' handles the nullable type per R-6-schema's
  // widened interface; matches the graceful fallback pattern used in
  // KRMySpaceSection's "MY SPACE" header.
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
      onPress: () => fireComingSoonAlert(krName ?? 'this relationship'),
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
              <KRGoalsToolshedPanel
                goals={goals}
                goalProgress={goalProgress}
                onAddGoalTask={onAddGoalTask}
                onGoalPress={onGoalPress}
              />
            )}
            {openSurface === 'journal' && (
              <KRJournalToolshedPanel
                krId={krId}
                userId={userId}
                krName={krName}
                accentColor={accentColor}
                onEntryPress={onJournalEntryPress}
                dateRange={journalDateRange}
                onDateRangeChange={onJournalDateRangeChange}
              />
            )}
            {openSurface === 'analytics' && (
              <KRAnalyticsToolshedPanel
                krId={krId}
                userId={userId}
                krName={krName}
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
