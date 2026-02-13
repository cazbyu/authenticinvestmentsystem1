import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { AspirationContent } from '@/lib/morningSparkV2Service';

interface ContractCloseStepProps {
  aspiration: AspirationContent | null;
  targetScore: number;
  contractItemCount: number;
  onCommit: () => void;
  committing: boolean;
}

export default function ContractCloseStep({
  aspiration,
  targetScore,
  contractItemCount,
  onCommit,
  committing,
}: ContractCloseStepProps) {
  const { colors, isDarkMode } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(0.5)).current;
  const [committed, setCommitted] = useState(false);
  const prevCommitting = useRef(committing);

  // Detect when committing transitions from true to false (success)
  useEffect(() => {
    if (prevCommitting.current && !committing) {
      setCommitted(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Animated.parallel([
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(celebrationScale, {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCommitting.current = committing;
  }, [committing]);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleCommit = () => {
    if (committing || committed) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onCommit();
  };

  return (
    <View style={styles.container}>
      {/* Summary card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: isDarkMode ? colors.surface : '#FFFDF5',
            borderColor: '#D4A843',
          },
        ]}
      >
        {aspiration?.content_text && (
          <>
            <Text style={[styles.aspirationQuote, { color: colors.text }]}>
              "{aspiration.content_text}"
            </Text>
            {aspiration.title && (
              <Text style={[styles.aspirationSource, { color: colors.textSecondary }]}>
                {'\u2014'} {aspiration.title}
              </Text>
            )}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>
        )}

        <Text style={[styles.contractHeading, { color: colors.text }]}>
          Today's Contract
        </Text>

        <Text style={[styles.contractDetail, { color: colors.textSecondary }]}>
          You have{' '}
          <Text style={[styles.contractHighlight, { color: colors.text }]}>
            {contractItemCount} item{contractItemCount !== 1 ? 's' : ''}
          </Text>{' '}
          committed
        </Text>

        <Text style={[styles.contractDetail, { color: colors.textSecondary }]}>
          Target:{' '}
          <Text style={[styles.contractHighlight, { color: '#D97706' }]}>
            {targetScore} points
          </Text>
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
          {'\u{1F4DD}'} Remember to capture thoughts, roses, and thorns throughout the day
        </Text>
      </View>

      {/* Commit button */}
      {!committed ? (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.commitButton,
              (committing) && styles.commitButtonDisabled,
            ]}
            onPress={handleCommit}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.85}
            disabled={committing || committed}
          >
            {committing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.commitButtonText}>
                {'\u{270D}\uFE0F'} Sign Your Contract
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.celebrationContainer,
            {
              opacity: celebrationOpacity,
              transform: [{ scale: celebrationScale }],
            },
          ]}
        >
          <Text style={styles.celebrationCheck}>{'\u2705'}</Text>
          <Text style={[styles.celebrationText, { color: colors.success }]}>
            You got this!
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 24,
  },
  aspirationQuote: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 4,
  },
  aspirationSource: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 14,
    borderRadius: 1,
  },
  contractHeading: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  contractDetail: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 22,
  },
  contractHighlight: {
    fontWeight: '700',
  },
  reminderText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  commitButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4A843',
    shadowColor: '#C4972E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    minHeight: 56,
  },
  commitButtonDisabled: {
    opacity: 0.7,
  },
  commitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  celebrationContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  celebrationCheck: {
    fontSize: 40,
    marginBottom: 8,
  },
  celebrationText: {
    fontSize: 22,
    fontWeight: '700',
  },
});
