import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchDailyAggregationData } from '@/lib/weeklyReflectionData';
import { DailyAggregationData } from '@/types/reflections';
import { Target, Users, Activity, CircleAlert as AlertCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  fetchReflectionsByDateRange,
  ReflectionWithRelations,
  ReflectionAttachment,
  fetchAttachmentsForReflections,
} from '@/lib/reflectionUtils';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { fetchAttachmentsForNotes, NoteAttachment } from '@/lib/noteAttachmentUtils';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';
import ImageViewerModal, { ImageAttachment } from './ImageViewerModal';

type TimelineItemType = 'reflection' | 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'note';

interface ParentItemData {
  id: string;
  title?: string;
  completed_at?: string;
  archived?: boolean;
  is_urgent?: boolean;
  is_important?: boolean;
  type?: string;
  is_active?: boolean;
}

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  created_at: string;
  content?: string;
  date?: string;
  parent_type?: string;
  title?: string;
  attachments?: ReflectionAttachment[];
  noteAttachments?: NoteAttachment[];
  parentItem?: ParentItemData;
  isActive?: boolean;
  priorityColor?: string;
}

interface DailyHistoryItemRow {
  item_type: TimelineItemType;
  parent_id: string;
  item_title: string | null;
  item_content: string | null;
  item_created_at: string;
  note_id: string | null;
  parent_task_type: string | null;
  parent_completed_at: string | null;
  parent_is_urgent: boolean | null;
  parent_is_important: boolean | null;
  parent_archived: boolean | null;
  parent_is_active: boolean | null;
  parent_withdrawn_at: string | null;
  notes_count: number | null;
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

// DailyNotesView renders "Today's Reflections and Notes". Reflections arrive via
// fetchReflectionsByDateRange (Supabase table 0008-ap-reflections + reflection RPCs)
// and note timeline items come from fetchTodayTimelineData which reads
// 0008-ap-universal-notes-join alongside parent tables for the selected day.
export default function DailyNotesView({ selectedDate, onReflectionPress, onNotePress }: DailyNotesViewProps) {
  const { colors } = useTheme();
  const [aggregationData, setAggregationData] = useState<DailyAggregationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ImageAttachment[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [expandedSections, setExpandedSections] = useState({
    leadingIndicators: true,
    roleInvestment: true,
    domainBalance: true,
    lessons: true,
  });

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

      console.log('[DailyNotes] loadData called:', {
        selectedDate,
        inputDate,
        normalizedTargetDate,
        range,
      });

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

  const fetchTodayTimelineData = async (targetDateString: string, _range: DailyRange) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const normalizedDate = targetDateString.split('T')[0];

    console.log('[DailyNotes] fetchTodayTimelineData called:', {
      targetDateString,
      normalizedDate,
      userId: user.id,
    });

    const reflections = await fetchReflectionsByDateRange(user.id, normalizedDate, normalizedDate);
    const reflectionIds = reflections.map((r) => r.id);
    const reflectionAttachmentsMap = reflectionIds.length > 0
      ? await fetchAttachmentsForReflections(reflectionIds)
      : new Map<string, ReflectionAttachment[]>();

    console.log('[DailyNotes] Reflections fetched:', {
      count: reflections.length,
      reflections: reflections.map(r => ({ id: r.id, title: r.reflection_title, content: r.content?.substring(0, 50) })),
    });

    const { data: historyData, error: historyError } = await supabase.rpc('get_daily_history_items', {
      p_target_date: normalizedDate,
      p_user_id: user.id,
    });

    if (historyError) {
      console.error('Error fetching daily history items:', historyError);
      return;
    }

    console.log('[DailyNotes] History items fetched:', {
      count: historyData?.length || 0,
      items: historyData?.map((item: any) => ({
        type: item.item_type,
        title: item.item_title,
        content: item.item_content?.substring(0, 30),
      })),
    });

    const historyItems: DailyHistoryItemRow[] = (historyData || []) as DailyHistoryItemRow[];
    const noteBackedItems = historyItems.filter((item) => item.item_type !== 'reflection');

    const noteIds = noteBackedItems
      .map((item) => item.note_id)
      .filter((noteId): noteId is string => Boolean(noteId));

    const noteAttachmentsMap = noteIds.length > 0
      ? await fetchAttachmentsForNotes(noteIds)
      : new Map<string, NoteAttachment[]>();

    const reflectionItems: TimelineItem[] = reflections.map((r) => ({
      id: r.id,
      type: 'reflection' as TimelineItemType,
      created_at: r.created_at,
      content: r.content,
      date: r.date,
      title: r.reflection_title?.trim() || 'Reflection',
      attachments: reflectionAttachmentsMap.get(r.id) || [],
    }));

    const noteItems: TimelineItem[] = noteBackedItems.map((item) => {
      const resolvedType: TimelineItemType = item.item_type === 'event'
        ? 'event'
        : (item.item_type as TimelineItemType);

      const parentItem: ParentItemData = {
        id: item.parent_id,
        title: item.item_title ?? undefined,
        completed_at: item.parent_completed_at ?? undefined,
        archived: item.parent_archived ?? undefined,
        is_urgent: item.parent_is_urgent ?? undefined,
        is_important: item.parent_is_important ?? undefined,
        type: item.parent_task_type ?? resolvedType,
        is_active: item.parent_is_active ?? undefined,
      };

      let isActive = false;
      let priorityColor: string | undefined;

      if (resolvedType === 'task' || resolvedType === 'event') {
        isActive = !item.parent_completed_at;
        if (isActive) {
          if (item.parent_is_urgent && item.parent_is_important) {
            priorityColor = '#ef4444';
          } else if (!item.parent_is_urgent && item.parent_is_important) {
            priorityColor = '#10b981';
          } else if (item.parent_is_urgent && !item.parent_is_important) {
            priorityColor = '#f59e0b';
          } else {
            priorityColor = '#6b7280';
          }
        }
      } else if (item.item_type === 'depositIdea') {
        isActive = item.parent_is_active ?? false;
        if (isActive) {
          priorityColor = '#8b5cf6';
        }
      }

      return {
        id: item.note_id || `${item.item_type}-${item.parent_id}`,
        type: resolvedType,
        content: item.item_content || undefined,
        created_at: item.item_created_at,
        parent_type: resolvedType === 'event' ? 'task' : item.item_type,
        title: item.item_title || getItemTypeLabel(resolvedType),
        noteAttachments: item.note_id ? (noteAttachmentsMap.get(item.note_id) || []) : [],
        parentItem,
        isActive,
        priorityColor,
      };
    });

    const combined = [...reflectionItems, ...noteItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    console.log('[DailyNotes] Combined timeline items:', {
      reflectionItemsCount: reflectionItems.length,
      noteItemsCount: noteItems.length,
      combinedCount: combined.length,
      items: combined.map(item => ({
        type: item.type,
        title: item.title,
        hasContent: !!item.content,
        hasAttachments: (item.attachments?.length || 0) + (item.noteAttachments?.length || 0),
      })),
    });

    setTimelineItems(combined);
  };



  const formatDateTime = (createdAt: string) => {
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
      case 'note':
        return '#9333ea'; // purple-600
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
      case 'note':
        return 'Note';
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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
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
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggleSection('leadingIndicators')}
                  activeOpacity={0.7}
                >
                  <Target size={24} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Leading Indicators Review</Text>
                  {expandedSections.leadingIndicators ? (
                    <ChevronUp size={20} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {expandedSections.leadingIndicators && (
                  <>
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
                  </>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggleSection('roleInvestment')}
                  activeOpacity={0.7}
                >
                  <Users size={24} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Role Investment Summary</Text>
                  {expandedSections.roleInvestment ? (
                    <ChevronUp size={20} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {expandedSections.roleInvestment && (
                  <>
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
                  </>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggleSection('domainBalance')}
                  activeOpacity={0.7}
                >
                  <Activity size={24} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Wellness Domain Balance</Text>
                  {expandedSections.domainBalance ? (
                    <ChevronUp size={20} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {expandedSections.domainBalance && (
                  <>
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
                  </>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => toggleSection('lessons')}
                  activeOpacity={0.7}
                >
                  <AlertCircle size={24} color={aggregationData.totalWithdrawals > 0 ? '#f59e0b' : '#10b981'} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Lessons</Text>
                  {expandedSections.lessons ? (
                    <ChevronUp size={20} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {expandedSections.lessons && (
                  <>
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
                            <Text style={[styles.warningText, { color: '#f59e0b' }]}>Roles:</Text>
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
                            <Text style={[styles.warningText, { color: '#f59e0b' }]}>Domains:</Text>
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
                  </>
                )}
              </View>
            </>
          )}

        {timelineItems.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Today's Reflections and Notes ({timelineItems.length})
            </Text>

            <View style={styles.notesList}>
              {timelineItems.map((item) => {
                const reflectionAttachments = item.attachments || [];
                const noteAttachments = item.noteAttachments || [];
                const allAttachments = [...reflectionAttachments, ...noteAttachments];
                const imageAttachments = allAttachments
                  .filter((attachment) => attachment.file_type?.startsWith('image/')) as ImageAttachment[];
                const documentAttachments = allAttachments.filter(
                  (attachment) => attachment.file_type && !attachment.file_type.startsWith('image/')
                );
                const displayTitle = item.title || getItemTypeLabel(item.type);
                const timestamp = formatDateTime(item.created_at);

                return (
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
                      <View style={styles.noteTitleContainer}>
                        <Text style={[styles.noteTitle, { color: colors.text }]}>{displayTitle}</Text>
                        <Text style={[styles.noteTimestamp, { color: colors.textSecondary }]}>{timestamp}</Text>
                      </View>
                      <View style={[styles.tagBadge, { backgroundColor: getItemTypeBadgeColor(item.type) }]}>
                        <Text style={styles.tagBadgeText}>{getItemTypeLabel(item.type)}</Text>
                      </View>
                    </View>

                    {item.content ? (
                      <Text style={[styles.noteContent, { color: colors.text }]}>{item.content}</Text>
                    ) : null}

                    {imageAttachments.length > 0 && (
                      <View style={styles.imagePreviewContainer}>
                        {imageAttachments.slice(0, 3).map((attachment, index) => (
                          <TouchableOpacity
                            key={attachment.id}
                            onPress={() => {
                              setSelectedImages(imageAttachments);
                              setSelectedImageIndex(index);
                              setImageViewerVisible(true);
                            }}
                            style={styles.imageThumbnail}
                          >
                            <Image
                              source={{ uri: attachment.public_url }}
                              style={styles.thumbnailImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ))}
                        {imageAttachments.length > 3 && (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedImages(imageAttachments);
                              setSelectedImageIndex(3);
                              setImageViewerVisible(true);
                            }}
                            style={[styles.imageThumbnail, styles.moreImagesThumbnail]}
                          >
                            <View style={styles.moreImagesOverlay}>
                              <Text style={styles.moreImagesText}>+{imageAttachments.length - 3}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {documentAttachments.length > 0 && (
                      <View style={styles.documentAttachmentsContainer}>
                        {documentAttachments.slice(0, 3).map((attachment) => (
                          <TouchableOpacity
                            key={attachment.id}
                            onPress={() => {
                              if (attachment.public_url) {
                                Linking.openURL(attachment.public_url);
                              }
                            }}
                            style={styles.documentAttachmentItem}
                          >
                            <AttachmentThumbnail
                              uri={attachment.public_url || ''}
                              fileType={attachment.file_type}
                              fileName={attachment.file_name}
                              size="small"
                            />
                            <Text style={[styles.documentFileName, { color: colors.text }]} numberOfLines={1}>
                              {attachment.file_name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Today's Reflections and Notes
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No reflections or notes recorded for this date.
            </Text>
          </View>
        )}
        </View>

      </ScrollView>

      <ImageViewerModal
        visible={imageViewerVisible}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </>
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
  noteTitleContainer: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  noteTimestamp: {
    fontSize: 13,
    fontStyle: 'italic',
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
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesThumbnail: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  documentAttachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  documentAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    maxWidth: '100%',
  },
  documentFileName: {
    fontSize: 12,
    flex: 1,
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
