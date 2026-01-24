import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

interface CompassHubProps {
  size?: number;
  isSpinning?: boolean;
  onTap?: () => void;
  activeZone?: 'mission' | 'wellness' | 'goals' | 'roles' | null;
  activeCardinal?: 'north' | 'east' | 'south' | 'west' | null;
}

const ZONE_COLORS = {
  mission: '#ed1c24',
  wellness: '#39b54a',
  goals: '#4169E1',
  roles: '#9370DB',
};

const CARDINAL_TO_ANGLE = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

const DEFAULT_CENTER_COLOR = '#ed1c24';
const HUB_WHITE = '#fff';

export default function CompassHub({
  size = 288,
  isSpinning = false,
  onTap,
  activeZone = null,
  activeCardinal = null,
}: CompassHubProps) {
  const spindleRotation = useSharedValue(0);
  const hubIconOpacity = useSharedValue(0);

  const centerColor = activeZone ? ZONE_COLORS[activeZone] : DEFAULT_CENTER_COLOR;

  useEffect(() => {
    if (activeCardinal) {
      const targetAngle = CARDINAL_TO_ANGLE[activeCardinal];
      spindleRotation.value = withTiming(targetAngle, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
      hubIconOpacity.value = withTiming(1, { duration: 400 });
    } else {
      spindleRotation.value = withTiming(0, { duration: 400 });
      hubIconOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [activeCardinal]);

  const spindleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: size / 2 },
        { translateY: size / 2 },
        { rotate: `${spindleRotation.value}deg` },
        { translateX: -size / 2 },
        { translateY: -size / 2 },
      ],
    };
  });

  const hubIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: hubIconOpacity.value,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]} pointerEvents="none">
      {/* Silver spindle that rotates to active cardinal */}
      <Animated.View style={[StyleSheet.absoluteFill, spindleAnimatedStyle]}>
        <Svg
          width={size}
          height={size}
          viewBox="0 0 288 288"
        >
          <G>
            <Path
              d="M144,130 L144,50 M140,55 L144,50 L148,55"
              stroke="#999999"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        </Svg>
      </Animated.View>

      {/* Small icon in center when cardinal is active */}
      {activeCardinal && (
        <Animated.View style={[styles.hub, hubIconAnimatedStyle]}>
          <Svg width={20} height={20} viewBox="0 0 20 20">
            <Path
              d="M10,2 L12,8 L18,10 L12,12 L10,18 L8,12 L2,10 L8,8 Z"
              fill={centerColor}
              stroke={HUB_WHITE}
              strokeWidth="1"
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hub: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});