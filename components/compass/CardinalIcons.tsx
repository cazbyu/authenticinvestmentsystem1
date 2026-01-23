import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Circle, Path, Defs, Filter, FeGaussianBlur, FeOffset, FeComponentTransfer, FeFuncA, FeMerge, FeMergeNode } from 'react-native-svg';

interface CardinalIconsProps {
  activeCardinal: 'north' | 'east' | 'south' | 'west' | null;
  size?: number;
  theme?: 'light' | 'dark';
}

const CENTER = 144;
const ICON_SIZE = 44;
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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 288 288">
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
        {Object.entries(CARDINAL_CONFIG).map(([key, config]) => {
          const isActive = activeCardinal === key;

          if (!isActive) return null;

          return (
            <G key={key} transform={`translate(${CENTER}, ${CENTER})`} filter="url(#cardinalShadow)">
              <Circle
                cx={0}
                cy={0}
                r={22}
                fill={bgColor}
                stroke={config.color}
                strokeWidth={2.5}
              />
              <G transform={`scale(${ICON_SCALE})`}>
                <Path
                  d={ICON_PATHS[key as keyof typeof ICON_PATHS]}
                  fill="none"
                  stroke={config.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
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
