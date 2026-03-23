/**
 * CompassDirectionHeader — Shared header for all three rituals.
 * Shows a small compass icon rotated to the current direction,
 * plus direction label and power question.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Compass } from 'lucide-react-native';

export type CompassDirection = 'north' | 'south' | 'east' | 'west';

interface CompassDirectionHeaderProps {
  direction: CompassDirection;
  label: string;
  powerQuestion: string;
  color?: string;
}

const DIRECTION_CONFIG: Record<CompassDirection, { angle: number; emoji: string }> = {
  north: { angle: 0, emoji: '🧭' },
  west: { angle: 270, emoji: '🧭' },
  east: { angle: 90, emoji: '🧭' },
  south: { angle: 180, emoji: '🧭' },
};

const DIRECTION_COLORS: Record<CompassDirection, string> = {
  north: '#ed1c24',
  west: '#9370DB',
  east: '#39b54a',
  south: '#4169E1',
};

export function CompassDirectionHeader({
  direction,
  label,
  powerQuestion,
  color,
}: CompassDirectionHeaderProps) {
  const config = DIRECTION_CONFIG[direction];
  const dirColor = color || DIRECTION_COLORS[direction];
  const dirName = direction.charAt(0).toUpperCase() + direction.slice(1);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.compassCircle, { backgroundColor: dirColor + '18' }]}>
          <Compass
            size={28}
            color={dirColor}
            style={{ transform: [{ rotate: `${config.angle}deg` }] }}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.directionLabel, { color: dirColor }]}>
            {dirName} — {label}
          </Text>
          <Text style={styles.powerQuestion}>{powerQuestion}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compassCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  directionLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  powerQuestion: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 2,
  },
});
