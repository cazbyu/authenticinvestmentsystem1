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
import { fetchDailyAggregationData } from '@/lib/weeklyReflectionData';
import { DailyAggregationData } from '@/types/reflections';
import { Target, Users, Activity, AlertCircle } from 'lucide-react-native';
import { fetchReflectionsByDateRange, ReflectionWithRelations } from '@/lib/reflectionUtils';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

type TimelineItemType = 'reflection' | 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'note';

interface ParentItemData {
  id: string;
  title?: string;
  completed_at?: string;
  archived?: boolean;
  is_urgent?: boolean;
  is_important?: boolean;
  type?: string;
}

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  created_at: string;
  content?: string;
  date?: string;
  parent_type?: string;
  parentItem?: ParentItemData;
  isActive?: boolean;
  priorityColor?: string;
}

interface DailyNotesViewProps {
  selectedDate?: string;
  onReflectionPress?: (reflection: ReflectionWithRelations) => void;
  onNotePress?: (item: TimelineItem) => void;
}

interface DailyRange {
  start: string;
  end: string;
  dateString: string;
}

export default function DailyNotesView({ selectedDate, onReflectionPress, onNotePress }: DailyNotesViewProps) {
  const { colors } = useTheme();
  const [aggregationData, setAggregationData] = useState<DailyAggregationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);

  const normalizeDateInput = (value: string) => value.split('T')[0];

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
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const inputDate = selectedDate || formatLocalDate(new Date());
      const normalizedTargetDate = normalizeDateInput(inputDate);
      const range = getDayDateRangeForDate(normalizedTargetDate);
      await Promise.all([
        fetchDailyData(normalizedTargetDate, range, inputDate),
        fetchTodayTimelineData(normalizedTargetDate, range),
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
  const fetchDailyData = async (targetDate: string, range: DailyRange, originalInput: string) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[DailyNotes] No user found');
      return;
    }

    console.log('[DailyNotes] Fetching data for date range:', {
      originalInput,
      normalizedTargetDate: targetDate,
      start: range.start,
      end: range.end,
      dateOnly: range.dateString,
      userId: user.id,
    });

    const data = await fetchDailyAggregationData(user.id, range.start, range.end, range.dateString);

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

  const getDayDateRangeForDate = (dateString: string): DailyRange => {
    const normalizedDate = dateString.split('T')[0];
    const parsedDate = parseLocalDate(normalizedDate);

    if (Number.isNaN(parsedDate.getTime())) {
      const fallback = new Date();
      const fallbackDateString = formatLocalDate(fallback);
      return getDayDateRangeForDate(fallbackDateString);
    }

    const year = parsedDate.getFullYear();
    const monthIndex = parsedDate.getMonth();
    const dayOfMonth = parsedDate.getDate();

    // Create a wide UTC range that safely covers the full target day
    const start = new Date(Date.UTC(year, monthIndex, dayOfMonth - 1, 10, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex, dayOfMonth + 1, 12, 0, 0));

    console.log('[DailyNotes] Date range calculation:', {
      inputDate: normalizedDate,
      startUTC: start.toISOString(),
      endUTC: end.toISOString(),
      note: 'Wide range to ensure timezone coverage',
    });

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      dateString: formatLocalDate(parsedDate),
    };
  };

  const fetchTodayTimelineData = async (targetDateString: string, range: DailyRange) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const normalizedDate = targetDateString.split('T')[0];

    const reflections = await fetchReflectionsByDateRange(user.id, normalizedDate, normalizedDate);

    const todayStart = new Date(range.start);
    const todayEnd = new Date(range.end);

    console.log('[DailyNotes] Fetching notes for date:', {
      targetDate: normalizedDate,
      utcRangeStart: todayStart.toISOString(),
      utcRangeEnd: todayEnd.toISOString(),
    });

    const { data: notesData, error: notesError } = await supabase
      .from('0008-ap-universal-notes-join')
      .select(`
        parent_id,
        parent_type,
        note:0008-ap-notes(
          id,
          content,
          created_at
        )
      `)
      .eq('user_id', user.id);

    // Filter notes by the created_at timestamp from the notes table
    // Use a wide range to ensure we don't miss notes due to timezone differences
    const filteredNotesData = notesData?.filter((item: any) => {
      if (!item.note || !item.note.created_at) return false;
      const noteDate = new Date(item.note.created_at);
      return noteDate >= todayStart && noteDate <= todayEnd;
    });

    if (notesError) {
      console.error('Error fetching today notes:', notesError);
    }

    // Get unique parent IDs by type
    const taskParentIds = filteredNotesData?.filter((n: any) => n.parent_type === 'task').map((n: any) => n.parent_id) || [];
    const depositIdeaIds = filteredNotesData?.filter((n: any) => n.parent_type === 'depositIdea').map((n: any) => n.parent_id) || [];
    const withdrawalIds = filteredNotesData?.filter((n: any) => n.parent_type === 'withdrawal').map((n: any) => n.parent_id) || [];

    // Fetch parent item data
    const parentItemsMap = new Map<string, ParentItemData>();

    if (taskParentIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('0008-ap-tasks')
        .select('id, title, completed_at, is_urgent, is_important, type')
        .in('id', taskParentIds);
      tasksData?.forEach((task: any) => {
        parentItemsMap.set(task.id, task);
      });
    }

    if (depositIdeaIds.length > 0) {
      const { data: depositIdeasData } = await supabase
        .from('0008-ap-deposit-ideas')
        .select('id, title, archived')
        .in('id', depositIdeaIds);
      depositIdeasData?.forEach((di: any) => {
        parentItemsMap.set(di.id, di);
      });
    }

    if (withdrawalIds.length > 0) {
      const { data: withdrawalsData } = await supabase
        .from('0008-ap-withdrawals')
        .select('id, title')
        .in('id', withdrawalIds);
      withdrawalsData?.forEach((w: any) => {
        parentItemsMap.set(w.id, { ...w, completed_at: new Date().toISOString() });
      });
    }

    // Transform reflections to timeline items
    const reflectionItems: TimelineItem[] = reflections.map(r => ({
      id: r.id,
      type: 'reflection' as TimelineItemType,
      created_at: r.created_at,
      content: r.content,
      date: r.date,
    }));

    // Transform notes to timeline items with parent item data
    const noteItems: TimelineItem[] = filteredNotesData
      ? filteredNotesData
          .filter((item: any) => item.note && item.note.id)
          .map((item: any) => {
            const parentItem = parentItemsMap.get(item.parent_id);
            let type = item.parent_type || 'note';

            // If parent is a task, determine if it's task or event
            if (item.parent_type === 'task' && parentItem?.type) {
              type = parentItem.type;
            }

            // Determine if item is active
            let isActive = false;
            let priorityColor = undefined;

            if (parentItem) {
              if (item.parent_type === 'task') {
                isActive = !parentItem.completed_at;
                if (isActive) {
                  // Calculate priority color
                  if (parentItem.is_urgent && parentItem.is_important) {
                    priorityColor = '#ef4444';
                  } else if (!parentItem.is_urgent && parentItem.is_important) {
                    priorityColor = '#10b981';
                  } else if (parentItem.is_urgent && !parentItem.is_important) {
                    priorityColor = '#f59e0b';
                  } else {
                    priorityColor = '#6b7280';
                  }
                }
              } else if (item.parent_type === 'depositIdea') {
                isActive = !parentItem.archived;
                if (isActive) priorityColor = '#8b5cf6';
              }
            }

            return {
              id: item.note.id,
              type: type as TimelineItemType,
              content: item.note.content,
              created_at: item.note.created_at,
              parent_type: item.parent_type,
              parentItem,
              isActive,
              priorityColor,
            };
          })
      : [];

    // Merge and sort by created_at
    const combined = [...reflectionItems, ...noteItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setTimelineItems(combined);
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

  const getItemTypeBadgeColor = (type: TimelineItemType) => {
    switch (type) {
      case 'event':
        return '#10b981';
      case 'task':
        return '#0078d4';
      case 'depositIdea':
        return '#8b5cf6';
      case 'withdrawal':
        return '#f59e0b';
      case 'reflection':
        return colors.primary;
      default:
        return colors.primary;
    }
  };

  const getItemTypeLabel = (type: TimelineItemType) => {
    switch (type) {
      case 'event':
        return 'Event';
      case 'task':
        return 'Task';
      case 'depositIdea':
        return 'Deposit Idea';
      case 'withdrawal':
        return 'Withdrawal';
      case 'reflection':
        return 'Reflection';
      default:
        return 'Note';
    }
  };

  const formatCurrentDate = () => {
    const dateToFormat = selectedDate ? parseLocalDate(selectedDate) : new Date();

    if (Number.isNaN(dateToFormat.getTime())) {
      return selectedDate || new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }

    return dateToFormat.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
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

        {timelineItems.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Today's Reflections and Notes ({timelineItems.length})
            </Text>

            <View style={styles.notesList}>
              {timelineItems.map(item => (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={[
                    styles.noteCard,
                    {
                      backgroundColor: item.isActive ? '#f3f4f6' : colors.background,
                      borderColor: item.isActive && item.priorityColor ? item.priorityColor : colors.border,
                      borderLeftColor: item.isActive && item.priorityColor ? item.priorityColor : getItemTypeBadgeColor(item.type),
                      borderLeftWidth: 3,
                      borderWidth: item.isActive ? 2 : 1,
                    },
                  ]}
                  onPress={() => onNotePress?.(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteDate, { color: colors.text }]}>
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                    <View style={[styles.tagBadge, { backgroundColor: getItemTypeBadgeColor(item.type) }]}>
                      <Text style={styles.tagBadgeText}>{getItemTypeLabel(item.type)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.notePreview, { color: colors.textSecondary }]} numberOfLines={3}>
                    {truncateContent(item.content || '')}
                  </Text>
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
