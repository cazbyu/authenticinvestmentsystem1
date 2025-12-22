import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CircleCheck as CheckCircle, Calendar, Flower, CircleAlert as AlertCircle, Lightbulb, FileText, Heart } from 'lucide-react-native';
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
  if (loading || !statistics) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.dashboardStrip}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.dashboardStrip}
        onPress={() => onPress(domain)}
        activeOpacity={0.8}
      >
        {/* Left: Domain Identity */}
        <View style={styles.identitySection}>
          <View style={styles.domainIcon}>
            <Heart size={40} color="#ec4899" />
          </View>
          <Text style={styles.domainLabel}>{domain.name}</Text>
        </View>

        {/* Center-Left: Summary Metrics */}
        <View style={styles.summarySection}>
          <View style={styles.summaryTile}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>Completed</Text>
              <CheckCircle size={12} color="#10b981" />
            </View>
            <Text style={styles.summaryValue}>{statistics.completedDeposits}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Scheduled</Text>
            <Text style={styles.summaryValue}>{statistics.totalScheduled}</Text>
          </View>
        </View>

        {/* Center: Weekly Schedule */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleLabel}>Deposits</Text>
            <Calendar size={12} color="#6b7280" />
          </View>
          <View style={styles.scheduleGrid}>
            <Text style={styles.scheduleRow}>W1: {statistics.scheduledByWeek.week1}</Text>
            <Text style={styles.scheduleRow}>W2: {statistics.scheduledByWeek.week2}</Text>
            <Text style={styles.scheduleRow}>W3: {statistics.scheduledByWeek.week3}</Text>
            <Text style={styles.scheduleRow}>W4: {statistics.scheduledByWeek.week4}</Text>
          </View>
        </View>

        {/* Right: Icon Quadrants */}
        <View style={styles.quadrantSection}>
          <View style={styles.quadrantTile}>
            <Flower size={26} color="#ec4899" />
            <Text style={styles.quadrantValue}>{statistics.reflectionStats.roses}</Text>
          </View>
          <View style={styles.quadrantTile}>
            <Lightbulb size={26} color="#f59e0b" />
            <Text style={styles.quadrantValue}>{statistics.reflectionStats.depositIdeas}</Text>
          </View>
          <View style={styles.quadrantTile}>
            <AlertCircle size={26} color="#ef4444" />
            <Text style={styles.quadrantValue}>{statistics.reflectionStats.thorns}</Text>
          </View>
          <View style={styles.quadrantTile}>
            <FileText size={26} color="#6b7280" />
            <Text style={styles.quadrantValue}>{statistics.reflectionStats.reflectionsAndNotes}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dashboardStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1d5db',
    borderRadius: 12,
    padding: 18,
    gap: 18,
    minHeight: 130,
    minWidth: 700,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#6b7280',
  },
  identitySection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    flexShrink: 0,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#9ca3af',
  },
  domainIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  domainLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  summarySection: {
    gap: 12,
    width: 100,
    flexShrink: 0,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#9ca3af',
  },
  summaryTile: {
    minWidth: 85,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#4b5563',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  scheduleSection: {
    width: 80,
    flexShrink: 0,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#9ca3af',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  scheduleLabel: {
    fontSize: 9,
    color: '#4b5563',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scheduleGrid: {
    gap: 2,
  },
  scheduleRow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  quadrantSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 160,
    minWidth: 160,
    flexShrink: 0,
    gap: 8,
  },
  quadrantTile: {
    width: 76,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  quadrantValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
});
