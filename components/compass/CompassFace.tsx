import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  G,
  Circle,
  Path,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

type Zone = 'mission' | 'wellness' | 'goals' | 'roles';

interface CompassItem {
  id: string;
  label: string;
  slotCode: string;
  angle: number;
  color?: string;
}

interface CompassFaceProps {
  activeZone: Zone;
  showColorRing: boolean;
  items?: CompassItem[];
  onItemTap?: (slotCode: string) => void;
  highlightedSlot?: string | null;
  size?: number;
}

const WELLNESS_ZONES: CompassItem[] = [
  { id: 'wz1', label: 'Mental', slotCode: 'WZ1', angle: 45 },
  { id: 'wz2', label: 'Emotional', slotCode: 'WZ2', angle: 67.5 },
  { id: 'wz3', label: 'Physical', slotCode: 'WZ3', angle: 90 },
  { id: 'wz4', label: 'Spiritual', slotCode: 'WZ4', angle: 112.5 },
  { id: 'wz5', label: 'Social', slotCode: 'WZ5', angle: 135 },
  { id: 'wz6', label: 'Financial', slotCode: 'WZ6', angle: 157.5 },
  { id: 'wz7', label: 'Career', slotCode: 'WZ7', angle: 180 },
  { id: 'wz8', label: 'Environmental', slotCode: 'WZ8', angle: 202.5 },
];

const ZONE_COLORS = {
  mission: '#ed1c24',
  wellness: '#39b54a',
  goals: '#00abc5',
  roles: '#ffd400',
};

const COMPASS_CENTER = { x: 144, y: 144 };
const ITEM_RADIUS = 120;

