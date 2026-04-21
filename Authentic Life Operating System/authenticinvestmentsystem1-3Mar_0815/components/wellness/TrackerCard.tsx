import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Activity,
  Brain,
  Droplet,
  Footprints,
  Moon,
  Scale,
} from 'lucide-react-native';

import { getStatusPipColor } from '@/components/common/StatusPip';

/**
 * TrackerCard — Minimalist Executive design system
 * Universal tracker tile that renders any tracker instance in a Toolshed
 * grid, formatted by measurement_type.
 */

export interface TrackerInstance {
  instance_id: string;
  display_name: string;
  icon: string | null;
  measurement_type: string;
  unit_label: string | null;
  currency_code: string | null;
  goal_value: number | null;
  goal_value_max: number | null;
  goal_direction: string | null;
  is_compound: boolean;
  allow_multiple_logs_per_day: boolean;
  goal_label: string | null;
  goal_helper_text: string | null;
}

export interface TrackerCardProps {
  instance: TrackerInstance;
  todayValue?: number | string | boolean | null;
  lastLogDate?: string | null;
  onPress: () => void;
  accentColor?: string;
  overlay?: React.ReactNode;
}

const DEFAULT_ACCENT = '#16a34a';

const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  scale: Scale,
  moon: Moon,
  droplet: Droplet,
  footprints: Footprints,
  brain: Brain,
};

export function formatTrackerValue(
  value: number | string | boolean | null | undefined,
  measurementType: string,
  unitLabel?: string | null,
  currencyCode?: string | null,
  goalValue?: number | null,
): string {
  if (value === null || value === undefined) return '';

  switch (measurementType) {
    case 'number':
      return unitLabel ? `${value} ${unitLabel}` : String(value);
    case 'hours':
      return `${Number(value).toFixed(1)} hrs`;
    case 'duration': {
      const seconds = Number(value);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'currency':
      return `${currencyCode ?? ''} ${Number(value).toFixed(2)}`.trim();
    case 'percentage':
      return `${value}%`;
    case 'rating':
      // TODO: rating scale handling — revisit when first rating
      // tracker ships. goal_value used as scale max is a simplification.
      return `${value}/${goalValue ?? 5}`;
    case 'text': {
      const str = String(value);
      return str.length > 20 ? `${str.slice(0, 20)}...` : str;
    }
    case 'time_of_day':
      return String(value);
    case 'distance':
      return unitLabel ? `${value} ${unitLabel}` : String(value);
    case 'coordinates':
      return '📍';
    default:
      return String(value);
  }
}

export function TrackerCard({
  instance,
  todayValue,
  lastLogDate,
  onPress,
  accentColor = DEFAULT_ACCENT,
  overlay,
}: TrackerCardProps) {
  const IconComponent =
    (instance.icon && ICON_MAP[instance.icon]) || Activity;
  const pipColor = getStatusPipColor(lastLogDate ?? null);
  const hasValue = todayValue !== null && todayValue !== undefined;
  const valueLabel = hasValue
    ? formatTrackerValue(
        todayValue,
        instance.measurement_type,
        instance.unit_label,
        instance.currency_code,
        instance.goal_value,
      )
    : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && {
          borderColor: accentColor,
          borderWidth: 1.5,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: accentColor + '20' },
          ]}
        >
          <IconComponent size={22} color={accentColor} />
        </View>
        <View style={[styles.pipOverlay, { backgroundColor: pipColor }]} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {instance.display_name}
      </Text>
      {hasValue ? (
        <Text style={styles.value} numberOfLines={1}>
          {valueLabel}
        </Text>
      ) : (
        <Text style={styles.valuePlaceholder} numberOfLines={1}>
          Log today
        </Text>
      )}
      {overlay}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31.5%',
    height: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
  },
  iconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  name: {
    fontSize: 11,
    textAlign: 'center',
    color: '#1f2937',
    fontWeight: '500',
    lineHeight: 14,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e3a5f',
  },
  valuePlaceholder: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
});
