import React from 'react';
import { View } from 'react-native';

/**
 * StatusPip — Minimalist Executive design system
 * Colored health dot indicating recency of activity.
 * Used on role tiles, KR tiles, and wellness zone cards.
 */

export interface StatusPipProps {
  lastActivityDate: string | null;
  size?: number;
}

export const STATUS_PIP_COLORS = {
  fresh: '#16a34a',
  stale: '#f59e0b',
  cold: '#dc2626',
  none: '#9ca3af',
};

export function getStatusPipColor(
  lastActivityDate: string | null | undefined,
): string {
  if (!lastActivityDate) return STATUS_PIP_COLORS.none;
  const then = new Date(lastActivityDate);
  if (Number.isNaN(then.getTime())) return STATUS_PIP_COLORS.none;
  const daysSince = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (daysSince < 3) return STATUS_PIP_COLORS.fresh;
  if (daysSince <= 10) return STATUS_PIP_COLORS.stale;
  return STATUS_PIP_COLORS.cold;
}

export function StatusPip({ lastActivityDate, size = 8 }: StatusPipProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getStatusPipColor(lastActivityDate),
      }}
    />
  );
}
