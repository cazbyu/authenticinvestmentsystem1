import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { G, Circle, Defs, Filter, FeGaussianBlur, FeOffset, FeComponentTransfer, FeFuncA, FeMerge, FeMergeNode } from 'react-native-svg';
import { NorthStarIcon, WellnessIcon, GoalIcon, RoleIcon } from '@/components/icons/CustomIcons';

interface CardinalIconsProps {
  activeCardinal: 'north' | 'east' | 'south' | 'west' | null;
  hoveredCardinal?: 'north' | 'east' | 'south' | 'west' | null;  // NEW
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

const ICON_COMPONENTS = {
  north: NorthStarIcon,
  east: WellnessIcon,
  south: GoalIcon,
  west: RoleIcon,
};

const CARDINAL_CONFIG = {
  north: { angle: 0, color: '#ed1c24', label: 'Mission' },
  east: { angle: 90, color: '#39b54a', label: 'Wellness' },
  south: { angle: 180, color: '#4169E1', label: 'Goals' },
  west: { angle: 270, color: '#9370DB', label: 'Roles' },
};

const CARDINAL_POSITIONS = {
  north: { x: 144, y: 28 },
  east: { x: 260, y: 144 },
  south: { x: 144, y: 260 },
  west: { x: 28, y: 144 },
};

// Label offsets from icon center (push labels outward from compass)
const LABEL_OFFSETS = {
  north: { x: 0, y: -20 },
  east: { x: 20, y: 0 },
  south: { x: 0, y: 20 },
  west: { x: -20, y: 0 },
};

export default function CardinalIcons({
  activeCardinal,
  hoveredCardinal = null,  // NEW - defaults to null
  size = 288,
  theme = 'light',
  onCardinalPress,
  contentCounts = {},
}: CardinalIconsProps) {
  const scale = size / 288;
  const cardinals: Array<'north' | 'east' | 'south' | 'west'> = ['north', 'east', 'south', 'west'];

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: 'transparent' }]}>
      {/* SVG circles only - no icons here */}
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
          const isHovered = hoveredCardinal === key;

          return (
            <G 
              key={key} 
              transform={`translate(${pos.x}, ${pos.y})`}
              opacity={isActive || isHovered ? 1 : 0}
            >
              <Circle
                cx={0}
                cy={0}
                r={24}
                fill="rgba(255, 255, 255, 0.9)"
                stroke={config.color}
                strokeWidth={2.5}
              />
            </G>
          );
        })}
      </Svg>

      {/* Animated icons and labels - only visible when hovered or active */}
      {cardinals.map((cardinal) => {
        const config = CARDINAL_CONFIG[cardinal];
        const pos = CARDINAL_POSITIONS[cardinal];
        const IconComponent = ICON_COMPONENTS[cardinal];
        const isActive = activeCardinal === cardinal;
        const isHovered = hoveredCardinal === cardinal;
        const shouldShow = isActive || isHovered;
        const labelOffset = LABEL_OFFSETS[cardinal];

        return (
          <CardinalIconWithLabel
            key={`icon-${cardinal}`}
            IconComponent={IconComponent}
            color={config.color}
            label={config.label}
            position={pos}
            labelOffset={labelOffset}
            scale={scale}
            isActive={isActive}
            shouldShow={shouldShow}
            cardinal={cardinal}
          />
        );
      })}
    </View>
  );
}

// Separate component for animated icon + label
interface CardinalIconWithLabelProps {
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
  label: string;
  position: { x: number; y: number };
  labelOffset: { x: number; y: number };
  scale: number;
  isActive: boolean;
  shouldShow: boolean;
  cardinal: 'north' | 'east' | 'south' | 'west';
}

function CardinalIconWithLabel({
  IconComponent,
  color,
  label,
  position,
  labelOffset,
  scale,
  isActive,
  shouldShow,
  cardinal,
}: CardinalIconWithLabelProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(shouldShow ? 1 : 0, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      }),
    };
  }, [shouldShow]);

  // Determine label text alignment based on position
  const labelStyle = {
    north: { textAlign: 'center' as const, top: position.y * scale + labelOffset.y - 8, left: position.x * scale - 30, width: 60 },
    east: { textAlign: 'left' as const, top: position.y * scale - 6, left: position.x * scale + labelOffset.x + 12 },
    south: { textAlign: 'center' as const, top: position.y * scale + labelOffset.y + 12, left: position.x * scale - 30, width: 60 },
    west: { textAlign: 'right' as const, top: position.y * scale - 6, right: (288 * scale) - (position.x * scale) + Math.abs(labelOffset.x) + 12 },
  };

  return (
    <>
      {/* Icon */}
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            left: position.x * scale - 12 * scale,
            top: position.y * scale - 12 * scale,
          },
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        <IconComponent
          size={24 * scale}
          color={color}
          strokeWidth={isActive ? 2 : 1.5}
        />
      </Animated.View>

      {/* Label */}
      <Animated.View
        style={[
          styles.labelWrapper,
          labelStyle[cardinal],
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.labelBox}>
          <Text style={[styles.labelText}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </>
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
  labelWrapper: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#ffffff',
  },
  labelBox: {
    backgroundColor: 'rgba(50, 50, 50, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
});