// components/goals/DayDot.tsx
import React, { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';

export const DayDot = memo(function DayDot({
  date,
  dayName,
  hasLog,
  onToggle,
  onLabelPress,
  trackingTemplate,
  disabled,
}: {
  date: string;
  dayName: string;
  hasLog: boolean;
  onToggle: (date: string) => void;
  onLabelPress?: (date: string) => void;
  trackingTemplate?: string | null;
  disabled: boolean;
}) {
  const [isToggling, setIsToggling] = useState(false);

  const handlePress = useCallback(async () => {
    if (disabled || isToggling) return;

    setIsToggling(true);
    try {
      await onToggle(date);
    } finally {
      setTimeout(() => setIsToggling(false), 300);
    }
  }, [date, disabled, isToggling, onToggle]);

  const handleLabelPress = useCallback(() => {
    if (onLabelPress) onLabelPress(date);
  }, [date, onLabelPress]);

  return (
    <View style={styles.dayDotContainer}>
      {onLabelPress && trackingTemplate ? (
        <TouchableOpacity
          onPress={handleLabelPress}
          hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Text style={[styles.dayLabelText, styles.dayLabelTappable]}>{dayName}</Text>
          <View style={styles.dayLabelIndicator} />
        </TouchableOpacity>
      ) : (
        <Text style={styles.dayLabelText}>{dayName}</Text>
      )}
      <TouchableOpacity
        style={[
          styles.dayDot,
          hasLog && styles.dayDotCompleted,
          isToggling && styles.dayDotToggling,
        ]}
        onPress={handlePress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled || isToggling}
      >
        {hasLog && <Check size={12} color="#ffffff" />}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  dayDotContainer: {
    alignItems: 'center',
    gap: 4,
  },
  dayLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  dayLabelTappable: {
    color: '#0078d4',
  },
  dayLabelIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0078d4',
    alignSelf: 'center',
    marginTop: 1,
  },
  dayDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280',
  },
  dayDotCompleted: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  dayDotToggling: {
    opacity: 0.6,
  },
});
