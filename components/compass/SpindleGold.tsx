import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { G, Path, Polygon } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

interface SpindleGoldProps {
  angle: number;
  size?: number;
  continuousSpin?: boolean;
  onSnapComplete?: (direction: 0 | 90 | 180 | 270) => void;
}

const GOLD_COLOR = '#C9A227';
const ANIMATION_DURATION = 300;
const SPIN_DURATION = 4000; // 4 seconds per full rotation
const CARDINAL_DIRECTIONS = [0, 90, 180, 270] as const;

const snapToCardinal = (angle: number): 0 | 90 | 180 | 270 => {
  const normalized = ((angle % 360) + 360) % 360;
  const distances = CARDINAL_DIRECTIONS.map(cardinal => {
    const diff = Math.abs(normalized - cardinal);
    const altDiff = 360 - diff;
    return Math.min(diff, altDiff);
  });
  const minIndex = distances.indexOf(Math.min(...distances));
  return CARDINAL_DIRECTIONS[minIndex];
};

export default function SpindleGold({
  angle,
  size = 288,
  continuousSpin = false,
  onSnapComplete
}: SpindleGoldProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (continuousSpin) {
      // Continuous clockwise spin
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, {
          duration: SPIN_DURATION,
          easing: Easing.linear,
        }),
        -1, // Infinite repeats
        false // Don't reverse
      );
    } else {
      // Stop any continuous animation and snap to cardinal
      cancelAnimation(rotation);
      
      const targetAngle = snapToCardinal(angle);
      const currentNormalized = ((rotation.value % 360) + 360) % 360;
      let diff = targetAngle - currentNormalized;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const finalRotation = rotation.value + diff;
      
      rotation.value = withTiming(
        finalRotation,
        {
          duration: ANIMATION_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished && onSnapComplete) {
            runOnJS(onSnapComplete)(targetAngle);
          }
        }
      );
    }

    return () => {
      if (continuousSpin) {
        cancelAnimation(rotation);
      }
    };
  }, [angle, continuousSpin, onSnapComplete]);

  const animatedProps = useAnimatedProps(() => {
    return {
      transform: `rotate(${rotation.value}, 144, 144)`,
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
            d="M164.4,135.82c-3.23-8.27-11.32-14.1-20.7-13.99-9.17.12-16.98,5.88-20.14,13.94l1.18-5.12,1.19-5.16,17.36-75.06.59-2.56.09.39.32,1.35,18.89,81,1.22,5.21Z"
            fill={GOLD_COLOR}
          />
          <Polygon
            points="143.97 48.27 144.28 49.62 144.28 23.32 143.78 22.73 143.28 23.32 143.28 50.43 143.88 47.87 143.97 48.27"
            fill={GOLD_COLOR}
          />
          <Polygon
            points="141.42 25.05 143.78 16.48 143.78 21.68 144.28 21.68 144.28 23.32 147.11 26.67 143.78 15.22 140.46 26.67 143.28 23.32 143.28 22.75 141.42 25.05"
            fill={GOLD_COLOR}
          />
          <Polygon
            points="144.28 23.32 144.28 21.68 143.78 21.68 143.78 22.13 143.28 22.75 143.28 23.32 143.78 22.73 144.28 23.32"
            fill={GOLD_COLOR}
          />
          <Polygon
            points="141.42 25.05 143.28 22.75 143.28 21.68 143.78 21.68 143.78 16.48 141.42 25.05"
            fill={GOLD_COLOR}
          />
          <Polygon
            points="143.28 22.75 143.78 22.13 143.78 21.68 143.28 21.68 143.28 22.75"
            fill={GOLD_COLOR}
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