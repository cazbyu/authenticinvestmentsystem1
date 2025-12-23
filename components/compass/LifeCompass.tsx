import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Svg, {
  G,
  Rect,
  Circle,
  Path,
  Polygon,
} from 'react-native-svg';
import { useRouter } from 'expo-router';

interface LifeCompassProps {
  size?: number;
}

const DIRECTIONS = {
  NORTH: { angle: 0, name: 'North Star', route: '/goals', params: { section: 'northstar' } },
  EAST: { angle: 90, name: 'Wellness Bank', route: '/wellness', params: {} },
  SOUTH: { angle: 180, name: 'Goal Bank', route: '/goals', params: {} },
  WEST: { angle: 270, name: 'Role Bank', route: '/roles', params: {} },
};

const TOLERANCE = 20;

function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function findNearestDirection(angle: number): { angle: number; name: string } | null {
  const normalized = normalizeAngle(angle);

  for (const [key, direction] of Object.entries(DIRECTIONS)) {
    const diff = Math.abs(normalized - direction.angle);
    const diff2 = Math.abs(normalized - (direction.angle + 360));
    const diff3 = Math.abs(normalized - (direction.angle - 360));

    const minDiff = Math.min(diff, diff2, diff3);

    if (minDiff <= TOLERANCE) {
      return { angle: direction.angle, name: direction.name };
    }
  }

  return null;
}

