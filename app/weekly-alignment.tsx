import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckCircle2, Target, TrendingUp, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { hasCompletedWeeklyAlignmentThisWeek, isWeeklyAlignmentWindowOpen, getWeeklyAlignmentPoints, calculateWeekBounds } from '@/lib/ritualUtils';
import { getUserPreferences } from '@/lib/userPreferences';

interface WeeklyAlignment {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  keystone_focus: string;
  execution_score: number | null;
  keystone_achieved: boolean | null;
  created_at: string;
}

interface WeekBounds {
  weekStart: string;
  weekEnd: string;
}

export default function WeeklyAlignmentScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAlignment, setCompletedAlignment] = useState<WeeklyAlignment | null>(null);
  const [lastWeekAlignment, setLastWeekAlignment] = useState<WeeklyAlignment | null>(null);

  const [keystoneFocus, setKeystoneFocus] = useState('');
  const [weekBounds, setWeekBounds] = useState<WeekBounds>({ weekStart: '', weekEnd: '' });
  const [bonusWindow, setBonusWindow] = useState(false);
  const [points, setPoints] = useState(10);
  const [userPreferredDay, setUserPreferredDay] = useState<string>('');

  const [scaleAnim] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkCompletionStatus();
  }, []);

  useEffect(() => {
    if (isCompleted && completedAlignment) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isCompleted, completedAlignment]);

  async function getLastWeekBounds(userId: string): Promise<WeekBounds> {
    const bounds = await calculateWeekBounds(userId);
    const weekStart = new Date(bounds.weekStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekEnd = new Date(bounds.weekEnd);
    weekEnd.setDate(weekEnd.getDate() - 7);

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
    };
  }

  function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatWeekRange(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endDay = end.getDate();
    const year = end.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  }

  async function checkCompletionStatus() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to complete Weekly Alignment.');
        router.back();
        return;
      }

      const [bounds, prefs] = await Promise.all([
        calculateWeekBounds(user.id),
        getUserPreferences(user.id)
      ]);

      setWeekBounds(bounds);

      const inBonusWindow = isWeeklyAlignmentWindowOpen();
      const alignmentPoints = getWeeklyAlignmentPoints();

      setBonusWindow(inBonusWindow);
      setPoints(alignmentPoints);

      if (prefs?.weekly_alignment_day) {
        setUserPreferredDay(capitalizeFirstLetter(prefs.weekly_alignment_day));
      }

      const completed = await hasCompletedWeeklyAlignmentThisWeek(user.id);

      if (completed) {
        await fetchCompletedAlignment(user.id, bounds.weekStart);
        setIsCompleted(true);
      } else {
        const lastWeekBounds = await getLastWeekBounds(user.id);
        await fetchLastWeekAlignment(user.id, lastWeekBounds.weekStart);
      }
    } catch (error) {
      console.error('Error checking completion status:', error);
      Alert.alert('Error', 'Failed to load Weekly Alignment. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompletedAlignment(userId: string, weekStartDate: string) {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (error) {
        console.error('Error fetching completed alignment:', error);
        return;
      }

      if (data) {
        setCompletedAlignment(data);
      }
    } catch (error) {
      console.error('Exception fetching completed alignment:', error);
    }
  }

  async function fetchLastWeekAlignment(userId: string, lastWeekStartDate: string) {
    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start_date', lastWeekStartDate)
        .maybeSingle();

      if (error) {
        console.error('Error fetching last week alignment:', error);
        return;
      }

      if (data) {
        setLastWeekAlignment(data);
      }
    } catch (error) {
      console.error('Exception fetching last week alignment:', error);
    }
  }

  async function handleCommit() {
    if (!keystoneFocus.trim()) {
      Alert.alert('Required', 'Please enter your keystone focus for the week.');
      return;
    }

    try {
      setSubmitting(true);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to commit Weekly Alignment.');
        return;
      }

      const { data, error } = await supabase
        .from('0008-ap-weekly-alignments')
        .insert({
          user_id: user.id,
          week_start_date: weekBounds.weekStart,
          week_end_date: weekBounds.weekEnd,
          keystone_focus: keystoneFocus.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating weekly alignment:', error);
        Alert.alert('Error', 'Failed to save Weekly Alignment. Please try again.');
        return;
      }

      console.log(`[Weekly Alignment] Awarded ${points} points (Bonus window: ${bonusWindow})`);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

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

      setCompletedAlignment(data);
      setIsCompleted(true);
    } catch (error) {
      console.error('Exception submitting weekly alignment:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading Weekly Alignment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isCompleted && completedAlignment) {
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Weekly Alignment</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Animated.View style={[styles.completedCard, { opacity: fadeAnim }]}>
            <View style={styles.successIconContainer}>
              <CheckCircle2 size={80} color={colors.primary} />
            </View>

            <Text style={[styles.completedTitle, { color: colors.text }]}>
              Committed!
            </Text>

            <Text style={[styles.weekRange, { color: colors.textSecondary }]}>
              {formatWeekRange(completedAlignment.week_start_date, completedAlignment.week_end_date)}
            </Text>

            <View style={[styles.focusCard, { backgroundColor: isDarkMode ? colors.card : '#F9FAFB' }]}>
              <View style={styles.focusHeader}>
                <Target size={24} color={colors.primary} />
                <Text style={[styles.focusLabel, { color: colors.textSecondary }]}>
                  Your Keystone Focus
                </Text>
              </View>
              <Text style={[styles.focusText, { color: colors.text }]}>
                {completedAlignment.keystone_focus}
              </Text>
            </View>

            {completedAlignment.execution_score !== null && (
              <View style={[styles.scoreCard, { backgroundColor: isDarkMode ? colors.card : '#F9FAFB' }]}>
                <TrendingUp size={20} color={colors.primary} />
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
                  Execution Score
                </Text>
                <Text style={[styles.scoreValue, { color: colors.text }]}>
                  {completedAlignment.execution_score}%
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/dashboard')}
            >
              <Text style={styles.doneButtonText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Weekly Alignment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.weekRangeContainer}>
          <Calendar size={20} color={colors.textSecondary} />
          <Text style={[styles.weekRangeText, { color: colors.textSecondary }]}>
            {formatWeekRange(weekBounds.weekStart, weekBounds.weekEnd)}
          </Text>
        </View>

        <View style={[styles.pointsBanner, { backgroundColor: bonusWindow ? '#ECFDF5' : '#F3F4F6' }]}>
          <View style={styles.pointsBannerContent}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>
              {bonusWindow ? '⭐' : '⏰'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pointsBannerTitle, { color: bonusWindow ? '#10B981' : '#6B7280' }]}>
                {bonusWindow ? 'Bonus Window Active!' : 'Outside Bonus Window'}
              </Text>
              <Text style={[styles.pointsBannerSubtitle, { color: bonusWindow ? '#059669' : '#4B5563' }]}>
                Complete now for +{points} points
              </Text>
            </View>
          </View>
          <Text style={[styles.windowInfo, { color: bonusWindow ? '#059669' : '#6B7280' }]}>
            Bonus window: Friday 12:00 AM - Monday 11:59 PM
          </Text>
          {userPreferredDay && (
            <Text style={[styles.preferenceInfo, { color: colors.textSecondary }]}>
              Your planning day: {userPreferredDay}
            </Text>
          )}
        </View>

        {lastWeekAlignment ? (
          <View style={[styles.lastWeekSection, { backgroundColor: isDarkMode ? colors.card : '#F9FAFB' }]}>
            <Text style={[styles.lastWeekTitle, { color: colors.text }]}>
              Last Week's Performance
            </Text>

            <View style={styles.lastWeekContent}>
              <Text style={[styles.lastWeekLabel, { color: colors.textSecondary }]}>
                Keystone Focus
              </Text>
              <Text style={[styles.lastWeekValue, { color: colors.text }]}>
                {lastWeekAlignment.keystone_focus}
              </Text>

              {lastWeekAlignment.execution_score !== null && (
                <>
                  <Text style={[styles.lastWeekLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Execution Score
                  </Text>
                  <Text style={[styles.lastWeekValue, { color: colors.text }]}>
                    {lastWeekAlignment.execution_score}%
                  </Text>
                </>
              )}

              {lastWeekAlignment.keystone_achieved !== null && (
                <>
                  <Text style={[styles.lastWeekLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Achieved
                  </Text>
                  <Text
                    style={[
                      styles.lastWeekValue,
                      { color: lastWeekAlignment.keystone_achieved ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {lastWeekAlignment.keystone_achieved ? 'Yes' : 'No'}
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.lastWeekSection, { backgroundColor: isDarkMode ? colors.card : '#F9FAFB' }]}>
            <Text style={[styles.lastWeekTitle, { color: colors.text }]}>
              Last Week's Performance
            </Text>
            <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
              No data from last week. Let's start fresh!
            </Text>
          </View>
        )}

        <View style={styles.focusSection}>
          <Text style={[styles.focusHeading, { color: colors.text }]}>
            What's your ONE keystone focus this week?
          </Text>

          <TextInput
            style={[
              styles.focusInput,
              {
                backgroundColor: isDarkMode ? colors.card : '#F9FAFB',
                color: colors.text,
                borderColor: colors.primary,
              },
            ]}
            placeholder="e.g., 'No Sugar', 'Sleep 8 Hours', 'Daily Walk', 'Launch Feature'"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            value={keystoneFocus}
            onChangeText={setKeystoneFocus}
            textAlignVertical="top"
          />

          <View style={styles.examplesContainer}>
            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
              One word or habit
            </Text>
            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
              The constraint that unlocks everything else
            </Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.commitButton,
              { backgroundColor: colors.primary },
              submitting && styles.commitButtonDisabled,
            ]}
            onPress={handleCommit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Target size={20} color="#FFFFFF" />
                <Text style={styles.commitButtonText}>Commit to the Week</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  weekRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  weekRangeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  lastWeekSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  lastWeekTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  lastWeekContent: {
    gap: 4,
  },
  lastWeekLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  lastWeekValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  noDataText: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  focusSection: {
    marginBottom: 24,
  },
  focusHeading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 32,
  },
  focusInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    minHeight: 100,
    fontWeight: '500',
  },
  examplesContainer: {
    marginTop: 12,
    gap: 4,
  },
  exampleText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  commitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  commitButtonDisabled: {
    opacity: 0.6,
  },
  commitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  completedCard: {
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  completedTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  weekRange: {
    fontSize: 16,
    marginBottom: 32,
  },
  focusCard: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  focusLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  focusText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  scoreCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pointsBanner: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  pointsBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pointsBannerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  windowInfo: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  preferenceInfo: {
    fontSize: 13,
    marginTop: 4,
  },
});
