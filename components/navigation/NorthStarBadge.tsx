import React, { useEffect } from 'react';
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
import Svg, { Polygon } from 'react-native-svg';

interface NorthStarBadgeProps {
  size?: number;
  onPress: () => void;
  color?: string;
}

// Inline NorthStarIcon - no external import needed
function NorthStarIcon({ size = 24, color = '#231f20', strokeWidth = 3 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 144 144">
      <Polygon
        points="118.48 66.57 84.6 61.35 95.89 42.68 77.22 53.97 77.22 53.97 72 15.89 66.78 53.97 66.78 53.97 48.11 42.68 59.4 61.35 25.52 66.57 59.4 71.79 48.11 90.46 66.78 79.17 66.78 79.17 72 141.89 77.22 79.17 77.22 79.17 95.89 90.46 84.6 71.79 118.48 66.57"
        fill="none"
        stroke={color}
        strokeMiterlimit={10}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

export function NorthStarBadge({ 
  size = 24, 
  onPress,
  color = '#C9A227',
}: NorthStarBadgeProps) {
  
  // Try to use the hook, but provide fallback if it fails
  let shouldPulse = false;
  let isLoading = false;
  
  try {
    const { useNorthStarVisit } = require('@/hooks/NorthStarVisits');
    const visitState = useNorthStarVisit();
    shouldPulse = visitState?.shouldPulse ?? false;
    isLoading = visitState?.isLoading ?? false;
  } catch (error) {
    // Hook not available - default to showing the badge without pulse
    shouldPulse = false;
    isLoading = false;
  }

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (shouldPulse && !isLoading) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
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
      
      {/* NorthStar Icon - inline SVG */}
      <NorthStarIcon 
        size={size} 
        color={shouldPulse ? color : '#FFFFFF'}
        strokeWidth={3}
      />
      
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
    padding: 4,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  indicatorDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});