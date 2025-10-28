import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getWeekDateRange,
  fetchWeeklyAggregationData,
  fetchGoalActionsSummary,
} from '@/lib/weeklyReflectionData';
import { WeeklyAggregationData, GoalActionSummary } from '@/types/reflections';
import { Target, Users, Activity, CircleAlert as AlertCircle } from 'lucide-react-native';
import { fetchReflectionsByDateRange, ReflectionWithRelations, calculateWeekRange } from '@/lib/reflectionUtils';
import { formatLocalDate } from '@/lib/dateUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

export default function WeeklyReflectionView() {
  const { colors } = useTheme();
  const [weekRange, setWeekRange] = useState(getWeekDateRange());
  const [aggregationData, setAggregationData] = useState<WeeklyAggregationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [goalSummaries, setGoalSummaries] = useState<GoalActionSummary[]>([]);
  const [weekReflections, setWeekReflections] = useState<ReflectionWithRelations[]>([]);

  useEffect(() => {
    loadData();

    const handleReflectionChange = () => {
      loadData();
    };

    eventBus.on(EVENTS.REFLECTION_CREATED, handleReflectionChange);
    eventBus.on(EVENTS.REFLECTION_UPDATED, handleReflectionChange);
    eventBus.on(EVENTS.REFLECTION_DELETED, handleReflectionChange);

    return () => {
      eventBus.off(EVENTS.REFLECTION_CREATED, handleReflectionChange);
      eventBus.off(EVENTS.REFLECTION_UPDATED, handleReflectionChange);
      eventBus.off(EVENTS.REFLECTION_DELETED, handleReflectionChange);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWeeklyData(),
        fetchWeekReflections(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchWeeklyData = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[WeeklyReflection] No user found');
      return;
    }

    console.log('[WeeklyReflection] Fetching data for date range:', {
      start: weekRange.start,
      end: weekRange.end,
      startDateOnly: weekRange.start.split('T')[0],
      endDateOnly: weekRange.end.split('T')[0],
      userId: user.id,
    });

    const [data, summaries] = await Promise.all([
      fetchWeeklyAggregationData(user.id, weekRange.start, weekRange.end),
      fetchGoalActionsSummary(user.id, weekRange.start, weekRange.end),
    ]);

    console.log('[WeeklyReflection] Data fetched:', {
      goalProgress: data.goalProgress.length,
      roleInvestments: data.roleInvestments.length,
      domainBalance: data.domainBalance.length,
      withdrawalAnalysis: data.withdrawalAnalysis.length,
      goalSummaries: summaries.length,
    });

    if (summaries.length === 0 && data.roleInvestments.length === 0) {
      console.warn('[WeeklyReflection] No data returned - check if tasks are completed within the date range');
    }

    setAggregationData(data);
    setGoalSummaries(summaries);
  };

  const fetchWeekReflections = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prefsData } = await supabase
      .from('0008-ap-users')
      .select('week_start_day')
      .eq('user_id', user.id)
      .maybeSingle();

    const weekStartDay = prefsData?.week_start_day || 'sunday';
    const { weekStart, weekEnd } = calculateWeekRange(new Date(), weekStartDay);

    const reflections = await fetchReflectionsByDateRange(user.id, weekStart, weekEnd);
    setWeekReflections(reflections);
  };



  const formatWeekRange = () => {
    const start = new Date(weekRange.start);
    const end = new Date(weekRange.end);

    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const formatDateTime = (dateString: string, createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.content}>
        {/* Week Title */}
        <Text style={[styles.weekTitle, { color: colors.text }]}>
          Weekly Reflection - {formatWeekRange()}
        </Text>

        {/* Leading Indicators */}
        {aggregationData && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Target size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Leading Indicators Review</Text>
              </View>

              {goalSummaries.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You completed no actions towards your goals this week.
                </Text>
              ) : (
                <View style={styles.goalsList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    This week, you completed {goalSummaries.reduce((sum, g) => sum + g.action_count, 0)} {goalSummaries.reduce((sum, g) => sum + g.action_count, 0) === 1 ? 'action' : 'actions'} towards {goalSummaries.length} {goalSummaries.length === 1 ? 'goal' : 'goals'}.
                  </Text>
                  {goalSummaries.map(goal => (
                    <Text key={goal.goal_id} style={[styles.goalText, { color: colors.text }]}>
                      For your goal to {goal.goal_title}, you completed {goal.action_count} {goal.action_count === 1 ? 'action' : 'actions'}.
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Role Investment */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Users size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Role Investment Summary</Text>
              </View>

              {aggregationData.roleInvestments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You invested in no roles this week.
                </Text>
              ) : (
                <View style={styles.rolesList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You invested in the following roles this week:
                  </Text>
                  {aggregationData.roleInvestments.map(role => {
                    const totalDeposits = role.task_count + role.deposit_idea_count;
                    return (
                      <Text key={role.role_id} style={[styles.roleText, { color: colors.text }]}>
                        • {role.role_label} ({totalDeposits} {totalDeposits === 1 ? 'deposit' : 'deposits'})
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Domain Balance */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Activity size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Wellness Domain Balance</Text>
              </View>

              {aggregationData.domainBalance.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You invested in no wellness domains this week.
                </Text>
              ) : (
                <View style={styles.domainsList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You have invested in the following domains this week:
                  </Text>
                  {aggregationData.domainBalance.map(domain => (
                    <Text key={domain.domain_id} style={[styles.domainText, { color: colors.text }]}>
                      • {domain.domain_name} ({domain.activity_count} {domain.activity_count === 1 ? 'deposit' : 'deposits'})
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Withdrawals */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <AlertCircle size={24} color={aggregationData.withdrawalAnalysis.length > 0 ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Withdrawals and Lessons</Text>
              </View>

              {aggregationData.withdrawalAnalysis.length === 0 ? (
                <Text style={[styles.successText, { color: '#10b981' }]}>
                  You made no withdrawals this week.
                </Text>
              ) : (
                <View>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You made {aggregationData.withdrawalAnalysis.reduce((sum, w) => sum + w.withdrawal_count, 0)} {aggregationData.withdrawalAnalysis.reduce((sum, w) => sum + w.withdrawal_count, 0) === 1 ? 'withdrawal' : 'withdrawals'} this week in the following roles:
                  </Text>
                  <View style={styles.withdrawalsList}>
                    {aggregationData.withdrawalAnalysis.map(withdrawal => (
                      <Text key={withdrawal.role_id} style={[styles.withdrawalText, { color: colors.text }]}>
                        • {withdrawal.role_label} ({withdrawal.withdrawal_count})
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* Week Reflections */}
        {weekReflections.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>This Week's Reflections and Notes</Text>

            <View style={styles.previousList}>
              {weekReflections.map(reflection => (
                <TouchableOpacity
                  key={reflection.id}
                  style={[styles.previousCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <View style={styles.reflectionHeader}>
                    <Text style={[styles.previousWeek, { color: colors.text }]}>
                      {formatDateTime(reflection.date, reflection.created_at)}
                    </Text>
                    <View style={[styles.tagBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.tagBadgeText}>Reflection</Text>
                    </View>
                  </View>
                  <Text style={[styles.previousPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                    {truncateContent(reflection.content)}
                  </Text>
                  {reflection.notes && reflection.notes.length > 0 && (
                    <View style={styles.notesSection}>
                      <Text style={[styles.notesSectionTitle, { color: colors.text }]}>
                        Notes ({reflection.notes.length})
                      </Text>
                      {reflection.notes.slice(0, 2).map((note) => (
                        <View key={note.id} style={[styles.notePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {truncateContent(note.content, 60)}
                          </Text>
                        </View>
                      ))}
                      {reflection.notes.length > 2 && (
                        <Text style={[styles.moreNotesText, { color: colors.textSecondary }]}>
                          +{reflection.notes.length - 2} more {reflection.notes.length - 2 === 1 ? 'note' : 'notes'}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  goalsList: {
    gap: 12,
  },
  goalItem: {
    gap: 6,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  goalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalStats: {
    fontSize: 12,
    minWidth: 50,
  },
  rolesList: {
    gap: 12,
  },
  roleItem: {
    gap: 4,
  },
  roleText: {
    fontSize: 14,
  },
  depositText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  domainsList: {
    gap: 8,
  },
  domainItem: {},
  domainText: {
    fontSize: 14,
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  withdrawalsList: {
    gap: 6,
    marginTop: 8,
  },
  withdrawalText: {
    fontSize: 14,
  },
  questionsContainer: {
    gap: 24,
  },
  questionField: {
    gap: 8,
  },
  questionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  checkboxItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previousList: {
    gap: 12,
    marginTop: 12,
  },
  previousCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  previousWeek: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  previousPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  reflectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  notesSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  notesSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  notePreview: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#0078d4',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
  },
  moreNotesText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
});
