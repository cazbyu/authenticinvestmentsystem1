import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Heart } from 'lucide-react-native';

import { WellnessIcon } from '@/components/icons/WellnessIcon';
import { StatusPip } from '@/components/common/StatusPip';
import { getDomainColor } from '@/constants/wellnessColors';
import { getZoneTagline } from '@/constants/wellnessZoneCopy';
import { getDaysSince, formatDaysAgo } from '@/lib/roleStatistics';

/**
 * WellnessHubPage — Minimalist Executive design system
 * Content component for the redesigned 8-zone wellness hub per SS2.
 * Mounted below UniversalHeader in app/(tabs)/wellness.tsx.
 * Slice 2b wires real zone activity data (last deposit + tool counts)
 * into the overview stats, zone cards, and NEEDS ATTENTION banner.
 */

interface Domain {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface WellnessHubPageProps {
  domains: Domain[];
  onZoneTap: (domain: Domain) => void;
  lastDepositByDomain: Map<string, string | null>;
  toolCountByDomain: Map<string, number>;
}

// Paul's wellness-zone recency model
const WELLNESS_ACTIVE_THRESHOLD_DAYS = 3;
const WELLNESS_QUIET_THRESHOLD_DAYS = 6;

type ZoneState = 'active' | 'quiet' | 'asleep';

function classifyZone(daysSince: number | null): ZoneState {
  if (daysSince === null) return 'asleep';
  if (daysSince <= WELLNESS_ACTIVE_THRESHOLD_DAYS) return 'active';
  if (daysSince <= WELLNESS_QUIET_THRESHOLD_DAYS) return 'quiet';
  return 'asleep';
}

function formatZoneMeta(toolCount: number, lastDepositAt: string | null): string {
  const hasTools = toolCount > 0;
  const activityText = formatDaysAgo(getDaysSince(lastDepositAt));
  const toolText = `${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}`;

  if (hasTools && activityText) return `${toolText} · ${activityText}`;
  if (hasTools && !activityText) return `${toolText} · No deposits yet`;
  if (!hasTools && activityText) return `No tools yet · ${activityText}`;
  return 'No tools yet';
}

export function WellnessHubPage({
  domains,
  onZoneTap,
  lastDepositByDomain,
  toolCountByDomain,
}: WellnessHubPageProps) {
  const { counts, asleepZones } = useMemo(() => {
    const states = domains.map(d => {
      const lastAt = lastDepositByDomain.get(d.id) ?? null;
      const daysSince = getDaysSince(lastAt);
      return { domain: d, lastAt, daysSince, state: classifyZone(daysSince) };
    });

    const counts = {
      active: states.filter(s => s.state === 'active').length,
      quiet: states.filter(s => s.state === 'quiet').length,
      asleep: states.filter(s => s.state === 'asleep').length,
    };

    // All Asleep zones sorted: null (never) first, then daysSince desc
    const asleepZones = states
      .filter(s => s.state === 'asleep')
      .map(s => ({ domain: s.domain, daysSince: s.daysSince }))
      .sort((a, b) => {
        const aNull = a.daysSince === null;
        const bNull = b.daysSince === null;
        if (aNull && !bNull) return -1;
        if (!aNull && bNull) return 1;
        if (aNull && bNull) return 0;
        return b.daysSince! - a.daysSince!;
      });

    return { counts, asleepZones };
  }, [domains, lastDepositByDomain]);

  const showNeedsAttention = asleepZones.length > 0;

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
    >
      {/* OVERVIEW CARD */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewTop}>
          <View style={styles.heartCircle}>
            <Heart size={18} color="#ffffff" fill="#ffffff" />
          </View>
          <Text style={styles.overviewTitle}>
            Your eight wellness zones
          </Text>
        </View>
        <Text style={styles.overviewDesc}>
          Where you deposit energy across the whole life. Green means you're active. Amber means it's been a while. Red means this zone is asking for attention.
        </Text>
        <View style={styles.statsRow}>
          <StatTile value={counts.active} label="Active" />
          <StatTile value={counts.quiet} label="Quiet" />
          <StatTile value={counts.asleep} label="Asleep" />
        </View>
      </View>

      {/* NEEDS ATTENTION */}
      {showNeedsAttention && (
        <View style={styles.needsAttention}>
          <Text style={styles.needsAttentionLabel}>NEEDS ATTENTION</Text>
          {asleepZones.map(s => (
            <Text
              key={s.domain.id}
              style={styles.needsAttentionBody}
            >
              {s.daysSince === null
                ? `${s.domain.name} — never`
                : s.daysSince === 1
                  ? `${s.domain.name} — 1 day`
                  : `${s.domain.name} — ${s.daysSince} days`}
            </Text>
          ))}
        </View>
      )}

      {/* ALL ZONES */}
      <Text style={styles.sectionHeader}>ALL ZONES</Text>
      <View style={styles.grid}>
        {domains.map(domain => (
          <ZoneCard
            key={domain.id}
            domain={domain}
            lastDepositAt={lastDepositByDomain.get(domain.id) ?? null}
            toolCount={toolCountByDomain.get(domain.id) ?? 0}
            onPress={() => onZoneTap(domain)}
          />
        ))}
      </View>

      {/* 7-DAY BALANCE — placeholder, visualized in Slice 2c */}
      <Text style={[styles.sectionHeader, styles.balanceHeader]}>
        7-DAY BALANCE
      </Text>
      <View style={styles.balancePlaceholder} />
    </ScrollView>
  );
}

function StatTile({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function ZoneCard({
  domain,
  lastDepositAt,
  toolCount,
  onPress,
}: {
  domain: Domain;
  lastDepositAt: string | null;
  toolCount: number;
  onPress: () => void;
}) {
  const color = getDomainColor(domain.name);
  const tagline = getZoneTagline(domain.name);
  const metaText = formatZoneMeta(toolCount, lastDepositAt);

  return (
    <Pressable onPress={onPress} style={styles.zoneCard}>
      <View style={styles.zoneTop}>
        <View
          style={[styles.zoneIconCircle, { backgroundColor: color + '26' }]}
        >
          <WellnessIcon name={domain.name} color={color} size={20} />
        </View>
        <Text style={styles.zoneName} numberOfLines={1}>
          {domain.name}
        </Text>
        <StatusPip
          lastActivityDate={lastDepositAt}
          activeThresholdDays={WELLNESS_ACTIVE_THRESHOLD_DAYS}
          quietThresholdDays={WELLNESS_QUIET_THRESHOLD_DAYS}
        />
      </View>
      {tagline ? <Text style={styles.zoneTagline}>{tagline}</Text> : null}
      <Text style={styles.zoneMeta}>{metaText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16 },

  overviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    gap: 12,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heartCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  overviewDesc: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  needsAttention: {
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  needsAttentionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#dc2626',
  },
  needsAttentionBody: {
    fontSize: 13,
    color: '#1f2937',
  },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  balanceHeader: { marginTop: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  zoneCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 6,
  },
  zoneTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  zoneTagline: { fontSize: 12, color: '#4b5563' },
  zoneMeta: { fontSize: 11, color: '#6b7280' },

  balancePlaceholder: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
  },
});
