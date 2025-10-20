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

  return (
    <TouchableOpacity
      style={[
        styles.eventContainer,
        { borderLeftColor: getBorderColor() },
        isNoTimeTask && styles.noTimeTaskContainer,
        style
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.8}
    >
      <View style={styles.eventContent}>
        <Text style={[styles.eventTitle, isNoTimeTask && styles.noTimeTaskTitle]} numberOfLines={2}>
          {task.title}
        </Text>
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
    padding: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 16,
    marginBottom: 2,
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