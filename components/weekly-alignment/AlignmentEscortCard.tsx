import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Compass, Lightbulb, Star, Sparkles, X } from 'lucide-react-native';

export interface AlignmentEscortCardProps {
  message: string;
  type: 'nudge' | 'prompt' | 'celebrate';
  actionLabel?: string;
  actionLabel2?: string;
  onAction?: () => void;
  onAction2?: () => void;
  onDismiss?: () => void;
  icon?: 'compass' | 'lightbulb' | 'star' | 'sparkles';
  colors?: {
    background: string;
    text: string;
    accent: string;
    border: string;
  };
}

export function AlignmentEscortCard({
  message,
  type,
  actionLabel,
  actionLabel2,
  onAction,
  onAction2,
  onDismiss,
  icon = 'compass',
  colors,
}: AlignmentEscortCardProps) {
  const [slideAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const getBackgroundColor = () => {
    if (colors) return colors.background;

    switch (type) {
      case 'nudge':
        return '#f0f9ff';
      case 'prompt':
        return '#fef3f2';
      case 'celebrate':
        return '#f0fdf4';
      default:
        return '#f8fafc';
    }
  };

  const getAccentColor = () => {
    if (colors) return colors.accent;

    switch (type) {
      case 'nudge':
        return '#0ea5e9';
      case 'prompt':
        return '#ed1c24';
      case 'celebrate':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getBorderColor = () => {
    if (colors) return colors.border;

    switch (type) {
      case 'nudge':
        return '#bae6fd';
      case 'prompt':
        return '#fed7d7';
      case 'celebrate':
        return '#bbf7d0';
      default:
        return '#e5e7eb';
    }
  };

  const getTextColor = () => {
    if (colors) return colors.text;
    return '#1f2937';
  };

  const renderIcon = () => {
    const iconColor = getAccentColor();
    const size = 20;

    switch (icon) {
      case 'compass':
        return <Compass size={size} color={iconColor} />;
      case 'lightbulb':
        return <Lightbulb size={size} color={iconColor} />;
      case 'star':
        return <Star size={size} color={iconColor} />;
      case 'sparkles':
        return <Sparkles size={size} color={iconColor} />;
      default:
        return <Compass size={size} color={iconColor} />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderLeftColor: getAccentColor(),
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Left Accent Border */}
      <View style={[styles.accentBorder, { backgroundColor: getAccentColor() }]} />

      {/* Content Container */}
      <View style={styles.content}>
        {/* Icon and Message Row */}
        <View style={styles.headerRow}>
          <View style={styles.iconContainer}>{renderIcon()}</View>
          <Text style={[styles.message, { color: getTextColor() }]}>{message}</Text>
        </View>

        {/* Action Buttons */}
        {(actionLabel || actionLabel2) && (
          <View style={styles.actionRow}>
            {actionLabel && onAction && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: getAccentColor() }]}
                onPress={onAction}
              >
                <Text style={styles.actionButtonText}>{actionLabel}</Text>
              </TouchableOpacity>
            )}
            {actionLabel2 && onAction2 && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.secondaryButton,
                  {
                    borderColor: getAccentColor(),
                  },
                ]}
                onPress={onAction2}
              >
                <Text style={[styles.actionButtonText, { color: getAccentColor() }]}>
                  {actionLabel2}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Dismiss Button */}
      {onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <X size={16} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  accentBorder: {
    width: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});
