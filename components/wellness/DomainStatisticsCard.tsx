import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
      <View style={styles.cardContent}>
        {/* Left: Icon and Name (vertically centered) */}
        <View style={styles.leftSection}>
          <View style={styles.domainIconContainer}>
            <Heart size={40} color="#ec4899" />
          </View>
          <View style={styles.domainNameContainer}>
            <Text style={styles.domainName} numberOfLines={2}>{domain.name}</Text>
            <Text style={styles.depositCount}>{statistics.completedDeposits}</Text>
          </View>
        </View>

        {/* Middle: Scheduled Deposits by Week */}
        <View style={styles.middleSection}>
          <View style={styles.statHeader}>
            <Calendar size={14} color="#3b82f6" />
            <Text style={styles.statLabel}>Deposits</Text>
          </View>
          <View style={styles.weeksList}>
            <View style={styles.weekRow}>
              <Text style={styles.weekLabel}>W1:</Text>
              <View style={styles.weekCheckbox} />
              <Text style={styles.weekValue}>{statistics.scheduledByWeek.week1}</Text>
            </View>
            <View style={styles.weekRow}>
              <Text style={styles.weekLabel}>W2:</Text>
              <View style={styles.weekCheckbox} />
              <Text style={styles.weekValue}>{statistics.scheduledByWeek.week2}</Text>
            </View>
            <View style={styles.weekRow}>
              <Text style={styles.weekLabel}>W3:</Text>
              <View style={styles.weekCheckbox} />
              <Text style={styles.weekValue}>{statistics.scheduledByWeek.week3}</Text>
            </View>
            <View style={styles.weekRow}>
              <Text style={styles.weekLabel}>W4:</Text>
              <View style={styles.weekCheckbox} />
              <Text style={styles.weekValue}>{statistics.scheduledByWeek.week4}</Text>
            </View>
          </View>
        </View>

        {/* Right: Reflection Quadrant */}
        <View style={styles.rightSection}>
          <View style={styles.reflectionQuadrant}>
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
          <View style={styles.authenticScoreBadge}>
            <Text style={styles.authenticScoreLabel}>AS</Text>
            <Text style={styles.authenticScoreValue}>{statistics.authenticScore}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 140,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ec4899',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardContent: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 120,
  },
  domainIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainNameContainer: {
    flex: 1,
    gap: 4,
  },
  domainName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  depositCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  middleSection: {
    flex: 1,
    gap: 6,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  weeksList: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 26,
  },
  weekCheckbox: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 3,
    backgroundColor: '#ecfdf5',
  },
  weekValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reflectionQuadrant: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  quadrantRow: {
    flexDirection: 'row',
  },
  quadrantCell: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  quadrantValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  authenticScoreBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    minWidth: 76,
  },
  authenticScoreLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  authenticScoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ec4899',
  },
});
