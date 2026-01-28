import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNorthStarVisit } from '@/hooks/useNorthStarVisit';

interface NorthStarBadgeProps {
  size?: number;
  onPress: () => void;
  color?: string;
}

export function NorthStarBadge({ 
  size = 24, 
  onPress,
  color = '#C9A227', // Gold color
}: NorthStarBadgeProps) {
  const { shouldPulse, isLoading } = useNorthStarVisit();
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (shouldPulse && !isLoading) {
      // Create pulsing animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite repeat
        false
      );
      
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      // Stop animation
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0.6;
    }

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, [shouldPulse, isLoading]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shouldPulse ? 1.05 : 1 }],
  }));

  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={styles.container}
      activeOpacity={0.7}
      accessibilityLabel="View your North Star - Mission and Vision"
      accessibilityRole="button"
    >
      {/* Pulse ring (only visible when pulsing) */}
      {shouldPulse && (
        <Animated.View style={[styles.pulseRing, pulseStyle, { 
          width: size + 12, 
          height: size + 12,
          borderRadius: (size + 12) / 2,
          borderColor: color,
        }]} />
      )}
      
      {/* Star icon */}
      <Animated.View style={iconStyle}>
        <Ionicons 
          name="star" 
          size={size} 
          color={shouldPulse ? color : '#9CA3AF'} 
        />
      </Animated.View>
      
      {/* Small dot indicator when pulsing */}
      {shouldPulse && (
        <View style={[styles.indicatorDot, { backgroundColor: '#EF4444' }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  indicatorDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});