import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { G, Path, Polygon } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

interface SpindleSilverProps {
  angle: number;
  size?: number;
  animated?: boolean;
  onAngleChange?: (angle: number) => void;
}

const SILVER_COLOR = '#A8A9AD';
const ANIMATION_DURATION = 300;
const DEFAULT_ANGLE = 0;

const normalizeAngle = (angle: number): number => {
  return ((angle % 360) + 360) % 360;
};

const calculateShortestPath = (current: number, target: number): number => {
  const currentNormalized = normalizeAngle(current);
  const targetNormalized = normalizeAngle(target);

  let diff = targetNormalized - currentNormalized;

  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return current + diff;
};

export default function SpindleSilver({
  angle,
  size = 288,
  animated = true,
  onAngleChange
}: SpindleSilverProps) {
  const rotation = useSharedValue(DEFAULT_ANGLE);

  useEffect(() => {
    const targetAngle = calculateShortestPath(rotation.value, angle);

    if (animated) {
      rotation.value = withTiming(
        targetAngle,
        {
          duration: ANIMATION_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished && onAngleChange) {
            runOnJS(onAngleChange)(normalizeAngle(targetAngle));
          }
        }
      );
    } else {
      rotation.value = targetAngle;
      if (onAngleChange) {
        onAngleChange(normalizeAngle(targetAngle));
      }
    }
  }, [angle, animated, onAngleChange]);

  const animatedProps = useAnimatedProps(() => {
    // Add 180 offset because the SVG path is drawn pointing South
    const visualAngle = rotation.value + 180;
    return {
      transform: `rotate(${visualAngle}, 144, 144)`,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 288 288"
      >
        <AnimatedG animatedProps={animatedProps}>
          <Path
            d="M156.26,161.84c-.13.08-.26.15-.38.23l-11.63,50.28-11.72-50.26c-3.96-2.48-7.05-6.21-8.77-10.63l1.21,5.21,18.96,81.28v.96s-1.41-1.68-1.41-1.68l1.66,5.73,1.67-5.73-1.42,1.68-.05.06.05-.23,17.8-76.95,1.19-5.16,1.18-5.11c-1.66,4.24-4.59,7.84-8.34,10.32ZM144.43,239.2l.93-1.16-1.18,4.29v-2.82s.09-.11.09-.11v-.02s.16-.18.16-.18Z"
            fill={SILVER_COLOR}
          />
          <Polygon
            points="144.18 239.73 144.18 242.33 145.36 238.04 144.43 239.19 144.43 239.73 144.18 239.73"
            fill={SILVER_COLOR}
          />
          <Polygon
            points="144.27 239.39 144.18 239.5 144.18 239.73 144.43 239.73 144.43 239.19 144.28 239.38 144.27 239.41 144.27 239.39"
            fill={SILVER_COLOR}
          />
          <Polygon
            points="144.27 239.41 144.28 239.38 144.27 239.39 144.27 239.41"
            fill={SILVER_COLOR}
          />
        </AnimatedG>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
