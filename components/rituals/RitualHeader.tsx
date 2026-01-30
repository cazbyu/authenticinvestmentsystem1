import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';

interface RitualHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    background: string;
  };
  showBackButton?: boolean;
  showCloseButton?: boolean;
  rightElement?: React.ReactNode;
}

export function RitualHeader({
  title,
  subtitle,
  onBack,
  onClose,
  colors,
  showBackButton = true,
  showCloseButton = false,
  rightElement,
}: RitualHeaderProps) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {/* Left Side */}
      <View style={styles.leftSection}>
        {showBackButton && onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.iconButton}
            accessible={true}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {showCloseButton && onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconButton}
            accessible={true}
            accessibilityLabel="Close"
          >
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {!showBackButton && !showCloseButton && <View style={styles.spacer} />}
      </View>

      {/* Center - Title */}
      <View style={styles.centerSection}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right Side */}
      <View style={styles.rightSection}>
        {rightElement || <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 48,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: 8,
  },
  spacer: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default RitualHeader;