import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';

interface PeriodSelectorProps {
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  score?: number;
}

export function PeriodSelector({ selectedPeriod, onPeriodChange, score }: PeriodSelectorProps) {
  const periods: { value: TimePeriod; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All' }
  ];

  const formatScore = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}`;
  };

  return (
    <View style={styles.wrapper}>
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
      {score !== undefined && (
        <Text style={styles.scoreText}>{formatScore(score)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 'auto',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  buttonSelected: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  buttonTextSelected: {
    color: '#fff',
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0078d4',
  },
});
