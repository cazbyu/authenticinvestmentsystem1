import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Circle, Path } from 'react-native-svg';

interface CardinalIconsProps {
  activeCardinal: 'north' | 'east' | 'south' | 'west' | null;
  size?: number;
  theme?: 'light' | 'dark';
}

const CENTER = 144;
const ICON_RADIUS = 115;

const ICON_PATHS = {
  north: 'M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z',
  east: 'M0,-7 C4,-7 7,-4 7,0 C7,4 4,7 0,7 C0,3 -3,0 -3,-4 C-3,-6 -1,-7 0,-7 Z M0,-4 L0,4',
  south: 'M0,-7 A7,7 0 1,1 0,7 A7,7 0 1,1 0,-7 M0,-4 A4,4 0 1,1 0,4 A4,4 0 1,1 0,-4 M0,-1.5 A1.5,1.5 0 1,1 0,1.5 A1.5,1.5 0 1,1 0,-1.5',
  west: 'M-3,-6 A2,2 0 1,1 -3,-2 A2,2 0 1,1 -3,-6 M-3,0 L-3,5 M-6,2 L0,2 M3,-6 A2,2 0 1,1 3,-2 A2,2 0 1,1 3,-6 M3,0 L3,5 M0,2 L6,2',
};

const CARDINAL_CONFIG = {
  north: { angle: 0, color: '#ed1c24' },
  east: { angle: 90, color: '#39b54a' },
  south: { angle: 180, color: '#00abc5' },
  west: { angle: 270, color: '#ffd400' },
};

export default function CardinalIcons({
  activeCardinal,
  size = 288,
  theme = 'light',
}: CardinalIconsProps) {
  const bgColor = theme === 'light' ? '#ffffff' : '#1a1a1a';
  const scale = size / 288;

  const calculatePosition = (angle: number) => {
    const angleRad = (angle - 90) * (Math.PI / 180);
    return {
      x: CENTER + ICON_RADIUS * Math.cos(angleRad),
      y: CENTER + ICON_RADIUS * Math.sin(angleRad),
    };
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 288 288">
        {Object.entries(CARDINAL_CONFIG).map(([key, config]) => {
          const isActive = activeCardinal === key;

          if (!isActive) return null;

          const { x, y } = calculatePosition(config.angle);

          return (
            <G key={key} transform={`translate(${x}, ${y})`}>
              <Circle
                cx={0}
                cy={0}
                r={16}
                fill={bgColor}
                stroke={config.color}
                strokeWidth={2}
              />
              <Path
                d={ICON_PATHS[key as keyof typeof ICON_PATHS]}
                fill="none"
                stroke={config.color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          );
        })}
      </Svg>
    </View>
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
