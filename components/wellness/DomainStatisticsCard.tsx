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
      {/* Top Row: Icon, Name, Total, AS */}
      <View style={styles.topRow}>
        <View style={styles.identitySection}>
          <View style={[styles.domainIconContainer, isMobile && styles.domainIconMobile]}>
            <Heart size={isMobile ? 24 : 32} color="#ec4899" />
          </View>
          <View style={styles.nameSection}>
            <Text style={styles.domainName} numberOfLines={1}>{domain.name}</Text>
            <Text style={styles.depositCount}>{statistics.completedDeposits}</Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <View style={styles.authenticScoreBadge}>
            <Text style={styles.authenticScoreLabel}>AS</Text>
            <Text style={styles.authenticScoreValue}>{statistics.authenticScore}</Text>
          </View>
        </View>
      </View>

      {/* Bottom Row: Weekly Data & Quadrant */}
      <View style={styles.bottomRow}>
        <View style={styles.weeklySection}>
          <View style={styles.weeksCompact}>
            <View style={styles.weekItem}>
              <Text style={styles.weekLabelCompact}>W1</Text>
              <View style={styles.weekCheckboxSmall} />
              <Text style={styles.weekValueCompact}>{statistics.scheduledByWeek.week1}</Text>
            </View>
            <View style={styles.weekItem}>
              <Text style={styles.weekLabelCompact}>W2</Text>
              <View style={styles.weekCheckboxSmall} />
              <Text style={styles.weekValueCompact}>{statistics.scheduledByWeek.week2}</Text>
            </View>
            <View style={styles.weekItem}>
              <Text style={styles.weekLabelCompact}>W3</Text>
              <View style={styles.weekCheckboxSmall} />
              <Text style={styles.weekValueCompact}>{statistics.scheduledByWeek.week3}</Text>
            </View>
            <View style={styles.weekItem}>
              <Text style={styles.weekLabelCompact}>W4</Text>
              <View style={styles.weekCheckboxSmall} />
              <Text style={styles.weekValueCompact}>{statistics.scheduledByWeek.week4}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quadrantSection}>
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
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  identitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  domainIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainIconMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  nameSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  domainName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  depositCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  scoreSection: {
    marginLeft: 8,
  },
  authenticScoreBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 48,
  },
  authenticScoreLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500',
  },
  authenticScoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ec4899',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  weeklySection: {
    flex: 1,
  },
  weeksCompact: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  weekItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  weekLabelCompact: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  weekCheckboxSmall: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 2,
    backgroundColor: '#ecfdf5',
  },
  weekValueCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  quadrantSection: {
    marginLeft: 8,
  },
  reflectionQuadrant: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quadrantRow: {
    flexDirection: 'row',
  },
  quadrantCell: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  quadrantValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
  },
});
