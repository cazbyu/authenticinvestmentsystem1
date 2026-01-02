import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Sparkles, Target, TrendingUp, FileText, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  checkTodaysSpark,
  getTodayTargetScore,
  commitDailySpark,
  getRandomAspiration,
  getDefaultInspiration,
  Aspiration,
} from '@/lib/sparkUtils';

type CommitStage = 'pre-commit' | 'loading' | 'post-commit';

export default function CommitScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();

  const [stage, setStage] = useState<CommitStage>('pre-commit');
  const [userId, setUserId] = useState<string>('');
  const [targetScore, setTargetScore] = useState<number>(0);
  const [aspiration, setAspiration] = useState<Aspiration | null>(null);
  const [inspirationText, setInspirationText] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const scoreScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const inspirationOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && stage === 'pre-commit') {
      Animated.spring(scoreScale, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }).start();

      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, stage]);

  useEffect(() => {
    if (stage === 'post-commit') {
      Animated.timing(inspirationOpacity, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [stage]);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      const spark = await checkTodaysSpark(user.id);
      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      const score = await getTodayTargetScore(user.id);
      setTargetScore(score);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      setStage('loading');

      await commitDailySpark(userId, targetScore);

      const userAspiration = await getRandomAspiration(userId);
      if (userAspiration) {
        setAspiration(userAspiration);
        setInspirationText(userAspiration.aspiration_text);
      } else {
        setInspirationText(getDefaultInspiration());
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setStage('post-commit');
    } catch (error) {
      console.error('Error committing:', error);
      Alert.alert('Error', "Couldn't save your commitment. Please try again.");
      setStage('pre-commit');
    }
  }

  function handleStartDay() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace('/(tabs)/dashboard');
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
          disabled={stage === 'loading'}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {stage === 'post-commit' ? "You're Set!" : 'Ready to Act?'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {stage === 'pre-commit' && (
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
          <Animated.View
            style={[
              styles.contentSection,
              {
                opacity: contentOpacity,
              },
            ]}
          >
            <View style={styles.titleSection}>
              <View style={styles.titleWithIcon}>
                <Target size={32} color={colors.primary} />
                <Text style={[styles.pageTitle, { color: colors.text }]}>Ready to Act? 🎯</Text>
              </View>
              <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
                Here's what you're committing to today
              </Text>
            </View>

            <Animated.View
              style={[
                styles.scoreCard,
                {
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  borderColor: colors.primary,
                  transform: [{ scale: scoreScale }],
                },
              ]}
            >
              <View style={styles.scoreHeader}>
                <Sparkles size={24} color={colors.primary} />
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
                  Your Target Score for Today
                </Text>
              </View>
              <Text style={[styles.scoreValue, { color: colors.primary }]}>{targetScore}</Text>
              {targetScore === 0 && (
                <Text style={[styles.scoreNote, { color: colors.textSecondary }]}>
                  No scheduled tasks yet, but you can earn points throughout the day!
                </Text>
              )}
            </Animated.View>

            <View style={[styles.bonusSection, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }]}>
              <View style={styles.bonusHeader}>
                <TrendingUp size={20} color={colors.primary} />
                <Text style={[styles.bonusTitle, { color: colors.text }]}>
                  Plus, earn bonus points for:
                </Text>
              </View>
              <View style={styles.bonusList}>
                <View style={styles.bonusItem}>
                  <Text style={styles.bonusEmoji}>✨</Text>
                  <Text style={[styles.bonusText, { color: colors.text }]}>
                    Creating new Deposit Ideas throughout the day
                  </Text>
                </View>
                <View style={styles.bonusItem}>
                  <Text style={styles.bonusEmoji}>📝</Text>
                  <Text style={[styles.bonusText, { color: colors.text }]}>
                    Capturing Reflections (quick or deep)
                  </Text>
                </View>
                <View style={styles.bonusItem}>
                  <Text style={styles.bonusEmoji}>🎯</Text>
                  <Text style={[styles.bonusText, { color: colors.text }]}>
                    Completing additional unscheduled tasks
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ height: 120 }} />
          </Animated.View>
        </ScrollView>
      )}

      {stage === 'post-commit' && (
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
          <View style={styles.contentSection}>
            <View style={styles.successSection}>
              <CheckCircle2 size={64} color="#10B981" />
              <Text style={[styles.successTitle, { color: colors.text }]}>
                ✓ You're committed for today!
              </Text>
              <Text style={[styles.targetReminder, { color: colors.textSecondary }]}>
                Today's Target: {targetScore} points
              </Text>
            </View>

            <Animated.View
              style={[
                styles.inspirationCard,
                {
                  backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                  opacity: inspirationOpacity,
                },
              ]}
            >
              <View style={styles.inspirationHeader}>
                <FileText size={24} color={colors.primary} />
                <Text style={[styles.inspirationTitle, { color: colors.text }]}>
                  Today's Inspiration
                </Text>
              </View>

              <View style={styles.quoteContainer}>
                <Text style={[styles.quoteText, { color: colors.text }]}>{inspirationText}</Text>
              </View>

              {aspiration && (
                <Text style={[styles.inspirationDate, { color: colors.textSecondary }]}>
                  From your aspirations library
                </Text>
              )}
            </Animated.View>

            <View style={{ height: 120 }} />
          </View>
        </ScrollView>
      )}

      {stage === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Committing to your day...</Text>
        </View>
      )}

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {stage === 'pre-commit' && (
          <TouchableOpacity
            style={[styles.commitButton, { backgroundColor: colors.primary }]}
            onPress={handleCommit}
            activeOpacity={0.8}
          >
            <Text style={styles.commitButtonText}>✓ I'm Ready to Act!</Text>
          </TouchableOpacity>
        )}

        {stage === 'post-commit' && (
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            onPress={handleStartDay}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start My Day →</Text>
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
  },
  contentSection: {
    paddingTop: 24,
  },
  titleSection: {
    marginBottom: 32,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  scoreCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 3,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 80,
    fontWeight: '800',
    lineHeight: 88,
  },
  scoreNote: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  bonusSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  bonusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  bonusTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  bonusList: {
    gap: 12,
  },
  bonusItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bonusEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  bonusText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  targetReminder: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  inspirationCard: {
    padding: 28,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  inspirationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  inspirationTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  quoteContainer: {
    paddingVertical: 8,
  },
  quoteText: {
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  inspirationDate: {
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  commitButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  commitButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  startButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});
