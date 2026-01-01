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
import { ArrowLeft, Compass, CheckCircle2, Trophy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  hasCompletedEveningReviewToday,
  calculateDominantCardinal,
  calculateDailyScore,
} from '@/lib/ritualUtils';

interface CompletedReview {
  id: string;
  review_date: string;
  final_score: number;
  target_score: number;
  dominant_cardinal: 'north' | 'east' | 'west' | 'south' | null;
  is_win: boolean;
  rose_content: string | null;
  thorn_content: string | null;
  brain_dump_content: string | null;
}

export default function EveningReviewScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedReview, setCompletedReview] = useState<CompletedReview | null>(null);

  const [roseContent, setRoseContent] = useState('');
  const [thornContent, setThornContent] = useState('');
  const [brainDumpContent, setBrainDumpContent] = useState('');
  const [finalScore, setFinalScore] = useState(0);
  const [targetScore, setTargetScore] = useState(35);
  const [dominantCardinal, setDominantCardinal] = useState<'north' | 'east' | 'west' | 'south' | null>(null);

  const [scaleAnim] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkCompletionStatus();
  }, []);

  useEffect(() => {
    if (isCompleted && completedReview) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isCompleted, completedReview]);

  async function checkCompletionStatus() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to complete Evening Review.');
        router.back();
        return;
      }

      const completed = await hasCompletedEveningReviewToday(user.id);

      if (completed) {
        await fetchCompletedReview(user.id);
        setIsCompleted(true);
      } else {
        await calculateScores(user.id);
      }
    } catch (error) {
      console.error('Error checking completion status:', error);
      Alert.alert('Error', 'Failed to load Evening Review. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompletedReview(userId: string) {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('v-daily-reviews-complete')
        .select('*')
        .eq('user_id', userId)
        .eq('review_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error fetching completed review:', error);
        return;
      }

      if (data) {
        setCompletedReview(data);
      }
    } catch (error) {
      console.error('Exception fetching completed review:', error);
    }
  }

  async function calculateScores(userId: string) {
    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      const { data: sparkData } = await supabase
        .from('0008-ap-daily-sparks')
        .select('target_score')
        .eq('user_id', userId)
        .eq('spark_date', today)
        .maybeSingle();

      const target = sparkData?.target_score || 35;
      setTargetScore(target);

      const score = await calculateDailyScore(userId, today);
      setFinalScore(score);

      const cardinal = await calculateDominantCardinal(userId, today);
      setDominantCardinal(cardinal);
    } catch (error) {
      console.error('Error calculating scores:', error);
      setTargetScore(35);
      setFinalScore(0);
    }
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to complete Evening Review.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('create_evening_review', {
        p_user_id: user.id,
        p_review_date: today,
        p_rose_content: roseContent.trim() || null,
        p_thorn_content: thornContent.trim() || null,
        p_brain_dump_content: brainDumpContent.trim() || null,
        p_final_score: finalScore,
        p_target_score: targetScore,
        p_dominant_cardinal: dominantCardinal,
      });

      if (error) {
        console.error('Error creating evening review:', error);
        Alert.alert('Error', 'Failed to save Evening Review. Please try again.');
        return;
      }

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

      await fetchCompletedReview(user.id);
      setIsCompleted(true);
    } catch (error) {
      console.error('Exception submitting evening review:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function getCardinalLabel(cardinal: string | null): string {
    switch (cardinal) {
      case 'north':
        return 'Aspirations';
      case 'east':
        return 'Wellness';
      case 'west':
        return 'Roles';
      case 'south':
        return 'Maintenance';
      default:
        return 'Balanced';
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading Evening Review...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isCompleted && completedReview) {
    const isWin = completedReview.is_win;

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Evening Review</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Animated.View style={[styles.completedCard, { opacity: fadeAnim }]}>
            <View style={styles.compassContainer}>
              <Compass size={64} color={isWin ? '#10B981' : colors.primary} />
              {completedReview.dominant_cardinal && (
                <Text style={[styles.cardinalLabel, { color: colors.text }]}>
                  {getCardinalLabel(completedReview.dominant_cardinal)}
                </Text>
              )}
            </View>

            <View style={styles.scoreboardCompleted}>
              <View style={styles.scoreColumn}>
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>HOME</Text>
                <Text style={[styles.scoreValue, { color: isWin ? '#10B981' : '#EF4444' }]}>
                  {completedReview.final_score}
                </Text>
              </View>
              <Text style={[styles.scoreDash, { color: colors.textSecondary }]}>-</Text>
              <View style={styles.scoreColumn}>
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>GUEST</Text>
                <Text style={[styles.scoreValue, { color: colors.text }]}>
                  {completedReview.target_score}
                </Text>
              </View>
            </View>

            {isWin && (
              <View style={styles.victoryBanner}>
                <Trophy size={24} color="#10B981" />
                <Text style={styles.victoryText}>Victory! You met your target!</Text>
              </View>
            )}

            {completedReview.rose_content && (
              <View style={styles.reflectionSection}>
                <Text style={[styles.reflectionTitle, { color: '#10B981' }]}>Rose</Text>
                <Text style={[styles.reflectionContent, { color: colors.text }]}>
                  {completedReview.rose_content}
                </Text>
              </View>
            )}

            {completedReview.thorn_content && (
              <View style={styles.reflectionSection}>
                <Text style={[styles.reflectionTitle, { color: '#EF4444' }]}>Thorn</Text>
                <Text style={[styles.reflectionContent, { color: colors.text }]}>
                  {completedReview.thorn_content}
                </Text>
              </View>
            )}

            {completedReview.brain_dump_content && (
              <View style={styles.reflectionSection}>
                <Text style={[styles.reflectionTitle, { color: '#3B82F6' }]}>Brain Dump</Text>
                <Text style={[styles.reflectionContent, { color: colors.text }]}>
                  {completedReview.brain_dump_content}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/dashboard')}
            >
              <CheckCircle2 size={20} color="#FFFFFF" />
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Evening Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formSection}>
          <Text style={[styles.sectionHeading, { color: '#10B981' }]}>
            What went well today?
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDarkMode ? colors.card : '#F9FAFB',
                color: colors.text,
                borderColor: '#10B981',
              },
            ]}
            placeholder="Celebrate your wins, big or small..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={roseContent}
            onChangeText={setRoseContent}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.sectionHeading, { color: '#EF4444' }]}>
            What was challenging?
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDarkMode ? colors.card : '#F9FAFB',
                color: colors.text,
                borderColor: '#EF4444',
              },
            ]}
            placeholder="It's okay. Tomorrow is a new day..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={thornContent}
            onChangeText={setThornContent}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.sectionHeading, { color: '#3B82F6' }]}>
            Brain dump for tomorrow
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDarkMode ? colors.card : '#F9FAFB',
                color: colors.text,
                borderColor: '#3B82F6',
              },
            ]}
            placeholder="Clear your mind before bed..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={brainDumpContent}
            onChangeText={setBrainDumpContent}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.scoreboardSection}>
          <Text style={[styles.scoreboardHeading, { color: colors.text }]}>
            Today's Score
          </Text>
          <View style={[styles.scoreboard, { backgroundColor: isDarkMode ? colors.card : '#F9FAFB' }]}>
            <View style={styles.scoreColumn}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>HOME</Text>
              <Text
                style={[
                  styles.scoreValue,
                  { color: finalScore >= targetScore ? '#10B981' : '#EF4444' },
                ]}
              >
                {finalScore}
              </Text>
            </View>
            <Text style={[styles.scoreDash, { color: colors.textSecondary }]}>-</Text>
            <View style={styles.scoreColumn}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>GUEST</Text>
              <Text style={[styles.scoreValue, { color: colors.text }]}>{targetScore}</Text>
            </View>
          </View>
          {finalScore >= targetScore && (
            <Text style={[styles.winMessage, { color: '#10B981' }]}>
              You're winning!
            </Text>
          )}
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Complete Review</Text>
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
  formSection: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  scoreboardSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  scoreboardHeading: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 32,
  },
  scoreColumn: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  scoreDash: {
    fontSize: 36,
    fontWeight: '600',
  },
  winMessage: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  completedCard: {
    alignItems: 'center',
  },
  compassContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardinalLabel: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  scoreboardCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 32,
  },
  victoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
  },
  victoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  reflectionSection: {
    width: '100%',
    marginBottom: 20,
  },
  reflectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  reflectionContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
