import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions, ScrollView } from 'react-native';
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
  period?: 'week' | 'month' | 'year';
  loading?: boolean;
  onPress?: (role: Role) => void;
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

  if (loading || !statistics) {
    if (isMobile) {
      return (
        <View style={styles.mobileCard}>
          <View style={styles.mobileLoadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      );
    }
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

  if (isMobile) {
    const CardWrapper = onPress ? TouchableOpacity : View;
    const wrapperProps = onPress ? { onPress: () => onPress(role), activeOpacity: 0.7 } : {};

    return (
      <CardWrapper style={styles.mobileCard} {...wrapperProps}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.mobileRoleImage} />
        ) : (
          <View style={[styles.mobileRolePlaceholder, { backgroundColor: role.color || '#0078d4' }]}>
            <Text style={styles.mobileRolePlaceholderText}>
              {role.label.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.mobileRoleName}>{role.label}</Text>
        <View style={styles.mobileMetrics}>
          <View style={styles.mobileMetricItem}>
            <Text style={styles.mobileMetricLabel}>Completed</Text>
            <Text style={styles.mobileMetricValue}>{statistics.completedDeposits}</Text>
          </View>
          <View style={styles.mobileMetricItem}>
            <Text style={styles.mobileMetricLabel}>Scheduled</Text>
            <Text style={styles.mobileMetricValue}>{statistics.totalScheduled}</Text>
          </View>
        </View>
      </CardWrapper>
    );
  }

  const StripWrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress: () => onPress(role), activeOpacity: 0.8 } : {};

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <StripWrapper
        style={styles.dashboardStrip}
        {...wrapperProps}
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
        <Text style={styles.roleLabel}>{role.label}</Text>
      </View>

      {/* Center-Left: Summary Metrics */}
      <View style={styles.summarySection}>
        <View style={styles.summaryTile}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Completed</Text>
            <CheckCircle size={10} color="#10b981" />
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
          <Text style={styles.scheduleLabel}>Next 4 Weeks</Text>
          <Calendar size={10} color="#6b7280" />
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
      </StripWrapper>
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
    overflow: 'hidden',
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
  roleAvatar: {
    width: 70,
    height: 70,
    borderRadius: 4,
    marginBottom: 8,
  },
  roleAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  roleAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    width: '100%',
    lineHeight: 13,
  },
  summarySection: {
    gap: 10,
    width: 100,
    flexShrink: 0,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#9ca3af',
    alignItems: 'center',
  },
  summaryTile: {
    alignItems: 'center',
    width: '100%',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
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
    marginBottom: 4,
  },
  scheduleLabel: {
    fontSize: 9,
    color: '#4b5563',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scheduleGrid: {
    gap: 1,
  },
  scheduleRow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  quadrantSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
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
    gap: 4,
  },
  quadrantValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  mobileCard: {
    backgroundColor: '#d1d5db',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 180,
  },
  mobileLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  mobileRoleImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  mobileRolePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileRolePlaceholderText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },
  mobileRoleName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  mobileMetrics: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 8,
  },
  mobileMetricItem: {
    alignItems: 'center',
    gap: 4,
  },
  mobileMetricLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mobileMetricValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
});
