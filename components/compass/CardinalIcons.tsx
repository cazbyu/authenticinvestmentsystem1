import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Circle, Text as SvgText } from 'react-native-svg';

interface CardinalIconsProps {
  visible: boolean;
  activeCardinal: 'north' | 'east' | 'south' | 'west' | null;
  size?: number;
}

const CARDINAL_CONFIG = {
  north: { angle: 0, label: 'MVV', icon: '⭐', color: '#ed1c24' },
  east: { angle: 90, label: 'Wellness', icon: '🌿', color: '#39b54a' },
  south: { angle: 180, label: 'Goals', icon: '🎯', color: '#00abc5' },
  west: { angle: 270, label: 'Roles', icon: '👥', color: '#ffd400' },
};

const ICON_RADIUS = 115;
const CENTER = 144;

export default function CardinalIcons({
  visible,
  activeCardinal,
  size = 288,
}: CardinalIconsProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    }),
  }));

  const calculatePosition = (angle: number) => {
    const angleRad = (angle - 90) * (Math.PI / 180);
    return {
      x: CENTER + ICON_RADIUS * Math.cos(angleRad),
      y: CENTER + ICON_RADIUS * Math.sin(angleRad),
    };
  };

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 288 288">
        {Object.entries(CARDINAL_CONFIG).map(([key, config]) => {
          const { x, y } = calculatePosition(config.angle);
          const isActive = activeCardinal === key;
          const circleRadius = isActive ? 18 : 14;
          const bgOpacity = isActive ? 1 : 0.7;

          return (
            <G key={key}>
              <Circle
                cx={x}
                cy={y}
                r={circleRadius}
                fill={config.color}
                opacity={bgOpacity}
              />
              <SvgText
                x={x}
                y={y + 5}
                fontSize={isActive ? 16 : 12}
                textAnchor="middle"
                fill="#fff"
              >
                {config.icon}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
});
