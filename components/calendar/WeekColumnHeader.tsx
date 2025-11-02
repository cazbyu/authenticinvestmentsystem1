import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task } from '../tasks/TaskCard';

interface WeekColumnHeaderProps {
  dayLabel: string;
  dateNumber: number;
  isToday: boolean;
  tasks: Task[];
  onPress?: () => void;
  onQuadrantPress?: (quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4') => void;
}

export function WeekColumnHeader({
  dayLabel,
  dateNumber,
  isToday,
  tasks,
  onPress,
  onQuadrantPress,
}: WeekColumnHeaderProps) {
  const content = (
    <View style={[styles.container, isToday && styles.todayContainer]}>
      <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
        {dayLabel}
      </Text>
      <View style={[styles.dateCircle, isToday && styles.todayDateCircle]}>
        <Text style={[styles.dateNumber, isToday && styles.todayDateNumber]}>
          {dateNumber}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    minHeight: 80,
  },
  todayContainer: {
    backgroundColor: '#f0f9ff',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  todayLabel: {
    color: '#0078d4',
  },
  dateCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayDateCircle: {
    backgroundColor: '#0078d4',
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  todayDateNumber: {
    color: '#ffffff',
  },
});
