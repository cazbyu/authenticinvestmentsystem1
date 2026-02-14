// components/weekly-alignment/TourGuideBubble.tsx
// CoachBubble: 2-way coaching interface for Weekly Alignment steps
// Floating FAB expands into a chat panel with message history + text input

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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Compass, X, Send } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type {
  AlignmentCoachResponse,
  ConversationMessage,
  CaptureOffer,
} from '@/types/alignmentCoach';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const AUTO_OPEN_DELAY_MS = 1000;

interface CoachBubbleProps {
  /** Latest coach response (for auto-open and capture tracking) */
  latestResponse: AlignmentCoachResponse | null;
  /** Whether a request is in flight */
  isLoading: boolean;
  /** Full conversation history */
  messages: ConversationMessage[];
  /** Send a user message */
  onSendMessage: (text: string) => void;
  /** Accept a capture offer */
  onAcceptCapture: (offer: CaptureOffer) => void;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Toggle panel open/closed */
  onToggle: () => void;
  /** Step accent color */
  stepColor: string;
  /** Step display label */
  stepLabel: string;
}

// Keep the named export as TourGuideBubble for backward compatibility
export function TourGuideBubble({
  latestResponse,
  isLoading,
  messages,
  onSendMessage,
  onAcceptCapture,
  isOpen,
  onToggle,
  stepColor,
  stepLabel,
}: CoachBubbleProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const lastResponseRef = useRef<string | null>(null);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasContent = messages.length > 0 || isLoading;
  const captures = latestResponse?.captures || [];

  // Animate open/close
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  // Auto-open when new coach response arrives
  useEffect(() => {
    if (
      latestResponse?.text &&
      latestResponse.text !== lastResponseRef.current
    ) {
      lastResponseRef.current = latestResponse.text;

      if (autoOpenTimerRef.current) {
        clearTimeout(autoOpenTimerRef.current);
      }

      if (!isOpen) {
        autoOpenTimerRef.current = setTimeout(() => {
          onToggle();
          autoOpenTimerRef.current = null;
        }, AUTO_OPEN_DELAY_MS);
      }
    }

    return () => {
      if (autoOpenTimerRef.current) {
        clearTimeout(autoOpenTimerRef.current);
      }
    };
  }, [latestResponse?.text]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length > 0 && isOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isOpen]);

  // Reset last response ref when messages are cleared (step change)
  useEffect(() => {
    if (messages.length === 0) {
      lastResponseRef.current = null;
    }
  }, [messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    onSendMessage(text);
  }

  function handleAcceptCapture(offer: CaptureOffer) {
    onAcceptCapture(offer);
  }

  const panelTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_MAX_HEIGHT + 60, 0],
  });

  const panelOpacity = slideAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Backdrop when panel is open */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onToggle}
        />
      )}

      {/* Chat Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: panelOpacity,
            transform: [{ translateY: panelTranslateY }],
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <KeyboardAvoidingView
          style={styles.panelInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={[styles.stepDot, { backgroundColor: stepColor }]} />
            <View style={styles.headerTextGroup}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Your Coach
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {stepLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onToggle}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg, index) => (
              <View
                key={`msg-${index}`}
                style={[
                  styles.bubble,
                  msg.role === 'user'
                    ? [styles.bubbleUser, { backgroundColor: stepColor }]
                    : [styles.bubbleAssistant, { backgroundColor: colors.border }],
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    {
                      color:
                        msg.role === 'user'
                          ? '#fff'
                          : colors.text,
                    },
                  ]}
                >
                  {msg.content}
                </Text>

                {/* Show capture offers on the last assistant message */}
                {msg.role === 'assistant' &&
                  index === messages.length - 1 &&
                  captures.length > 0 && (
                    <View style={styles.captureOfferRow}>
                      {captures.map((offer, ci) => (
                        <View key={`cap-${ci}`} style={styles.captureOfferButtons}>
                          <TouchableOpacity
                            style={styles.captureAcceptBtn}
                            onPress={() => handleAcceptCapture(offer)}
                          >
                            <Text style={styles.captureAcceptText}>
                              + {offer.captureType === 'task' ? 'Add Task' :
                                 offer.captureType === 'event' ? 'Add Event' :
                                 offer.captureType === 'rose' ? 'Add Rose' :
                                 offer.captureType === 'thorn' ? 'Add Thorn' :
                                 offer.captureType === 'reflection' ? 'Add Reflection' :
                                 offer.captureType === 'deposit_idea' ? 'Add Idea' :
                                 `Add ${offer.captureType}`}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
              </View>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: colors.border }]}>
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={stepColor} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Thinking...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Row */}
          <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={2000}
              editable={!isLoading}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor: input.trim() && !isLoading ? stepColor : colors.border,
                },
              ]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: stepColor }]}
        onPress={onToggle}
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
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // --- FAB ---
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1001,
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

  // --- Panel ---
  panel: {
    position: 'absolute',
    bottom: 88,
    left: 16,
    right: 16,
    maxHeight: PANEL_MAX_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 1000,
  },
  panelInner: {
    flex: 1,
    maxHeight: PANEL_MAX_HEIGHT - 2, // Account for border
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 8,
  },

  // --- Messages ---
  messagesScroll: {
    flex: 1,
    minHeight: 120,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },

  // --- Capture Offers ---
  captureOfferRow: {
    marginTop: 10,
    gap: 6,
  },
  captureOfferButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  captureAcceptBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  captureAcceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  // --- Loading ---
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // --- Input ---
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TourGuideBubble;
