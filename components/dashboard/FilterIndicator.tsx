import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';

interface FilterIndicatorProps {
  period: TimePeriod;
  onClear: () => void;
}

export function FilterIndicator({ period, onClear }: FilterIndicatorProps) {
  const getPeriodLabel = (period: TimePeriod): string => {
    switch (period) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Filtered: {getPeriodLabel(period)}</Text>
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <X size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
  },
  badgeText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
