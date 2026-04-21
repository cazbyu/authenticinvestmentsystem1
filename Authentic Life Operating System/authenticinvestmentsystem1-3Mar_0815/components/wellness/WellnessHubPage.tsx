import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { ChevronLeft, Heart, MoreVertical } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { WellnessIcon } from '@/components/icons/WellnessIcon';
import { StatusPip } from '@/components/common/StatusPip';
import { getDomainColor } from '@/constants/wellnessColors';
import { getZoneTagline } from '@/constants/wellnessZoneCopy';

/**
 * WellnessHubPage — Minimalist Executive design system
 * Redesigned 8-zone wellness hub per SS2 mockup. Slice 2a = shell
 * only: static placeholders for counts + balance bar. Real data
 * integration lands in Slice 2b; balance visualization in 2c.
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
  onOpenSettings?: () => void;
}

const HUB_GREEN = '#2d9040';

export function WellnessHubPage({
  domains,
  onZoneTap,
  onOpenSettings,
}: WellnessHubPageProps) {
  const router = useRouter();
  const { authenticScore } = useAuthenticScore();

  // 2a: no real data — these wire up in Slice 2b
  const showNeedsAttention = false;
  const activeCount: number | null = null;
  const quietCount: number | null = null;
  const asleepCount: number | null = null;

  return (
    <View style={styles.root}>
      {/* HUB HEADER */}
      <View style={[styles.header, { backgroundColor: HUB_GREEN }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wellness</Text>
        <View style={styles.headerRight}>
          <Text style={styles.scoreLabel}>AUTHENTIC SCORE</Text>
          <Text style={styles.scoreValue}>
            {authenticScore.toLocaleString()}
          </Text>
        </View>
        {onOpenSettings && (
          <TouchableOpacity
            onPress={onOpenSettings}
            hitSlop={10}
            style={styles.kebabButton}
          >
            <MoreVertical size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {/* OVERVIEW CARD */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View style={[styles.heartCircle, { backgroundColor: HUB_GREEN }]}>
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
            <StatTile value={activeCount} label="Active" />
            <StatTile value={quietCount} label="Quiet" />
            <StatTile value={asleepCount} label="Asleep" />
          </View>
        </View>

        {/* NEEDS ATTENTION — hidden until Slice 2b */}
        {showNeedsAttention && (
          <View style={styles.needsAttention}>
            <Text style={styles.needsAttentionLabel}>NEEDS ATTENTION</Text>
            <Text style={styles.needsAttentionBody}>
              Recreational — no deposits in 18 days
            </Text>
          </View>
        )}

        {/* ALL ZONES */}
        <Text style={styles.sectionHeader}>ALL ZONES</Text>
        <View style={styles.grid}>
          {domains.map(domain => (
            <ZoneCard
              key={domain.id}
              domain={domain}
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
    </View>
  );
}

function StatTile({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>
        {value === null ? '—' : value.toString()}
      </Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function ZoneCard({
  domain,
  onPress,
}: {
  domain: Domain;
  onPress: () => void;
}) {
  const color = getDomainColor(domain.name);
  const tagline = getZoneTagline(domain.name);

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
        <StatusPip lastActivityDate={null} />
      </View>
      {tagline ? <Text style={styles.zoneTagline}>{tagline}</Text> : null}
      <Text style={styles.zoneMeta}>—</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backButton: { padding: 2 },
  kebabButton: { padding: 2, marginLeft: 4 },
  headerTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
    flex: 1,
  },
  headerRight: { alignItems: 'flex-end' },
  scoreLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 1,
  },

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
