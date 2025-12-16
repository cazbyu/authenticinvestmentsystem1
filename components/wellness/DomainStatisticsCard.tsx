import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { CheckCircle, Calendar, Flower, AlertCircle, Lightbulb, FileText, Heart } from 'lucide-react-native';
import { DomainStatistics } from '@/lib/roleStatistics';

interface Domain {
  id: string;
  name: string;
  description?: string;
}

interface DomainStatisticsCardProps {
  domain: Domain;
  statistics: DomainStatistics | null;
  loading?: boolean;
  onPress: (domain: Domain) => void;
}

export function DomainStatisticsCard({
  domain,
  statistics,
  loading = false,
  onPress
}: DomainStatisticsCardProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (loading || !statistics) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(domain)}
      activeOpacity={0.7}
    >
      {/* Top: Identity - Icon + Name */}
      <View style={styles.identityRow}>
        <View style={[styles.domainIconContainer, isMobile && styles.domainIconMobile]}>
          <Heart size={isMobile ? 20 : 24} color="#ec4899" />
        </View>
        <Text style={styles.domainName} numberOfLines={1}>{domain.name}</Text>
      </View>

      {/* Middle: Primary Metrics - Total Deposits + AS */}
      <View style={styles.metricsRow}>
        <View style={styles.depositMetric}>
          <Text style={styles.metricLabel}>Total</Text>
          <Text style={styles.depositCount}>{statistics.completedDeposits}</Text>
        </View>
        <View style={styles.asMetric}>
          <Text style={styles.metricLabel}>AS</Text>
          <Text style={styles.asValue}>{statistics.authenticScore}</Text>
        </View>
      </View>

      {/* Bottom: Operational Detail - Weekly + Quadrant */}
      <View style={styles.detailRow}>
        <View style={styles.weeklyIndicators}>
          <View style={styles.weekIndicator}>
            <Text style={styles.weekLabel}>W1</Text>
            <View style={styles.weekDot} />
            <Text style={styles.weekValue}>{statistics.scheduledByWeek.week1}</Text>
          </View>
          <View style={styles.weekIndicator}>
            <Text style={styles.weekLabel}>W2</Text>
            <View style={styles.weekDot} />
            <Text style={styles.weekValue}>{statistics.scheduledByWeek.week2}</Text>
          </View>
          <View style={styles.weekIndicator}>
            <Text style={styles.weekLabel}>W3</Text>
            <View style={styles.weekDot} />
            <Text style={styles.weekValue}>{statistics.scheduledByWeek.week3}</Text>
          </View>
          <View style={styles.weekIndicator}>
            <Text style={styles.weekLabel}>W4</Text>
            <View style={styles.weekDot} />
            <Text style={styles.weekValue}>{statistics.scheduledByWeek.week4}</Text>
          </View>
        </View>

        <View style={styles.quadrantGrid}>
          <View style={styles.quadrantRow}>
            <View style={styles.quadrantCell}>
              <Text style={styles.quadrantValue}>{statistics.reflectionStats.roses}</Text>
            </View>
            <View style={styles.quadrantCell}>
              <Text style={styles.quadrantValue}>{statistics.reflectionStats.thorns}</Text>
            </View>
          </View>
          <View style={styles.quadrantRow}>
            <View style={styles.quadrantCell}>
              <Text style={styles.quadrantValue}>{statistics.reflectionStats.depositIdeas}</Text>
            </View>
            <View style={styles.quadrantCell}>
              <Text style={styles.quadrantValue}>{statistics.reflectionStats.reflectionsAndNotes}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#ec4899',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  domainIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainIconMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  domainName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  depositMetric: {
    flex: 1,
    backgroundColor: '#fef2f7',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  asMetric: {
    flex: 1,
    backgroundColor: '#fef2f7',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#9f1239',
    fontWeight: '500',
    marginBottom: 2,
  },
  depositCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  asValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ec4899',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  weeklyIndicators: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  weekIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
  },
  weekDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
  },
  weekValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  quadrantGrid: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  quadrantRow: {
    flexDirection: 'row',
  },
  quadrantCell: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  quadrantValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
});
