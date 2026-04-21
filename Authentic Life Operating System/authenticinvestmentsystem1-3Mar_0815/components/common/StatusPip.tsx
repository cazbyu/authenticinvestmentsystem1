import React from 'react';
import { View } from 'react-native';

/**
 * StatusPip — Minimalist Executive design system
 * Colored health dot indicating recency of activity.
 * Used on role tiles, KR tiles, tracker cards, and wellness zone cards.
 *
 * Thresholds are parameterized: default values preserve the original
 * behavior (<= 2 days fresh, 3-10 days stale, >10 days cold) exactly.
 * Callers can pass custom thresholds for their own recency model.
 */

const DEFAULT_ACTIVE_THRESHOLD_DAYS = 2;
const DEFAULT_QUIET_THRESHOLD_DAYS = 10;

export interface StatusPipProps {
  lastActivityDate: string | null;
  size?: number;
  activeThresholdDays?: number;
  quietThresholdDays?: number;
}

export const STATUS_PIP_COLORS = {
  fresh: '#16a34a',
  stale: '#f59e0b',
  cold: '#dc2626',
  none: '#9ca3af',
};

export function getStatusPipColor(
  lastActivityDate: string | null | undefined,
  activeThresholdDays: number = DEFAULT_ACTIVE_THRESHOLD_DAYS,
  quietThresholdDays: number = DEFAULT_QUIET_THRESHOLD_DAYS,
): string {
  if (!lastActivityDate) return STATUS_PIP_COLORS.none;
  const then = new Date(lastActivityDate);
  if (Number.isNaN(then.getTime())) return STATUS_PIP_COLORS.none;
  const daysSince = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (daysSince <= activeThresholdDays) return STATUS_PIP_COLORS.fresh;
  if (daysSince <= quietThresholdDays) return STATUS_PIP_COLORS.stale;
  return STATUS_PIP_COLORS.cold;
}

export function StatusPip({
  lastActivityDate,
  size = 8,
  activeThresholdDays,
  quietThresholdDays,
}: StatusPipProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: getStatusPipColor(
          lastActivityDate,
          activeThresholdDays,
          quietThresholdDays,
        ),
      }}
    />
  );
}
