import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Users } from 'lucide-react-native';
import { RoleMetrics } from '@/lib/dashboardSummaryMetrics';

interface RoleSummaryCardProps {
  metrics: RoleMetrics;
  onPress: () => void;
}

export function RoleSummaryCard({ metrics, onPress }: RoleSummaryCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Users size={24} color="#AF52DE" />
        </View>
        <Text style={styles.title}>Roles</Text>
      </View>

      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          <Text style={styles.metricValue}>{metrics.activeRoles}</Text>
          <Text style={styles.metricLabel}>Active</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricRow}>
          <Text style={styles.metricValue}>{metrics.totalRoles}</Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Balance Score</Text>
        <View style={styles.balanceBar}>
          <View
            style={[
              styles.balanceFill,
              { width: `${metrics.balanceScore}%` }
            ]}
          />
        </View>
        <Text style={styles.balanceText}>{metrics.balanceScore}%</Text>
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
    backgroundColor: '#F3E5F5',
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
    color: '#AF52DE',
    marginBottom: 4,
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
  balanceContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  balanceBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  balanceFill: {
    height: '100%',
    backgroundColor: '#AF52DE',
    borderRadius: 4,
  },
  balanceText: {
    fontSize: 14,
    color: '#AF52DE',
    fontWeight: '600',
    textAlign: 'center',
  },
});
