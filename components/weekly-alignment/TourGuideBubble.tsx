// components/weekly-alignment/TourGuideBubble.tsx
// Floating chat bubble for Tour Guide coaching across Weekly Alignment steps

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Compass, X } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.85;
const BUBBLE_MIN_WIDTH = 280;
const BUBBLE_SCROLL_MAX_HEIGHT = 200;
const AUTO_OPEN_DELAY_MS = 1000;

interface TourGuideBubbleProps {
  message: string | null;
  isLoading?: boolean;
  onDismiss?: () => void;
}

export function TourGuideBubble({
  message,
  isLoading = false,
  onDismiss,
}: TourGuideBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const lastMessageRef = useRef<string | null>(null);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When we get a new message: show dot, auto-open after 1 second. When loading, auto-open to show "Listening..."
  useEffect(() => {
    if (message && message !== lastMessageRef.current) {
      lastMessageRef.current = message;

      // Clear any pending auto-open
      if (autoOpenTimerRef.current) {
        clearTimeout(autoOpenTimerRef.current);
      }

      // Auto-open after 1 second when we have a new message
      autoOpenTimerRef.current = setTimeout(() => {
        setIsOpen(true);
        animateBubble(1);
        autoOpenTimerRef.current = null;
      }, AUTO_OPEN_DELAY_MS);
    } else if (isLoading) {
      // When loading starts, auto-open to show "Listening..."
      setIsOpen(true);
      animateBubble(1);
    } else if (!message && !isLoading) {
      lastMessageRef.current = null;
      setIsOpen(false);
      animateBubble(0);
    }
  }, [message, isLoading]);

  // Reset lastMessageRef when message is cleared (e.g. step change)
  useEffect(() => {
    if (!message) {
      lastMessageRef.current = null;
    }
  }, [message]);

  const hasContent = !!(message || isLoading);

  const animateBubble = (toValue: number) => {
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleOpen = () => {
    if (hasContent) {
      setIsOpen(true);
      animateBubble(1);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    animateBubble(0);
    onDismiss?.();
  };

  const handleToggle = () => {
    if (!hasContent) return;
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  const bubbleTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [150, 0],
  });

  const bubbleOpacity = slideAnim;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Speech Bubble - above the button */}
      {hasContent && (
        <Animated.View
          style={[
            styles.bubbleWrapper,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleTranslateY }],
            },
          ]}
          pointerEvents={isOpen ? 'auto' : 'none'}
        >
          <View style={[styles.bubble, !isOpen && styles.bubbleHidden]}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>

            <ScrollView
              style={styles.bubbleScroll}
              contentContainerStyle={styles.bubbleContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#64748b" />
                  <Text style={styles.loadingText}>Listening...</Text>
                </View>
              ) : message ? (
                <Text style={styles.messageText}>{message}</Text>
              ) : null}
            </ScrollView>

            {/* Speech bubble tail pointing down */}
            <View style={styles.tail} />
          </View>
        </Animated.View>
      )}

      {/* Floating Button */}
      <TouchableOpacity
        style={[styles.fab, hasContent && styles.fabActive]}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        <Compass size={24} color="#FFFFFF" />
        {hasContent && !isOpen && <View style={styles.notificationDot} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ed1c24',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabActive: {
    // Same style when there's content
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bubbleWrapper: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 64,
    minWidth: BUBBLE_MIN_WIDTH,
    maxWidth: BUBBLE_MAX_WIDTH,
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  bubbleHidden: {
    opacity: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleScroll: {
    maxHeight: BUBBLE_SCROLL_MAX_HEIGHT,
  },
  bubbleContent: {
    paddingRight: 32,
    paddingTop: 8,
    paddingBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    flexWrap: 'wrap',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
    fontStyle: 'italic',
  },
  tail: {
    position: 'absolute',
    bottom: -10,
    right: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fafafa',
  },
});

export default TourGuideBubble;
