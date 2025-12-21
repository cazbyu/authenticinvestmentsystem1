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
          <>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.countScoreContainer}>
              <Text style={styles.count}>{count || 0}</Text>
              <Text style={styles.scoreText}>{(score || 0).toFixed(1)}</Text>
            </View>
          </>
        );

      case 'dualCount':
        return (
          <>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.dualCountContainer}>
              <View style={styles.countBlock}>
                <Text style={styles.count}>{primaryCount || 0}</Text>
                <Text style={styles.countLabel}>{primaryLabel || 'Primary'}</Text>
              </View>
              <View style={styles.countBlock}>
                <Text style={styles.count}>{secondaryCount || 0}</Text>
                <Text style={styles.countLabel}>{secondaryLabel || 'Secondary'}</Text>
              </View>
            </View>
          </>
        );

      case 'single':
      default:
        return (
          <>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.count}>{count || 0}</Text>
          </>
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
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
          <Icon size={24} color={iconColor} />
        </View>
        {renderContent()}
      </View>
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  count: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  countScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  dualCountContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 16,
  },
  countBlock: {
    alignItems: 'center',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
});
