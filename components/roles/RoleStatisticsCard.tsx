import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { CheckCircle, Calendar, Flower, AlertCircle, Lightbulb, FileText } from 'lucide-react-native';
import { RoleStatistics } from '@/lib/roleStatistics';

interface Role {
  id: string;
  label: string;
  category?: string;
  image_path?: string;
  color?: string;
}

interface RoleStatisticsCardProps {
  role: Role;
  statistics: RoleStatistics | null;
  loading?: boolean;
  onPress: (role: Role) => void;
  imageUrl?: string;
}

export function RoleStatisticsCard({
  role,
  statistics,
  loading = false,
  onPress,
  imageUrl
}: RoleStatisticsCardProps) {
  if (loading || !statistics) {
    return (
      <View style={[styles.card, { borderLeftColor: role.color || '#0078d4' }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: role.color || '#0078d4' }]}
      onPress={() => onPress(role)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {/* Left: Icon and Name (vertically centered) */}
        <View style={styles.leftSection}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.roleImage} />
          ) : (
            <View style={[styles.roleImagePlaceholder, { backgroundColor: role.color || '#0078d4' }]}>
              <Text style={styles.roleImageText}>{role.label.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.roleNameContainer}>
            <Text style={styles.roleName} numberOfLines={2}>{role.label}</Text>
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
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
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
  },
  roleImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  roleImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleImageText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  roleNameContainer: {
    flex: 1,
    gap: 4,
  },
  roleName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  depositCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  middleSection: {
    flex: 1,
    gap: 4,
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
    gap: 3,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekLabel: {
    fontSize: 11,
    color: '#6b7280',
    width: 22,
  },
  weekCheckbox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 2,
    backgroundColor: '#ecfdf5',
  },
  weekValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  quadrantValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  authenticScoreBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    minWidth: 64,
  },
  authenticScoreLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  authenticScoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0078d4',
  },
});
