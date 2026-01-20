import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Tooltip from '@/components/common/Tooltip';

type ReflectionMode = 'rose' | 'thorn' | 'depositIdea' | 'reflection';

interface ReflectionModePillsProps {
  selectedMode: ReflectionMode;
  onModeChange: (mode: ReflectionMode) => void;
}

export default function ReflectionModePills({ selectedMode, onModeChange }: ReflectionModePillsProps) {
  const { colors } = useTheme();

  const modes: { value: ReflectionMode; tooltip: string; icon: 'rose' | 'thorn' | 'idea' | 'note' }[] = [
    {
      value: 'rose',
      tooltip: 'Rose',
      icon: 'rose'
    },
    {
      value: 'thorn',
      tooltip: 'Thorn',
      icon: 'thorn'
    },
    {
      value: 'depositIdea',
      tooltip: 'Deposit Idea',
      icon: 'idea'
    },
    {
      value: 'reflection',
      tooltip: 'Reflection',
      icon: 'note'
    },
  ];

  const renderIcon = (icon: 'rose' | 'thorn' | 'idea' | 'note', isSelected: boolean) => {
    if (icon === 'rose') {
      return (
        <Image
          source={require('@/assets/images/rose-81.png')}
          style={[styles.iconImage, { opacity: isSelected ? 1 : 0.7 }]}
          resizeMode="contain"
        />
      );
    } else if (icon === 'thorn') {
      return (
        <Image
          source={require('@/assets/images/thorn-81.svg')}
          style={[styles.iconImage, { opacity: isSelected ? 1 : 0.7 }]}
          resizeMode="contain"
        />
      );
    } else if (icon === 'idea') {
      return (
        <Image
          source={require('@/assets/images/deposit-idea.svg')}
          style={[styles.iconImage, { opacity: isSelected ? 1 : 0.7 }]}
          resizeMode="contain"
        />
      );
    } else {
      return (
        <Image
          source={require('@/assets/images/reflections-72.svg')}
          style={[styles.iconImage, { opacity: isSelected ? 1 : 0.7 }]}
          resizeMode="contain"
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      {modes.map((mode) => {
        const isSelected = selectedMode === mode.value;

        // Use purple color for reflection mode
        const backgroundColor = mode.value === 'reflection' && isSelected
          ? '#9333ea'  // purple-600
          : isSelected
            ? colors.primary
            : colors.surface;
        const borderColor = mode.value === 'reflection' && isSelected
          ? '#9333ea'  // purple-600
          : isSelected
            ? colors.primary
            : colors.border;

        return (
          <Tooltip key={mode.value} content={mode.tooltip}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                { borderColor, backgroundColor }
              ]}
              onPress={() => onModeChange(mode.value)}
              activeOpacity={0.7}
            >
              {renderIcon(mode.icon, isSelected)}
            </TouchableOpacity>
          </Tooltip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  iconImage: {
    width: 32,
    height: 32,
  },
});
