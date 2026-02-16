/**
 * CompassRitualController — Visual Heartbeat of the Weekly Alignment
 *
 * Orchestrates compass animations during the weekly alignment ritual:
 * 1. Full-screen ignition animation (spindles spin, decelerate to North)
 * 2. Shrink-to-corner transition
 * 3. Gold spindle rotates to cardinal direction per step
 * 4. Silver spindle tracks sub-items (roles, zones, goals)
 * 5. Step 5 alignment sweep through all cardinals
 * 6. Step 6 fade-out with overlay text
 *
 * Renders a simplified compass (star + spindles, no dots/waypoints/icons)
 * suitable for the 72px corner size.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  G,
  Circle,
  Path,
  Polygon,
} from 'react-native-svg';
import SpindleGold from './SpindleGold';
import SpindleSilver from './SpindleSilver';
import {
  IGNITION_CONFIG,
  TRANSITION_DURATION,
  SHRINK_DURATION,
  FADE_DURATION,
  FULL_SIZE,
  CORNER_SIZE,
  CORNER_PADDING_X,
  CORNER_PADDING_Y,
  ALIGNMENT_SWEEP_ANGLES,
  getStepConfig,
  INTRO_MESSAGES,
  INTRO_FADE_IN,
  INTRO_FADE_OUT,
  INTRO_BACKDROP_FADE,
} from '@/lib/compassRitualSequence';

// ============================================
// TYPES
// ============================================

interface CompassRitualControllerProps {
  /** Current step index (0-5) */
  currentStep: number;
  /** Whether the ignition animation has completed */
  isIgnitionComplete: boolean;
  /** Silver spindle target angle from step components (for sub-item tracking) */
  silverFocusAngle?: number;
  /** Called when ignition animation finishes */
  onIgnitionComplete: () => void;
  /** For Step 5: which cardinal index (0-3) to sweep Gold spindle to */
  alignmentSweepIndex?: number;
  /** Theme colors */
  colors: any;
  /** Measured dock position (absolute screen coordinates of the placeholder) */
  dockPosition?: { x: number; y: number } | null;
  /** Whether to show the inspirational intro text sequence */
  showIntroSequence?: boolean;
  /** Whether the user already has a core identity (hides final "Finish this sentence..." message) */
  hasIdentity?: boolean;
  /** Called when the intro text sequence finishes and backdrop fades out */
  onIntroSequenceComplete?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function CompassRitualController({
  currentStep,
  isIgnitionComplete,
  silverFocusAngle,
  onIgnitionComplete,
  alignmentSweepIndex,
  colors,
  dockPosition,
  showIntroSequence = false,
  hasIdentity = false,
  onIntroSequenceComplete,
}: CompassRitualControllerProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // ---- Reanimated shared values (container animations) ----
  const compassScale = useSharedValue(1);
  const compassX = useSharedValue(screenWidth / 2 - FULL_SIZE / 2);
  const compassY = useSharedValue(screenHeight / 3 - FULL_SIZE / 2);
  const compassOpacity = useSharedValue(1);

  // Overlay ref for measuring its window offset
  const overlayRef = useRef<View>(null);
  const overlayOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Always-current dock position ref (avoids stale closure in handleIgnitionDone)
  const dockPositionRef = useRef(dockPosition);
  useEffect(() => { dockPositionRef.current = dockPosition; }, [dockPosition]);

  // Ignition ceremony spindle rotations (Reanimated for smooth spin)
  const goldIgnitionRotation = useSharedValue(0);
  const silverIgnitionRotation = useSharedValue(0);

  // Step 6 overlay
  const overlayOpacity = useSharedValue(0);

  // ---- Intro sequence state ----
  const [introMessageIndex, setIntroMessageIndex] = useState(-1);
  const [introComplete, setIntroComplete] = useState(!showIntroSequence);
  const introTextOpacity = useSharedValue(0);
  const introBackdropOpacity = useSharedValue(showIntroSequence ? 1 : 0);
  const introTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Filter messages based on identity status
  const introMessages = INTRO_MESSAGES.filter(
    (msg) => !msg.noIdentityOnly || !hasIdentity,
  );

  // ---- React state for post-ignition spindle angles ----
  // SpindleGold/SpindleSilver manage their own Reanimated internals;
  // they accept `angle` as a plain number prop and animate to it.
  const [goldAngle, setGoldAngle] = useState(0);
  const [silverAngle, setSilverAngle] = useState(0);

  // Track ignition phase
  const ignitionPhaseRef = useRef<'spinning' | 'decelerating' | 'shrinking' | 'docked'>('spinning');

  // ============================================
  // IGNITION ANIMATION
  // ============================================
  useEffect(() => {
    if (isIgnitionComplete) return;

    // Phase 1: Free spin (2 seconds)
    goldIgnitionRotation.value = withTiming(
      IGNITION_CONFIG.goldSpinDegrees,
      { duration: IGNITION_CONFIG.spinDuration, easing: Easing.linear },
    );

    silverIgnitionRotation.value = withTiming(
      IGNITION_CONFIG.silverSpinDegrees,
      { duration: IGNITION_CONFIG.spinDuration, easing: Easing.linear },
      (finished) => {
        if (!finished) return;
        // Phase 2: Decelerate (spindles are already at target rotation,
        // but we re-issue a withTiming to the same value with cubic-out
        // to create the deceleration feel)
        ignitionPhaseRef.current = 'decelerating';

        goldIgnitionRotation.value = withTiming(
          IGNITION_CONFIG.goldSpinDegrees,
          { duration: IGNITION_CONFIG.decelerateDuration, easing: Easing.out(Easing.cubic) },
          (finished2) => {
            if (!finished2) return;
            runOnJS(handleIgnitionDone)();
          },
        );

        silverIgnitionRotation.value = withTiming(
          IGNITION_CONFIG.silverSpinDegrees,
          { duration: IGNITION_CONFIG.decelerateDuration + 200, easing: Easing.out(Easing.cubic) },
        );
      },
    );
  }, [isIgnitionComplete]);

  // ============================================
  // INTRO TEXT SEQUENCE
  // ============================================
  useEffect(() => {
    if (!showIntroSequence || introComplete) return;

    // Schedule each message as a separate timeout
    const timers: ReturnType<typeof setTimeout>[] = [];

    introMessages.forEach((msg, idx) => {
      // Fade in
      timers.push(
        setTimeout(() => {
          setIntroMessageIndex(idx);
          introTextOpacity.value = withTiming(1, { duration: INTRO_FADE_IN });
        }, msg.startMs),
      );

      // Fade out
      timers.push(
        setTimeout(() => {
          introTextOpacity.value = withTiming(0, { duration: INTRO_FADE_OUT });
        }, msg.startMs + INTRO_FADE_IN + msg.holdMs),
      );
    });

    // After last message fully fades: fade backdrop and signal complete
    const lastMsg = introMessages[introMessages.length - 1];
    const sequenceEndMs = lastMsg.startMs + INTRO_FADE_IN + lastMsg.holdMs + INTRO_FADE_OUT;

    timers.push(
      setTimeout(() => {
        introBackdropOpacity.value = withTiming(0, { duration: INTRO_BACKDROP_FADE });
      }, sequenceEndMs),
    );

    timers.push(
      setTimeout(() => {
        setIntroComplete(true);
        onIntroSequenceComplete?.();
      }, sequenceEndMs + INTRO_BACKDROP_FADE),
    );

    introTimersRef.current = timers;

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [showIntroSequence]); // Run once on mount if intro is enabled

  const computeDockXY = useCallback(() => {
    const cornerScale = CORNER_SIZE / FULL_SIZE;
    const scaleOffset = (FULL_SIZE / 2) * (1 - cornerScale);

    const pos = dockPositionRef.current;
    if (pos) {
      const overlayX = overlayOffsetRef.current.x;
      const overlayY = overlayOffsetRef.current.y;
      return {
        x: (pos.x - overlayX) - scaleOffset,
        y: (pos.y - overlayY) - scaleOffset,
      };
    }
    return { x: CORNER_PADDING_X, y: CORNER_PADDING_Y };
  }, []);

  const handleIgnitionDone = useCallback(() => {
    ignitionPhaseRef.current = 'shrinking';

    const cornerScale = CORNER_SIZE / FULL_SIZE;
    const { x: dockX, y: dockY } = computeDockXY();

    compassScale.value = withTiming(cornerScale, {
      duration: SHRINK_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    compassX.value = withTiming(dockX, {
      duration: SHRINK_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    compassY.value = withTiming(dockY, {
      duration: SHRINK_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    // After shrink completes, notify parent
    setTimeout(() => {
      ignitionPhaseRef.current = 'docked';
      onIgnitionComplete();
    }, SHRINK_DURATION + 50);
  }, [onIgnitionComplete, computeDockXY]);

  // ============================================
  // STEP CHANGE → GOLD SPINDLE
  // ============================================
  useEffect(() => {
    if (!isIgnitionComplete) return;

    const config = getStepConfig(currentStep);

    // Update gold angle (SpindleGold animates internally via its angle prop)
    setGoldAngle(config.goldAngle);

    // Reset silver to step default if step doesn't follow items
    if (!config.silverFollowsItems) {
      setSilverAngle(config.silverAngle);
    }

    // Step 6: Fade out compass, show overlay
    if (config.fadeOut) {
      compassOpacity.value = withTiming(0, {
        duration: FADE_DURATION,
        easing: Easing.out(Easing.ease),
      });
      overlayOpacity.value = withDelay(
        FADE_DURATION / 2,
        withTiming(1, { duration: FADE_DURATION }),
      );
    } else {
      // Ensure visible if user navigates back from Step 6
      compassOpacity.value = withTiming(1, { duration: 200 });
      overlayOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [currentStep, isIgnitionComplete]);

  // ============================================
  // SILVER SPINDLE FOCUS (sub-item tracking)
  // ============================================
  useEffect(() => {
    if (!isIgnitionComplete || silverFocusAngle === undefined) return;

    const config = getStepConfig(currentStep);
    if (!config.silverFollowsItems) return;

    setSilverAngle(silverFocusAngle);
  }, [silverFocusAngle, isIgnitionComplete, currentStep]);

  // ============================================
  // STEP 5 ALIGNMENT SWEEP
  // ============================================
  useEffect(() => {
    if (!isIgnitionComplete || alignmentSweepIndex === undefined) return;
    if (currentStep !== 4) return; // Only Step 5 (index 4)

    const angle = ALIGNMENT_SWEEP_ANGLES[alignmentSweepIndex];
    if (angle === undefined) return;

    setGoldAngle(angle);
  }, [alignmentSweepIndex, isIgnitionComplete, currentStep]);

  // ============================================
  // ANIMATED STYLES
  // ============================================
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: compassX.value },
      { translateY: compassY.value },
      { scale: compassScale.value },
    ],
    opacity: compassOpacity.value,
  }));

  const goldIgnitionStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${goldIgnitionRotation.value}deg` }],
  }));

  const silverIgnitionStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${silverIgnitionRotation.value}deg` }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const introTextStyle = useAnimatedStyle(() => ({
    opacity: introTextOpacity.value,
  }));

  const introBackdropStyle = useAnimatedStyle(() => ({
    opacity: introBackdropOpacity.value,
  }));

  // ============================================
  // RENDER
  // ============================================
  const isIgniting = !isIgnitionComplete;
  const introActive = showIntroSequence && !introComplete;

  const handleOverlayLayout = useCallback(() => {
    if (overlayRef.current) {
      (overlayRef.current as any).measureInWindow((x: number, y: number) => {
        if (x !== undefined && y !== undefined) {
          overlayOffsetRef.current = { x, y };
        }
      });
    }
  }, []);

  return (
    <View
      ref={overlayRef}
      style={styles.overlay}
      pointerEvents={(isIgniting || introActive) ? 'auto' : 'none'}
      onLayout={handleOverlayLayout}
    >
      {/* Ignition backdrop — blocks interaction during ceremony */}
      {isIgniting && !showIntroSequence && (
        <View style={[styles.ignitionBackdrop, { backgroundColor: colors.background }]} />
      )}

      {/* Intro sequence backdrop — animated opacity so it fades out smoothly */}
      {showIntroSequence && (
        <Animated.View
          style={[styles.ignitionBackdrop, { backgroundColor: colors.background }, introBackdropStyle]}
          pointerEvents={introActive ? 'auto' : 'none'}
        />
      )}

      {/* Compass container — transforms handle position/scale/opacity */}
      <Animated.View style={[styles.compassWrapper, { width: FULL_SIZE, height: FULL_SIZE }, containerStyle]}>
        {/* Simplified compass face SVG (no dots, no waypoints, no cardinal icons) */}
        <Svg width={FULL_SIZE} height={FULL_SIZE} viewBox="0 0 288 288">
          {/* White background circle */}
          <Circle cx="144" cy="144" r="102.24" fill="#fff" />

          {/* Outer ring */}
          <Path
            d="M144,30.24c62.83,0,113.76,50.93,113.76,113.76s-50.93,113.76-113.76,113.76S30.24,206.83,30.24,144,81.17,30.24,144,30.24M144,27.84c-64.05,0-116.16,52.11-116.16,116.16s52.11,116.16,116.16,116.16,116.16-52.11,116.16-116.16S208.05,27.84,144,27.84h0Z"
            fill="#333"
          />

          {/* Middle ring */}
          <Path
            d="M144,57.6c47.72,0,86.4,38.68,86.4,86.4s-38.68,86.4-86.4,86.4-86.4-38.68-86.4-86.4,38.68-86.4,86.4-86.4M144,55.2c-48.96,0-88.8,39.84-88.8,88.8s39.84,88.8,88.8,88.8,88.8-39.84,88.8-88.8-39.84-88.8-88.8-88.8h0Z"
            fill="#333"
          />

          {/* 8-point star */}
          <G id="Star">
            <G id="_2nd_Tier_Star">
              <Polygon points="144 112.87 64.8 64.8 112.87 144 64.8 223.2 144 175.13 223.2 223.2 175.13 144 223.2 64.8 144 112.87" fill="#333" />
              <Polygon points="144 144 211.78 211.78 170.64 144 144 144" fill="#fff" />
              <Polygon points="144 144 211.78 211.78 144 170.64 144 144" fill="#333" />
              <Polygon points="144 144 211.78 76.22 144 117.36 144 144" fill="#fff" />
              <Polygon points="144 144 211.78 76.22 170.64 144 144 144" fill="#333" />
              <Polygon points="144 144 69.44 69.44 114.7 144 144 144" fill="#fff" />
              <Polygon points="144 144 69.44 69.44 144 114.7 144 144" fill="#333" />
              <Polygon points="144 144 76.22 211.78 144 170.64 144 144" fill="#fff" />
              <Polygon points="144 144 76.22 211.78 117.36 144 144 144" fill="#333" />
            </G>
            <G id="Outer_Star">
              <Polygon points="172.3 115.7 144 0 115.7 115.7 0 144 115.7 172.3 144 288 172.3 172.3 288 144 172.3 115.7" fill="#333" />
              <Polygon points="144 144 144 279.56 170.64 170.64 144 144" fill="#fff" />
              <Polygon points="144 144 144 279.56 117.36 170.64 144 144" fill="#333" />
              <Polygon points="144 144 279.56 144 170.64 117.36 144 144" fill="#fff" />
              <Polygon points="144 144 279.56 144 170.64 170.64 144 144" fill="#333" />
              <Polygon points="144 144 144 8.44 117.36 117.36 144 144" fill="#fff" />
              <Polygon points="144 144 144 8.44 170.64 117.36 144 144" fill="#333" />
              <Polygon points="144 144 8.44 144 117.36 170.64 144 144" fill="#fff" />
              <Polygon points="144 144 8.44 144 117.36 117.36 144 144" fill="#333" />
            </G>
          </G>

          {/* Center circles */}
          <G id="Center_Circle">
            <Circle cx="144" cy="144" r="24.48" fill="#fff" />
            <Path
              d="M144,169.68c-14.16,0-25.68-11.52-25.68-25.68s11.52-25.68,25.68-25.68,25.68,11.52,25.68,25.68-11.52,25.68-25.68,25.68ZM144,120.72c-12.84,0-23.28,10.44-23.28,23.28s10.44,23.28,23.28,23.28,23.28-10.44,23.28-23.28-10.44-23.28-23.28-23.28Z"
              fill="#333"
            />
            <Circle cx="144" cy="144" r="20.16" fill="#333" />
            <Circle cx="144" cy="144" r="16.8" fill="#fff" />
          </G>
        </Svg>

        {/* Spindle layers */}
        {isIgniting ? (
          <>
            {/* During ignition: Animated.View wrappers control rotation */}
            <Animated.View style={[styles.spindleLayer, { width: FULL_SIZE, height: FULL_SIZE }, goldIgnitionStyle]}>
              <SpindleGold angle={0} size={FULL_SIZE} continuousSpin={false} onSnapComplete={() => {}} />
            </Animated.View>
            <Animated.View style={[styles.spindleLayer, { width: FULL_SIZE, height: FULL_SIZE }, silverIgnitionStyle]}>
              <SpindleSilver angle={0} size={FULL_SIZE} animated={false} continuousSpin={false} onAngleChange={() => {}} />
            </Animated.View>
          </>
        ) : (
          <>
            {/* After ignition: angle prop drives internal Reanimated animation */}
            <View style={[styles.spindleLayer, { width: FULL_SIZE, height: FULL_SIZE }]}>
              <SpindleGold angle={goldAngle} size={FULL_SIZE} continuousSpin={false} onSnapComplete={() => {}} />
            </View>
            <View style={[styles.spindleLayer, { width: FULL_SIZE, height: FULL_SIZE }]}>
              <SpindleSilver angle={silverAngle} size={FULL_SIZE} animated={true} continuousSpin={false} onAngleChange={() => {}} />
            </View>
          </>
        )}
      </Animated.View>

      {/* Intro text sequence overlay */}
      {showIntroSequence && introMessageIndex >= 0 && (
        <Animated.View style={[styles.introTextContainer, introTextStyle]} pointerEvents="none">
          <View style={[styles.introTextBlock, { backgroundColor: `${colors.background}E6` }]}>
            <Text style={[styles.introText, { color: colors.text }]}>
              {introMessages[introMessageIndex]?.text ?? ''}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Step 6: "Thinking done — time to act" overlay */}
      <Animated.View style={[styles.step6Overlay, overlayStyle]} pointerEvents="none">
        <Text style={[styles.step6Text, { color: colors.textSecondary }]}>
          Thinking done — time to act
        </Text>
      </Animated.View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  ignitionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  compassWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spindleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  introTextContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    top: '55%',
  },
  introTextBlock: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    maxWidth: 340,
    alignItems: 'center',
  },
  introText: {
    fontSize: 22,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  step6Overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  step6Text: {
    fontSize: 20,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
