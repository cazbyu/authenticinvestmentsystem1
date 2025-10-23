import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { PriorityQuadrant } from './PriorityQuadrant';
import { Task } from '../tasks/TaskCard';

interface CollapsibleQuadrantRowProps {
  weekDates: Date[];
  tasksByDate: Record<string, Task[]>;
  columnWidth: number;
  isExpanded: boolean;
  onToggle: () => void;
  onQuadrantPress?: (quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4', tasks: Task[]) => void;
  showCompleted?: boolean;
}

export function CollapsibleQuadrantRow({
  weekDates,
  tasksByDate,
  columnWidth,
  isExpanded,
  onToggle,
  onQuadrantPress,
  showCompleted,
}: CollapsibleQuadrantRowProps) {
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleHeader}>
        <TouchableOpacity
          onPress={onToggle}
          style={styles.toggleButton}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleText}>Priority Quadrants</Text>
          {isExpanded ? (
            <ChevronUp size={20} color="#6b7280" />
          ) : (
            <ChevronDown size={20} color="#6b7280" />
          )}
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.quadrantRowContainer}>
          <View style={styles.timeColumnSpacer} />
          {weekDates.map((date, index) => {
            const dateStr = formatLocalDate(date);
            const dayTasks = tasksByDate[dateStr] || [];

            return (
              <View
                key={index}
                style={[
                  styles.quadrantCell,
                  columnWidth > 0 && { width: columnWidth },
                ]}
              >
                <PriorityQuadrant
                  tasks={dayTasks}
                  size="medium"
                  onPress={
                    onQuadrantPress
                      ? (quadrant) => onQuadrantPress(quadrant, dayTasks)
                      : undefined
                  }
                  showCompleted={showCompleted}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  toggleHeader: {
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  quadrantRowContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  timeColumnSpacer: {
    width: 70,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  quadrantCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    minWidth: 0,
  },
});
