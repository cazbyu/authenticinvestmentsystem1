import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  clamp,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Plus, Compass } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ACTIVITY_CONFIGS, ACTIVITY_ORDER, ActivityConfig, ActivityType } from '@/lib/activityConfig';

interface SpeedDialFabProps {
  onActivitySelect: (config: ActivityConfig) => void;
  size?: number;
  backgroundColor?: string;
  /** When true, adds Coach option at top; when false, single tap skips menu and calls onQuickCaptureDirect */
  coachingChatEnabled?: boolean;
  /** Called when user taps Coach option (only when coachingChatEnabled) */
  onCoachPress?: () => void;
  /** Called when user taps FAB and coach is disabled — skip menu, go straight to capture */
  onQuickCaptureDirect?: () => void;
}

const MINI_FAB_SIZE = 48;
const MINI_FAB_SPACING = 60;

export function SpeedDialFab({
  onActivitySelect,
  size = 56,
  backgroundColor,
  coachingChatEnabled = true,
  onCoachPress,
  onQuickCaptureDirect,
}: SpeedDialFabProps) {
  const { colors } = useTheme();
  const fabBackgroundColor = backgroundColor || colors.primary;
  const screenDimensions = useRef(Dimensions.get('window'));
  const hasInitialized = useRef(false);

  const [isOpen, setIsOpen] = useState(false);

  // Position state
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Gesture state
  const isPressed = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const hasMoved = useSharedValue(false);

  // Animation state
  const openProgress = useSharedValue(0);

  useEffect(() => {
    const updatePosition = () => {
      const { width, height } = Dimensions.get('window');
      screenDimensions.current = { width, height } as typeof screenDimensions.current;

      // Clamp to keep the FAB on-screen
      translateX.value = clamp(translateX.value, 0, width - size);
      translateY.value = clamp(translateY.value, 0, height - size - 120);

      if (!hasInitialized.current) {
        translateX.value = width - size - 20;
        translateY.value = height - size - 120;
        hasInitialized.current = true;
      }
    };

    updatePosition();
    const subscription = Dimensions.addEventListener('change', updatePosition);

    return () => {
      subscription?.remove();
    };
  }, [size, translateX, translateY]);

  const toggleOpen = () => {
    if (!coachingChatEnabled && onQuickCaptureDirect) {
      onQuickCaptureDirect();
      return;
    }
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    openProgress.value = withSpring(newIsOpen ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  };

  const handleActivityPress = (activityKey: ActivityType) => {
    const config = ACTIVITY_CONFIGS[activityKey];
    // Close the menu
    setIsOpen(false);
    openProgress.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    // Notify parent
    onActivitySelect(config);
  };

  const handlePress = () => {
    toggleOpen();
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      isPressed.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
      hasMoved.value = false;
    })
    .onChange((event) => {
      'worklet';
      const distance = Math.sqrt(
        event.translationX ** 2 + event.translationY ** 2
      );

      if (distance > 5) {
        hasMoved.value = true;
      }

      const newX = startX.value + event.translationX;
      const newY = startY.value + event.translationY;

      const { width, height } = screenDimensions.current;

      translateX.value = clamp(newX, 0, width - size);
      translateY.value = clamp(newY, 0, height - size - 120);
    })
    .onFinalize(() => {
      'worklet';
      isPressed.value = false;

      if (!hasMoved.value) {
        runOnJS(handlePress)();
      }
    });

  // Main FAB animated style
  const mainFabAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withSpring(isPressed.value ? 1.1 : 1) },
      ],
    };
  });

  // Plus icon rotation
  const plusIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${interpolate(openProgress.value, [0, 1], [0, 45])}deg` },
      ],
    };
  });

  // Backdrop animated style
  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(openProgress.value, [0, 1], [0, 0.3]),
      pointerEvents: openProgress.value > 0 ? 'auto' : 'none',
    };
  });

  // Create animated styles for each mini FAB
  const createMiniFabStyle = (index: number) => {
    return useAnimatedStyle(() => {
      const yOffset = interpolate(
        openProgress.value,
        [0, 1],
        [0, -(MINI_FAB_SPACING * (index + 1))],
        Extrapolation.CLAMP
      );
      
      const scale = interpolate(
        openProgress.value,
        [0, 0.5, 1],
        [0, 0.5, 1],
        Extrapolation.CLAMP
      );

      const opacity = interpolate(
        openProgress.value,
        [0, 0.3, 1],
        [0, 0, 1],
        Extrapolation.CLAMP
      );

      return {
        transform: [
          { translateY: yOffset },
          { scale },
        ],
        opacity,
      };
    });
  };

  // Create animated styles for each label
  const createLabelStyle = (index: number) => {
    return useAnimatedStyle(() => {
      const opacity = interpolate(
        openProgress.value,
        [0, 0.5, 1],
        [0, 0, 1],
        Extrapolation.CLAMP
      );

      return {
        opacity,
      };
    });
  };

  // When coach enabled, add Coach as first item (index 0)
  const coachOffset = coachingChatEnabled && onCoachPress ? 1 : 0;

  // Pre-create animated styles: index 0 for coach when present, then activity indices
  const coachMiniFabStyle = createMiniFabStyle(0);
  const coachLabelStyle = createLabelStyle(0);
  const miniFabStyles = ACTIVITY_ORDER.map((_, index) =>
    createMiniFabStyle(index + coachOffset)
  );
  const labelStyles = ACTIVITY_ORDER.map((_, index) =>
    createLabelStyle(index + coachOffset)
  );

  const renderIcon = (config: ActivityConfig) => {
    // All activities use PNG images
    if (config.imageSource) {
      return (
        <Image
          source={config.imageSource}
          style={styles.miniFabImage}
          resizeMode="contain"
        />
      );
    }

    // Fallback (shouldn't happen)
    return <Plus size={22} color={config.color} />;
  };

  return (
    <>
      {/* Backdrop - closes menu when tapped */}
      <Animated.View
        style={[styles.backdrop, backdropStyle]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setIsOpen(false);
            openProgress.value = withSpring(0);
          }}
          activeOpacity={1}
        />
      </Animated.View>

      {/* FAB Container */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <GestureDetector gesture={panGesture}>
          <Animated.View
            collapsable={false}
            style={[
              styles.mainFabWrapper,
              mainFabAnimatedStyle,
            ]}
          >
            {/* Coach Mini FAB (when enabled) */}
            {coachingChatEnabled && onCoachPress && (
              <Animated.View
                style={[styles.miniFabContainer, coachMiniFabStyle]}
              >
                <Animated.View style={[styles.labelContainer, coachLabelStyle]}>
                  <Text style={[styles.label, { color: '#4A90D9' }]}>
                    Coach
                  </Text>
                </Animated.View>
                <TouchableOpacity
                  style={[styles.miniFab, { borderColor: '#4A90D9' }]}
                  onPress={() => {
                    setIsOpen(false);
                    openProgress.value = withSpring(0);
                    onCoachPress();
                  }}
                  activeOpacity={0.7}
                >
                  <Compass size={22} color="#4A90D9" />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Activity Mini FABs */}
            {ACTIVITY_ORDER.map((activityKey, index) => {
              const config = ACTIVITY_CONFIGS[activityKey];
              
              return (
                <Animated.View
                  key={activityKey}
                  style={[
                    styles.miniFabContainer,
                    miniFabStyles[index],
                  ]}
                >
                  {/* Label */}
                  <Animated.View style={[styles.labelContainer, labelStyles[index]]}>
                    <Text style={[styles.label, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </Animated.View>

                  {/* Mini FAB Button */}
                  <TouchableOpacity
                    style={[
                      styles.miniFab,
                      { borderColor: config.color },
                    ]}
                    onPress={() => handleActivityPress(activityKey)}
                    activeOpacity={0.7}
                  >
                    {renderIcon(config)}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

            {/* Main FAB */}
            <View
              style={[
                styles.mainFab,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: fabBackgroundColor,
                },
              ]}
            >
              <Animated.View style={plusIconStyle}>
                <Plus size={28} color="#ffffff" />
              </Animated.View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 999,
  },
  fabContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  mainFabWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  mainFab: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  miniFabContainer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  miniFab: {
    width: MINI_FAB_SIZE,
    height: MINI_FAB_SIZE,
    borderRadius: MINI_FAB_SIZE / 2,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  miniFabImage: {
    width: 26,
    height: 26,
  },
  labelContainer: {
    position: 'absolute',
    right: MINI_FAB_SIZE + 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});