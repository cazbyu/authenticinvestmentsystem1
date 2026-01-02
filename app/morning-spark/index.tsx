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

  const needleRotation = useRef(new Animated.Value(-90)).current;
  const gaugeContainerRef = useRef<View>(null);
  const [gaugeDimensions, setGaugeDimensions] = useState({ width: 0, height: 0 });

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
    if (selectedFuel) {
      const rotationMap = {
        1: -90,
        2: 0,
        3: 90,
      };

      Animated.spring(needleRotation, {
        toValue: rotationMap[selectedFuel],
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();
    }
  }, [selectedFuel]);

  function handleGaugeTap(event: any) {
    if (gaugeDimensions.width === 0) return;

    setHasInteracted(true);

    const { locationX } = event.nativeEvent;
    const centerX = gaugeDimensions.width / 2;
    const relativeX = locationX - centerX;

    let newFuel: FuelLevel;
    if (relativeX < -gaugeDimensions.width / 6) {
      newFuel = 1;
    } else if (relativeX < gaugeDimensions.width / 6) {
      newFuel = 2;
    } else {
      newFuel = 3;
    }

    if (newFuel !== selectedFuel) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    setSelectedFuel(newFuel);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setHasInteracted(true);
        handleGaugeTap(evt);
      },
      onPanResponderMove: (evt) => {
        handleGaugeTap(evt);
      },
      onPanResponderRelease: () => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              const { width, height } = event.nativeEvent.layout;
              setGaugeDimensions({ width, height });
            }}
            style={styles.gaugeContainer}
            {...panResponder.panHandlers}
          >
            <View style={styles.gaugeArcContainer}>
              <View style={[styles.arcSegment, styles.arcLeft, { backgroundColor: fuelOptions[0].color }]} />
              <View style={[styles.arcSegment, styles.arcMiddle, { backgroundColor: fuelOptions[1].color }]} />
              <View style={[styles.arcSegment, styles.arcRight, { backgroundColor: fuelOptions[2].color }]} />

              <View style={styles.tickMarksContainer}>
                {Array.from({ length: 11 }).map((_, i) => {
                  const angle = -90 + (i * 18);
                  const isActive =
                    (selectedFuel === 1 && i <= 3) ||
                    (selectedFuel === 2 && i > 3 && i <= 7) ||
                    (selectedFuel === 3 && i > 7);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.tickMark,
                        {
                          transform: [
                            { rotate: `${angle}deg` },
                            { translateY: -80 },
                          ],
                          backgroundColor: isActive ? '#FFFFFF' : isDarkMode ? '#4B5563' : '#D1D5DB',
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <View style={styles.needleContainer}>
                <Animated.View
                  style={[
                    styles.needle,
                    {
                      backgroundColor: selectedFuel === 1 ? fuelOptions[0].color : selectedFuel === 2 ? fuelOptions[1].color : selectedFuel === 3 ? fuelOptions[2].color : colors.border,
                      transform: [
                        { rotate: needleRotation.interpolate({
                          inputRange: [-90, 90],
                          outputRange: ['-90deg', '90deg'],
                        }) },
                      ],
                    },
                  ]}
                />
                <View style={[styles.needleCenter, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.needleCenterEmoji}>
                    {selectedFuel === 1 ? fuelOptions[0].emoji : selectedFuel === 2 ? fuelOptions[1].emoji : selectedFuel === 3 ? fuelOptions[2].emoji : '⚡'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.gaugeLabels}>
              <View style={styles.gaugeLabelLeft}>
                <Text style={[styles.gaugeLabelText, { color: fuelOptions[0].color }]}>E</Text>
                <Text style={[styles.gaugeLabelSubtext, { color: colors.textSecondary }]}>Low</Text>
              </View>
              <View style={styles.gaugeLabelRight}>
                <Text style={[styles.gaugeLabelText, { color: fuelOptions[2].color }]}>F</Text>
                <Text style={[styles.gaugeLabelSubtext, { color: colors.textSecondary }]}>Full</Text>
              </View>
            </View>
          </View>

          <View style={styles.levelIndicatorsContainer}>
            <TouchableOpacity
              style={[
                styles.levelIndicator,
                selectedFuel === 1 && styles.levelIndicatorActive,
                { borderColor: fuelOptions[0].color },
              ]}
              onPress={() => {
                setHasInteracted(true);
                setSelectedFuel(1);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.levelIndicatorEmoji}>{fuelOptions[0].emoji}</Text>
              <Text style={[styles.levelIndicatorLabel, { color: selectedFuel === 1 ? fuelOptions[0].color : colors.textSecondary }]}>
                LOW
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.levelIndicator,
                selectedFuel === 2 && styles.levelIndicatorActive,
                { borderColor: fuelOptions[1].color },
              ]}
              onPress={() => {
                setHasInteracted(true);
                setSelectedFuel(2);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.levelIndicatorEmoji}>{fuelOptions[1].emoji}</Text>
              <Text style={[styles.levelIndicatorLabel, { color: selectedFuel === 2 ? fuelOptions[1].color : colors.textSecondary }]}>
                MEDIUM
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.levelIndicator,
                selectedFuel === 3 && styles.levelIndicatorActive,
                { borderColor: fuelOptions[2].color },
              ]}
              onPress={() => {
                setHasInteracted(true);
                setSelectedFuel(3);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.levelIndicatorEmoji}>{fuelOptions[2].emoji}</Text>
              <Text style={[styles.levelIndicatorLabel, { color: selectedFuel === 3 ? fuelOptions[2].color : colors.textSecondary }]}>
                HIGH
              </Text>
            </TouchableOpacity>
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
    marginBottom: 24,
  },
  gaugeContainer: {
    height: 200,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeArcContainer: {
    width: 200,
    height: 120,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arcSegment: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 20,
    opacity: 0.3,
  },
  arcLeft: {
    borderColor: 'transparent',
    borderTopColor: 'transparent',
    borderLeftColor: '#F59E0B',
    borderBottomColor: '#F59E0B',
    transform: [{ rotate: '-135deg' }],
  },
  arcMiddle: {
    borderColor: 'transparent',
    borderTopColor: '#3B82F6',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-90deg' }],
  },
  arcRight: {
    borderColor: 'transparent',
    borderTopColor: 'transparent',
    borderRightColor: '#10B981',
    borderBottomColor: '#10B981',
    transform: [{ rotate: '45deg' }],
  },
  tickMarksContainer: {
    position: 'absolute',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickMark: {
    position: 'absolute',
    width: 2,
    height: 8,
    borderRadius: 1,
  },
  needleContainer: {
    position: 'absolute',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  needle: {
    position: 'absolute',
    width: 4,
    height: 70,
    borderRadius: 2,
    bottom: 80,
  },
  needleCenter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  needleCenterEmoji: {
    fontSize: 20,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 180,
    marginTop: -10,
  },
  gaugeLabelLeft: {
    alignItems: 'flex-start',
  },
  gaugeLabelRight: {
    alignItems: 'flex-end',
  },
  gaugeLabelText: {
    fontSize: 20,
    fontWeight: '700',
  },
  gaugeLabelSubtext: {
    fontSize: 12,
    fontWeight: '600',
  },
  levelIndicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  levelIndicator: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  levelIndicatorActive: {
    borderWidth: 3,
  },
  levelIndicatorEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  levelIndicatorLabel: {
    fontSize: 11,
    fontWeight: '700',
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
