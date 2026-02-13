import React, { useState, useEffect, useCallback } from 'react';
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
import { ArrowLeft, CheckCircle2, Trophy, Compass, Tag } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import {
  ContractFollowUpData,
  WeeklyContractItem,
  RoleTag,
  DomainTag,
  GoalTag,
  getContractFollowUp,
  tagCompletedTask,
  saveEveningReviewV2,
  getUserRoles,
  getUserDomains,
  getUserGoals,
  calculateDailyScore,
  calculateDominantCardinal,
} from '@/lib/morningSparkV2Service';

// ============ HELPER FUNCTIONS ============

function getCardinalLabel(cardinal: string | null): string {
  switch (cardinal) {
    case 'north': return 'Aspirations';
    case 'east': return 'Wellness';
    case 'west': return 'Roles';
    case 'south': return 'Maintenance';
    default: return 'Balanced';
  }
}

function getCardinalEmoji(cardinal: string | null): string {
  switch (cardinal) {
    case 'north': return '⭐';
    case 'east': return '🌿';
    case 'west': return '👥';
    case 'south': return '🔧';
    default: return '🧭';
  }
}

// ============ TAG CHIP COMPONENT ============

function TagChip({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.tagChip,
        selected
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: 'transparent', borderColor: color + '60' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.tagChipText,
          { color: selected ? '#FFFFFF' : color },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============ TASK FOLLOW-UP CARD ============

function TaskFollowUpCard({
  item,
  isUntagged,
  colors,
  isDarkMode,
  roles,
  domains,
  goals,
  selectedTags,
  onToggleTag,
}: {
  item: WeeklyContractItem;
  isUntagged: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDarkMode: boolean;
  roles: RoleTag[];
  domains: DomainTag[];
  goals: GoalTag[];
  selectedTags: Map<string, { roleIds: string[]; domainIds: string[]; goalIds: string[] }>;
  onToggleTag: (taskId: string, type: 'role' | 'domain' | 'goal', id: string) => void;
}) {
  const isCompleted = !!item.completed_at;
  const tags = selectedTags.get(item.id) || { roleIds: [], domainIds: [], goalIds: [] };
  const [showTagPicker, setShowTagPicker] = useState(false);

  return (
    <View
      style={[
        styles.taskCard,
        {
          backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
          borderColor: isCompleted ? colors.success + '40' : colors.error + '40',
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.taskCardHeader}>
        <Text style={styles.taskStatusIcon}>
          {isCompleted ? '✅' : '⭕'}
        </Text>
        <Text
          style={[
            styles.taskCardTitle,
            { color: colors.text },
            isCompleted && !isUntagged && styles.taskCardTitleCompleted,
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={[styles.taskPointsBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.taskPointsText, { color: colors.primary }]}>+{item.points}</Text>
        </View>
      </View>

      {/* Existing tags */}
      {(item.roles.length > 0 || item.domains.length > 0 || item.goals.length > 0) && (
        <View style={styles.existingTagsRow}>
          {item.roles.map((r) => (
            <View key={`role-${r.id}`} style={[styles.existingTag, { backgroundColor: '#3B82F620', borderColor: '#3B82F6' }]}>
              <Text style={[styles.existingTagText, { color: '#3B82F6' }]}>{r.label}</Text>
            </View>
          ))}
          {item.domains.map((d) => (
            <View key={`domain-${d.id}`} style={[styles.existingTag, { backgroundColor: '#16A34A20', borderColor: '#16A34A' }]}>
              <Text style={[styles.existingTagText, { color: '#16A34A' }]}>{d.name}</Text>
            </View>
          ))}
          {item.goals.map((g) => (
            <View key={`goal-${g.id}`} style={[styles.existingTag, { backgroundColor: '#D9770620', borderColor: '#D97706' }]}>
              <Text style={[styles.existingTagText, { color: '#D97706' }]}>{g.title}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tag prompt for untagged completed items */}
      {isUntagged && isCompleted && (
        <>
          <TouchableOpacity
            style={[styles.tagPrompt, { borderColor: colors.primary + '40' }]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowTagPicker(!showTagPicker);
            }}
            activeOpacity={0.7}
          >
            <Tag size={14} color={colors.primary} />
            <Text style={[styles.tagPromptText, { color: colors.primary }]}>
              {showTagPicker ? 'Hide tags' : 'Tag this completion'}
            </Text>
          </TouchableOpacity>

          {showTagPicker && (
            <View style={styles.tagPickerContainer}>
              {roles.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: colors.textSecondary }]}>Roles</Text>
                  <View style={styles.tagChipsRow}>
                    {roles.map((r) => (
                      <TagChip
                        key={r.id}
                        label={r.label}
                        color="#3B82F6"
                        selected={tags.roleIds.includes(r.id)}
                        onPress={() => onToggleTag(item.id, 'role', r.id)}
                      />
                    ))}
                  </View>
                </View>
              )}
              {domains.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: colors.textSecondary }]}>Wellness</Text>
                  <View style={styles.tagChipsRow}>
                    {domains.map((d) => (
                      <TagChip
                        key={d.id}
                        label={d.name}
                        color="#16A34A"
                        selected={tags.domainIds.includes(d.id)}
                        onPress={() => onToggleTag(item.id, 'domain', d.id)}
                      />
                    ))}
                  </View>
                </View>
              )}
              {goals.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagSectionLabel, { color: colors.textSecondary }]}>Goals</Text>
                  <View style={styles.tagChipsRow}>
                    {goals.map((g) => (
                      <TagChip
                        key={g.id}
                        label={g.title}
                        color="#D97706"
                        selected={tags.goalIds.includes(g.id)}
                        onPress={() => onToggleTag(item.id, 'goal', g.id)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ============ MAIN COMPONENT ============

export default function EveningReviewV2Screen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();

  // Loading & submission state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // User
  const [userId, setUserId] = useState('');

  // Section 1: Contract follow-up
  const [followUpData, setFollowUpData] = useState<ContractFollowUpData>({
    completed: [],
    incomplete: [],
    untagged: [],
  });

  // Tagging state for untagged items
  const [selectedTags, setSelectedTags] = useState<
    Map<string, { roleIds: string[]; domainIds: string[]; goalIds: string[] }>
  >(new Map());
  const [userRoles, setUserRoles] = useState<RoleTag[]>([]);
  const [userDomains, setUserDomains] = useState<DomainTag[]>([]);
  const [userGoals, setUserGoals] = useState<GoalTag[]>([]);

  // Section 2: Combined brain dump
  const [brainDumpContent, setBrainDumpContent] = useState('');

  // Section 3: Score & close
  const [finalScore, setFinalScore] = useState(0);
  const [targetScore, setTargetScore] = useState(35);
  const [dominantCardinal, setDominantCardinal] = useState<string | null>(null);
  const [dayWord, setDayWord] = useState('');

  // Animations
  const [scaleAnim] = useState(new Animated.Value(1));
  const [completionAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    loadData();
  }, []);

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
      const today = toLocalISOString(new Date()).split('T')[0];

      // Load all data in parallel
      const [followUp, roles, domains, goals, score, cardinal, sparkData] = await Promise.all([
        getContractFollowUp(user.id, today),
        getUserRoles(user.id),
        getUserDomains(user.id),
        getUserGoals(user.id),
        calculateDailyScore(user.id, today),
        calculateDominantCardinal(user.id, today),
        supabase
          .from('0008-ap-daily-sparks')
          .select('initial_target_score')
          .eq('user_id', user.id)
          .eq('spark_date', today)
          .maybeSingle(),
      ]);

      setFollowUpData(followUp);
      setUserRoles(roles);
      setUserDomains(domains);
      setUserGoals(goals);
      setFinalScore(score);
      setDominantCardinal(cardinal);
      setTargetScore(sparkData.data?.initial_target_score || 35);
    } catch (error) {
      console.error('Error loading evening review data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleTag = useCallback(
    (taskId: string, type: 'role' | 'domain' | 'goal', id: string) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      setSelectedTags((prev) => {
        const next = new Map(prev);
        const existing = next.get(taskId) || { roleIds: [], domainIds: [], goalIds: [] };

        if (type === 'role') {
          const idx = existing.roleIds.indexOf(id);
          if (idx >= 0) {
            existing.roleIds = existing.roleIds.filter((r) => r !== id);
          } else {
            existing.roleIds = [...existing.roleIds, id];
          }
        } else if (type === 'domain') {
          const idx = existing.domainIds.indexOf(id);
          if (idx >= 0) {
            existing.domainIds = existing.domainIds.filter((d) => d !== id);
          } else {
            existing.domainIds = [...existing.domainIds, id];
          }
        } else if (type === 'goal') {
          const idx = existing.goalIds.indexOf(id);
          if (idx >= 0) {
            existing.goalIds = existing.goalIds.filter((g) => g !== id);
          } else {
            existing.goalIds = [...existing.goalIds, id];
          }
        }

        next.set(taskId, existing);
        return next;
      });
    },
    []
  );

  async function handleSubmit() {
    try {
      setSubmitting(true);
      const today = toLocalISOString(new Date()).split('T')[0];

      // 1. Save tags for any untagged completed tasks
      for (const [taskId, tags] of selectedTags.entries()) {
        if (tags.roleIds.length > 0 || tags.domainIds.length > 0 || tags.goalIds.length > 0) {
          try {
            await tagCompletedTask(
              taskId,
              tags.roleIds.length > 0 ? tags.roleIds : undefined,
              tags.domainIds.length > 0 ? tags.domainIds : undefined,
              tags.goalIds.length > 0 ? tags.goalIds : undefined
            );
          } catch (e) {
            console.error('Error tagging task:', e);
          }
        }
      }

      // 2. Save the evening review
      await saveEveningReviewV2(userId, today, brainDumpContent, dayWord || undefined);

      // 3. Success feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Recalculate score after tagging (tags may affect score)
      const updatedScore = await calculateDailyScore(userId, today);
      setFinalScore(updatedScore);

      setIsCompleted(true);

      Animated.spring(completionAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Auto redirect after 3 seconds
      setTimeout(() => {
        router.replace('/(tabs)/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error submitting evening review:', error);
      Alert.alert('Error', 'Failed to save Evening Review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ============ LOADING STATE ============

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your evening review...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ COMPLETION STATE ============

  if (isCompleted) {
    const isWin = finalScore >= targetScore;
    const scale = completionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1],
    });

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.completionContainer}>
          <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
            <CheckCircle2 size={80} color={isWin ? '#10B981' : colors.primary} />

            <Text style={[styles.completionTitle, { color: colors.text }]}>
              {isWin ? 'Another Win!' : 'Review Complete'}
            </Text>

            <View style={styles.completionScoreboard}>
              <View style={styles.scoreColumn}>
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>HOME</Text>
                <Text style={[styles.scoreValue, { color: isWin ? '#10B981' : '#EF4444' }]}>
                  {finalScore}
                </Text>
              </View>
              <Text style={[styles.scoreDash, { color: colors.textSecondary }]}>-</Text>
              <View style={styles.scoreColumn}>
                <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>GUEST</Text>
                <Text style={[styles.scoreValue, { color: colors.text }]}>{targetScore}</Text>
              </View>
            </View>

            {dominantCardinal && (
              <Text style={[styles.completionCardinal, { color: colors.textSecondary }]}>
                {getCardinalEmoji(dominantCardinal)} Dominant: {getCardinalLabel(dominantCardinal)}
              </Text>
            )}

            {isWin && (
              <View style={styles.victoryBanner}>
                <Trophy size={24} color="#10B981" />
                <Text style={styles.victoryText}>You beat your target!</Text>
              </View>
            )}

            {dayWord.trim() !== '' && (
              <Text style={[styles.completionDayWord, { color: colors.textSecondary }]}>
                Today in one word: <Text style={{ fontWeight: '700', color: colors.text }}>{dayWord}</Text>
              </Text>
            )}
          </Animated.View>

          <Text style={[styles.redirectText, { color: colors.textSecondary }]}>
            Redirecting to dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============ MAIN FORM ============

  const completedCount = followUpData.completed.length;
  const incompleteCount = followUpData.incomplete.length;
  const totalCount = completedCount + incompleteCount;
  const isWinning = finalScore >= targetScore;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Evening Review</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ====== SECTION 1: CONTRACT FOLLOW-UP ====== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Today's Contract
          </Text>

          {totalCount > 0 ? (
            <View style={[styles.summaryBar, { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB' }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNumber, { color: colors.success }]}>{completedCount}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Done</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNumber, { color: incompleteCount > 0 ? colors.error : colors.textSecondary }]}>
                  {incompleteCount}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Remaining</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB' }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No tasks were scheduled for today.
              </Text>
            </View>
          )}

          {/* Completed tasks */}
          {followUpData.completed.map((item) => {
            const isUntagged = followUpData.untagged.some((u) => u.id === item.id);
            return (
              <TaskFollowUpCard
                key={item.id}
                item={item}
                isUntagged={isUntagged}
                colors={colors}
                isDarkMode={isDarkMode}
                roles={userRoles}
                domains={userDomains}
                goals={userGoals}
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
              />
            );
          })}

          {/* Incomplete tasks */}
          {followUpData.incomplete.map((item) => (
            <TaskFollowUpCard
              key={item.id}
              item={item}
              isUntagged={false}
              colors={colors}
              isDarkMode={isDarkMode}
              roles={userRoles}
              domains={userDomains}
              goals={userGoals}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
            />
          ))}
        </View>

        {/* ====== SECTION 2: COMBINED BRAIN DUMP ====== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Brain Dump
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Wins, challenges, and anything on your mind for tomorrow
          </Text>
          <TextInput
            style={[
              styles.brainDumpInput,
              {
                backgroundColor: isDarkMode ? colors.surface : '#F9FAFB',
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="What happened today? What's on your mind for tomorrow..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            value={brainDumpContent}
            onChangeText={setBrainDumpContent}
            textAlignVertical="top"
          />
        </View>

        {/* ====== SECTION 3: SCORE & CLOSE ====== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Today's Score
          </Text>

          {/* Scoreboard */}
          <View style={[styles.scoreboard, { backgroundColor: isDarkMode ? colors.surface : '#F9FAFB' }]}>
            <View style={styles.scoreColumn}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>HOME</Text>
              <Text style={[styles.scoreValue, { color: isWinning ? '#10B981' : '#EF4444' }]}>
                {finalScore}
              </Text>
            </View>
            <Text style={[styles.scoreDash, { color: colors.textSecondary }]}>-</Text>
            <View style={styles.scoreColumn}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>GUEST</Text>
              <Text style={[styles.scoreValue, { color: colors.text }]}>{targetScore}</Text>
            </View>
          </View>

          {isWinning && (
            <View style={styles.winBanner}>
              <Trophy size={20} color="#10B981" />
              <Text style={styles.winBannerText}>You're winning!</Text>
            </View>
          )}

          {/* Dominant cardinal */}
          {dominantCardinal && (
            <View style={[styles.cardinalBadge, { backgroundColor: isDarkMode ? colors.surface : '#F3F4F6' }]}>
              <Compass size={16} color={colors.primary} />
              <Text style={[styles.cardinalBadgeText, { color: colors.textSecondary }]}>
                {getCardinalEmoji(dominantCardinal)} {getCardinalLabel(dominantCardinal)}
              </Text>
            </View>
          )}

          {/* Day word */}
          <View style={styles.dayWordContainer}>
            <Text style={[styles.dayWordLabel, { color: colors.textSecondary }]}>
              Describe today in one word (optional)
            </Text>
            <TextInput
              style={[
                styles.dayWordInput,
                {
                  backgroundColor: isDarkMode ? colors.surface : '#F9FAFB',
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g., productive, restful, challenging..."
              placeholderTextColor={colors.textSecondary}
              value={dayWord}
              onChangeText={setDayWord}
              maxLength={30}
            />
          </View>
        </View>

        {/* Submit button */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }], paddingHorizontal: 16, paddingBottom: 32 }}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }
              handleSubmit();
            }}
            disabled={submitting}
            activeOpacity={0.85}
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

// ============ STYLES ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Header
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
    fontWeight: '700',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 16,
  },

  // Empty state
  emptyCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },

  // Task cards
  taskCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskStatusIcon: {
    fontSize: 18,
  },
  taskCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  taskCardTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskPointsBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  taskPointsText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Existing tags
  existingTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginLeft: 30,
  },
  existingTag: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  existingTagText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Tag prompt
  tagPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 30,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  tagPromptText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Tag picker
  tagPickerContainer: {
    marginTop: 10,
    marginLeft: 30,
    gap: 10,
  },
  tagSection: {
    gap: 6,
  },
  tagSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Brain dump
  brainDumpInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 140,
    lineHeight: 24,
  },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 32,
    marginTop: 8,
  },
  scoreColumn: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: '800',
  },
  scoreDash: {
    fontSize: 32,
    fontWeight: '600',
  },

  // Win banner
  winBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    alignSelf: 'center',
  },
  winBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },

  // Cardinal badge
  cardinalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cardinalBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Day word
  dayWordContainer: {
    marginTop: 20,
  },
  dayWordLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  dayWordInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },

  // Submit
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  // Completion
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 24,
  },
  completionScoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginBottom: 16,
  },
  completionCardinal: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
  },
  completionDayWord: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
  },
  victoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
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
  redirectText: {
    fontSize: 14,
    marginTop: 24,
  },
});
