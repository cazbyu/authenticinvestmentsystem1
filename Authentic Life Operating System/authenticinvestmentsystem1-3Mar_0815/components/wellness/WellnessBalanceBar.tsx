import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { getDomainColor } from '@/constants/wellnessColors';

interface Domain {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface WellnessBalanceBarProps {
  domains: Domain[];
  countsByDomain: Map<string, number>;
}

interface Segment {
  id: string;
  name: string;
  color: string;
  count: number;
  displayPct: number;  // rounded for legend, percentages sum to 100
  clampedPct: number;  // min 1 for flex layout so tiny slivers remain visible
}

/**
 * WellnessBalanceBar — Minimalist Executive design system
 * Horizontal stacked bar + per-zone legend for the last 7 days of
 * deposit activity. Empty state renders a gray bar + caption.
 * Slice 2c: wired into WellnessHubPage below the "7-DAY BALANCE" header.
 */

export function WellnessBalanceBar({
  domains,
  countsByDomain,
}: WellnessBalanceBarProps) {
  const segments = useMemo<Segment[]>(() => {
    const items = domains
      .map(d => ({ domain: d, count: countsByDomain.get(d.id) ?? 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);

    const total = items.reduce((sum, x) => sum + x.count, 0);
    if (total === 0 || items.length === 0) return [];

    // Raw percentages, then round for legend display
    const displayPcts = items.map(x => Math.round((x.count / total) * 100));

    // Absorb rounding drift in the largest segment (items sorted desc).
    const sum = displayPcts.reduce((s, p) => s + p, 0);
    const delta = 100 - sum;
    if (delta !== 0 && displayPcts.length > 0) {
      displayPcts[0] += delta;
    }

    // Clamp for layout: min 1% so tiny slivers stay visible.
    const clampedPcts = displayPcts.map(p => Math.max(p, 1));

    return items.map((x, i) => ({
      id: x.domain.id,
      name: x.domain.name,
      color: getDomainColor(x.domain.name),
      count: x.count,
      displayPct: displayPcts[i],
      clampedPct: clampedPcts[i],
    }));
  }, [domains, countsByDomain]);

  const isEmpty = segments.length === 0;

  if (isEmpty) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyBar} />
        <Text style={styles.emptyCaption}>No deposits in the last 7 days</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {segments.map(seg => (
          <View
            key={seg.id}
            style={{
              flex: seg.clampedPct,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {segments.map(seg => (
          <View key={seg.id} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {seg.name}
            </Text>
            <Text style={styles.legendPct}>{seg.displayPct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  bar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
  },
  emptyBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
  },
  emptyCaption: {
    fontSize: 13,
    color: '#6b7280',
  },
  legend: { gap: 4 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
  },
  legendPct: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
});
