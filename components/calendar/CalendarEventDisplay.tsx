import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task } from '@/components/tasks/TaskCard';
import { formatTimeForDisplay } from '@/lib/dateUtils';

interface CalendarEventDisplayProps {
  task: Task;
  onPress: (task: Task) => void;
  style?: any;
}

export function CalendarEventDisplay({ task, onPress, style }: CalendarEventDisplayProps) {
  const formatTime = (timeString: string) => {
    return formatTimeForDisplay(timeString);
  };

  const getBorderColor = () => {
    if (task.status === "completed") return "#3b82f6";
    if (task.is_urgent && task.is_important) return "#ef4444";
    if (!task.is_urgent && task.is_important) return "#22c55e";
    if (task.is_urgent && !task.is_important) return "#eab308";
    return "#9ca3af";
  };

  const isNoTimeTask = (task as any).isNoTimeTask;
  const isTask = task.type === 'task';
  const isEvent = task.type === 'event';
  const isCompleted = task.status === 'completed';

  return (
    <TouchableOpacity
      style={[
        styles.eventContainer,
        { borderLeftColor: getBorderColor(), borderColor: getBorderColor() },
        isNoTimeTask && styles.noTimeTaskContainer,
        isTask && styles.taskContainer,
        isCompleted && styles.completedContainer,
        style
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.8}
    >
      <View style={styles.eventContent}>
        <View style={styles.titleRow}>
          {isTask && <Text style={styles.typeIndicator}>📋</Text>}
          {isEvent && <Text style={styles.typeIndicator}>📅</Text>}
          <Text style={[styles.eventTitle, isNoTimeTask && styles.noTimeTaskTitle, isCompleted && styles.completedTitle]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        {!isNoTimeTask && task.start_time && task.end_time && (
          <Text style={styles.eventTime}>
            {formatTime(task.start_time)} – {formatTime(task.end_time)}
          </Text>
        )}
        {!isNoTimeTask && task.start_time && !task.end_time && (
          <Text style={styles.eventTime}>
            {formatTime(task.start_time)}
          </Text>
        )}
        {isNoTimeTask && (
          <Text style={styles.noTimeLabel}>
            No time set
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  eventContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderLeftWidth: 4,
    borderWidth: 2,
    padding: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  taskContainer: {
    borderLeftWidth: 3,
    borderStyle: 'solid',
  },
  completedContainer: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  eventContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeIndicator: {
    fontSize: 10,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 16,
    marginBottom: 2,
    flex: 1,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  eventTime: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  noTimeTaskContainer: {
    backgroundColor: '#f3f4f6',
    opacity: 0.9,
  },
  noTimeTaskTitle: {
    fontSize: 11,
    color: '#4b5563',
  },
  noTimeLabel: {
    fontSize: 9,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});