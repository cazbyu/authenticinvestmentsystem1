import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle, Calendar, TrendingUp, TrendingDown, BookOpen, Lightbulb } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface FollowThroughButtonBarProps {
  onPressTask: () => void;
  onPressEvent: () => void;
  onPressRose: () => void;
  onPressThorn: () => void;
  onPressReflection: () => void;
  onPressDepositIdea: () => void;
}

export default function FollowThroughButtonBar({
  onPressTask,
  onPressEvent,
  onPressRose,
  onPressThorn,
  onPressReflection,
  onPressDepositIdea,
}: FollowThroughButtonBarProps) {
  const { colors } = useTheme();

  const buttonItems = [
    { icon: CheckCircle, onPress: onPressTask, color: colors.primary },
    { icon: Calendar, onPress: onPressEvent, color: colors.secondary },
    { icon: TrendingUp, onPress: onPressRose, color: '#10b981' },
    { icon: TrendingDown, onPress: onPressThorn, color: '#ef4444' },
    { icon: BookOpen, onPress: onPressReflection, color: '#8b5cf6' },
    { icon: Lightbulb, onPress: onPressDepositIdea, color: '#f59e0b' },
  ];

  return (
    <View style={styles.container}>
      {buttonItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={index}
            style={[styles.button, { backgroundColor: `${item.color}15` }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Icon size={24} color={item.color} strokeWidth={2} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 8,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
