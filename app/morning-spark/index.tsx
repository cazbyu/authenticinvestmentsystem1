import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Platform, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { checkTodaysSpark, updateSparkFuelLevel } from '@/lib/sparkUtils';

type FuelLevel = 1 | 2 | 3;

interface FuelOption {
  level: FuelLevel;
  emoji: string;
  label: string;
  description: string;
  color: string;
}

const fuelOptions: FuelOption[] = [
  {
    level: 1,
    emoji: '🔋',
    label: 'LOW (1)',
    description: 'Need Recovery\nI need to focus on essentials and rest',
    color: '#F59E0B',
  },
  {
    level: 2,
    emoji: '⚡',
    label: 'MEDIUM (2)',
    description: 'Steady Pace\nI can maintain momentum today',
    color: '#3B82F6',
  },
  {
    level: 3,
    emoji: '🚀',
    label: 'HIGH (3)',
    description: 'Full Energy\nI\'m ready to maximize today!',
    color: '#10B981',
  },
];

export default function MorningSparkFuelCheck() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState<FuelLevel | null>(null);
  const [existingSparkId, setExistingSparkId] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const thumbPosition = useRef(new Animated.Value(0)).current;
  const gaugeContainerRef = useRef<View>(null);
  const [gaugeWidth, setGaugeWidth] = useState(0);

  useEffect(() => {
    checkExistingSpark();
  }, []);

  async function checkExistingSpark() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to set your Morning Spark.');
        router.back();
        return;
      }

      const spark = await checkTodaysSpark(user.id);

      if (spark) {
        setExistingSparkId(spark.id);
        setSelectedFuel(spark.fuel_level);
      }
    } catch (error) {
      console.error('Error checking existing spark:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedFuel && gaugeWidth > 0) {
      const zoneWidth = gaugeWidth / 3;
      const targetPosition = (selectedFuel - 1) * zoneWidth + zoneWidth / 2 - 24;

      Animated.spring(thumbPosition, {
        toValue: targetPosition,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [selectedFuel, gaugeWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setHasInteracted(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gaugeWidth === 0) return;

        const newPosition = Math.max(0, Math.min(gaugeWidth - 48, gestureState.moveX - 20));
        thumbPosition.setValue(newPosition);

        const zoneWidth = gaugeWidth / 3;
        const centerPosition = newPosition + 24;
        let newFuel: FuelLevel;

        if (centerPosition < zoneWidth) {
          newFuel = 1;
        } else if (centerPosition < zoneWidth * 2) {
          newFuel = 2;
        } else {
          newFuel = 3;
        }

        if (newFuel !== selectedFuel) {
          setSelectedFuel(newFuel);
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      },
      onPanResponderRelease: () => {
        if (selectedFuel && gaugeWidth > 0) {
          const zoneWidth = gaugeWidth / 3;
          const targetPosition = (selectedFuel - 1) * zoneWidth + zoneWidth / 2 - 24;

          Animated.spring(thumbPosition, {
            toValue: targetPosition,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();

          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      },
    })
  ).current;

  async function handleNext() {
    if (!selectedFuel) return;

    try {
      setSaving(true);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to set your fuel level.');
        return;
      }

      const modeMap = {
        1: 'recovery',
        2: 'steady',
        3: 'sprint',
      } as const;

      const mode = modeMap[selectedFuel];
      const today = new Date().toISOString().split('T')[0];

      if (existingSparkId) {
        const { error } = await supabase
          .from('0008-ap-daily-sparks')
          .update({
            fuel_level: selectedFuel,
            mode: mode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSparkId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('0008-ap-daily-sparks')
          .insert({
            user_id: user.id,
            spark_date: today,
            fuel_level: selectedFuel,
            mode: mode,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setExistingSparkId(data.id);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setTimeout(() => {
        router.push('/morning-spark/scheduled-actions');
      }, 300);
    } catch (error) {
      console.error('Error saving fuel level:', error);
      Alert.alert('Error', 'Failed to save your fuel level. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDevReset() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('0008-ap-daily-sparks')
        .delete()
        .eq('user_id', user.id)
        .eq('spark_date', today);

      if (error) {
        console.error('Error resetting spark:', error);
        Alert.alert('Error', 'Failed to reset spark. Please try again.');
        return;
      }

      setExistingSparkId(null);
      setSelectedFuel(null);

      Alert.alert('Success', 'Spark reset! You can now test the flow again.');
    } catch (error) {
      console.error('Error in dev reset:', error);
      Alert.alert('Error', 'Failed to reset spark. Please try again.');
    }
  }

  function formatDate() {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    return today.toLocaleDateString('en-US', options);
  }

  function getCurrentDescription() {
    if (!selectedFuel) return 'Drag the indicator to select your energy level';

    const descriptions = {
      1: 'Need Recovery - I need to focus on essentials and rest',
      2: 'Steady Pace - I can maintain momentum today',
      3: 'Full Energy - I\'m ready to maximize today!',
    };

    return descriptions[selectedFuel];
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Morning Spark</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.sparkEmoji}>✨</Text>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Morning Spark</Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate()}</Text>
        </View>

        <View style={styles.questionSection}>
          <Text style={[styles.question, { color: colors.text }]}>
            How's your fuel level today?
          </Text>
        </View>

        <View style={styles.gaugeSection}>
          <View
            ref={gaugeContainerRef}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setGaugeWidth(width);
            }}
            style={styles.gaugeContainer}
            {...panResponder.panHandlers}
          >
            <View style={styles.gaugeTrack}>
              <View style={[styles.zone, styles.zoneLow, selectedFuel === 1 && styles.zoneActive]} />
              <View style={[styles.zone, styles.zoneMedium, selectedFuel === 2 && styles.zoneActive]} />
              <View style={[styles.zone, styles.zoneHigh, selectedFuel === 3 && styles.zoneActive]} />
            </View>

            {gaugeWidth > 0 && (
              <Animated.View
                style={[
                  styles.gaugeThumb,
                  {
                    left: thumbPosition,
                    backgroundColor: selectedFuel === 1 ? fuelOptions[0].color : selectedFuel === 2 ? fuelOptions[1].color : fuelOptions[2].color,
                  },
                ]}
              >
                <Text style={styles.thumbEmoji}>
                  {selectedFuel === 1 ? fuelOptions[0].emoji : selectedFuel === 2 ? fuelOptions[1].emoji : fuelOptions[2].emoji}
                </Text>
              </Animated.View>
            )}
          </View>

          <View style={styles.labelsContainer}>
            <View style={styles.labelItem}>
              <Text style={[styles.zoneEmoji, selectedFuel === 1 && styles.zoneEmojiActive]}>{fuelOptions[0].emoji}</Text>
              <Text style={[styles.zoneLabel, { color: selectedFuel === 1 ? fuelOptions[0].color : colors.textSecondary }]}>
                {fuelOptions[0].label}
              </Text>
            </View>
            <View style={styles.labelItem}>
              <Text style={[styles.zoneEmoji, selectedFuel === 2 && styles.zoneEmojiActive]}>{fuelOptions[1].emoji}</Text>
              <Text style={[styles.zoneLabel, { color: selectedFuel === 2 ? fuelOptions[1].color : colors.textSecondary }]}>
                {fuelOptions[1].label}
              </Text>
            </View>
            <View style={styles.labelItem}>
              <Text style={[styles.zoneEmoji, selectedFuel === 3 && styles.zoneEmojiActive]}>{fuelOptions[2].emoji}</Text>
              <Text style={[styles.zoneLabel, { color: selectedFuel === 3 ? fuelOptions[2].color : colors.textSecondary }]}>
                {fuelOptions[2].label}
              </Text>
            </View>
          </View>

          <Text style={[styles.descriptionText, { color: selectedFuel ? colors.text : colors.textSecondary }]}>
            {getCurrentDescription()}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: hasInteracted && selectedFuel ? colors.primary : colors.border,
              opacity: hasInteracted && selectedFuel ? 1 : 0.5,
            },
          ]}
          onPress={handleNext}
          disabled={!hasInteracted || !selectedFuel || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.nextButtonText}>
              Next →
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.devResetButton}
          onPress={handleDevReset}
          activeOpacity={0.7}
        >
          <Text style={styles.devResetText}>
            Reset Today's Spark (Dev)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sparkEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  questionSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  question: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  gaugeSection: {
    marginBottom: 32,
  },
  gaugeContainer: {
    height: 80,
    marginBottom: 20,
    justifyContent: 'center',
  },
  gaugeTrack: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  zone: {
    flex: 1,
    opacity: 0.3,
  },
  zoneLow: {
    backgroundColor: '#F59E0B',
  },
  zoneMedium: {
    backgroundColor: '#3B82F6',
  },
  zoneHigh: {
    backgroundColor: '#10B981',
  },
  zoneActive: {
    opacity: 1,
  },
  gaugeThumb: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbEmoji: {
    fontSize: 24,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  labelItem: {
    alignItems: 'center',
    flex: 1,
  },
  zoneEmoji: {
    fontSize: 20,
    marginBottom: 4,
    opacity: 0.5,
  },
  zoneEmojiActive: {
    opacity: 1,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    minHeight: 48,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  devResetButton: {
    height: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  devResetText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
