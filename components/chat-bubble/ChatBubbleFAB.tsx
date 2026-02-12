/**
 * ChatBubbleFAB - Floating action button to toggle chat panel
 */

import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ChatBubbleFABProps {
  isOpen: boolean;
  onPress: () => void;
  ritualColor: string;
  hasNotification?: boolean;
  visible?: boolean;
}

const BRAND_RED = '#ed1c24';

export function ChatBubbleFAB({
  isOpen,
  onPress,
  ritualColor,
  hasNotification = false,
  visible = true,
}: ChatBubbleFABProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOpen && hasNotification && visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isOpen, hasNotification, visible]);

  function handlePress() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  if (!visible) return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.fab,
            {
              backgroundColor: isOpen ? '#9ca3af' : BRAND_RED,
              transform: [{ scale: isOpen ? 1 : pulseAnim }],
            },
          ]}
        >
          <Text style={styles.icon}>{isOpen ? '✕' : '💬'}</Text>
          {hasNotification && !isOpen && (
            <View style={[styles.dot, { backgroundColor: ritualColor }]} />
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 100,
  },
  touchable: {
    padding: 4,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 24,
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