export default function CompassFace({
  activeZone,
  showColorRing,
  items,
  onItemTap,
  highlightedSlot = null,
  size = 288,
}: CompassFaceProps) {
  const [displayItems, setDisplayItems] = useState<CompassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const colorRingOpacity = useSharedValue(showColorRing ? 1 : 0);
  const itemsOpacity = useSharedValue(0);

  useEffect(() => {
    colorRingOpacity.value = withTiming(showColorRing ? 1 : 0, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [showColorRing]);

  useEffect(() => {
    loadItemsForZone();
  }, [activeZone]);

  const loadItemsForZone = async () => {
    itemsOpacity.value = 0;

    if (items) {
      setDisplayItems(items);
      itemsOpacity.value = withSequence(
        withTiming(0, { duration: 150 }),
        withTiming(1, { duration: 300 })
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (activeZone === 'wellness') {
        setDisplayItems(WELLNESS_ZONES);
        itemsOpacity.value = withSequence(
          withTiming(0, { duration: 150 }),
          withTiming(1, { duration: 300 })
        );
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDisplayItems([]);
        setLoading(false);
        return;
      }

      let zoneItems: CompassItem[] = [];

      switch (activeZone) {
        case 'roles': {
          const { data: roles } = await supabase
            .from('0008-ap-roles')
            .select(`
              id,
              name,
              0008-ap-user-slot-mappings!inner(
                slot_code,
                0008-ap-compass-coordinates!inner(angle)
              )
            `)
            .eq('profile_id', user.id)
            .eq('is_active', true)
            .order('name');

          if (roles) {
            zoneItems = roles.map((role: any) => ({
              id: role.id,
              label: role.name,
              slotCode: role['0008-ap-user-slot-mappings'][0]?.slot_code || 'R1',
              angle: role['0008-ap-user-slot-mappings'][0]?.['0008-ap-compass-coordinates']?.angle || 270,
              color: ZONE_COLORS.roles,
            }));
          }
          break;
        }

        case 'goals': {
          const { data: goals } = await supabase
            .from('0008-ap-goals-12wk')
            .select(`
              id,
              title,
              0008-ap-user-slot-mappings!inner(
                slot_code,
                0008-ap-compass-coordinates!inner(angle)
              )
            `)
            .eq('profile_id', user.id)
            .eq('is_active', true)
            .order('title')
            .limit(20);

          if (goals) {
            zoneItems = goals.map((goal: any) => ({
              id: goal.id,
              label: goal.title,
              slotCode: goal['0008-ap-user-slot-mappings'][0]?.slot_code || 'G1',
              angle: goal['0008-ap-user-slot-mappings'][0]?.['0008-ap-compass-coordinates']?.angle || 180,
              color: ZONE_COLORS.goals,
            }));
          }
          break;
        }

        case 'mission': {
          const { data: aspirations } = await supabase
            .from('0008-ap-aspirations-library')
            .select('id, title, aspiration_type')
            .eq('profile_id', user.id)
            .eq('is_active', true)
            .order('aspiration_type')
            .limit(10);

          if (aspirations) {
            zoneItems = aspirations.map((item: any, index: number) => ({
              id: item.id,
              label: item.title,
              slotCode: `M${index + 1}`,
              angle: 0 + (index * 10),
              color: ZONE_COLORS.mission,
            }));
          }
          break;
        }
      }

      setDisplayItems(zoneItems);
      itemsOpacity.value = withSequence(
        withTiming(0, { duration: 150 }),
        withTiming(1, { duration: 300 })
      );
    } catch (error) {
      console.error('Error loading compass items:', error);
      setDisplayItems([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateItemPosition = (angle: number) => {
    const angleRad = (angle - 90) * (Math.PI / 180);
    const x = COMPASS_CENTER.x + ITEM_RADIUS * Math.cos(angleRad);
    const y = COMPASS_CENTER.y + ITEM_RADIUS * Math.sin(angleRad);
    return { x, y };
  };

  const handleItemPress = (item: CompassItem) => {
    if (Platform.OS !== 'web' && Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (onItemTap) {
      onItemTap(item.slotCode);
    }
  };

  const colorRingStyle = useAnimatedStyle(() => ({
    opacity: colorRingOpacity.value,
  }));

  const grayscaleRingStyle = useAnimatedStyle(() => ({
    opacity: 1 - colorRingOpacity.value,
  }));

  const itemsStyle = useAnimatedStyle(() => ({
    opacity: itemsOpacity.value,
  }));

  const scale = size / 288;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.ringContainer, StyleSheet.absoluteFill]}>
        <Animated.View style={[StyleSheet.absoluteFill, colorRingStyle]}>
          <Svg width={size} height={size} viewBox="0 0 288 288">
            <Defs>
              <LinearGradient id="wellness-bg-1" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#39b54a" stopOpacity="0.15" />
                <Stop offset="50%" stopColor="#8dc63f" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#00a651" stopOpacity="0.15" />
              </LinearGradient>
            </Defs>
            <Circle
              cx="144"
              cy="144"
              r="108"
              fill="none"
              stroke="url(#wellness-bg-1)"
              strokeWidth="24"
            />
          </Svg>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, grayscaleRingStyle]}>
          <Svg width={size} height={size} viewBox="0 0 288 288">
            <Circle
              cx="144"
              cy="144"
              r="108"
              fill="none"
              stroke="#e0e0e0"
              strokeWidth="24"
              opacity="0.3"
            />
          </Svg>
        </Animated.View>
      </View>

      <Animated.View style={[styles.itemsContainer, itemsStyle]}>
        <Svg width={size} height={size} viewBox="0 0 288 288">
          <G>
            {displayItems.map((item) => {
              const { x, y } = calculateItemPosition(item.angle);
              const isHighlighted = item.slotCode === highlightedSlot;
              const dotSize = isHighlighted ? 8 : 5;
              const textColor = isHighlighted ? (item.color || ZONE_COLORS[activeZone]) : '#666';

              return (
                <G key={item.id}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={dotSize}
                    fill={item.color || ZONE_COLORS[activeZone]}
                    opacity={isHighlighted ? 1 : 0.7}
                  />

                  {item.label && (
                    <SvgText
                      x={x}
                      y={y - 12}
                      fontSize="10"
                      fill={textColor}
                      fontWeight={isHighlighted ? '600' : '400'}
                      textAnchor="middle"
                    >
                      {item.label.length > 12 ? item.label.substring(0, 12) + '...' : item.label}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </G>
        </Svg>

        {displayItems.map((item) => {
          const { x, y } = calculateItemPosition(item.angle);
          const touchSize = 44;

          return (
            <TouchableOpacity
              key={`touch-${item.id}`}
              style={[
                styles.itemTouch,
                {
                  left: (x * scale) - (touchSize / 2),
                  top: (y * scale) - (touchSize / 2),
                  width: touchSize,
                  height: touchSize,
                },
              ]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.6}
            />
          );
        })}
      </Animated.View>

      {loading && (
        <View style={[styles.loadingContainer, StyleSheet.absoluteFill]}>
          <Svg width={size} height={size} viewBox="0 0 288 288">
            <Circle
              cx="144"
              cy="144"
              r="108"
              fill="none"
              stroke="#ccc"
              strokeWidth="2"
              strokeDasharray="10,5"
              opacity="0.5"
            />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  ringContainer: {
    pointerEvents: 'none',
  },
  itemsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  itemTouch: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
});
