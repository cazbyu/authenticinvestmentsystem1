import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';

interface PeriodSelectorProps {
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

export function PeriodSelector({ selectedPeriod, onPeriodChange }: PeriodSelectorProps) {
  const periods: { value: TimePeriod; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' }
  ];

  return (
    <View style={styles.container}>
      {periods.map(period => (
        <TouchableOpacity
          key={period.value}
          style={[
            styles.button,
            selectedPeriod === period.value && styles.buttonSelected
          ]}
          onPress={() => onPeriodChange(period.value)}
        >
          <Text
            style={[
              styles.buttonText,
              selectedPeriod === period.value && styles.buttonTextSelected
            ]}
          >
            {period.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  buttonTextSelected: {
    color: '#fff',
  },
});
