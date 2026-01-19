import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { CheckSquare, Calendar, Check, UserCircle, Trash2, Circle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';
import { ActFilter } from './ActFilterButtons';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { formatLocalDate, toLocalISOString } from '@/lib/dateUtils';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface ActionItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  due_date: string | null;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_urgent: boolean;
  is_important: boolean;
  is_deposit_idea: boolean;
  depositValue: number;
  isOverdue?: boolean;
  originalDate?: string;
  roles?: any[];
  domains?: any[];
  delegateName?: string | null;
  isCompleted?: boolean;
}

interface DateSection {
  title: string;
  data: ActionItem[];
}

interface ActionsTableViewProps {
  filter: ActFilter;
  period: TimePeriod;
  userId: string;
  onRefresh?: () => void;
  onTaskPress?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onDelegate?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const past = new Date('1900-01-01');

  switch (period) {
    case 'today':
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return { start: past, end: todayEnd };

    case 'week':
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: past, end: weekEnd };

    case 'month':
      const monthEnd = new Date(now);
      monthEnd.setDate(now.getDate() + 27);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: past, end: monthEnd };

    case 'all':
      const allEnd = new Date('2099-12-31');
      allEnd.setHours(23, 59, 59, 999);
      return { start: past, end: allEnd };
  }
}

// Swipeable Row Component
interface SwipeableRowProps {
  action: ActionItem;
  onComplete: () => void;
  onDelegate: () => void;
  onDelete: () => void;
  onPress: () => void;
  children: React.ReactNode;
}

