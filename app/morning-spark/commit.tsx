import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckCircle, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useMorningSpark } from '@/contexts/MorningSparkContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  checkTodaysSpark,
  commitDailySpark,
  getFuelEmoji,
  getFuelColor,
  getModeDescription,
} from '@/lib/sparkUtils';

export default function CommitScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const {
    fuelLevel,
    acceptedEvents,
    acceptedTasks,
    activatedDepositIdeas,
    calculateTargetScore,
    reset,
  } = useMorningSpark();

  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [sparkId, setSparkId] = useState<string>('');
  const [reflection, setReflection] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);

  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      setSparkId(spark.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load commitment screen. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getToneMessage(): string {
    if (!fuelLevel) return '';

    switch (fuelLevel) {
      case 1:
        return "A solid, manageable target. You've got this.";
      case 2:
        return "A balanced target. Let's make it happen.";
      case 3:
        return 'An ambitious target. Challenge accepted!';
    }
  }

  function getCommitButtonText(): string {
    if (!fuelLevel) return 'Commit';

    switch (fuelLevel) {
      case 1:
        return "I'm Committed";
      case 2:
        return 'Accept Challenge';
      case 3:
        return "Let's Do It";
    }
  }

  async function handleCommit() {
    try {
      setCommitting(true);

      const supabase = getSupabaseClient();
      let finalScore = calculateTargetScore();

      if (reflection.trim()) {
        const { error: reflectionError } = await supabase.from('0008-ap-reflections').insert({
          user_id: userId,
          reflection_type: 'morning_spark',
          parent_id: sparkId,
          parent_type: 'daily_spark',
          content: reflection.trim(),
          points_awarded: 1,
        });

        if (reflectionError) {
          console.error('Error saving reflection:', reflectionError);
        } else {
          finalScore += 1;
        }
      }

      await commitDailySpark(userId, finalScore);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowCelebration(true);

      Animated.parallel([
        Animated.spring(celebrationScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
        }),
        Animated.timing(celebrationOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        reset();
        router.replace('/(tabs)/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error committing spark:', error);
      Alert.alert('Error', 'Could not commit your Morning Spark. Please try again.');
      setCommitting(false);
    }
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

  const targetScore = calculateTargetScore();
  const reflectionBonus = reflection.trim() ? 1 : 0;
  const finalScore = targetScore + reflectionBonus;

  const eventsPoints = acceptedEvents.reduce((sum, e) => sum + e.points, 0);
  const tasksPoints = acceptedTasks.reduce((sum, t) => sum + t.points, 0);
  const ideasPoints = activatedDepositIdeas.length * 5;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Commitment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {fuelLevel && (
          <View style={styles.fuelSection}>
            <Text style={styles.fuelEmoji}>{getFuelEmoji(fuelLevel)}</Text>
            <Text style={[styles.fuelMode, { color: getFuelColor(fuelLevel) }]}>
              {getModeDescription(fuelLevel)}
            </Text>
          </View>
        )}

        <View style={[styles.scoreboardCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Your Target</Text>
          <Text
            style={[
              styles.scoreValue,
              { color: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
            ]}
          >
            {finalScore}
          </Text>
          <Text style={[styles.scoreUnit, { color: colors.textSecondary }]}>points</Text>
        </View>

        <View style={[styles.manifestCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.manifestTitle, { color: colors.text }]}>Breakdown</Text>

          {acceptedEvents.length > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                {acceptedEvents.length} event{acceptedEvents.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{eventsPoints}
              </Text>
            </View>
          )}

          {acceptedTasks.length > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                {acceptedTasks.length} task{acceptedTasks.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{tasksPoints}
              </Text>
            </View>
          )}

          {activatedDepositIdeas.length > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>
                {activatedDepositIdeas.length} deposit idea{activatedDepositIdeas.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>
                +{ideasPoints}
              </Text>
            </View>
          )}

          <View style={styles.manifestRow}>
            <Text style={[styles.manifestLabel, { color: colors.text }]}>Morning Spark</Text>
            <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>+10</Text>
          </View>

          {reflectionBonus > 0 && (
            <View style={styles.manifestRow}>
              <Text style={[styles.manifestLabel, { color: colors.text }]}>Final Reflection</Text>
              <Text style={[styles.manifestValue, { color: colors.textSecondary }]}>+1</Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.manifestRow}>
            <Text style={[styles.manifestTotal, { color: colors.text }]}>Total Target</Text>
            <Text
              style={[
                styles.manifestTotalValue,
                { color: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
              ]}
            >
              {finalScore}
            </Text>
          </View>
        </View>

        <View style={[styles.toneCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
          <Text style={[styles.toneText, { color: colors.text }]}>{getToneMessage()}</Text>
        </View>

        <View style={[styles.victoryCard, { backgroundColor: isDarkMode ? '#10B98120' : '#10B98110' }]}>
          <Sparkles size={20} color="#10B981" />
          <Text style={[styles.victoryText, { color: '#10B981' }]}>
            Beat this score by midnight to earn +10 Victory Bonus!
          </Text>
        </View>

        <View style={styles.reflectionSection}>
          <Text style={[styles.reflectionLabel, { color: colors.textSecondary }]}>
            Any final thoughts or reflections to capture? (+1 point)
          </Text>
          <TextInput
            style={[
              styles.reflectionInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Optional..."
            placeholderTextColor={colors.textSecondary}
            value={reflection}
            onChangeText={setReflection}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.commitButton,
            {
              backgroundColor: fuelLevel ? getFuelColor(fuelLevel) : colors.primary,
            },
          ]}
          onPress={handleCommit}
          disabled={committing}
          activeOpacity={0.8}
        >
          {committing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.commitButtonText}>{getCommitButtonText()}</Text>
          )}
        </TouchableOpacity>
      </View>

      {showCelebration && (
        <Animated.View
          style={[
            styles.celebration,
            {
              opacity: celebrationOpacity,
              transform: [{ scale: celebrationScale }],
            },
          ]}
        >
          <View
            style={[
              styles.celebrationContent,
              { backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' },
            ]}
          >
            <CheckCircle size={80} color="#10B981" />
            <Text style={[styles.celebrationText, { color: colors.text }]}>
              Commitment Locked In!
            </Text>
            <Text style={[styles.celebrationSubtext, { color: colors.textSecondary }]}>
              Let's make it a great day
            </Text>
          </View>
        </Animated.View>
      )}
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
    paddingTop: 24,
  },
  fuelSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  fuelEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  fuelMode: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreboardCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 80,
  },
  scoreUnit: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  manifestCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  manifestTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  manifestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  manifestLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  manifestValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  manifestTotal: {
    fontSize: 17,
    fontWeight: '700',
  },
  manifestTotalValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  toneCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toneText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  victoryCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  victoryText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    lineHeight: 20,
  },
  reflectionSection: {
    marginBottom: 20,
  },
  reflectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reflectionInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  commitButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  commitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  celebration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  celebrationContent: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  celebrationText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  celebrationSubtext: {
    fontSize: 16,
    fontWeight: '500',
  },
});
