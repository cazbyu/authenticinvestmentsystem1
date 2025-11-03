import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export type QuadrantCounts = {
  Q1: number; // Urgent + Important
  Q2: number; // Not Urgent + Important
  Q3: number; // Urgent + Not Important
  Q4: number; // Not Urgent + Not Important
};

export interface PriorityQuadrantProps {
  tasks: Array<{
    is_urgent: boolean;
    is_important: boolean;
    status: string;
  }>;
  size?: 'small' | 'medium' | 'large';
  onPress?: (quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4') => void;
  style?: object;
  customSize?: number;
}

export function calculateQuadrantCounts(
  tasks: PriorityQuadrantProps['tasks']
): QuadrantCounts {
  const counts: QuadrantCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

  // Debug: Check for duplicate task IDs (recurring tasks counted multiple times)
  if (tasks.length > 0) {
    const taskIds = tasks.map((t: any) => t.task_id || t.id);
    const uniqueTaskIds = new Set(taskIds);
    console.log('Total task entries:', tasks.length);
    console.log('Unique tasks:', uniqueTaskIds.size);
    console.log('Duplicate count:', tasks.length - uniqueTaskIds.size);

    // Check if tasks have occurrence_date (recurring instances)
    const withOccurrence = tasks.filter((t: any) => t.occurrence_date).length;
    console.log('Tasks with occurrence_date:', withOccurrence);
  }

  tasks.forEach((task) => {
    if (task.is_urgent && task.is_important) {
      counts.Q1++;
    } else if (!task.is_urgent && task.is_important) {
      counts.Q2++;
    } else if (task.is_urgent && !task.is_important) {
      counts.Q3++;
    } else {
      counts.Q4++;
    }
  });

  console.log('Quadrant counts:', counts);
  return counts;
}

export function PriorityQuadrant({
  tasks,
  size = 'medium',
  onPress,
  style,
  customSize
}: PriorityQuadrantProps) {
  const counts = calculateQuadrantCounts(tasks);

  const predefinedDimensions = {
    small: { container: 48, text: 10 },
    medium: { container: 64, text: 13 },
    large: { container: 80, text: 16 },
  }[size];

  const dimensions = customSize
    ? { container: customSize, text: Math.max(8, Math.floor(customSize / 5)) }
    : predefinedDimensions;

  const renderQuadrant = (
    quadrant: keyof QuadrantCounts,
    color: string,
    position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  ) => {
    // Calculate exact half of container size
    const quadrantSize = dimensions.container / 2;

    const content = (
      <View
        style={[
          styles.quadrant,
          {
            width: quadrantSize,
            height: quadrantSize,
            backgroundColor: color,
          },
        ]}
      >
        <Text
          style={[
            styles.quadrantText,
            {
              fontSize: dimensions.text,
              color: '#ffffff',
              fontWeight: '700',
            },
          ]}
        >
          {counts[quadrant]}
        </Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity
          key={quadrant}
          onPress={() => onPress(quadrant)}
          activeOpacity={0.7}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return <View key={quadrant}>{content}</View>;
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: dimensions.container,
          height: dimensions.container,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {renderQuadrant('Q1', '#ef4444', 'topLeft')}
        {renderQuadrant('Q2', '#22c55e', 'topRight')}
      </View>
      <View style={styles.row}>
        {renderQuadrant('Q3', '#f59e0b', 'bottomLeft')}
        {renderQuadrant('Q4', '#9ca3af', 'bottomRight')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
  },
  quadrant: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#1f2937',
  },
  quadrantText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
