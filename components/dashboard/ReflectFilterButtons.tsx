import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

const roseImage = require('@/assets/images/rose-81.png');
const thornImage = require('@/assets/images/thorn-81.png');
const reflectionImage = require('@/assets/images/reflections-72.png');
const depositIdeaImage = require('@/assets/images/deposit-idea.png');

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
        <Image
          source={depositIdeaImage}
          style={[styles.filterIcon, activeFilter === 'depositIdea' && styles.filterIconActive]}
          resizeMode="contain"
        />
      )}
      {renderFilterButton(
        'rose',
        '',
        <Image
          source={roseImage}
          style={[styles.filterIcon, activeFilter === 'rose' && styles.filterIconActive]}
          resizeMode="contain"
        />
      )}
      {renderFilterButton(
        'thorn',
        '',
        <Image
          source={thornImage}
          style={[styles.filterIcon, activeFilter === 'thorn' && styles.filterIconActive]}
          resizeMode="contain"
        />
      )}
      {renderFilterButton(
        'reflection',
        '',
        <Image
          source={reflectionImage}
          style={[styles.filterIcon, activeFilter === 'reflection' && styles.filterIconActive]}
          resizeMode="contain"
        />
      )}
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
  filterIcon: {
    width: 20,
    height: 20,
    opacity: 0.8,
  },
  filterIconActive: {
    opacity: 1,
    tintColor: '#ffffff',
  },
});
