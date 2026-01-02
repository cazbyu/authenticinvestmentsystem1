import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  DailySpark,
  checkTodaysSpark,
  createDailySpark,
  getFuelEmoji,
  getFuelColor,
  getFuelMode,
  calculateTargetScore,
  getModeDescription,
} from '@/lib/sparkUtils';

export default function SparkScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [sliderTouched, setSliderTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [alreadyCommitted, setAlreadyCommitted] = useState(false);
  const [todaysSpark, setTodaysSpark] = useState<DailySpark | null>(null);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(1));

  useFocusEffect(
    React.useCallback(() => {
      checkExistingSpark();
    }, [])
  );

  useEffect(() => {
    if (fuelLevel) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fuelLevel]);

  async function checkExistingSpark() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to set your Morning Spark.');
        router.back();
        return;
      }

      const spark = await checkTodaysSpark(user.id);

      if (spark) {
        setTodaysSpark(spark);
        setAlreadyCommitted(true);
      } else {
        setTodaysSpark(null);
        setAlreadyCommitted(false);
        setFuelLevel(null);
        setSliderTouched(false);
      }
    } catch (error) {
      console.error('Error checking spark:', error);
      Alert.alert('Error', 'Failed to check today\'s spark. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSliderChange(value: number) {
    const level = Math.round(value) as 1 | 2 | 3;
    setFuelLevel(level);

    if (!sliderTouched) {
      setSliderTouched(true);
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handleCommit() {
    if (!fuelLevel) return;

    try {
      setCommitting(true);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to commit your spark.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const spark = await createDailySpark({
        userId: user.id,
        fuelLevel,
        sparkDate: today,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setTodaysSpark(spark);
      setAlreadyCommitted(true);

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        fadeAnim.setValue(1);
      });
    } catch (error) {
      console.error('Error committing spark:', error);
      Alert.alert(
        'Error',
        'Failed to commit your Morning Spark. You may have already set one today.',
        [{ text: 'OK' }]
      );
    } finally {
      setCommitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
          <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Morning Spark</Text>
      </View>

      {alreadyCommitted && todaysSpark ? (
        <View style={styles.committedContainer}>
          <Animated.View style={[styles.committedCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.committedEmoji}>{getFuelEmoji(todaysSpark.fuel_level)}</Text>
            <Text style={[styles.committedMode, { color: getFuelColor(todaysSpark.fuel_level) }]}>
              {todaysSpark.mode} Mode
            </Text>
            <Text style={[styles.committedTarget, { color: colors.text }]}>
              Target: {todaysSpark.initial_target_score} points
            </Text>
            <Text style={[styles.committedMessage, { color: colors.textSecondary }]}>
              You set your intention. Now go live it.
            </Text>
          </Animated.View>

          <TouchableOpacity
            style={[styles.returnButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.returnButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.uncommittedContainer, { opacity: fadeAnim }]}>
          <View style={styles.emojiContainer}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Text style={styles.emojiDisplay}>
                {fuelLevel ? getFuelEmoji(fuelLevel) : '💭'}
              </Text>
            </Animated.View>
            {fuelLevel && (
              <View
                style={[
                  styles.emojiBackground,
                  { backgroundColor: getFuelColor(fuelLevel) + '20' },
                ]}
              />
            )}
          </View>

          <View style={styles.sliderSection}>
            <Text style={[styles.promptText, { color: colors.text }]}>
              How's your energy today?
            </Text>

            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={3}
                step={1}
                value={fuelLevel || 2}
                onValueChange={handleSliderChange}
                minimumTrackTintColor={fuelLevel ? getFuelColor(fuelLevel) : colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={fuelLevel ? getFuelColor(fuelLevel) : colors.primary}
              />
            </View>

            {fuelLevel && (
              <>
                <Text style={[styles.modeLabel, { color: getFuelColor(fuelLevel) }]}>
                  {getFuelMode(fuelLevel)} Mode
                </Text>
                <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
                  {getModeDescription(fuelLevel)}
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.commitButton,
              {
                backgroundColor: sliderTouched && fuelLevel ? colors.primary : colors.border,
              },
            ]}
            onPress={handleCommit}
            disabled={!sliderTouched || !fuelLevel || committing}
          >
            {committing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                style={[
                  styles.commitButtonText,
                  { color: sliderTouched && fuelLevel ? '#ffffff' : colors.textSecondary },
                ]}
              >
                Next
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  uncommittedContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    position: 'relative',
  },
  emojiDisplay: {
    fontSize: 100,
    textAlign: 'center',
  },
  emojiBackground: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    zIndex: -1,
  },
  sliderSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  promptText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 40,
  },
  sliderContainer: {
    marginBottom: 32,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  modeLabel: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  targetScore: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  modeDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  commitButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  commitButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  committedContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  committedCard: {
    alignItems: 'center',
    padding: 40,
  },
  committedEmoji: {
    fontSize: 100,
    marginBottom: 24,
  },
  committedMode: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
  },
  committedTarget: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  committedMessage: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 320,
  },
  returnButton: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 40,
    minWidth: 240,
  },
  returnButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
