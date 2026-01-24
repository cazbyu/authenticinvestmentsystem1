import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { G, Circle, Path, Defs, Filter, FeGaussianBlur, FeOffset, FeComponentTransfer, FeFuncA, FeMerge, FeMergeNode } from 'react-native-svg';

interface CardinalIconsProps {
  activeCardinal: 'north' | 'east' | 'south' | 'west' | null;
  size?: number;
  theme?: 'light' | 'dark';
  onCardinalPress?: (cardinal: 'north' | 'east' | 'south' | 'west') => void;
  contentCounts?: {
    mission?: number;
    wellness?: number;
    goals?: number;
    roles?: number;
  };
}

const CENTER = 144;
const ICON_SIZE = 48;
const ICON_SCALE = 1.5;

const ICON_PATHS = {
  north: {
    viewBox: '0 0 144 144',
    paths: [
      'M118.48 60.34 L84.6 55.12 L95.89 36.45 L77.22 47.74 L72 9.66 L66.78 47.74 L48.11 36.45 L59.4 55.12 L25.52 60.34 L59.4 65.56 L48.11 84.23 L66.78 72.94 L72 135.66 L77.22 72.94 L95.89 84.23 L84.6 65.56 Z'
    ]
  },
  east: {
    viewBox: '0 0 144 144',
    paths: [
      'M104.83,97.55l-17.64-4.33c-.58-7.2-2.4-21.17-7.87-31.45-.72-1.36-.82-2.98-.08-4.34.87-1.57,1.57-3.24,2.06-5.01,3.08-11.12,1.24-23.05-5.04-32.72l-2.8-4.32c-1.5-2.31-4.47-3.43-6.99-2.32-3.21,1.41-4.27,5.27-2.45,8.08l2.96,4.57c4.56,7.03,5.89,15.68,3.66,23.75-1.12,4.04-4.15,7.27-7.85,8.56-.69.2-6.81,2-8.81,2.73-6,2.2-16.64,11.36-18.71,13.18-1.22,1.07-1.91,2.62-1.88,4.25.03,1.63.77,3.15,2.02,4.18l15.39,12.59c1.03.84,2.26,1.25,3.5,1.25.28,0,.55-.05.83-.09l-42.61,23.39c-2.91,1.6-4.39,5.19-3.01,8.21,1.06,2.32,3.32,3.65,5.66,3.65,1.01,0,2.04-.25,2.99-.77l47.98-26.34h13.86l12.87,3.16-10.02,13.8c-1.82,2.51-1.8,6.07.38,8.27,2.78,2.8,7.26,2.36,9.48-.69l15.66-21.56c1.22-1.68,1.52-3.85.81-5.79-.71-1.94-2.34-3.41-4.36-3.9Z',
      'M52.74,56.67c7.63,0,13.82-6.19,13.82-13.82s-6.19-13.82-13.82-13.82-13.82,6.19-13.82,13.82,6.19,13.82,13.82,13.82Z'
    ]
  },
  south: {
    viewBox: '0 0 144 144',
    paths: [
      'M35.88,78.7c-.94-3.19-1.42-6.56-1.42-10.03,0-20.51,16.72-37.19,37.23-37.19,6.11,0,11.94,1.49,17,4.13l6.66-6.66c-6.94-4.13-15.02-6.56-23.66-6.56-25.57,0-46.29,20.78-46.29,46.29,0,4.82.73,9.47,2.12,13.85,2.12-2.36,5.1-3.75,8.36-3.82Z',
      'M104.72,51.71c2.6,5.1,4.13,10.86,4.13,16.97,0,20.51-16.65,37.2-37.16,37.2h-.52c.42,3.19-.49,6.42-2.6,8.95,1.04.11,2.08.14,3.12.14,25.5,0,46.22-20.75,46.22-46.29,0-8.6-2.36-16.72-6.52-23.63l-6.66,6.66Z',
      'M71.67,48.95c1.13,0,2.27.09,3.36.32l7.31-7.3c-3.31-1.36-6.9-2.09-10.66-2.09-15.92,0-28.85,12.93-28.85,28.81s12.93,28.85,28.85,28.85,28.81-12.93,28.81-28.85c0-3.77-.73-7.35-2.09-10.66l-7.31,7.3c.23,1.09.32,2.22.32,3.36,0,10.89-8.85,19.78-19.74,19.78s-19.78-8.89-19.78-19.78,8.89-19.74,19.78-19.74Z',
      'M134.74,19.88c-.53-1.27-1.77-2.1-3.15-2.1h-9.03v-9.03c0-1.38-.83-2.62-2.1-3.15-1.27-.52-2.73-.24-3.71.74l-9.32,9.32c-.64.64-1,1.5-1,2.41v9.41l-30.62,30.62c-1.29-.51-2.69-.81-4.16-.81-6.28,0-11.39,5.11-11.39,11.39s5.11,11.38,11.39,11.38,11.38-5.1,11.38-11.38c0-1.47-.3-2.87-.81-4.16l30.62-30.62h9.42c.9,0,1.77-.36,2.41-1l9.32-9.32c.97-.97,1.26-2.44.74-3.71Z'
    ]
  },
  west: {
    viewBox: '0 0 144 144',
    paths: [
      'M68.16,79.69a7.03,7.03,0,1,1,7.03-7.03,7.03,7.03,0,0,1-7.03,7.03Z',
      'M49.74,83.09l8.82,8.73c.61.6.95,1.42.95,2.27v31.58',
      'M76.81,125.68v-31.58c0-.85.34-1.68.95-2.27l6.59-3.47',
      'M82.79,79.33c-4.83,2.17-11.9,5.24-13.23,5.24h-2.8c-2.07,0-4.07-.73-5.65-2.07l-6.25-5.27',
      'M68.16,125.68v-15.76',
      'M126.56,87.57c2.47,0,4.48-1.86,4.48-4.15v-29.34c0-4.68-4.1-8.48-9.15-8.48h-25.34c-5.05,0-9.15,3.8-9.15,8.48v29.34c0,2.29,2.01,4.15,4.48,4.15',
      'M122.91,66.53v59.15',
      'M109.22,91.38l-.4,34.3',
      'M95.53,125.68v-59.15',
      'M109.22,30.81a11.25,11.25,0,1,1-11.25-11.25,11.25,11.25,0,0,1,11.25,11.25Z',
      'M14.89,78.43l-2.25-3.24c-.7-1.22-.92-2.66-.62-4.03l3.2-14.44,1.58-7.14.3-1.37c.89-4.03,4.47-6.9,8.59-6.9h11.72c3.99,0,7.48,2.68,8.51,6.54l6.19,23.3c.44,1.64.11,3.38-.89,4.75l-2.15,2.53',
      'M23,54.17l-7.58,36.8h32.59l-7.58-36.8',
      'M31.45,28.13a9.81,9.81,0,1,1-9.81-9.81,9.81,9.81,0,0,1,9.81,9.81Z',
      'M21.6,125.68l-2.19-34.14',
      'M31.2,91.54v33.89',
      'M40.8,125.68l2.18-34.14',
      'M9,125.68h126'
    ]
  }
};

