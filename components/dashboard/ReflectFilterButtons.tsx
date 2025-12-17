import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lightbulb, BookOpen, Flower2, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type ReflectFilter = 'all' | 'depositIdea' | 'rose' | 'thorn' | 'reflection';

interface ReflectFilterButtonsProps {
  activeFilter: ReflectFilter;
  onFilterChange: (filter: ReflectFilter) => void;
}

export function ReflectFilterButtons({
  activeFilter,
  onFilterChange,
}: ReflectFilterButtonsProps) {
  const { colors } = useTheme();

  const renderFilterButton = (
    filter: ReflectFilter,
    label: string,
    icon?: React.ReactNode
  ) => {
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
        <View style={styles.buttonContent}>
          {icon}
          {label && (
            <Text
              style={[
                styles.filterText,
                { color: isActive ? '#ffffff' : colors.text },
              ]}
            >
              {label}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {renderFilterButton('all', 'All')}
      {renderFilterButton(
        'depositIdea',
        '',
        <Lightbulb
          size={18}
          color={activeFilter === 'depositIdea' ? '#ffffff' : '#f59e0b'}
        />
      )}
      {renderFilterButton(
        'rose',
        '',
        <Flower2
          size={18}
          color={activeFilter === 'rose' ? '#ffffff' : '#ec4899'}
        />
      )}
      {renderFilterButton(
        'thorn',
        '',
        <AlertTriangle
          size={18}
          color={activeFilter === 'thorn' ? '#ffffff' : '#ef4444'}
        />
      )}
      {renderFilterButton(
        'reflection',
        '',
        <BookOpen
          size={18}
          color={activeFilter === 'reflection' ? '#ffffff' : '#8b5cf6'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
