import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface DashboardCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  iconColor: string;
  iconBackgroundColor: string;
  onPress?: () => void;
}

export function DashboardCard({
  title,
  count,
  icon: Icon,
  iconColor,
  iconBackgroundColor,
  onPress
}: DashboardCardProps) {
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

      <View style={styles.content}>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.title}>{title}</Text>
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
});
