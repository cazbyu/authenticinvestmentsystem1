import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
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
  const { width: screenWidth } = useWindowDimensions();

  // Responsive quadrant sizing based on screen width
  const quadrantSize = useMemo(() => {
    const availableWidth = columnWidth - 16;
    const maxSize = 52;
    const minSize = 36;

    // Mobile (< 400px): Smaller quadrants, always visible
    if (screenWidth < 400) {
      return Math.max(minSize, Math.min(42, availableWidth * 0.75));
    }
    // Tablet (400-768px): Medium quadrants
    else if (screenWidth < 768) {
      return Math.max(40, Math.min(48, availableWidth * 0.85));
    }
    // Desktop (>768px): Full size quadrants
    else {
      return Math.min(maxSize, availableWidth * 0.95);
    }
  }, [columnWidth, screenWidth]);

  // On mobile, show a more compact toggle button
  const isMobile = screenWidth < 400;
  const isTablet = screenWidth >= 400 && screenWidth < 768;

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.toggleHeader, isMobile && styles.toggleHeaderMobile]}>
        <TouchableOpacity
          onPress={onToggle}
          style={[styles.toggleButton, isMobile && styles.toggleButtonMobile]}
          activeOpacity={0.7}
        >
          <Text style={[styles.toggleText, isMobile && styles.toggleTextMobile]}>
            {isMobile ? 'Quadrants' : 'Priority Quadrants'}
          </Text>
          {isExpanded ? (
            <ChevronUp size={isMobile ? 16 : 20} color="#6b7280" />
          ) : (
            <ChevronDown size={isMobile ? 16 : 20} color="#6b7280" />
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
                  customSize={quadrantSize}
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
  toggleHeaderMobile: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44, // Touch-friendly minimum height
  },
  toggleButtonMobile: {
    gap: 6,
    minHeight: 40,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  toggleTextMobile: {
    fontSize: 11,
    letterSpacing: 0.3,
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
    paddingVertical: 8,
  },
});
