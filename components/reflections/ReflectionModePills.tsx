import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Tooltip from '@/components/common/Tooltip';

type ReflectionMode = 'rose' | 'thorn' | 'depositIdea';

interface ReflectionModePillsProps {
  selectedMode: ReflectionMode;
  onModeChange: (mode: ReflectionMode) => void;
}

export default function ReflectionModePills({ selectedMode, onModeChange }: ReflectionModePillsProps) {
  const { colors } = useTheme();

  const modes: { value: ReflectionMode; tooltip: string; icon: 'rose' | 'thorn' | 'idea' }[] = [
    {
      value: 'rose',
      tooltip: 'A success, joy, or meaningful moment to celebrate',
      icon: 'rose'
    },
    {
      value: 'thorn',
      tooltip: 'A moment that needs attention, care or improvement',
      icon: 'thorn'
    },
    {
      value: 'depositIdea',
      tooltip: 'A helpful idea worth capturing for future action',
      icon: 'idea'
    },
  ];

  const renderIcon = (icon: 'rose' | 'thorn' | 'idea', isSelected: boolean) => {
    if (icon === 'rose') {
      return (
        <Image
          source={require('@/assets/images/rose.png')}
          style={[
            styles.iconImage,
            isSelected && { tintColor: '#ffffff' }
          ]}
          resizeMode="contain"
        />
      );
    } else if (icon === 'thorn') {
      return (
        <Image
          source={require('@/assets/images/cactus-thorn.png')}
          style={[
            styles.iconImage,
            isSelected && { tintColor: '#ffffff' }
          ]}
          resizeMode="contain"
        />
      );
    } else {
      return (
        <Lightbulb
          size={24}
          color={isSelected ? '#ffffff' : colors.text}
          fill={isSelected ? '#ffffff' : 'none'}
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      {modes.map((mode) => {
        const isSelected = selectedMode === mode.value;

        return (
          <Tooltip key={mode.value} content={mode.tooltip}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
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
