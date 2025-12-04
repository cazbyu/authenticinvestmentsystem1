import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  clamp,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface DraggableFabProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  size?: number;
  backgroundColor?: string;
}

export function DraggableFab({
  onPress,
  children,
  style,
  size = 24,
  backgroundColor
}: DraggableFabProps) {
  const { colors } = useTheme();
  const fabBackgroundColor = backgroundColor || colors.primary;
  const screenDimensions = useRef(Dimensions.get('window'));
  const hasInitialized = useRef(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const isPressed = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const hasMoved = useSharedValue(false);

  useEffect(() => {
    const updatePosition = () => {
      const { width, height } = Dimensions.get('window');
      screenDimensions.current = { width, height } as typeof screenDimensions.current;

      // Clamp to keep the FAB on-screen when device rotates or window resizes
      translateX.value = clamp(translateX.value, 20, width - size - 20);
      translateY.value = clamp(translateY.value, 20, height - size - 100);

      if (!hasInitialized.current) {
        translateX.value = width - size - 20;
        translateY.value = height - size - 100;
        hasInitialized.current = true;
      }
    };

    updatePosition();
    const subscription = Dimensions.addEventListener('change', updatePosition);

    return () => {
      subscription?.remove();
    };
  }, [size, translateX, translateY]);

  const handlePress = () => {
    onPress();
  };

  const longPress = Gesture.LongPress()
    .minDuration(0)
    .onStart(() => {
      'worklet';
      isPressed.value = true;
      hasMoved.value = false;
    })
    .onEnd(() => {
      'worklet';
      if (!hasMoved.value) {
        runOnJS(handlePress)();
      }
      isPressed.value = false;
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-3, 3])
    .activeOffsetY([-3, 3])
    .onStart(() => {
      'worklet';
      isPressed.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
      hasMoved.value = true;
    })
    .onUpdate((event) => {
      'worklet';
      const newX = startX.value + event.translationX;
      const newY = startY.value + event.translationY;

      const { width, height } = screenDimensions.current;

      translateX.value = clamp(newX, 0, width - size);
      translateY.value = clamp(newY, 0, height - size - 80);
    })
    .onEnd(() => {
      'worklet';
      isPressed.value = false;

      const currentX = translateX.value;
      const currentY = translateY.value;

      const { width, height } = screenDimensions.current;

      translateX.value = withSpring(
        clamp(currentX, 20, width - size - 20)
      );
      translateY.value = withSpring(
        clamp(currentY, 20, height - size - 100)
      );
    });

  const composedGesture = Gesture.Race(panGesture, longPress);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withSpring(isPressed.value ? 1.1 : 1) },
      ],
    };
  });

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          collapsable={false}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[
            styles.fab,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: fabBackgroundColor,
            },
            animatedStyle,
            style,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  fab: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
