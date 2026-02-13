import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import GaugeBg from '@/assets/images/gauge-bg.svg';
import GaugeNeedle from '@/assets/images/gauge-needle.svg';
import {
  FuelLevel,
  FuelWhyReason,
  FUEL_WHY_OPTIONS,
} from '@/lib/morningSparkV2Service';

interface EnergyCheckStepProps {
  fuelLevel: 1 | 2 | 3 | null;
  fuelWhy: FuelWhyReason | null;
  onFuelLevelChange: (level: 1 | 2 | 3) => void;
  onFuelWhyChange: (why: FuelWhyReason) => void;
}

const FUEL_OPTIONS: {
  level: FuelLevel;
  emoji: string;
  label: string;
  description: string;
  borderColor: string;
  bg: string;
}[] = [
  { level: 1, emoji: '🔋', label: 'Low', description: 'Running low', borderColor: '#E53935', bg: '#FFEBEE' },
  { level: 2, emoji: '⚡', label: 'Moderate', description: 'Enough to work with', borderColor: '#F57F17', bg: '#FFF8E1' },
  { level: 3, emoji: '🚀', label: 'Full', description: 'Ready to go', borderColor: '#2E7D32', bg: '#E8F5E9' },
];

const NEEDLE_ANGLES: Record<string, number> = {
  null: 0,
  '1': -45,
  '2': 0,
  '3': 45,
};

export default function EnergyCheckStep({
  fuelLevel,
  fuelWhy,
  onFuelLevelChange,
  onFuelWhyChange,
}: EnergyCheckStepProps) {
  const { colors, isDarkMode } = useTheme();
  const needleAnim = useRef(new Animated.Value(0)).current;
  const whyAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef([1, 2, 3].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    const target = NEEDLE_ANGLES[String(fuelLevel)] ?? 0;
    Animated.spring(needleAnim, {
      toValue: target,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [fuelLevel]);

  useEffect(() => {
    Animated.timing(whyAnim, {
      toValue: fuelLevel === 1 ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [fuelLevel]);

  const handleFuelSelect = (level: 1 | 2 | 3, index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnims[index], { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onFuelLevelChange(level);
  };

  const handleWhySelect = (why: FuelWhyReason) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onFuelWhyChange(why);
  };

  const needleRotation = needleAnim.interpolate({
    inputRange: [-45, 0, 45],
    outputRange: ['-45deg', '0deg', '45deg'],
  });

  const whyHeight = whyAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });
  const whyOpacity = whyAnim;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        How's your energy this morning?
      </Text>

      <View style={styles.gaugeContainer}>
        <GaugeBg width={200} height={120} />
        <Animated.View
          style={[
            styles.needleOverlay,
            { transform: [{ rotate: needleRotation }] },
          ]}
        >
          <GaugeNeedle width={200} height={120} />
        </Animated.View>
      </View>

      <View style={styles.optionsRow}>
        {FUEL_OPTIONS.map((opt, index) => {
          const isSelected = fuelLevel === opt.level;
          return (
            <Animated.View
              key={opt.level}
              style={{ transform: [{ scale: scaleAnims[index] }], flex: 1 }}
            >
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isDarkMode ? colors.surface : opt.bg,
                    borderColor: opt.borderColor,
                    borderWidth: isSelected ? 3 : 1,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => handleFuelSelect(opt.level, index)}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  {opt.description}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View
        style={[styles.whyContainer, { maxHeight: whyHeight, opacity: whyOpacity }]}
      >
        <Text style={[styles.whyTitle, { color: colors.text }]}>What's behind it?</Text>
        <View style={styles.pillRow}>
          {FUEL_WHY_OPTIONS.map((opt) => {
            const isSelected = fuelWhy === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.pill,
                  isSelected
                    ? { backgroundColor: '#E53935', borderColor: '#E53935' }
                    : {
                        backgroundColor: isDarkMode ? colors.surface : '#FFF',
                        borderColor: colors.border,
                      },
                ]}
                activeOpacity={0.7}
                onPress={() => handleWhySelect(opt.id)}
              >
                <Text style={styles.pillEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.pillLabel,
                    { color: isSelected ? '#FFF' : colors.text },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  gaugeContainer: { width: 200, height: 120, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  needleOverlay: { position: 'absolute', top: 0, left: 0 },
  optionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 4, marginBottom: 8 },
  optionCard: { borderRadius: 12, padding: 12, alignItems: 'center' },
  optionEmoji: { fontSize: 28, marginBottom: 4 },
  optionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  optionDesc: { fontSize: 11, textAlign: 'center' },
  whyContainer: { overflow: 'hidden', width: '100%', paddingHorizontal: 4, marginTop: 12 },
  whyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pillEmoji: { fontSize: 16, marginRight: 6 },
  pillLabel: { fontSize: 13, fontWeight: '500' },
});
