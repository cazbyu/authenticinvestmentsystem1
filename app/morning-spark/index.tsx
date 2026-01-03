import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Platform, Image, ScrollView } from 'react-native';
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
    label: 'LOW',
    description: 'Need Recovery - I need to focus on essentials and rest',
    color: '#F59E0B',
  },
  {
    level: 2,
    emoji: '⚡',
    label: 'MEDIUM',
    description: 'Steady Pace - I can maintain momentum today',
    color: '#3B82F6',
  },
  {
    level: 3,
    emoji: '🚀',
    label: 'HIGH',
    description: 'Full Energy - I\'m ready to maximize today!',
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

  const needleRotation = useRef(new Animated.Value(0)).current;
  const iconScales = {
    1: useRef(new Animated.Value(1)).current,
    2: useRef(new Animated.Value(1)).current,
    3: useRef(new Animated.Value(1)).current,
  };

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
        tension: 50,
        friction: 8,
      }).start();

      Object.keys(iconScales).forEach((key) => {
        const level = parseInt(key) as FuelLevel;
        Animated.spring(iconScales[level], {
          toValue: level === selectedFuel ? 1.15 : 1,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }).start();
      });
    }
  }, [selectedFuel]);

  function handleFuelSelect(level: FuelLevel) {
    setHasInteracted(true);
    setSelectedFuel(level);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

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
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

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
        Alert.alert('Error', `Failed to reset spark: ${error.message}`);
        return;
      }

      setExistingSparkId(null);
      setSelectedFuel(null);
      setHasInteracted(false);

      needleRotation.setValue(0);
      iconScales[1].setValue(1);
      iconScales[2].setValue(1);
      iconScales[3].setValue(1);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Success',
        'Spark reset! Returning to dashboard...',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/dashboard')
          }
        ]
      );
    } catch (error) {
      console.error('Error in dev reset:', error);
      Alert.alert('Error', `Failed to reset spark: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    if (!selectedFuel) return 'Select your energy level to continue';
    return fuelOptions[selectedFuel - 1].description;
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          <View style={styles.gaugeContainer}>
            {/* PNG Gauge Background */}
            <View style={styles.gaugeSvgContainer}>
              <Image
                source={require('@/assets/images/gauge-bg.png')}
                style={styles.gaugeBg}
                resizeMode="contain"
              />

              {/* Clickable Icon Buttons positioned around gauge */}
              <Animated.View style={[styles.iconButton, styles.iconLow, { transform: [{ scale: iconScales[1] }] }]}>
                <TouchableOpacity
                  onPress={() => handleFuelSelect(1)}
                  style={[
                    styles.iconTouchable,
                    selectedFuel === 1 && [styles.iconActive, { backgroundColor: fuelOptions[0].color + '30' }],
                  ]}
                  accessible={true}
                  accessibilityLabel="Select Low fuel level"
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconEmoji}>{fuelOptions[0].emoji}</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.iconButton, styles.iconMedium, { transform: [{ scale: iconScales[2] }] }]}>
                <TouchableOpacity
                  onPress={() => handleFuelSelect(2)}
                  style={[
                    styles.iconTouchable,
                    selectedFuel === 2 && [styles.iconActive, { backgroundColor: fuelOptions[1].color + '30' }],
                  ]}
                  accessible={true}
                  accessibilityLabel="Select Medium fuel level"
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconEmoji}>{fuelOptions[1].emoji}</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.iconButton, styles.iconHigh, { transform: [{ scale: iconScales[3] }] }]}>
                <TouchableOpacity
                  onPress={() => handleFuelSelect(3)}
                  style={[
                    styles.iconTouchable,
                    selectedFuel === 3 && [styles.iconActive, { backgroundColor: fuelOptions[2].color + '30' }],
                  ]}
                  accessible={true}
                  accessibilityLabel="Select High fuel level"
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconEmoji}>{fuelOptions[2].emoji}</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Animated Needle SVG */}
              <Animated.View
                style={[
                  styles.needleContainer,
                  {
                    transform: [
                      { translateY: 50 },
                      { rotate: needleRotation.interpolate({
                        inputRange: [-90, 90],
                        outputRange: ['-90deg', '90deg'],
                      }) },
                      { translateY: -50 },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('@/assets/images/gauge-needle.svg')}
                  style={styles.needleSvg}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>

            {/* E and F labels */}
            <View style={styles.gaugeLabels}>
              <View style={styles.gaugeLabelLeft}>
                <Text style={[styles.gaugeLabelText, { color: fuelOptions[0].color }]}>E</Text>
                <Text style={[styles.gaugeLabelSubtext, { color: colors.textSecondary }]}>Empty</Text>
              </View>
              <View style={styles.gaugeLabelRight}>
                <Text style={[styles.gaugeLabelText, { color: fuelOptions[2].color }]}>F</Text>
                <Text style={[styles.gaugeLabelSubtext, { color: colors.textSecondary }]}>Full</Text>
              </View>
            </View>
          </View>

          {/* Description text */}
          <Text style={[styles.descriptionText, { color: selectedFuel ? colors.text : colors.textSecondary }]}>
            {getCurrentDescription()}
          </Text>

          {/* Button Cards for alternative selection */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[
                styles.buttonCard,
                { borderColor: fuelOptions[0].color },
                selectedFuel === 1 && [styles.buttonActive, { backgroundColor: fuelOptions[0].color + '15' }],
              ]}
              onPress={() => handleFuelSelect(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonEmoji}>{fuelOptions[0].emoji}</Text>
              <Text style={[styles.buttonLabel, { color: selectedFuel === 1 ? fuelOptions[0].color : colors.textSecondary }]}>
                {fuelOptions[0].label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.buttonCard,
                { borderColor: fuelOptions[1].color },
                selectedFuel === 2 && [styles.buttonActive, { backgroundColor: fuelOptions[1].color + '15' }],
              ]}
              onPress={() => handleFuelSelect(2)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonEmoji}>{fuelOptions[1].emoji}</Text>
              <Text style={[styles.buttonLabel, { color: selectedFuel === 2 ? fuelOptions[1].color : colors.textSecondary }]}>
                {fuelOptions[1].label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.buttonCard,
                { borderColor: fuelOptions[2].color },
                selectedFuel === 3 && [styles.buttonActive, { backgroundColor: fuelOptions[2].color + '15' }],
              ]}
              onPress={() => handleFuelSelect(3)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonEmoji}>{fuelOptions[2].emoji}</Text>
              <Text style={[styles.buttonLabel, { color: selectedFuel === 3 ? fuelOptions[2].color : colors.textSecondary }]}>
                {fuelOptions[2].label}
              </Text>
            </TouchableOpacity>
          </View>
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

        <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: 32,
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
    alignItems: 'center',
    marginBottom: 20,
  },
  gaugeSvgContainer: {
    width: 320,
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeBg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  iconButton: {
    position: 'absolute',
    zIndex: 10,
  },
  iconTouchable: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconActive: {
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  iconEmoji: {
    fontSize: 36,
  },
  iconLow: {
    left: 15,
    top: 100,
  },
  iconMedium: {
    left: '50%',
    marginLeft: -32,
    top: 10,
  },
  iconHigh: {
    right: 15,
    top: 100,
  },
  needleContainer: {
    position: 'absolute',
    bottom: 16,
    width: 40,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  needleSvg: {
    width: 40,
    height: 100,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginTop: 8,
  },
  gaugeLabelLeft: {
    alignItems: 'flex-start',
  },
  gaugeLabelRight: {
    alignItems: 'flex-end',
  },
  gaugeLabelText: {
    fontSize: 24,
    fontWeight: '700',
  },
  gaugeLabelSubtext: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    minHeight: 50,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 6,
  },
  buttonActive: {
    borderWidth: 3,
  },
  buttonEmoji: {
    fontSize: 28,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
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
