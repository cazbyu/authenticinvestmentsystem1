import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getRoleStreak,
  getRoleActionCount30d,
  getRoleActiveGoalsCount,
} from '@/lib/roleStatistics';

/**
 * RoleStatsRow — R-2 sibling of components/wellness/ZoneStatsRow.tsx.
 *
 * Three tiles: Day Streak / Last 30 Day Actions / Active Goals.
 * Consumes R-1's three role-scoped fetchers in parallel via Promise.all.
 *
 * Visual parity with ZoneStatsRow (3 tiles, large numbers, uppercase
 * small labels) — but theme-aware backgrounds/borders per the C-2/R-1
 * convention. Wellness twin uses hardcoded grays; we don't follow that
 * here to keep the role redesign theme-consistent.
 */

export interface RoleStatsRowProps {
  roleId: string;
  userId: string;
}

export function RoleStatsRow({ roleId, userId }: RoleStatsRowProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [count30d, setCount30d] = useState(0);
  const [activeGoals, setActiveGoals] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const [s, a, g] = await Promise.all([
          getRoleStreak(supabase, roleId, userId, controller.signal),
          getRoleActionCount30d(supabase, roleId, userId, controller.signal),
          getRoleActiveGoalsCount(supabase, roleId, userId, controller.signal),
        ]);
        if (cancelled) return;
        setStreak(s);
        setCount30d(a);
        setActiveGoals(g);
      } catch (e) {
        if (!cancelled) {
          console.error('[RoleStatsRow] load failed', e);
          setStreak(0);
          setCount30d(0);
          setActiveGoals(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [roleId, userId]);

  return (
    <View style={styles.statsRow}>
      <View
        style={[
          styles.statTile,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.statNumber, { color: colors.text }]}>
          {loading ? '–' : streak}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          Day Streak
        </Text>
      </View>
      <View
        style={[
          styles.statTile,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.statNumber, { color: colors.text }]}>
          {loading ? '–' : count30d}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          Last 30 Day Actions
        </Text>
      </View>
      <View
        style={[
          styles.statTile,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.statNumber, { color: colors.text }]}>
          {loading ? '–' : activeGoals}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          Active Goals
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
