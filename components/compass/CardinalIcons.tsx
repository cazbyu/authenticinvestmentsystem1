import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
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
  north: 'M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z',
  east: 'M0,-7 C4,-7 7,-4 7,0 C7,4 4,7 0,7 C0,3 -3,0 -3,-4 C-3,-6 -1,-7 0,-7 Z M0,-4 L0,4',
  south: 'M0,-7 A7,7 0 1,1 0,7 A7,7 0 1,1 0,-7 M0,-4 A4,4 0 1,1 0,4 A4,4 0 1,1 0,-4 M0,-1.5 A1.5,1.5 0 1,1 0,1.5 A1.5,1.5 0 1,1 0,-1.5',
  west: 'M-3,-6 A2,2 0 1,1 -3,-2 A2,2 0 1,1 -3,-6 M-3,0 L-3,5 M-6,2 L0,2 M3,-6 A2,2 0 1,1 3,-2 A2,2 0 1,1 3,-6 M3,0 L3,5 M0,2 L6,2',
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
          const isActive = activeCardinal === key;
          const isPressed = pressedCardinal === key;

          return (
            <G
              key={key}
              transform={`translate(${pos.x}, ${pos.y})`}
              filter={isActive ? "url(#cardinalShadow)" : undefined}
              opacity={isPressed ? 0.7 : 1}
            >
              <Circle
                cx={0}
                cy={0}
                r={24}
                fill={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'}
                stroke={config.color}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <G transform={`scale(${ICON_SCALE})`}>
                <Path
                  d={ICON_PATHS[key]}
                  fill="none"
                  stroke={config.color}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            </G>
          );
        })}
      </Svg>

      {cardinals.map((cardinal) => {
        const pos = CARDINAL_POSITIONS[cardinal];
        const domain = DOMAIN_MAP[cardinal];
        const count = contentCounts[domain] || 0;

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
          >
            {count > 0 && (
              <View style={styles.contentIndicator}>
                <Text style={styles.contentIndicatorText}>{count}</Text>
              </View>
            )}
          </Pressable>
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
  contentIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ed1c24',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contentIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
