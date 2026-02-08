// ============================================================================
// AlignmentEscortCard.tsx - Coaching nudge card for the Weekly Alignment flow
// ============================================================================
// A reusable card component that appears at contextually appropriate moments
// within each step of the Weekly Alignment ritual. Provides nudges, prompts,
// and celebrations to guide users toward creating aligned actions.
//
// Visual styles:
//   - nudge: Soft suggestion (light blue/gray background)
//   - prompt: Action-oriented (light brand color background with button)
//   - celebrate: Positive reinforcement (light green background)
// ============================================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { X, Compass, Lightbulb, Star, PartyPopper } from 'lucide-react-native';
import type { AlignmentEscortCardProps } from '@/types/weekPlan';

const BRAND_COLOR = '#ed1c24';

function getCardStyles(type: AlignmentEscortCardProps['type'], stepColor?: string) {
  const color = stepColor || BRAND_COLOR;

  switch (type) {
    case 'nudge':
      return {
        backgroundColor: '#f0f4f8',
        borderLeftColor: color,
        iconColor: '#64748b',
      };
    case 'prompt':
      return {
        backgroundColor: `${color}10`,
        borderLeftColor: color,
        iconColor: color,
      };
    case 'celebrate':
      return {
        backgroundColor: '#ecfdf5',
        borderLeftColor: '#10b981',
        iconColor: '#10b981',
      };
  }
}

function getIcon(type: AlignmentEscortCardProps['type'], iconName?: string) {
  const size = 20;

  if (iconName === 'compass') return Compass;
  if (iconName === 'lightbulb') return Lightbulb;
  if (iconName === 'star') return Star;

  switch (type) {
    case 'nudge':
      return Compass;
    case 'prompt':
      return Lightbulb;
    case 'celebrate':
      return PartyPopper;
  }
}

export function AlignmentEscortCard({
  message,
  type,
  actionLabel,
  actionLabel2,
  onAction,
  onAction2,
  onDismiss,
  icon,
  stepColor,
}: AlignmentEscortCardProps) {
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const cardStyles = getCardStyles(type, stepColor);
  const IconComponent = getIcon(type, icon);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: cardStyles.backgroundColor,
          borderLeftColor: cardStyles.borderLeftColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* Dismiss button */}
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible
          accessibilityLabel="Dismiss"
        >
          <X size={14} color="#94a3b8" />
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${cardStyles.iconColor}15` }]}>
          <IconComponent size={20} color={cardStyles.iconColor} />
        </View>

        {/* Message + Actions */}
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: '#334155' }]}>
            {message}
          </Text>

          {/* Action buttons */}
          {(actionLabel || actionLabel2) && (
            <View style={styles.actionsRow}>
              {actionLabel && onAction && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: stepColor || BRAND_COLOR },
                  ]}
                  onPress={onAction}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>{actionLabel}</Text>
                </TouchableOpacity>
              )}
              {actionLabel2 && onAction2 && (
                <TouchableOpacity
                  style={[
                    styles.actionButtonSecondary,
                    { borderColor: stepColor || BRAND_COLOR },
                  ]}
                  onPress={onAction2}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.actionButtonSecondaryText,
                      { color: stepColor || BRAND_COLOR },
                    ]}
                  >
                    {actionLabel2}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 14,
    marginVertical: 8,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    padding: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  actionButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default AlignmentEscortCard;
