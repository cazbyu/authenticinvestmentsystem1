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
}

export function calculateQuadrantCounts(tasks: PriorityQuadrantProps['tasks']): QuadrantCounts {
  const counts: QuadrantCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

  tasks.forEach((task) => {
    // Only count pending/incomplete tasks
    if (task.status === 'completed') return;

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

  return counts;
}

export function PriorityQuadrant({
  tasks,
  size = 'medium',
  onPress,
  style
}: PriorityQuadrantProps) {
  const counts = calculateQuadrantCounts(tasks);

  const dimensions = {
    small: { container: 48, text: 10 },
    medium: { container: 64, text: 13 },
    large: { container: 80, text: 16 },
  }[size];

  const renderQuadrant = (
    quadrant: keyof QuadrantCounts,
    color: string,
    position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  ) => {
    // Calculate half dimensions for each quadrant (accounting for borders)
    const quadrantSize = (dimensions.container - 4) / 2; // Subtract border widths and divide by 2

    const content = (
      <View
        style={[
          styles.quadrant,
          {
            width: quadrantSize,
            height: quadrantSize,
            backgroundColor: counts[quadrant] > 0 ? color : '#f3f4f6',
            borderTopLeftRadius: position === 'topLeft' ? 8 : 0,
            borderTopRightRadius: position === 'topRight' ? 8 : 0,
            borderBottomLeftRadius: position === 'bottomLeft' ? 8 : 0,
            borderBottomRightRadius: position === 'bottomRight' ? 8 : 0,
          },
        ]}
      >
        <Text
          style={[
            styles.quadrantText,
            {
              fontSize: dimensions.text,
              color: counts[quadrant] > 0 ? '#ffffff' : '#9ca3af',
              fontWeight: counts[quadrant] > 0 ? '700' : '500',
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
    borderWidth: 2,
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
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  quadrantText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
