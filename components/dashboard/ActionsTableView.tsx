import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CheckSquare, Calendar, Check, UserCircle, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';
import { ActFilter } from './ActFilterButtons';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { formatLocalDate, toLocalISOString } from '@/lib/dateUtils';

interface ActionItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  due_date: string | null;
  start_date: string | null;
  start_time: string | null;  // ADD
  end_time: string | null;    // ADD
  is_urgent: boolean;
  is_important: boolean;
  is_deposit_idea: boolean;
  depositValue: number;
  isOverdue?: boolean;
  originalDate?: string;
  roles?: any[];
  domains?: any[];
  delegateName?: string | null;  // ADD - first name of delegate
  isCompleted?: boolean;  // ADD
}

interface DateWithActions {
  date: string;
  actions: ActionItem[];
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
  const [dateGroups, setDateGroups] = useState<DateWithActions[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Reset initial load flag when filter/period/userId changes
    isInitialLoad.current = true;
    loadActions();
  }, [filter, period, userId]);

  // Event bus listeners for real-time updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('[ActionsTableView] Event received, refreshing...');
      loadActions(true); // silent refresh - don't show loading state
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
    console.log('[ActionsTableView] loadActions called with:', { userId, filter, period, silent });

    if (!userId) {
      console.log('[ActionsTableView] No userId provided, skipping load');
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    try {
      // Only show loading state on initial load or explicit user refresh
      if (!silent && isInitialLoad.current) {
        setLoading(true);
      }
      const supabase = getSupabaseClient();
      const { start, end } = getDateRange(period);
      const startStr = formatLocalDate(start);
      const endStr = formatLocalDate(end);

      // Get today's date for filtering past events
      const todayStr = formatLocalDate(new Date());

      // Get start of today in local timezone (for completed_at comparison)
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

        // Include pending/in_progress OR completed today
        query = query.or(`status.in.(pending,in_progress),and(status.eq.completed,completed_at.gte.${todayStartISO})`);

        const { data, error } = await query.order('due_date', { ascending: true });
        if (error) throw error;
        tasksData = data || [];
      } else if (filter === 'event') {
        // Events show from TODAY through end of selected period
        // Never show past events (start_date < today)
        let query = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'event')
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .gte('start_date', todayStr);  // Never before today

        // Add upper bound based on period
        if (period !== 'all') {
          query = query.lte('start_date', endStr);
        }

        // Include pending/in_progress OR completed today
        query = query.or(`status.in.(pending,in_progress),and(status.eq.completed,completed_at.gte.${todayStartISO})`);

        const { data, error } = await query.order('start_date', { ascending: true });
        if (error) throw error;
        tasksData = data || [];
      } else {
        // Combined view: tasks + events with different filtering rules
        // Tasks: can be overdue, filtered by due_date
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'task')
          .is('deleted_at', null)
          .is('parent_task_id', null);

        // Events: from today forward only (never past)
        let eventsQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, start_time, end_time, is_urgent, is_important, is_deposit_idea, status, completed_at')
          .eq('user_id', userId)
          .eq('type', 'event')
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .gte('start_date', todayStr);  // Never before today

        // Apply period upper bounds
        if (period !== 'all') {
          tasksQuery = tasksQuery.lte('due_date', endStr);
          eventsQuery = eventsQuery.lte('start_date', endStr);
        }

        // Include pending/in_progress OR completed today for both queries
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

 // TEMPORARY DEBUG - Remove after testing
    console.log('[ActionsTableView DEBUG] Raw tasksData:', tasksData?.map(t => ({
      id: t.id,
      title: t.title,
      type: t.type,
      start_time: t.start_time,
      end_time: t.end_time,
    })));
      
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

        // Map delegates by task
        const delegatesByTask = new Map<string, string>();
        (delegatesRes.data || []).forEach((d: any) => {
          if (d.delegate?.name) {
            // Get first name only
            const firstName = d.delegate.name.split(' ')[0];
            delegatesByTask.set(d.parent_id, firstName);
          }
        });

        // TEMPORARY DEBUG - Remove after testing
