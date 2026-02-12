/**
 * MorningSparkGauge - Two-step energy entry before Morning Spark chat
 * Phase 1: Select fuel level (Low/Moderate/Full)
 * Phase 2: Select reason for that level
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FUEL_LEVELS, ENERGY_REASONS } from '@/constants/chatBubble';

interface MorningSparkGaugeProps {
  onComplete: (fuelLevel: 1 | 2 | 3, reasonId: string) => void;
  colors?: { text: string; textSecondary: string; background: string };
}

export function MorningSparkGauge({ onComplete, colors }: MorningSparkGaugeProps) {
  const [phase, setPhase] = useState<'gauge' | 'reason'>('gauge');
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const theme = {
    text: colors?.text ?? '#1a1a1a',
    textSecondary: colors?.textSecondary ?? '#666',
    background: colors?.background ?? '#fff',
  };

  function handleLevelSelect(level: 1 | 2 | 3) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedLevel(level);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPhase('reason');
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function handleReasonSelect(reasonId: string) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (selectedLevel) {
      setTimeout(() => onComplete(selectedLevel, reasonId), 500);
    }
  }

  if (phase === 'gauge') {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={[styles.title, { color: theme.text }]}>How's your energy this morning?</Text>
        <View style={styles.fuelRow}>
          {FUEL_LEVELS.map((f) => (
            <TouchableOpacity
              key={f.level}
              style={[
                styles.fuelZone,
                { backgroundColor: f.colorBg, borderColor: f.colorBorder },
              ]}
              onPress={() => handleLevelSelect(f.level as 1 | 2 | 3)}
              activeOpacity={0.7}
            >
              <Text style={styles.fuelIcon}>{f.icon}</Text>
              <Text style={[styles.fuelLabel, { color: f.color }]}>{f.label}</Text>
              <Text style={[styles.fuelDesc, { color: theme.textSecondary }]}>
                {f.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  }

  const levelData = selectedLevel ? FUEL_LEVELS[selectedLevel - 1] : null;
  const reasons = selectedLevel ? ENERGY_REASONS[selectedLevel as 1 | 2 | 3] : [];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {levelData && (
        <View
          style={[
            styles.selectedBadge,
            { backgroundColor: levelData.colorBg, borderColor: levelData.colorBorder },
          ]}
        >
          <Text style={styles.fuelIcon}>{levelData.icon}</Text>
          <Text style={[styles.fuelLabel, { color: levelData.color }]}>
            {levelData.label}
          </Text>
        </View>
      )}
      <Text style={[styles.reasonTitle, { color: theme.text }]}>
        What's behind it?
      </Text>
      <View style={styles.reasonGrid}>
        {reasons.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.reasonButton, { backgroundColor: theme.background }]}
            onPress={() => handleReasonSelect(r.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.reasonIcon}>{r.icon}</Text>
            <Text style={[styles.reasonLabel, { color: theme.text }]}>{r.label}</Text>
            <Text style={[styles.reasonDesc, { color: theme.textSecondary }]}>
              {r.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  fuelRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  fuelZone: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 90,
  },
  fuelIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  fuelLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fuelDesc: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  reasonGrid: {
    gap: 10,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  reasonIcon: {
    fontSize: 24,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  reasonDesc: {
    fontSize: 13,
  },
});
