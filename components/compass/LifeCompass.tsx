import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Svg, {
  G,
  Rect,
  Circle,
  Path,
  Polygon,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { useRouter } from 'expo-router';
import { COMPASS_WAYPOINTS, WAYPOINT_TOLERANCE, COMPASS_CENTER, CompassWaypoint } from './compassConfig';
import * as Haptics from 'expo-haptics';
import SpindleGold from './SpindleGold';
import SpindleSilver from './SpindleSilver';
import CompassHub from './CompassHub';

interface LifeCompassProps {
  size?: number;
  contextMode?: 'morning_spark' | 'dashboard' | 'navigation';
  onZoneChange?: (zone: 'mission' | 'wellness' | 'goals' | 'roles') => void;
  onSlotSelect?: (slotCode: string | null) => void;
  onSpinComplete?: () => void;
  onTaskFormOpen?: (formType: 'task' | 'event' | 'depositIdea') => void;
  onJournalFormOpen?: (formType: 'rose' | 'thorn' | 'reflection') => void;
}

interface CompassState {
  bigSpindleAngle: 0 | 90 | 180 | 270;
  smallSpindleAngle: number;
  activeZone: 'mission' | 'wellness' | 'goals' | 'roles';
  focusedSlot: string | null;
  isSpinning: boolean;
  sequenceStep: number | null;
  showColorRing: boolean;
}

const ZONE_ANGLES = {
  mission: 0,
  wellness: 90,
  goals: 180,
  roles: 270,
} as const;

const ANGLE_TO_ZONE = {
  0: 'mission',
  90: 'wellness',
  180: 'goals',
  270: 'roles',
} as const;

const DOT_ANGLES = [
  15, 30, 45, 60, 75,       // Between N (0°) and E (90°)
  105, 120, 135, 150, 165,  // Between E (90°) and S (180°)
  195, 210, 225, 240, 255,  // Between S (180°) and W (270°)
  285, 300, 315, 330, 345   // Between W (270°) and N (0°)
];

const DOT_RADIUS = 126;  // Outside the compass ring
const DOT_SIZE = 8;      // Radius of each dot

function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function findNearestWaypoint(angle: number): CompassWaypoint | null {
  const normalized = normalizeAngle(angle);
  const activeWaypoints = COMPASS_WAYPOINTS.filter(w => w.type !== 'decorative');

  for (const waypoint of activeWaypoints) {
    const diff = Math.abs(normalized - waypoint.angle);
    const diff2 = Math.abs(normalized - (waypoint.angle + 360));
    const diff3 = Math.abs(normalized - (waypoint.angle - 360));
    const minDiff = Math.min(diff, diff2, diff3);

    if (minDiff <= WAYPOINT_TOLERANCE) {
      return waypoint;
    }
  }

  return null;
}

function findNearestDot(angle: number): number | null {
  const normalized = normalizeAngle(angle);
  const TOLERANCE = 10;

  for (const dotAngle of DOT_ANGLES) {
    const diff = Math.abs(normalized - dotAngle);
    const diff2 = Math.abs(normalized - (dotAngle + 360));
    const diff3 = Math.abs(normalized - (dotAngle - 360));
    const minDiff = Math.min(diff, diff2, diff3);

    if (minDiff <= TOLERANCE) {
      return dotAngle;
    }
  }

  return null;
}

export function LifeCompass({
  size = 320,
  contextMode = 'navigation',
  onZoneChange,
  onSlotSelect,
  onSpinComplete,
  onTaskFormOpen,
  onJournalFormOpen,
}: LifeCompassProps) {
  const router = useRouter();
  const colorRingOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  const [compassState, setCompassState] = useState<CompassState>({
    bigSpindleAngle: 0,
    smallSpindleAngle: 0,
    activeZone: 'mission',
    focusedSlot: null,
    isSpinning: false,
    sequenceStep: null,
    showColorRing: false,
  });

  const [focusedDot, setFocusedDot] = useState<number | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const responsiveSize = Math.min(size, screenWidth * 0.8);

  useEffect(() => {
    const showColor = compassState.bigSpindleAngle === 90;
    setCompassState(prev => ({ ...prev, showColorRing: showColor }));

    colorRingOpacity.value = withTiming(showColor ? 1 : 0, {
      duration: 400,
    });
  }, [compassState.bigSpindleAngle]);

  useEffect(() => {
    if (onZoneChange) {
      onZoneChange(compassState.activeZone);
    }
  }, [compassState.activeZone, onZoneChange]);

  useEffect(() => {
    if (onSlotSelect) {
      onSlotSelect(compassState.focusedSlot);
    }
  }, [compassState.focusedSlot, onSlotSelect]);

  const handleGoldSpindleSnap = (direction: 0 | 90 | 180 | 270) => {
    const zone = ANGLE_TO_ZONE[direction];
    setCompassState(prev => ({
      ...prev,
      bigSpindleAngle: direction,
      activeZone: zone,
    }));

    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleSilverSpindleChange = (angle: number) => {
    const waypoint = findNearestWaypoint(angle);
    const nearestDot = findNearestDot(angle);

    setCompassState(prev => ({
      ...prev,
      smallSpindleAngle: angle,
      focusedSlot: waypoint?.id || (nearestDot ? `DOT_${nearestDot}` : null),
    }));

    setFocusedDot(nearestDot);
  };

  const handleHubTap = () => {
    if (compassState.isSpinning) return;

    setCompassState(prev => ({ ...prev, isSpinning: true }));

    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const zones: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < zones.length) {
        const angle = zones[currentIndex];
        setCompassState(prev => ({
          ...prev,
          bigSpindleAngle: angle,
          activeZone: ANGLE_TO_ZONE[angle],
          sequenceStep: currentIndex,
        }));
        currentIndex++;
      } else {
        clearInterval(interval);
        setCompassState(prev => ({
          ...prev,
          isSpinning: false,
          sequenceStep: null,
        }));
        if (onSpinComplete) {
          onSpinComplete();
        }
      }
    }, 1000);
  };

  const handleWaypointAction = (waypoint: CompassWaypoint) => {
    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (waypoint.action === 'navigate' && waypoint.route) {
      router.push(waypoint.route as any);
    } else if (waypoint.action === 'task-form' && waypoint.formType && onTaskFormOpen) {
      onTaskFormOpen(waypoint.formType as 'task' | 'event' | 'depositIdea');
    } else if (waypoint.action === 'journal-form' && waypoint.formType && onJournalFormOpen) {
      onJournalFormOpen(waypoint.formType as 'rose' | 'thorn' | 'reflection');
    }
  };

  const handleDotPress = (dotAngle: number) => {
    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setCompassState(prev => ({
      ...prev,
      smallSpindleAngle: dotAngle,
      focusedSlot: `DOT_${dotAngle}`,
    }));

    setFocusedDot(dotAngle);

    const waypoint = findNearestWaypoint(dotAngle);
    if (waypoint) {
      setTimeout(() => {
        handleWaypointAction(waypoint);
      }, 300);
    }
  };

  const calculateDotPosition = (angle: number) => {
    const angleRad = (angle - 90) * (Math.PI / 180);
    const x = COMPASS_CENTER.x + DOT_RADIUS * Math.cos(angleRad);
    const y = COMPASS_CENTER.y + DOT_RADIUS * Math.sin(angleRad);
    return { x, y };
  };

  const calculateAngle = (x: number, y: number): number => {
    const scale = 288 / responsiveSize;
    const svgX = x * scale;
    const svgY = y * scale;

    const dx = svgX - COMPASS_CENTER.x;
    const dy = svgY - COMPASS_CENTER.y;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle + 90;

    return normalizeAngle(angle);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const angle = calculateAngle(event.x, event.y);
      rotation.value = angle;
      runOnJS(handleSilverSpindleChange)(angle);
    });

  const colorRingStyle = useAnimatedStyle(() => ({
    opacity: colorRingOpacity.value,
  }));

  const grayscaleRingStyle = useAnimatedStyle(() => ({
    opacity: 1 - colorRingOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.compassContainer,
          { width: responsiveSize, height: responsiveSize },
        ]}
      >
        <Svg
          width={responsiveSize}
          height={responsiveSize}
          viewBox="0 0 288 288"
        >
          <Defs>
            <RadialGradient id="rainbow-gradient" cx="50%" cy="50%" r="50%">
              <Stop offset="20%" stopColor="#ffffff" stopOpacity="0" />
              <Stop offset="40%" stopColor="#ff0000" stopOpacity="0.3" />
              <Stop offset="50%" stopColor="#ff7f00" stopOpacity="0.5" />
              <Stop offset="60%" stopColor="#ffff00" stopOpacity="0.7" />
              <Stop offset="70%" stopColor="#00ff00" stopOpacity="0.7" />
              <Stop offset="80%" stopColor="#0000ff" stopOpacity="0.7" />
              <Stop offset="90%" stopColor="#8b00ff" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#ff00ff" stopOpacity="0.4" />
            </RadialGradient>
          </Defs>

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

          <G id="BlackDots">
            {DOT_ANGLES.map((angle, index) => {
              const { x, y } = calculateDotPosition(angle);
              const isFocused = focusedDot === angle;

              return (
                <G key={`dot-${index}`}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={isFocused ? DOT_SIZE * 1.3 : DOT_SIZE}
                    fill={isFocused ? '#000' : '#333'}
                    opacity={isFocused ? 1 : 0.85}
                  />
                </G>
              );
            })}
          </G>
        </Svg>

        {DOT_ANGLES.map((angle, index) => {
          const { x, y } = calculateDotPosition(angle);
          const scale = responsiveSize / 288;
          const touchSize = 44;

          return (
            <TouchableOpacity
              key={`touch-dot-${index}`}
              style={[
                styles.dotTouch,
                {
                  left: (x * scale) - (touchSize / 2),
                  top: (y * scale) - (touchSize / 2),
                  width: touchSize,
                  height: touchSize,
                },
              ]}
              onPress={() => handleDotPress(angle)}
              activeOpacity={0.6}
            />
          );
        })}

        <GestureDetector gesture={panGesture}>
          <View style={[styles.gestureArea, StyleSheet.absoluteFill]} />
        </GestureDetector>

        <View style={[styles.colorRingContainer, StyleSheet.absoluteFill]}>
          <Animated.View style={[StyleSheet.absoluteFill, colorRingStyle]}>
            <Svg
              width={responsiveSize}
              height={responsiveSize}
              viewBox="0 0 288 288"
              style={StyleSheet.absoluteFill}
            >
              <Circle
                cx="144"
                cy="144"
                r="88"
                fill="url(#rainbow-gradient)"
                opacity="0.6"
              />
            </Svg>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, grayscaleRingStyle]}>
            <Svg
              width={responsiveSize}
              height={responsiveSize}
              viewBox="0 0 288 288"
              style={StyleSheet.absoluteFill}
            >
              <Circle
                cx="144"
                cy="144"
                r="88"
                fill="none"
                opacity="0"
              />
            </Svg>
          </Animated.View>
        </View>

        <View style={[styles.spindleLayer, { width: responsiveSize, height: responsiveSize }]}>
          <SpindleGold
            angle={compassState.bigSpindleAngle}
            size={responsiveSize}
            onSnapComplete={handleGoldSpindleSnap}
          />
        </View>

        <View style={[styles.spindleLayer, StyleSheet.absoluteFill]}>
          <SpindleSilver
            angle={compassState.smallSpindleAngle}
            size={responsiveSize}
            animated={!compassState.isSpinning}
            onAngleChange={handleSilverSpindleChange}
          />
        </View>

        <View style={[styles.hubLayer, StyleSheet.absoluteFill]}>
          <CompassHub
            size={responsiveSize}
            isSpinning={compassState.isSpinning}
            onTap={handleHubTap}
            activeZone={compassState.activeZone}
          />
        </View>
      </View>
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
  spindleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hubLayer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorRingContainer: {
    pointerEvents: 'none',
  },
  dotTouch: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  gestureArea: {
    backgroundColor: 'transparent',
  },
});