function SwipeableRow({ action, onComplete, onDelegate, onDelete, onPress, children }: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const SWIPE_THRESHOLD = -80;
  const ACTION_WIDTH = 70;

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow left swipe (negative translation)
      if (event.translationX < 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX < SWIPE_THRESHOLD) {
        // Reveal actions
        translateX.value = withTiming(-ACTION_WIDTH * 2);
        runOnJS(setIsRevealed)(true);
      } else {
        // Hide actions
        translateX.value = withTiming(0);
        runOnJS(setIsRevealed)(false);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const closeSwipe = () => {
    translateX.value = withTiming(0);
    setIsRevealed(false);
  };

  return (
    <View style={styles.swipeContainer}>
      {/* Hidden Action Buttons */}
      <View style={styles.hiddenActionsContainer}>
        <TouchableOpacity
          style={[styles.hiddenActionButton, styles.delegateButton]}
          onPress={() => {
            closeSwipe();
            onDelegate();
          }}
        >
          <UserCircle size={20} color="#fff" strokeWidth={2} />
          <Text style={styles.hiddenActionText}>Delegate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.hiddenActionButton, styles.deleteButton]}
          onPress={() => {
            closeSwipe();
            onDelete();
          }}
        >
          <Trash2 size={20} color="#fff" strokeWidth={2} />
          <Text style={styles.hiddenActionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function ActionsTableView({
  filter,
  period,
  userId,
  onRefresh,
  onTaskPress,
  onComplete,
  onDelegate,
  onDelete,
}: ActionsTableViewProps) {
  const { colors } = useTheme();
  const [sections, setSections] = useState<DateSection[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    isInitialLoad.current = true;
    loadActions();
  }, [filter, period, userId]);

  useEffect(() => {
    const handleRefresh = () => {
      loadActions(true);
    };

    eventBus.on(EVENTS.TASK_UPDATED, handleRefresh);
    eventBus.on(EVENTS.TASK_DELETED, handleRefresh);
    eventBus.on(EVENTS.TASK_CREATED, handleRefresh);
    eventBus.on(EVENTS.REFRESH_ALL_TASKS, handleRefresh);

    return () => {
      eventBus.off(EVENTS.TASK_UPDATED, handleRefresh);
      eventBus.off(EVENTS.TASK_DELETED, handleRefresh);
      eventBus.off(EVENTS.TASK_CREATED, handleRefresh);
      eventBus.off(EVENTS.REFRESH_ALL_TASKS, handleRefresh);
    };
  }, []);

  const loadActions = async (silent = false) => {
    if (!userId) {
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    try {
      if (!silent && isInitialLoad.current) {
        setLoading(true);
      }
      const supabase = getSupabaseClient();
      const { start, end } = getDateRange(period);
      const startStr = formatLocalDate(start);
      const endStr = formatLocalDate(end);

      const todayStr = formatLocalDate(new Date());

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartISO = toLocalISOString(todayStart);

      let tasksData: any[] = [];

      if (filter === 'task') {
        let query = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'task')
          .is('deleted_at', null)
          .is('parent_task_id', null);

        if (period === 'today') {
          query = query.lte('due_date', endStr);
        } else {
          query = query.lte('due_date', endStr);
        }

        query = query.or(`status.in.(pending,in_progress),and(status.eq.completed,completed_at.gte.${todayStartISO})`);

        const { data, error } = await query.order('due_date', { ascending: true });
        if (error) throw error;
        tasksData = data || [];
      } else if (filter === 'event') {
        let query = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'event')
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .gte('start_date', todayStr);

        if (period !== 'all') {
          query = query.lte('start_date', endStr);
        }

        query = query.or(`status.in.(pending,in_progress),and(status.eq.completed,completed_at.gte.${todayStartISO})`);

        const { data, error } = await query.order('start_date', { ascending: true });
        if (error) throw error;
        tasksData = data || [];
      } else {
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'task')
          .is('deleted_at', null)
          .is('parent_task_id', null);

        let eventsQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'event')
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .gte('start_date', todayStr);

        if (period !== 'all') {
          tasksQuery = tasksQuery.lte('due_date', endStr);
          eventsQuery = eventsQuery.lte('start_date', endStr);
        }

        tasksQuery = tasksQuery.or(`status.in.(pending,in_progress),and(status.eq.completed,completed_at.gte.${todayStartISO})`);
        eventsQuery = eventsQuery.or(`status.in.(pending,in_progress),and(status.eq.completed,completed_at.gte.${todayStartISO})`);

        const [tasksResult, eventsResult] = await Promise.all([
          tasksQuery.order('due_date', { ascending: true }),
          eventsQuery.order('start_date', { ascending: true }),
        ]);

        if (tasksResult.error) throw tasksResult.error;
        if (eventsResult.error) throw eventsResult.error;

        tasksData = [
          ...(tasksResult.data || []),
          ...(eventsResult.data || []),
        ];
      }

      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map((t) => t.id);

        const [rolesRes, domainsRes, goalsRes, delegatesRes] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id, role:0008-ap-roles(id, label)')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id, domain:0008-ap-domains(id, name)')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-goals-join')
            .select(
              'parent_id, goal_type, tw:0008-ap-goals-12wk(id, title, status), cg:0008-ap-goals-custom(id, title, status)'
            )
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-delegates-join')
            .select('parent_id, delegate:0008-ap-delegates(id, name)')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
        ]);

        const rolesByTask = new Map<string, any[]>();
        (rolesRes.data || []).forEach((r: any) => {
          if (!rolesByTask.has(r.parent_id)) rolesByTask.set(r.parent_id, []);
          rolesByTask.get(r.parent_id)!.push(r.role);
        });

        const domainsByTask = new Map<string, any[]>();
        (domainsRes.data || []).forEach((d: any) => {
          if (!domainsByTask.has(d.parent_id)) domainsByTask.set(d.parent_id, []);
          domainsByTask.get(d.parent_id)!.push(d.domain);
        });

        const goalsByTask = new Map<string, any[]>();
        (goalsRes.data || []).forEach((g: any) => {
          if (!goalsByTask.has(g.parent_id)) goalsByTask.set(g.parent_id, []);
          const goal = g.goal_type === 'twelve_wk_goal' ? g.tw : g.cg;
          if (goal && goal.status !== 'archived' && goal.status !== 'cancelled') {
            goalsByTask.get(g.parent_id)!.push(goal);
          }
        });

        const delegatesByTask = new Map<string, string>();
        (delegatesRes.data || []).forEach((d: any) => {
          if (d.delegate?.name) {
            const firstName = d.delegate.name.split(' ')[0];
            delegatesByTask.set(d.parent_id, firstName);
          }
        });

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const todayStr = formatLocalDate(now);

        const actionsWithScores: ActionItem[] = tasksData.map((task) => {
          const roles = rolesByTask.get(task.id) || [];
          const domains = domainsByTask.get(task.id) || [];
          const goals = goalsByTask.get(task.id) || [];
          const score = calculateTaskPoints(task, roles, domains, goals);

          const displayDate = task.type === 'event' ? task.start_date : task.due_date;
          const isOverdue = displayDate && displayDate < todayStr;

          return {
            id: task.id,
            title: task.title,
            type: task.type,
            due_date: task.due_date,
            start_date: task.start_date,
            start_time: task.start_time,
            end_time: task.end_time,
            is_urgent: task.is_urgent,
            is_important: task.is_important,
            is_deposit_idea: task.is_deposit_idea || false,
            depositValue: score,
            isOverdue,
            originalDate: isOverdue ? displayDate : undefined,
            roles: roles,
            domains: domains,
            delegateName: delegatesByTask.get(task.id) || null,
            isCompleted: task.status === 'completed',
          };
        });

        const grouped = new Map<string, ActionItem[]>();

        actionsWithScores.forEach((action) => {
          let displayDate = action.type === 'event' ? action.start_date : action.due_date;

          if (!displayDate) {
            displayDate = 'No Date';
          } else if (action.isOverdue) {
            displayDate = todayStr;
          }

          if (!grouped.has(displayDate)) {
            grouped.set(displayDate, []);
          }
          grouped.get(displayDate)!.push(action);
        });

        const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
          if (a === 'No Date') return 1;
          if (b === 'No Date') return -1;
          return a.localeCompare(b);
        });

        const sectionsData: DateSection[] = sortedDates.map((date) => ({
          title: date,
          data: grouped.get(date) || [],
        }));

        setSections(sectionsData);
      } else {
        setSections([]);
      }
    } catch (error) {
      console.error('[ActionsTableView] Error loading actions:', error);
      setSections([]);
    } finally {
      if (!silent && isInitialLoad.current) {
        setLoading(false);
      }
      isInitialLoad.current = false;
    }
  };

  const formatDate = (dateString: string) => {
    if (dateString === 'No Date') return 'No Date';

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = date.getDate();
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${monthStr} ${dayNum} (${weekday})`;
  };

  const formatOverdueDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  const getPriorityColor = (action: ActionItem) => {
    if (action.is_urgent && action.is_important) {
      return '#ef4444';
    } else if (!action.is_urgent && action.is_important) {
      return '#22c55e';
    } else if (action.is_urgent && !action.is_important) {
      return '#eab308';
    } else {
      return '#6b7280';
    }
  };

  const handleComplete = async (action: ActionItem) => {
    if (!onComplete) return;

    setSections(prevSections =>
      prevSections.map(section => ({
        ...section,
        data: section.data.map(a =>
          a.id === action.id ? { ...a, isCompleted: true } : a
        )
      }))
    );

    onComplete(action.id);
  };

  const handleDelegate = (action: ActionItem) => {
    if (onDelegate) {
      onDelegate(action.id);
    }
  };

  const handleDelete = (action: ActionItem) => {
    const performDelete = () => {
      setSections(prevSections =>
        prevSections.map(section => ({
          ...section,
          data: section.data.filter(a => a.id !== action.id)
        })).filter(section => section.data.length > 0)
      );

      if (onDelete) {
        onDelete(action.id);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${action.title}"?`);
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Action',
        `Are you sure you want to delete "${action.title}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const renderSectionHeader = ({ section }: { section: DateSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
        {formatDate(section.title)}
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: ActionItem }) => {
    const priorityColor = getPriorityColor(item);
    const isCompleted = item.isCompleted;

    const startTimeFormatted = formatTime(item.start_time);
    const endTimeFormatted = formatTime(item.end_time);
    const timeDisplay = startTimeFormatted && endTimeFormatted
      ? `${startTimeFormatted} - ${endTimeFormatted}`
      : startTimeFormatted || null;

    // Build metadata string
    const metadataParts: string[] = [];
    if (item.isOverdue && item.originalDate && !isCompleted) {
      metadataParts.push(`Overdue - ${formatOverdueDate(item.originalDate)}`);
    }
    if (item.type === 'event' && timeDisplay) {
      metadataParts.push(timeDisplay);
    }
    if (item.delegateName) {
      metadataParts.push(`Delegated to ${item.delegateName}`);
    }

    return (
      <SwipeableRow
        action={item}
        onComplete={() => handleComplete(item)}
        onDelegate={() => handleDelegate(item)}
        onDelete={() => handleDelete(item)}
        onPress={() => onTaskPress && onTaskPress(item.id)}
      >
        <TouchableOpacity
          style={[
            styles.itemContainer,
            { backgroundColor: colors.background },
            isCompleted && styles.completedItem
          ]}
          onPress={() => onTaskPress && onTaskPress(item.id)}
          activeOpacity={0.7}
          disabled={isCompleted}
        >
          {/* Left: Checkbox */}
          <TouchableOpacity
            onPress={() => !isCompleted && handleComplete(item)}
            style={styles.checkboxContainer}
            disabled={isCompleted}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isCompleted ? (
              <View style={[styles.checkbox, styles.checkboxCompleted]}>
                <Check size={16} color="#fff" strokeWidth={3} />
              </View>
            ) : (
              <View style={[styles.checkbox, { borderColor: priorityColor }]}>
                <Circle size={12} color={priorityColor} strokeWidth={0} fill={priorityColor} opacity={0.2} />
              </View>
            )}
          </TouchableOpacity>

          {/* Center: Content */}
          <View style={styles.contentContainer}>
            {/* Title Row */}
            <View style={styles.titleRow}>
              {/* Type Icon */}
              {item.type === 'task' ? (
                <CheckSquare size={16} color={isCompleted ? "#9ca3af" : colors.primary} strokeWidth={2} />
              ) : (
                <Calendar size={16} color={isCompleted ? "#9ca3af" : colors.primary} strokeWidth={2} />
              )}

              {/* Title */}
              <Text
                style={[
                  styles.titleText,
                  { color: isCompleted ? '#9ca3af' : priorityColor },
                  isCompleted && styles.completedText
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>

            {/* Metadata Row */}
            {metadataParts.length > 0 && (
              <Text style={[styles.metadataText, isCompleted && { color: '#9ca3af' }]}>
                {metadataParts.join(' • ')}
              </Text>
            )}
          </View>

          {/* Right: Points */}
          <View style={styles.pointsContainer}>
            <Text style={[styles.pointsText, isCompleted && { color: '#9ca3af' }]}>
              +{Math.round(item.depositValue)}
            </Text>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No pending actions in selected period
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={sections.length === 0 ? styles.emptyList : undefined}
        stickySectionHeadersEnabled={true}
      />
    </View>
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
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swipeContainer: {
    position: 'relative',
  },
  hiddenActionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  hiddenActionButton: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  delegateButton: {
    backgroundColor: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  hiddenActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  completedItem: {
    opacity: 0.6,
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  contentContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  metadataText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    paddingLeft: 24,
  },
  pointsContainer: {
    minWidth: 45,
    alignItems: 'flex-end',
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
});
