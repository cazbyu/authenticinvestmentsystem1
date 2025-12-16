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
        <View style={styles.leftSection}>
          <View style={styles.domainIconContainer}>
            <Heart size={32} color="#ec4899" />
          </View>
          <Text style={styles.domainName} numberOfLines={2}>{domain.name}</Text>
        </View>

        <View style={styles.middleSection}>
          <View style={styles.completedSection}>
            <View style={styles.statHeader}>
              <CheckCircle size={16} color="#10b981" />
              <Text style={styles.statLabel}>Deposits</Text>
            </View>
            <Text style={styles.statValue}>{statistics.completedDeposits}</Text>
          </View>

          <View style={styles.scheduledSection}>
            <View style={styles.statHeader}>
              <Calendar size={16} color="#3b82f6" />
              <Text style={styles.statLabel}>Deposits</Text>
            </View>
            <View style={styles.weeksList}>
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>W1:</Text>
                <Text style={styles.weekValue}>{statistics.scheduledByWeek.week1}</Text>
              </View>
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>W2:</Text>
                <Text style={styles.weekValue}>{statistics.scheduledByWeek.week2}</Text>
              </View>
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>W3:</Text>
                <Text style={styles.weekValue}>{statistics.scheduledByWeek.week3}</Text>
              </View>
              <View style={styles.weekRow}>
                <Text style={styles.weekLabel}>W4:</Text>
                <Text style={styles.weekValue}>{statistics.scheduledByWeek.week4}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.reflectionStats}>
            <View style={styles.reflectionRow}>
              <Flower size={14} color="#ec4899" />
              <Text style={styles.reflectionValue}>{statistics.reflectionStats.roses}</Text>
            </View>
            <View style={styles.reflectionRow}>
              <AlertCircle size={14} color="#ef4444" />
              <Text style={styles.reflectionValue}>{statistics.reflectionStats.thorns}</Text>
            </View>
            <View style={styles.reflectionRow}>
              <Lightbulb size={14} color="#f59e0b" />
              <Text style={styles.reflectionValue}>{statistics.reflectionStats.depositIdeas}</Text>
            </View>
            <View style={styles.reflectionRow}>
              <FileText size={14} color="#6366f1" />
              <Text style={styles.reflectionValue}>{statistics.reflectionStats.reflectionsAndNotes}</Text>
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ec4899',
    padding: 12,
    marginBottom: 12,
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
    gap: 12,
  },
  leftSection: {
    alignItems: 'center',
    width: 60,
  },
  domainIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  domainName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1f2937',
  },
  middleSection: {
    flex: 1,
    gap: 8,
  },
  completedSection: {
    gap: 4,
  },
  scheduledSection: {
    gap: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  weeksList: {
    gap: 2,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekLabel: {
    fontSize: 11,
    color: '#6b7280',
    width: 24,
  },
  weekValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 60,
  },
  reflectionStats: {
    gap: 6,
  },
  reflectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  reflectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    minWidth: 20,
    textAlign: 'right',
  },
  authenticScoreBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    minWidth: 50,
  },
  authenticScoreLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  authenticScoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ec4899',
  },
});
