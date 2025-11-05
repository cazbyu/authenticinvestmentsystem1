import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface AttachmentBadgeProps {
  count: number;
  size?: 'small' | 'medium';
  variant?: 'default' | 'compact';
}

export default function AttachmentBadge({
  count,
  size = 'small',
  variant = 'default',
}: AttachmentBadgeProps) {
  const { colors } = useTheme();

  if (count === 0) return null;

  const iconSizes = {
    small: 12,
    medium: 14,
  };

  const textSizes = {
    small: 10,
    medium: 12,
  };

  if (variant === 'compact') {
    return (
      <View
        style={[
          styles.compactBadge,
          { backgroundColor: colors.primary },
          size === 'medium' && styles.compactBadgeMedium,
        ]}
      >
        <Text style={[styles.compactText, { fontSize: textSizes[size] }]}>{count}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
        size === 'medium' && styles.badgeMedium,
      ]}
    >
      <Paperclip size={iconSizes[size]} color={colors.primary} />
      <Text style={[styles.badgeText, { color: colors.primary, fontSize: textSizes[size] }]}>
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontWeight: '600',
  },
  compactBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  compactBadgeMedium: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  compactText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
