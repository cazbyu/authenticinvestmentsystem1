import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { CircleCheck as CheckCircle, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const roseImage = require('@/assets/images/rose-81.svg');
const thornImage = require('@/assets/images/thorn-81.svg');
const reflectionImage = require('@/assets/images/reflections-72.svg');
const depositIdeaImage = require('@/assets/images/deposit-idea.svg');

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
    { image: roseImage, onPress: onPressRose, color: '#10b981' },
    { image: thornImage, onPress: onPressThorn, color: '#ef4444' },
    { image: reflectionImage, onPress: onPressReflection, color: '#8b5cf6' },
    { image: depositIdeaImage, onPress: onPressDepositIdea, color: '#f59e0b' },
  ];

  return (
    <View style={styles.container}>
      {buttonItems.map((item, index) => {
        return (
          <TouchableOpacity
            key={index}
            style={[styles.button, { backgroundColor: `${item.color}15` }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            {item.image ? (
              <Image source={item.image} style={styles.buttonImage} resizeMode="contain" />
            ) : item.icon ? (
              React.createElement(item.icon, { size: 24, color: item.color, strokeWidth: 2 })
            ) : null}
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
  buttonImage: {
    width: 28,
    height: 28,
  },
});
