import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Target } from 'lucide-react-native';
import { GoalMetrics } from '@/lib/dashboardSummaryMetrics';

interface GoalSummaryCardProps {
  metrics: GoalMetrics;
  onPress: () => void;
}

export function GoalSummaryCard({ metrics, onPress }: GoalSummaryCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Target size={24} color="#34C759" />
        </View>
        <Text style={styles.title}>Goals</Text>
      </View>

      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          <Text style={styles.metricValue}>{metrics.inProgress}</Text>
          <Text style={styles.metricLabel}>In Progress</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricRow}>
          <Text style={[styles.metricValue, styles.completedValue]}>
            {metrics.completed}
          </Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.totalText}>{metrics.total} Total Goals</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  metricRow: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF9500',
    marginBottom: 4,
  },
  completedValue: {
    color: '#34C759',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  totalText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});
