import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type ReflectionMode = 'reflection' | 'depositIdea' | 'withdrawal';

interface ReflectionModePillsProps {
  selectedMode: ReflectionMode;
  onModeChange: (mode: ReflectionMode) => void;
}

export default function ReflectionModePills({ selectedMode, onModeChange }: ReflectionModePillsProps) {
  const { colors } = useTheme();

  const modes: { value: ReflectionMode; label: string }[] = [
    { value: 'reflection', label: 'Reflection' },
    { value: 'depositIdea', label: 'Deposit Idea' },
    { value: 'withdrawal', label: 'Withdrawal' },
  ];

  return (
    <View style={styles.container}>
      {modes.map((mode) => (
        <TouchableOpacity
          key={mode.value}
          style={[
            styles.pill,
            { borderColor: colors.border, backgroundColor: colors.surface },
            selectedMode === mode.value && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={() => onModeChange(mode.value)}
        >
          <Text
            style={[
              styles.pillText,
              { color: selectedMode === mode.value ? '#ffffff' : colors.text }
            ]}
          >
            {mode.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
