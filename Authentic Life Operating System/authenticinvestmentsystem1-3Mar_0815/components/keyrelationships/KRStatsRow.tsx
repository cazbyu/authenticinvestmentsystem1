import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getKRStreak,
  getKRActionCount30d,
  getKRLastEngagement,
  type KRLastEngagement,
} from '@/lib/krStatistics';

/**
 * KRStatsRow — R-6-components-A sibling of components/roles/RoleStatsRow.tsx.
 *
 * Three tiles: Day Streak / Last 30 Day Actions / Last Engagement.
 * Consumes R-6-lib's three KR-scoped fetchers in parallel via Promise.all.
 *
 * Differs from RoleStatsRow:
 *   - 3rd tile is Last Engagement (NOT Active Goals) per audit v2 Q3 lock.
 *     Active Goals lives in KRToolshed instead (R-6-components-C).
 *   - Last Engagement covers all 6 KR activity categories via 4 queries
 *     (audit v2 Q2 REVISED FINAL): Task, Event (captured + commitments),
 *     Deposit Idea, Reflection, Rose, Thorn.
 *   - Accepts accentColor prop per Q6 lock (KRs inherit parent role accent).
 *     Currently NOT visually used; reserved for future enhancement (e.g.,
 *     subtle tile border tint, color bar, etc.). R-6-mount passes it from
 *     selectedRole.color so the prop is wired end-to-end.
 *
 * Refresh contract (mirrors RoleStatsRow / ZoneStatsRow):
 *   - Component refetches ONLY when krId or userId props change.
 *   - Does NOT subscribe to eventBus events. If a parent action mutates
 *     KR-tagged data (task completed, etc.), the parent must trigger a
 *     remount (e.g., via a `key` prop tied to a refresh counter) to force
 *     stats refresh. Confirmed pattern across all 3 stats rows in the app.
 *
 * Last Engagement formatting: inline formatter (NOT importing formatDaysAgo
 * from roleStatistics.ts). Reasons:
 *   - Lib helper returns lowercase ('today' / 'yesterday') — KRStatsRow
 *     wants Title Case ('Today' / 'Yesterday').
 *   - Lib helper doesn't handle 30+ days as months — KR side wants
 *     "1 month ago" / "{N} months ago" for older engagement (more
 *     readable than "147 days ago" for a long-distance KR).
 *   Re-implementation is small (~7 lines) and avoids the wrap-and-extend
 *   indirection. Future hygiene could extract a shared formatter if more
 *   surfaces need this exact formatting.
 */

export interface KRStatsRowProps {
  krId: string;
  userId: string;
  accentColor: string;
}

function formatLastEngagement(daysAgo: number | null): string {
  if (daysAgo === null) return 'Never';
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 30) return `${daysAgo} days ago`;
  const months = Math.floor(daysAgo / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export function KRStatsRow({ krId, userId, accentColor: _accentColor }: KRStatsRowProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [count30d, setCount30d] = useState(0);
  const [lastEngagement, setLastEngagement] = useState<KRLastEngagement>({
    date: null,
    daysAgo: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const [s, a, le] = await Promise.all([
          getKRStreak(supabase, krId, userId, controller.signal),
          getKRActionCount30d(supabase, krId, userId, controller.signal),
          getKRLastEngagement(supabase, krId, userId, controller.signal),
        ]);
        if (cancelled) return;
        setStreak(s);
        setCount30d(a);
        setLastEngagement(le);
      } catch (e) {
        if (!cancelled) {
          console.error('[KRStatsRow] load failed', e);
          setStreak(0);
          setCount30d(0);
          setLastEngagement({ date: null, daysAgo: null });
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
  }, [krId, userId]);

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
        <Text
          style={[styles.statNumber, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {loading ? '–' : formatLastEngagement(lastEngagement.daysAgo)}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          Last Engagement
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
