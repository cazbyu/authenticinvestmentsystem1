import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBackgroundColor: string;
  onPress?: () => void;
  displayMode?: 'single' | 'countScore' | 'dualCount';
  count?: number;
  score?: number;
  primaryCount?: number;
  secondaryCount?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function DashboardCard({
  title,
  icon: Icon,
  iconColor,
  iconBackgroundColor,
  onPress,
  displayMode = 'single',
  count,
  score,
  primaryCount,
  secondaryCount,
  primaryLabel,
  secondaryLabel,
}: DashboardCardProps) {
  const renderContent = () => {
    switch (displayMode) {
      case 'countScore':
        return (
          <View style={styles.content}>
            <View style={styles.countScoreContainer}>
              <Text style={styles.count}>{count || 0}</Text>
              <Text style={styles.scoreText}>+{(score || 0).toFixed(1)} pts</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>
        );

      case 'dualCount':
        return (
          <View style={styles.content}>
            <View style={styles.dualCountContainer}>
              <View style={styles.countBlock}>
                <Text style={styles.smallCount}>{primaryCount || 0}</Text>
                <Text style={styles.countLabel}>{primaryLabel || 'Primary'}</Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.countBlock}>
                <Text style={styles.smallCount}>{secondaryCount || 0}</Text>
                <Text style={styles.countLabel}>{secondaryLabel || 'Secondary'}</Text>
              </View>
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>
        );

      case 'single':
      default:
        return (
          <View style={styles.content}>
            <Text style={styles.count}>{count || 0}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        );
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
          <Icon size={24} color={iconColor} />
        </View>
      </View>

      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 120,
    flex: 1,
    marginHorizontal: 6,
    marginVertical: 6,
  },
  header: {
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'flex-start',
  },
  count: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  countScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
  },
  dualCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  countBlock: {
    alignItems: 'center',
  },
  smallCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 2,
  },
  separator: {
    width: 1,
    height: 30,
    backgroundColor: '#d1d5db',
  },
});
