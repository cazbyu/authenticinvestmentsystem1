import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Circle, Defs, Filter, FeGaussianBlur, FeOffset, FeComponentTransfer, FeFuncA, FeMerge, FeMergeNode } from 'react-native-svg';
import { NorthStarIcon, WellnessIcon, GoalIcon, RoleIcon } from '@/components/icons/CustomIcons';

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

const ICON_COMPONENTS = {
  north: NorthStarIcon,
  east: WellnessIcon,
  south: GoalIcon,
  west: RoleIcon,
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
    <View style={[styles.container, { width: size, height: size, backgroundColor: 'transparent' }]}>
      <Svg width={size} height={size} viewBox="0 0 288 288" style={{ position: 'absolute', overflow: 'visible' }}>
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
              opacity={isPressed ? 0.7 : 1}
            >
              <Circle
  cx={0}
  cy={0}
  r={24}
  fill={isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)'}
  stroke={config.color}
  strokeWidth={isActive ? 2.5 : 1.5}
/>
            </G>
          );
        })}
      </Svg>

      {cardinals.map((cardinal) => {
        const config = CARDINAL_CONFIG[cardinal];
        const pos = CARDINAL_POSITIONS[cardinal];
        const IconComponent = ICON_COMPONENTS[cardinal];
        const isActive = activeCardinal === cardinal;

        return (
          <View
            key={`icon-${cardinal}`}
            style={[
              styles.iconWrapper,
              {
                left: pos.x * scale - 12 * scale,
                top: pos.y * scale - 12 * scale,
              }
            ]}
            pointerEvents="none"
          >
            <IconComponent
              size={24 * scale}
              color={config.color}
              strokeWidth={isActive ? 2 : 1.5}
            />
          </View>
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
    pointerEvents: 'none',
  },
  iconWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  
});
