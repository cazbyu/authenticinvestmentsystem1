// components/TourGuideVoice.tsx
// Persistent coaching voice display for Weekly Alignment ritual

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Sparkles, Heart, Compass, Target, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react-native';
import type { TourGuideResponse } from '../types/tour-guide';

interface TourGuideVoiceProps {
  message: string;
  tone: TourGuideResponse['tone'];
  isLoading?: boolean;
}

function getToneStyles(tone: TourGuideResponse['tone']) {
  switch (tone) {
    case 'welcome':
      return {
        backgroundColor: '#fef3c7',
        borderLeftColor: '#f59e0b',
        iconColor: '#f59e0b',
        Icon: Sparkles,
      };
    case 'encourage':
      return {
        backgroundColor: '#ed1c2415',
        borderLeftColor: '#ed1c24',
        iconColor: '#ed1c24',
        Icon: Heart,
      };
    case 'slow_down':
      return {
        backgroundColor: '#e0f2fe',
        borderLeftColor: '#0284c7',
        iconColor: '#0284c7',
        Icon: Compass,
      };
    case 'push_forward':
      return {
        backgroundColor: '#fee2e2',
        borderLeftColor: '#dc2626',
        iconColor: '#dc2626',
        Icon: Target,
      };
    case 'celebrate':
      return {
        backgroundColor: '#d1fae5',
        borderLeftColor: '#10b981',
        iconColor: '#10b981',
        Icon: Sparkles,
      };
    case 'challenge':
      return {
        backgroundColor: '#f3f4f6',
        borderLeftColor: '#6b7280',
        iconColor: '#6b7280',
        Icon: AlertCircle,
      };
    case 'reflect':
      return {
        backgroundColor: '#f5f3ff',
        borderLeftColor: '#8b5cf6',
        iconColor: '#8b5cf6',
        Icon: Lightbulb,
      };
    default:
      return {
        backgroundColor: '#f0f4f8',
        borderLeftColor: '#64748b',
        iconColor: '#64748b',
        Icon: Compass,
      };
  }
}

export function TourGuideVoice({ message, tone, isLoading = false }: TourGuideVoiceProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    // Animate in when message changes
    fadeAnim.setValue(0);
    slideAnim.setValue(-10);

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
  }, [message, tone]);

  const toneStyles = getToneStyles(tone);
  const IconComponent = toneStyles.Icon;

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: '#f0f4f8', borderLeftColor: '#64748b' }]}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: '#64748b15' }]}>
            <ActivityIndicator size="small" color="#64748b" />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.loadingText, { color: '#64748b' }]}>
              Listening...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: toneStyles.backgroundColor,
          borderLeftColor: toneStyles.borderLeftColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: `${toneStyles.iconColor}15` }]}>
          <IconComponent size={22} color={toneStyles.iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: '#1e293b' }]}>
            {message}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});

export default TourGuideVoice;
