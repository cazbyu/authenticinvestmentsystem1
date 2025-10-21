import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PriorityQuadrant } from './PriorityQuadrant';
import { Task } from '../tasks/TaskCard';

interface WeekColumnHeaderProps {
  dayLabel: string;
  dateNumber: number;
  isToday: boolean;
  tasks: Task[];
  onPress?: () => void;
  onQuadrantPress?: (quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4') => void;
  showCompleted?: boolean;
}

export function WeekColumnHeader({
  dayLabel,
  dateNumber,
  isToday,
  tasks,
  onPress,
  onQuadrantPress,
  showCompleted,
}: WeekColumnHeaderProps) {
  const content = (
    <View style={[styles.container, isToday && styles.todayContainer]}>
      <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
        {dayLabel}
      </Text>
      <View style={styles.dateRow}>
        <View style={[styles.dateCircle, isToday && styles.todayDateCircle]}>
          <Text style={[styles.dateNumber, isToday && styles.todayDateNumber]}>
            {dateNumber}
          </Text>
        </View>
        <PriorityQuadrant
          tasks={tasks}
          size="small"
          style={styles.quadrant}
          onPress={onQuadrantPress}
          showCompleted={showCompleted}
        />
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
    padding: 12,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 8,
  },
  todayLabel: {
    color: '#0078d4',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayDateCircle: {
    backgroundColor: '#0078d4',
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  todayDateNumber: {
    color: '#ffffff',
  },
  quadrant: {
    marginLeft: 4,
  },
});
