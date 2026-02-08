// ============================================================================
// WeekPlanBadge.tsx - Floating counter badge for week plan items
// ============================================================================
// Shows a small counter in the step header during steps 2-5 that displays
// how many items have been captured so far. Creates a satisfying accumulation
// feeling as the user progresses through the Weekly Alignment ritual.
// ============================================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { ClipboardList } from 'lucide-react-native';

interface WeekPlanBadgeProps {
  count: number;
  onPress?: () => void;
  color?: string;
}

export function WeekPlanBadge({ count, onPress, color = '#ed1c24' }: WeekPlanBadgeProps) {
  const scaleAnim = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > 0 && prevCountRef.current === 0) {
      // First item added - scale in
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else if (count > prevCountRef.current && count > 0) {
      // Item added - bounce effect
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (count === 0) {
      scaleAnim.setValue(0);
    }
    prevCountRef.current = count;
  }, [count]);

  if (count === 0) return null;

  const badge = (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}15`,
          borderColor: `${color}40`,
          transform: [
            { scale: Animated.multiply(scaleAnim, bounceAnim) },
          ],
        },
      ]}
    >
      <ClipboardList size={14} color={color} />
      <Text style={[styles.badgeText, { color }]}>
        {count} {count === 1 ? 'item' : 'items'}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {badge}
      </TouchableOpacity>
    );
  }

  return badge;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default WeekPlanBadge;
