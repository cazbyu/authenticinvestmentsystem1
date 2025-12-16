import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { CircleCheck as CheckCircle, Calendar, Flower, CircleAlert as AlertCircle, Lightbulb, FileText } from 'lucide-react-native';
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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  if (loading || !statistics) {
    return (
      <View style={styles.dashboardStrip}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.dashboardStrip}
      onPress={() => onPress(role)}
      activeOpacity={0.8}
    >
      {/* Left: Role Identity */}
      <View style={styles.identitySection}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.roleAvatar} />
        ) : (
          <View style={[styles.roleAvatarPlaceholder, { backgroundColor: role.color || '#0078d4' }]}>
            <Text style={styles.roleAvatarText}>
              {role.label.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.roleLabel} numberOfLines={1}>{role.label}</Text>
      </View>

      {/* Center-Left: Summary Metrics */}
      <View style={styles.summarySection}>
        <View style={styles.summaryTile}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Deposits</Text>
            <CheckCircle size={12} color="#10b981" />
          </View>
          <Text style={styles.summaryValue}>{statistics.completedDeposits}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>AS</Text>
          <Text style={styles.summaryValue}>{statistics.authenticScore}</Text>
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
          <Flower size={20} color="#ec4899" />
          <Text style={styles.quadrantValue}>{statistics.reflectionStats.roses}</Text>
        </View>
        <View style={styles.quadrantTile}>
          <Lightbulb size={20} color="#f59e0b" />
          <Text style={styles.quadrantValue}>{statistics.reflectionStats.depositIdeas}</Text>
        </View>
        <View style={styles.quadrantTile}>
          <AlertCircle size={20} color="#ef4444" />
          <Text style={styles.quadrantValue}>{statistics.reflectionStats.thorns}</Text>
        </View>
        <View style={styles.quadrantTile}>
          <FileText size={20} color="#6b7280" />
          <Text style={styles.quadrantValue}>{statistics.reflectionStats.reflectionsAndNotes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dashboardStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    minHeight: 110,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  identitySection: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  roleAvatar: {
    width: 70,
    height: 70,
    borderRadius: 6,
    marginBottom: 6,
  },
  roleAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  summarySection: {
    gap: 10,
  },
  summaryTile: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    minWidth: 95,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  scheduleSection: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    minWidth: 110,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  scheduleLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
  },
  scheduleGrid: {
    gap: 3,
  },
  scheduleRow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  quadrantSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 140,
    gap: 8,
  },
  quadrantTile: {
    width: 66,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quadrantValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
});
