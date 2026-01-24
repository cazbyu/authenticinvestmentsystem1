import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { G, Path, Circle } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

const CARDINAL_LABELS = {
  north: 'Mission',
  east: 'Wellness',
  south: 'Goals',
  west: 'Roles',
};

const DEFAULT_CENTER_COLOR = '#ed1c24';
const HUB_GRAY = '#808285';
const HUB_WHITE = '#fff';
const HUB_DIAMETER = 28;
const MIN_TOUCH_TARGET = 44;

export default function CompassHub({
  size = 288,
  isSpinning = false,
  onTap,
  activeZone = null,
  activeCardinal = null,
}: CompassHubProps) {
  const pulseScale = useSharedValue(1);
  const spinRotation = useSharedValue(0);
  const spindleRotation = useSharedValue(0);
  const hubIconOpacity = useSharedValue(0);
  const scale = size / 288;

  const centerColor = activeZone ? ZONE_COLORS[activeZone] : DEFAULT_CENTER_COLOR;

  useEffect(() => {
    if (isSpinning) {
      cancelAnimation(pulseScale);
      pulseScale.value = 1;

      spinRotation.value = 0;
      spinRotation.value = withRepeat(
        withTiming(360, {
          duration: 2000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(spinRotation);
      spinRotation.value = withTiming(0, { duration: 300 });

      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(spinRotation);
    };
  }, [isSpinning]);

  useEffect(() => {
    if (activeCardinal) {
      const targetAngle = CARDINAL_TO_ANGLE[activeCardinal];
      spindleRotation.value = withTiming(targetAngle, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
      hubIconOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 400 })
      );
    } else {
      spindleRotation.value = withTiming(0, { duration: 400 });
      hubIconOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [activeCardinal]);

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
    };
  });

  const spinAnimatedProps = useAnimatedProps(() => {
    return {
      transform: `rotate(${spinRotation.value}, 144, 144)`,
    };
  });

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

  const touchAreaSize = Math.max(MIN_TOUCH_TARGET, HUB_DIAMETER * scale);

  return (
    <Pressable
      onPress={onTap}
      style={[
        styles.touchArea,
        {
          width: touchAreaSize,
          height: touchAreaSize,
        },
      ]}
      disabled={!onTap}
      accessibilityRole="button"
      accessibilityLabel={isSpinning ? 'Compass spinning' : 'Tap to spin compass'}
      accessibilityHint="Activates the compass spin sequence"
    >
      {({ pressed }) => (
        <View style={[styles.container, { width: size, height: size }]}>
          <Animated.View style={[StyleSheet.absoluteFill, spindleAnimatedStyle]}>
            <Svg
              width={size}
              height={size}
              viewBox="0 0 288 288"
              style={StyleSheet.absoluteFill}
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

          <Svg
            width={size}
            height={size}
            viewBox="0 0 288 288"
          >
            <G>
              <Animated.View style={pulseAnimatedStyle}>
                <Svg
                  width={size}
                  height={size}
                  viewBox="0 0 288 288"
                  style={StyleSheet.absoluteFill}
                >
                  {isSpinning ? (
                    <AnimatedG animatedProps={spinAnimatedProps}>
                      <Path
                        d="M144.14,157.89c7.79-.1,14.05-6.52,13.96-14.31s-6.52-14.05-14.31-13.96c-7.79.1-14.05,6.52-13.96,14.31.1,7.79,6.52,14.05,14.31,13.96ZM136.64,136.43c4.04-4.05,10.59-4.05,14.64-.01,4.05,4.04,4.05,10.59.01,14.64-4.04,4.05-10.59,4.05-14.64.01s-4.05-10.59-.01-14.64Z"
                        fill={HUB_GRAY}
                      />
                    </AnimatedG>
                  ) : (
                    <G>
                      <Path
                        d="M144.14,157.89c7.79-.1,14.05-6.52,13.96-14.31s-6.52-14.05-14.31-13.96c-7.79.1-14.05,6.52-13.96,14.31.1,7.79,6.52,14.05,14.31,13.96ZM136.64,136.43c4.04-4.05,10.59-4.05,14.64-.01,4.05,4.04,4.05,10.59.01,14.64-4.04,4.05-10.59,4.05-14.64.01s-4.05-10.59-.01-14.64Z"
                        fill={HUB_GRAY}
                      />
                    </G>
                  )}

                  <Path
                    d="M144.15,158.6c1.02-.01,2.02-.13,2.98-.34s1.89-.51,2.77-.9c.88-.39,1.72-.86,2.5-1.4,1.17-.82,2.22-1.8,3.12-2.91s1.63-2.35,2.18-3.69c.18-.45.34-.9.48-1.37.42-1.4.63-2.88.61-4.41-.02-1.53-.27-3.01-.72-4.4-.6-1.85-1.56-3.54-2.79-4.99-.61-.73-1.3-1.39-2.04-1.99-2.59-2.09-5.9-3.32-9.48-3.27-8.18.1-14.75,6.84-14.65,15.02.1,8.17,6.84,14.75,15.02,14.65ZM143.79,129.63c7.79-.1,14.21,6.16,14.31,13.96s-6.16,14.21-13.96,14.31c-7.79.1-14.21-6.16-14.31-13.96-.1-7.79,6.16-14.21,13.96-14.31Z"
                    fill={HUB_WHITE}
                  />

                  <Path
                    d="M165.82,141.92c-.05-.6-.12-1.19-.22-1.77l-.79-3.24c-.13-.37-.27-.73-.41-1.09-3.23-8.27-11.32-14.1-20.7-13.99-9.17.12-16.98,5.88-20.14,13.94-.22.55-.42,1.12-.59,1.7l-.71,3.25c-.06.39-.09.78-.12,1.18-.06.7-.1,1.41-.09,2.13.01.52.03,1.03.07,1.53.05.61.12,1.21.22,1.8l.8,3.23c.12.37.27.72.41,1.08,1.72,4.42,4.81,8.15,8.77,10.63.02.02.05.04.08.06,3.43,2.16,7.5,3.38,11.85,3.32,4.2-.05,8.1-1.3,11.42-3.4.12-.08.25-.15.38-.23,3.75-2.48,6.68-6.08,8.34-10.32.22-.55.42-1.12.59-1.69l.71-3.25c.06-.4.09-.8.12-1.21.06-.69.1-1.39.09-2.1,0-.52-.04-1.04-.08-1.56ZM162.02,154.24c-.41.7-.86,1.38-1.35,2.02-1.22,1.62-2.66,3.05-4.29,4.26-.12.09-.24.16-.36.25-.75.53-1.52,1.02-2.33,1.45-2.83,1.51-6.04,2.38-9.46,2.42-.56.01-1.13,0-1.68-.04-2.78-.19-5.41-.94-7.8-2.12-.95-.48-1.86-1.02-2.73-1.63-.02-.01-.03-.02-.05-.03-.65-.46-1.27-.95-1.86-1.48-.3-.27-.59-.54-.88-.83-2.01-2-3.61-4.41-4.68-7.08-.3-.77-.56-1.56-.78-2.36-.21-.81-.38-1.64-.49-2.48-.12-.84-.18-1.7-.19-2.57-.04-2.88.51-5.63,1.54-8.14.51-1.26,1.15-2.45,1.88-3.57.74-1.12,1.59-2.17,2.52-3.13,1.87-1.91,4.1-3.47,6.58-4.56,1.25-.55,2.55-.98,3.91-1.27,1.35-.3,2.75-.46,4.19-.48,4.32-.05,8.35,1.22,11.71,3.43,1.13.74,2.17,1.58,3.13,2.51.48.47.93.96,1.37,1.47,1.29,1.53,2.38,3.25,3.19,5.12.28.62.52,1.25.73,1.91.64,1.95.99,4.03,1.02,6.19v.27c0,3.81-1.03,7.39-2.84,10.47Z"
                    fill={HUB_WHITE}
                  />

                  <Circle
                    cx="143.99"
                    cy="143.78"
                    r="2"
                    fill={centerColor}
                    opacity={pressed ? 0.7 : 1}
                  />
                </Svg>
              </Animated.View>
            </G>
          </Svg>

          {activeCardinal && (
            <>
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
              <Animated.View style={[styles.hubLabel, hubIconAnimatedStyle]}>
                <Text style={styles.hubLabelText}>
                  {CARDINAL_LABELS[activeCardinal]}
                </Text>
              </Animated.View>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
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
  hubLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -30,
    marginTop: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
