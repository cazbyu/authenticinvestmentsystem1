import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type ActFilter = 'all' | 'task' | 'event';

interface ActFilterButtonsProps {
  activeFilter: ActFilter;
  onFilterChange: (filter: ActFilter) => void;
}

export function ActFilterButtons({
  activeFilter,
  onFilterChange,
}: ActFilterButtonsProps) {
  const { colors } = useTheme();

  const renderFilterButton = (filter: ActFilter, label: string) => {
    const isActive = activeFilter === filter;

    return (
      <TouchableOpacity
        key={filter}
        style={[
          styles.filterButton,
          isActive && { backgroundColor: colors.primary },
        ]}
        onPress={() => onFilterChange(filter)}
        accessibilityLabel={`${label} filter`}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
      >
        <Text
          style={[
            styles.filterText,
            { color: isActive ? '#ffffff' : colors.text },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {renderFilterButton('all', 'All')}
      {renderFilterButton('task', 'Tasks')}
      {renderFilterButton('event', 'Events')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
