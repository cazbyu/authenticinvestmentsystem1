import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Platform } from 'react-native';
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
  const [scaleAnims] = useState([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]);

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

  function animateButton(index: number) {
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function handleFuelSelection(fuelLevel: FuelLevel, index: number) {
    try {
      setSaving(true);
      animateButton(index);

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

      const mode = modeMap[fuelLevel];
      const today = new Date().toISOString().split('T')[0];

      if (existingSparkId) {
        const { error } = await supabase
          .from('0008-ap-daily-sparks')
          .update({
            fuel_level: fuelLevel,
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
            fuel_level: fuelLevel,
            mode: mode,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setExistingSparkId(data.id);
      }

      setSelectedFuel(fuelLevel);

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
          <Text style={[styles.explanation, { color: colors.textSecondary }]}>
            This helps us adjust your day's approach to match your energy.
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          {fuelOptions.map((option, index) => (
            <Animated.View
              key={option.level}
              style={{ transform: [{ scale: scaleAnims[index] }] }}
            >
              <TouchableOpacity
                style={[
                  styles.fuelButton,
                  {
                    backgroundColor: isDarkMode
                      ? `${option.color}20`
                      : `${option.color}15`,
                    borderColor: selectedFuel === option.level ? option.color : colors.border,
                    borderWidth: selectedFuel === option.level ? 3 : 1,
                  },
                ]}
                onPress={() => handleFuelSelection(option.level, index)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.fuelEmoji}>{option.emoji}</Text>
                <Text style={[styles.fuelLabel, { color: option.color }]}>
                  {option.label}
                </Text>
                <Text style={[styles.fuelDescription, { color: colors.text }]}>
                  {option.description}
                </Text>
                {selectedFuel === option.level && (
                  <View style={[styles.selectedBadge, { backgroundColor: option.color }]}>
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {saving && (
          <View style={styles.savingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.savingText, { color: colors.textSecondary }]}>
              Saving your fuel level...
            </Text>
          </View>
        )}

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devResetButton}
            onPress={handleDevReset}
            activeOpacity={0.7}
          >
            <Text style={styles.devResetText}>
              Reset Today's Spark (Dev Only)
            </Text>
          </TouchableOpacity>
        )}
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
    marginBottom: 32,
    alignItems: 'center',
  },
  question: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  explanation: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonsContainer: {
    gap: 16,
  },
  fuelButton: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
    position: 'relative',
  },
  fuelEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  fuelLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  fuelDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  savingText: {
    fontSize: 14,
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