const CARDINAL_CONFIG = {
  north: { angle: 0, color: '#ed1c24' },
  east: { angle: 90, color: '#39b54a' },
  south: { angle: 180, color: '#4169E1' },
  west: { angle: 270, color: '#9370DB' },
};

const DOMAIN_MAP = {
  north: 'mission',
  east: 'wellness',
  south: 'goals',
  west: 'roles',
} as const;

const CARDINAL_POSITIONS = {
  north: { x: 144, y: 28 },
  east: { x: 260, y: 144 },
  south: { x: 144, y: 260 },
  west: { x: 28, y: 144 },
};

export default function CardinalIcons({
  activeCardinal,
  size = 288,
  theme = 'light',
  onCardinalPress,
  contentCounts = {},
}: CardinalIconsProps) {
  const [pressedCardinal, setPressedCardinal] = useState<string | null>(null);
  const bgColor = theme === 'light' ? '#ffffff' : '#1a1a1a';
  const scale = size / 288;

  const cardinals: Array<'north' | 'east' | 'south' | 'west'> = ['north', 'east', 'south', 'west'];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 288 288" style={{ position: 'absolute' }}>
        <Defs>
          <Filter id="cardinalShadow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <FeOffset dx="0" dy="2" result="offsetblur" />
            <FeComponentTransfer>
              <FeFuncA type="linear" slope="0.2" />
            </FeComponentTransfer>
            <FeMerge>
              <FeMergeNode />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>
        {cardinals.map((key) => {
          const config = CARDINAL_CONFIG[key];
          const pos = CARDINAL_POSITIONS[key];
          const iconData = ICON_PATHS[key];
          const isActive = activeCardinal === key;
          const isPressed = pressedCardinal === key;

          return (
            <G
              key={key}
              transform={`translate(${pos.x}, ${pos.y})`}
              opacity={isPressed ? 0.7 : 1}
            >
              <Circle
                cx={0}
                cy={0}
                r={24}
                fill={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.1)'}
                stroke={config.color}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <G transform="translate(-12, -12) scale(0.167)">
                {iconData.paths.map((pathD, idx) => (
                  <Path
                    key={idx}
                    d={pathD}
                    fill="none"
                    stroke={config.color}
                    strokeWidth={isActive ? 9 : 6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </G>
            </G>
          );
        })}
      </Svg>

      {cardinals.map((cardinal) => {
        const pos = CARDINAL_POSITIONS[cardinal];

        return (
          <Pressable
            key={cardinal}
            onPressIn={() => setPressedCardinal(cardinal)}
            onPressOut={() => setPressedCardinal(null)}
            onPress={() => onCardinalPress?.(cardinal)}
            style={[
              styles.cardinalTouchArea,
              {
                left: pos.x * scale - 24 * scale,
                top: pos.y * scale - 24 * scale,
                width: 48 * scale,
                height: 48 * scale,
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cardinalTouchArea: {
    position: 'absolute',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