export function LifeCompass({ size = 320 }: LifeCompassProps) {
  const router = useRouter();
  const rotation = useSharedValue(0);
  const [nearDirection, setNearDirection] = useState<string | null>(null);
  const compassCenterX = 144;
  const compassCenterY = 144;

  useEffect(() => {
    const savedAngle = Platform.OS === 'web'
      ? localStorage.getItem('compass_angle')
      : null;

    if (savedAngle) {
      rotation.value = parseFloat(savedAngle);
    }
  }, []);

  const calculateAngle = (x: number, y: number): number => {
    const scale = 288 / size;
    const svgX = x * scale;
    const svgY = y * scale;

    const dx = svgX - compassCenterX;
    const dy = svgY - compassCenterY;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle + 90;

    return normalizeAngle(angle);
  };

  const handleAngleChange = (angle: number) => {
    const nearest = findNearestDirection(angle);
    if (nearest) {
      setNearDirection(nearest.name);
    } else {
      setNearDirection(null);
    }
  };

  const handleNavigate = (angle: number) => {
    const normalized = normalizeAngle(angle);

    let targetDirection = null;
    for (const [key, direction] of Object.entries(DIRECTIONS)) {
      const diff = Math.abs(normalized - direction.angle);
      const diff2 = Math.abs(normalized - (direction.angle + 360));
      const diff3 = Math.abs(normalized - (direction.angle - 360));

      if (Math.min(diff, diff2, diff3) <= TOLERANCE) {
        targetDirection = direction;
        break;
      }
    }

    if (targetDirection) {
      if (Platform.OS === 'web') {
        localStorage.setItem('compass_angle', String(targetDirection.angle));
      }

      router.push(targetDirection.route);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const angle = calculateAngle(event.x, event.y);
      rotation.value = angle;
      runOnJS(handleAngleChange)(angle);
    })
    .onEnd(() => {
      const currentAngle = rotation.value;
      const nearest = findNearestDirection(currentAngle);

      if (nearest) {
        rotation.value = withSpring(nearest.angle, {
          damping: 15,
          stiffness: 150,
        });

        setTimeout(() => {
          runOnJS(handleNavigate)(nearest.angle);
        }, 300);
      }

      runOnJS(setNearDirection)(null);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const screenWidth = Dimensions.get('window').width;
  const responsiveSize = Math.min(size, screenWidth * 0.8);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={[styles.compassContainer, { width: responsiveSize, height: responsiveSize }]}>
          <Svg
            width={responsiveSize}
            height={responsiveSize}
            viewBox="0 0 288 288"
          >
            <G id="Circle">
              <G id="Lines">
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-22.85 27.2) rotate(-10)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-32.42 42.18) rotate(-15)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-40.64 57.95) rotate(-20)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-47.45 74.37) rotate(-25)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-52.81 91.32) rotate(-30)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-56.67 108.67) rotate(-35)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-59.01 126.3) rotate(-40)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-59.03 161.82) rotate(-50)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-56.72 179.45) rotate(-55)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-52.89 196.81) rotate(-60)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-47.55 213.77) rotate(-65)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-40.76 230.2) rotate(-70)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-32.56 245.98) rotate(-75)" fill="#333"/>
                <Rect x="142.8" y="30.45" width="2.4" height="227.52" transform="translate(-23.02 260.98) rotate(-80)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-22.89 27.25) rotate(-10.02)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-32.44 42.23) rotate(-15.01)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-40.6 57.87) rotate(-19.98)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-47.45 74.36) rotate(-25)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-52.81 91.33) rotate(-30)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-56.67 108.69) rotate(-35)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-59.01 126.32) rotate(-40.01)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-59.03 161.79) rotate(-49.99)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-56.74 179.33) rotate(-54.97)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-52.89 196.8) rotate(-60)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-47.59 213.66) rotate(-64.97)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-40.8 230.11) rotate(-69.97)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-32.58 245.95) rotate(-74.99)" fill="#333"/>
                <Rect x="30.24" y="143.01" width="227.52" height="2.4" transform="translate(-22.96 261.07) rotate(-80.03)" fill="#333"/>
                <Circle cx="144" cy="144" r="102.24" fill="#fff"/>
              </G>
              <G id="Outer_Circle">
                <Path d="M144,30.24c62.83,0,113.76,50.93,113.76,113.76s-50.93,113.76-113.76,113.76S30.24,206.83,30.24,144,81.17,30.24,144,30.24M144,27.84c-64.05,0-116.16,52.11-116.16,116.16s52.11,116.16,116.16,116.16,116.16-52.11,116.16-116.16S208.05,27.84,144,27.84h0Z" fill="#333"/>
                <Path d="M144,32c61.86,0,112,50.14,112,112s-50.14,112-112,112-112-50.14-112-112,50.14-112,112-112M144,30.4c-62.64,0-113.6,50.96-113.6,113.6s50.96,113.6,113.6,113.6,113.6-50.96,113.6-113.6S206.64,30.4,144,30.4h0Z" fill="#fff"/>
              </G>
            </G>
            <G id="Middle_Circle">
              <Path d="M144,57.6c47.72,0,86.4,38.68,86.4,86.4s-38.68,86.4-86.4,86.4-86.4-38.68-86.4-86.4,38.68-86.4,86.4-86.4M144,55.2c-48.96,0-88.8,39.84-88.8,88.8s39.84,88.8,88.8,88.8,88.8-39.84,88.8-88.8-39.84-88.8-88.8-88.8h0Z" fill="#333"/>
            </G>
            <G id="Star">
              <G id="_2nd_Tier_Star">
                <Polygon points="144 112.87 64.8 64.8 112.87 144 64.8 223.2 144 175.13 223.2 223.2 175.13 144 223.2 64.8 144 112.87" fill="#333"/>
                <Polygon points="144 144 211.78 211.78 170.64 144 144 144" fill="#fff"/>
                <Polygon points="144 144 211.78 211.78 144 170.64 144 144" fill="#333"/>
                <Polygon points="144 144 211.78 76.22 144 117.36 144 144" fill="#fff"/>
                <Polygon points="144 144 211.78 76.22 170.64 144 144 144" fill="#333"/>
                <Polygon points="144 144 69.44 69.44 114.7 144 144 144" fill="#fff"/>
                <Polygon points="144 144 69.44 69.44 144 114.7 144 144" fill="#333"/>
                <Polygon points="144 144 76.22 211.78 144 170.64 144 144" fill="#fff"/>
                <Polygon points="144 144 76.22 211.78 117.36 144 144 144" fill="#333"/>
              </G>
              <G id="Outer_Star">
                <Polygon points="172.3 115.7 144 0 115.7 115.7 0 144 115.7 172.3 144 288 172.3 172.3 288 144 172.3 115.7" fill="#333"/>
                <G id="Top_Star">
                  <Polygon points="144 144 144 279.56 170.64 170.64 144 144" fill="#fff"/>
                  <Polygon points="144 144 144 279.56 117.36 170.64 144 144" fill="#333"/>
                  <Polygon points="144 144 279.56 144 170.64 117.36 144 144" fill="#fff"/>
                  <Polygon points="144 144 279.56 144 170.64 170.64 144 144" fill="#333"/>
                  <Polygon points="144 144 144 8.44 117.36 117.36 144 144" fill="#fff"/>
                  <Polygon points="144 144 144 8.44 170.64 117.36 144 144" fill="#333"/>
                  <Polygon points="144 144 8.44 144 117.36 170.64 144 144" fill="#fff"/>
                  <Polygon points="144 144 8.44 144 117.36 117.36 144 144" fill="#333"/>
                </G>
              </G>
            </G>
            <G id="Center_Circle">
              <Path d="M144,164.96c-11.56,0-20.96-9.4-20.96-20.96s9.4-20.96,20.96-20.96,20.96,9.4,20.96,20.96-9.4,20.96-20.96,20.96ZM144,124.64c-10.68,0-19.36,8.69-19.36,19.36s8.68,19.36,19.36,19.36,19.36-8.68,19.36-19.36-8.69-19.36-19.36-19.36Z" fill="#fff"/>
              <G id="Core_Circle">
                <Circle cx="144" cy="144" r="24.48" fill="#fff"/>
                <Path d="M144,169.68c-14.16,0-25.68-11.52-25.68-25.68s11.52-25.68,25.68-25.68,25.68,11.52,25.68,25.68-11.52,25.68-25.68,25.68ZM144,120.72c-12.84,0-23.28,10.44-23.28,23.28s10.44,23.28,23.28,23.28,23.28-10.44,23.28-23.28-10.44-23.28-23.28-23.28Z" fill="#333"/>
                <Circle cx="144" cy="144" r="20.16" fill="#333"/>
                <Circle cx="144" cy="144" r="16.8" fill="#fff"/>
              </G>
            </G>
          </Svg>
          <Animated.View
            style={[
              styles.spindleContainer,
              animatedStyle,
              { width: responsiveSize, height: responsiveSize }
            ]}
            pointerEvents="none"
          >
            <Svg
              width={responsiveSize}
              height={responsiveSize}
              viewBox="0 0 288 288"
            >
              <G id="spindle_green">
                <G id="spindle_green-2">
                  <Polygon points="121.73 144.02 143.91 48.12 166.27 143.98 144.09 239.88 121.73 144.02" fill="#00a651"/>
                  <Path d="M155.5,155.48c-6.34,6.35-16.63,6.36-22.98.02-1.06-1.06-1.92-2.23-2.63-3.47l14.18,60.78,14.06-60.81c-.7,1.24-1.57,2.41-2.62,3.47Z" fill="#fff"/>
                  <Circle cx="144" cy="144" r="10.35" transform="translate(-54.24 97.4) rotate(-31.77)" fill="#fff"/>
                </G>
                <Circle cx="144" cy="144" r="3.6" fill="#333"/>
              </G>
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spindleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
