import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WellnessIcon } from '@/components/icons/WellnessIcon';

/**
 * ZoneIdentityHeader — Minimalist Executive design system
 * White card with a soft tinted icon circle, zone name, and tagline.
 * Sits directly below the green zone header.
 */

export interface ZoneIdentityHeaderProps {
  zoneName: string;
  tagline: string;
  iconColor: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ZoneIdentityHeader({
  zoneName,
  tagline,
  iconColor,
}: ZoneIdentityHeaderProps) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: hexToRgba(iconColor, 0.15) },
        ]}
      >
        <WellnessIcon name={zoneName} color={iconColor} size={28} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.name}>{zoneName}</Text>
        <Text style={styles.tagline}>{tagline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  tagline: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
});
