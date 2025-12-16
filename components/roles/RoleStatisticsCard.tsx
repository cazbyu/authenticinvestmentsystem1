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
      {/* Top: Identity - Icon + Name */}
      <View style={styles.identityRow}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={[styles.roleImage, isMobile && styles.roleImageMobile]} />
        ) : (
          <View style={[
            styles.roleImagePlaceholder,
            isMobile && styles.roleImageMobile,
            { backgroundColor: role.color || '#0078d4' }
          ]}>
            <Text style={[styles.roleImageText, isMobile && styles.roleImageTextMobile]}>
              {role.label.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.roleName} numberOfLines={1}>{role.label}</Text>
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
  roleImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  roleImageMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  roleImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleImageText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  roleImageTextMobile: {
    fontSize: 14,
  },
  roleName: {
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
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  asMetric: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#6b7280',
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
    color: '#0078d4',
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