console.log('[ActionsTableView DEBUG] Delegates map:', Object.fromEntries(delegatesByTask));

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
            start_time: task.start_time,      // ADD
            end_time: task.end_time,          // ADD
            is_urgent: task.is_urgent,
            is_important: task.is_important,
            is_deposit_idea: task.is_deposit_idea || false,
            depositValue: score,
            isOverdue,
            originalDate: isOverdue ? displayDate : undefined,
            roles: roles,
            domains: domains,
            delegateName: delegatesByTask.get(task.id) || null,  // ADD
            isCompleted: task.status === 'completed',  // ADD
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

        const dateGroupsData: DateWithActions[] = sortedDates.map((date) => ({
          date,
          actions: grouped.get(date) || [],
        }));

        setDateGroups(dateGroupsData);
      } else {
        setDateGroups([]);
      }
    } catch (error) {
      console.error('[ActionsTableView] Error loading actions:', error);
      setDateGroups([]);
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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPriorityColor = (action: ActionItem) => {
    if (action.is_urgent && action.is_important) {
      return '#ef4444';
    } else if (!action.is_urgent && action.is_important) {
      return '#22c55e';
    } else if (action.is_urgent && !action.is_important) {
      return '#eab308';
    } else {
      return '#9ca3af';
    }
  };

  const handleComplete = async (action: ActionItem) => {
    if (!onComplete) return;

    // Optimistic UI update - mark as completed locally immediately
    setDateGroups(prevGroups =>
      prevGroups.map(group => ({
        ...group,
        actions: group.actions.map(a =>
          a.id === action.id ? { ...a, isCompleted: true } : a
        )
      }))
    );

    // Then trigger the actual completion
    onComplete(action.id);
  };

  const handleDelegate = (action: ActionItem) => {
    if (onDelegate) {
      onDelegate(action.id);
    }
  };

  const handleDelete = (action: ActionItem) => {
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
          onPress: () => {
            // Optimistic UI update - remove from list immediately
            setDateGroups(prevGroups =>
              prevGroups.map(group => ({
                ...group,
                actions: group.actions.filter(a => a.id !== action.id)
              })).filter(group => group.actions.length > 0)
            );

            // Then trigger the actual deletion
            if (onDelete) {
              onDelete(action.id);
            }
          },
        },
      ]
    );
  };

  const renderActionItem = (action: ActionItem) => {
    const priorityColor = getPriorityColor(action);
    const isCompleted = action.isCompleted;

    // Format time display for events
    const formatTime = (timeStr: string | null) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'pm' : 'am';
      const displayHour = hours % 12 || 12;
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const startTimeFormatted = formatTime(action.start_time);
    const endTimeFormatted = formatTime(action.end_time);
    const timeDisplay = startTimeFormatted && endTimeFormatted
      ? `${startTimeFormatted} - ${endTimeFormatted}`
      : startTimeFormatted || null;

    return (
      <View key={action.id} style={[styles.actionRow, isCompleted && styles.completedRow]}>
        <View style={styles.quickActionsContainer}>
          {!isCompleted ? (
            <TouchableOpacity
              onPress={() => handleComplete(action)}
              style={styles.quickActionButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Check size={18} color="#22c55e" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.quickActionButton}>
              <Check size={18} color="#9ca3af" strokeWidth={2.5} />
            </View>
          )}
          <TouchableOpacity
            onPress={() => handleDelegate(action)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={isCompleted}
          >
            <UserCircle size={18} color={isCompleted ? "#9ca3af" : "#3b82f6"} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(action)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.taskInfoContainer}
          onPress={() => onTaskPress && onTaskPress(action.id)}
          activeOpacity={0.7}
          disabled={isCompleted}
        >
          <View style={styles.iconContainer}>
            {action.type === 'task' ? (
              <CheckSquare size={16} color={isCompleted ? "#9ca3af" : colors.primary} />
            ) : (
              <Calendar size={16} color={isCompleted ? "#9ca3af" : colors.primary} />
            )}
          </View>
          <View style={styles.actionContent}>
            <View style={styles.actionTitleRow}>
              <Text
                style={[
                  styles.actionText,
                  { color: isCompleted ? '#9ca3af' : priorityColor },
                  isCompleted && styles.completedText
                ]}
                numberOfLines={1}
              >
                {action.title}
              </Text>
              {/* Time display for events */}
              {action.type === 'event' && timeDisplay && (
                <Text style={[styles.timeText, isCompleted && styles.completedText]}>
                  ({timeDisplay})
                </Text>
              )}
              {/* Delegate display */}
              {action.delegateName && (
                <Text style={[styles.delegateText, isCompleted && { color: '#9ca3af' }]}>
                  (Delegated {action.delegateName})
                </Text>
              )}
            </View>
            {action.isOverdue && action.originalDate && !isCompleted && (
              <Text style={styles.overdueText}>
                (Overdue - {formatOverdueDate(action.originalDate)})
              </Text>
            )}
          </View>
          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, isCompleted && { color: '#9ca3af' }]}>
              +{Math.round(action.depositValue)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDateRow = ({ item }: { item: DateWithActions }) => {
    return (
      <TouchableOpacity
        style={[
          styles.dateRow,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.dateColumn}>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {formatDate(item.date)}
          </Text>
        </View>
        <View style={styles.actionsColumn}>
          <View style={styles.actionsContainer}>
            {item.actions.map((action) => renderActionItem(action))}
          </View>
        </View>
      </TouchableOpacity>
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
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerDate, { color: colors.text }]}>Date</Text>
        <Text style={[styles.headerActions, { color: colors.text }]}>Actions</Text>
        <Text style={[styles.headerContent, { color: colors.text }]}>
          Tasks & Events
        </Text>
      </View>

      <FlatList
        data={dateGroups}
        renderItem={renderDateRow}
        keyExtractor={(item) => item.date}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={dateGroups.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
  },
  headerDate: {
    fontSize: 14,
    fontWeight: '600',
    width: 90,
  },
  headerActions: {
    fontSize: 14,
    fontWeight: '600',
    width: 120,
    textAlign: 'center',
  },
  headerContent: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  dateColumn: {
    width: 90,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  actionsContainer: {
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  quickActionButton: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  overdueText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '400',
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '400',
  },
  delegateText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  valueContainer: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleTag: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  domainTag: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  completedRow: {
    opacity: 0.7,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
});