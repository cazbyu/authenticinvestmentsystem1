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
  getDayDateRange,
  fetchDailyAggregationData,
} from '@/lib/weeklyReflectionData';
import { DailyAggregationData } from '@/types/reflections';
import { Target, Users, Activity, AlertCircle } from 'lucide-react-native';
import { fetchReflectionsByDateRange, ReflectionWithRelations } from '@/lib/reflectionUtils';
import { formatLocalDate } from '@/lib/dateUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

interface DailyNotesViewProps {
  onReflectionPress?: (reflection: ReflectionWithRelations) => void;
}

export default function DailyNotesView({ onReflectionPress }: DailyNotesViewProps) {
  const { colors } = useTheme();
  const [dayRange, setDayRange] = useState(getDayDateRange());
  const [aggregationData, setAggregationData] = useState<DailyAggregationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [todayReflections, setTodayReflections] = useState<ReflectionWithRelations[]>([]);

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
        fetchDailyData(),
        fetchTodayReflections(),
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

  const fetchDailyData = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[DailyNotes] No user found');
      return;
    }

    const range = getDayDateRange();
    setDayRange(range);

    console.log('[DailyNotes] Fetching data for date range:', {
      start: range.start,
      end: range.end,
      dateOnly: range.start.split('T')[0],
      userId: user.id,
    });

    const data = await fetchDailyAggregationData(user.id, range.start, range.end);

    console.log('[DailyNotes] Data fetched:', {
      goalSummaries: data.goalSummaries.length,
      roleInvestments: data.roleInvestments.length,
      domainBalance: data.domainBalance.length,
      totalWithdrawals: data.totalWithdrawals,
    });

    if (data.goalSummaries.length === 0 && data.roleInvestments.length === 0) {
      console.warn('[DailyNotes] No data returned - check if tasks are completed today');
    }

    setAggregationData(data);
  };

  const fetchTodayReflections = async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = formatLocalDate(new Date());
    const reflections = await fetchReflectionsByDateRange(user.id, today, today);
    setTodayReflections(reflections);
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

  const formatCurrentDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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
        <Text style={[styles.weekTitle, { color: colors.text }]}>
          Daily Reflection - {formatCurrentDate()}
        </Text>

        {aggregationData && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Target size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Leading Indicators Review</Text>
              </View>

              {aggregationData.goalSummaries.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You completed no actions towards your goals today.
                </Text>
              ) : (
                <View style={styles.goalsList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    Today, you completed {aggregationData.goalSummaries.reduce((sum, g) => sum + g.action_count, 0)} {aggregationData.goalSummaries.reduce((sum, g) => sum + g.action_count, 0) === 1 ? 'action' : 'actions'} towards {aggregationData.goalSummaries.length} {aggregationData.goalSummaries.length === 1 ? 'goal' : 'goals'}.
                  </Text>
                  {aggregationData.goalSummaries.map(goal => (
                    <Text key={goal.goal_id} style={[styles.goalText, { color: colors.text }]}>
                      For your goal to {goal.goal_title}, you completed {goal.action_count} {goal.action_count === 1 ? 'action' : 'actions'}.
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Users size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Role Investment Summary</Text>
              </View>

              {aggregationData.roleInvestments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You invested in no roles today.
                </Text>
              ) : (
                <View style={styles.rolesList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You invested in the following roles today:
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

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <Activity size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Wellness Domain Balance</Text>
              </View>

              {aggregationData.domainBalance.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You invested in no wellness domains today.
                </Text>
              ) : (
                <View style={styles.domainsList}>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You have invested in the following domains today:
                  </Text>
                  {aggregationData.domainBalance.map(domain => (
                    <Text key={domain.domain_id} style={[styles.domainText, { color: colors.text }]}>
                      • {domain.domain_name} ({domain.activity_count} {domain.activity_count === 1 ? 'deposit' : 'deposits'})
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <AlertCircle size={24} color={aggregationData.totalWithdrawals > 0 ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Withdrawals and Lessons</Text>
              </View>

              {aggregationData.totalWithdrawals === 0 ? (
                <Text style={[styles.successText, { color: '#10b981' }]}>
                  You made no withdrawals today.
                </Text>
              ) : (
                <View>
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    You made {aggregationData.totalWithdrawals} {aggregationData.totalWithdrawals === 1 ? 'withdrawal' : 'withdrawals'} today{aggregationData.withdrawalRoles.length > 0 || aggregationData.withdrawalDomains.length > 0 ? ' in the following:' : '.'}
                  </Text>
                  {aggregationData.withdrawalRoles.length > 0 && (
                    <View>
                      <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                        Roles:
                      </Text>
                      <View style={styles.withdrawalsList}>
                        {aggregationData.withdrawalRoles.map((role, index) => (
                          <Text key={index} style={[styles.withdrawalText, { color: colors.text }]}>
                            • {role.role_label} ({role.count})
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {aggregationData.withdrawalDomains.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                        Domains:
                      </Text>
                      <View style={styles.withdrawalsList}>
                        {aggregationData.withdrawalDomains.map((domain, index) => (
                          <Text key={index} style={[styles.withdrawalText, { color: colors.text }]}>
                            • {domain.domain_name} ({domain.count})
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {todayReflections.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Today's Reflections and Notes ({todayReflections.length})
            </Text>

            <View style={styles.notesList}>
              {todayReflections.map(reflection => (
                <TouchableOpacity
                  key={reflection.id}
                  style={[styles.noteCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => onReflectionPress?.(reflection)}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteDate, { color: colors.text }]}>
                      {formatDateTime(reflection.date, reflection.created_at)}
                    </Text>
                    <View style={[styles.tagBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.tagBadgeText}>Reflection</Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.notePreview, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {truncateContent(reflection.content)}
                  </Text>
                  {reflection.notes && reflection.notes.length > 0 && (
                    <View style={styles.notesSection}>
                      <Text style={[styles.notesSectionTitle, { color: colors.text }]}>
                        Notes ({reflection.notes.length})
                      </Text>
                      {reflection.notes.slice(0, 2).map((note) => (
                        <View key={note.id} style={[styles.noteItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={styles.noteItemHeader}>
                            <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={1}>
                              {truncateContent(note.content, 60)}
                            </Text>
                            {note.parent_type && (
                              <View style={[
                                styles.noteTypeBadge,
                                {
                                  backgroundColor:
                                    note.parent_type === 'event' ? '#10b981' :
                                    note.parent_type === 'task' ? '#0078d4' :
                                    note.parent_type === 'depositIdea' ? '#8b5cf6' :
                                    note.parent_type === 'withdrawal' ? '#f59e0b' :
                                    colors.primary
                                }
                              ]}>
                                <Text style={styles.noteTypeBadgeText}>
                                  {note.parent_type === 'event' ? 'Event' :
                                   note.parent_type === 'task' ? 'Task' :
                                   note.parent_type === 'depositIdea' ? 'Deposit Idea' :
                                   note.parent_type === 'withdrawal' ? 'Withdrawal' :
                                   note.parent_type}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                      {reflection.notes.length > 2 && (
                        <Text style={[styles.moreNotesText, { color: colors.textSecondary }]}>
                          +{reflection.notes.length - 2} more {reflection.notes.length - 2 === 1 ? 'note' : 'notes'}
                        </Text>
                      )}
                    </View>
                  )}
                  {(reflection.roles && reflection.roles.length > 0) ||
                   (reflection.domains && reflection.domains.length > 0) ? (
                    <View style={styles.tagsRow}>
                      {reflection.roles?.slice(0, 3).map((role) => (
                        <View key={`role-${role.id}`} style={[styles.tagChip, { backgroundColor: colors.primaryLight || `${colors.primary}20` }]}>
                          <Text style={[styles.tagChipText, { color: colors.primary }]} numberOfLines={1}>
                            {role.label}
                          </Text>
                        </View>
                      ))}
                      {reflection.domains?.slice(0, 2).map((domain) => (
                        <View key={`domain-${domain.id}`} style={[styles.tagChip, { backgroundColor: colors.primaryLight || `${colors.primary}20` }]}>
                          <Text style={[styles.tagChipText, { color: colors.primary }]} numberOfLines={1}>
                            {domain.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
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
  notesList: {
    gap: 12,
    marginTop: 12,
  },
  noteCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#0078d4',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 14,
    fontWeight: '600',
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
  notePreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '500',
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
  noteItem: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#0078d4',
  },
  noteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  noteTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  noteTypeBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
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
