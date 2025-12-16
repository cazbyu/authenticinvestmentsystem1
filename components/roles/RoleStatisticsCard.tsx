import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
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
      {/* Top Row: Avatar, Name, Total, AS */}
      <View style={styles.topRow}>
        <View style={styles.identitySection}>
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
          <View style={styles.nameSection}>
            <Text style={styles.roleName} numberOfLines={1}>{role.label}</Text>
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
  roleImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  roleImageMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  roleImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleImageText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  roleImageTextMobile: {
    fontSize: 14,
  },
  nameSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleName: {
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
    color: '#0078d4',
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
