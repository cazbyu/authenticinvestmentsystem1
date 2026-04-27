import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import {
  computeStreak,
  fetchActivityDaySetForStreak,
  fetchZoneActivity30Days,
} from '@/lib/zoneActivity';

/**
 * ZoneStatsRow — Minimalist Executive design system
 * Three white tiles below the cream callout area: Day Streak,
 * Last 30 Day Actions, Active Goals. Mirrors RoleBankHub.tsx's
 * stat-tile pattern (white card, 8px radius, gray border, number on
 * top, uppercase label below).
 */

export interface ZoneStatsRowProps {
  domainId: string;
  userId: string;
  activeGoalsCount: number;
}

export function ZoneStatsRow({
  domainId,
  userId,
  activeGoalsCount,
}: ZoneStatsRowProps) {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [count30d, setCount30d] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const [activity30, daySet365] = await Promise.all([
          fetchZoneActivity30Days(supabase, domainId, userId, controller.signal),
          fetchActivityDaySetForStreak(supabase, domainId, userId, 365, controller.signal),
        ]);
        if (cancelled) return;
        setCount30d(activity30.count);
        setStreak(computeStreak(daySet365));
      } catch (e) {
        if (!cancelled) {
          console.error('[ZoneStatsRow] load failed', e);
          setStreak(0);
          setCount30d(0);
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
  }, [domainId, userId]);

  return (
    <View style={styles.statsRow}>
      <View style={styles.statTile}>
        <Text style={styles.statNumber}>{loading ? '–' : streak}</Text>
        <Text style={styles.statLabel}>Day Streak</Text>
      </View>
      <View style={styles.statTile}>
        <Text style={styles.statNumber}>{loading ? '–' : count30d}</Text>
        <Text style={styles.statLabel}>Last 30 Day Actions</Text>
      </View>
      <View style={styles.statTile}>
        <Text style={styles.statNumber}>{activeGoalsCount}</Text>
        <Text style={styles.statLabel}>Active Goals</Text>
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
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
