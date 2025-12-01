import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface DraggableFabProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  size?: number;
  backgroundColor?: string;
}

export function DraggableFab({
  onPress,
  children,
  style,
  size = 24,
  backgroundColor
}: DraggableFabProps) {
  const { colors } = useTheme();
  const fabBackgroundColor = backgroundColor || colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fabBackgroundColor,
        },
        style,
      ]}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
});
