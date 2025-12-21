import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CheckSquare, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { TimePeriod } from '@/lib/dashboardSummaryMetrics';
import { ActFilter } from './ActFilterButtons';

interface ActionItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  due_date: string | null;
  start_date: string | null;
  is_urgent: boolean;
  is_important: boolean;
  depositValue: number;
  isOverdue?: boolean;
  originalDate?: string;
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
  }
}

export function ActionsTableView({
  filter,
  period,
  userId,
  onRefresh,
}: ActionsTableViewProps) {
  const { colors } = useTheme();
  const [dateGroups, setDateGroups] = useState<DateWithActions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActions();
  }, [filter, period, userId]);

  const loadActions = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { start, end } = getDateRange(period);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      let tasksData: any[] = [];

      if (filter === 'task') {
        let query = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, is_urgent, is_important')
          .eq('user_id', userId)
          .eq('type', 'task')
          .in('status', ['pending', 'in_progress'])
          .is('deleted_at', null)
          .is('parent_task_id', null);

        if (period === 'today') {
          query = query.lte('due_date', endStr);
        } else {
          query = query.lte('due_date', endStr);
        }

        const { data, error } = await query.order('due_date', { ascending: true });
        if (error) throw error;
        tasksData = data || [];
      } else if (filter === 'event') {
        let query = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, is_urgent, is_important')
          .eq('user_id', userId)
          .eq('type', 'event')
          .in('status', ['pending', 'in_progress'])
          .is('deleted_at', null)
          .is('parent_task_id', null);

        if (period === 'today') {
          query = query.lte('start_date', endStr);
        } else {
          query = query.lte('start_date', endStr);
        }

        const { data, error } = await query.order('start_date', { ascending: true });
        if (error) throw error;
        tasksData = data || [];
      } else {
        const tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, is_urgent, is_important')
          .eq('user_id', userId)
          .eq('type', 'task')
          .in('status', ['pending', 'in_progress'])
          .is('deleted_at', null)
          .is('parent_task_id', null);

        const eventsQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_date, is_urgent, is_important')
          .eq('user_id', userId)
          .eq('type', 'event')
          .in('status', ['pending', 'in_progress'])
          .is('deleted_at', null)
          .is('parent_task_id', null);

        if (period === 'today') {
          tasksQuery.lte('due_date', endStr);
          eventsQuery.lte('start_date', endStr);
        } else {
          tasksQuery.lte('due_date', endStr);
          eventsQuery.lte('start_date', endStr);
        }

        const [tasksResult, eventsResult] = await Promise.all([
          tasksQuery,
          eventsQuery,
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

        const [rolesRes, domainsRes, goalsRes] = await Promise.all([
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

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const todayStr = now.toISOString().split('T')[0];

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
            is_urgent: task.is_urgent,
            is_important: task.is_important,
            depositValue: score,
            isOverdue,
            originalDate: isOverdue ? displayDate : undefined,
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
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (dateString === 'No Date') return 'No Date';

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
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

  const renderActionItem = (action: ActionItem) => {
    const priorityColor = getPriorityColor(action);

    return (
      <View key={action.id} style={styles.actionRow}>
        <View style={styles.iconContainer}>
          {action.type === 'task' ? (
            <CheckSquare size={16} color={colors.primary} />
          ) : (
            <Calendar size={16} color={colors.primary} />
          )}
        </View>
        <View style={styles.actionContent}>
          <Text style={[styles.actionText, { color: priorityColor }]} numberOfLines={1}>
            {action.title}
            {action.isOverdue && action.originalDate && (
              <Text style={styles.overdueText}>
                {' '}(Overdue - {formatOverdueDate(action.originalDate)})
              </Text>
            )}
          </Text>
        </View>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>+{action.depositValue.toFixed(1)}</Text>
        </View>
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
        <Text style={[styles.headerContent, { color: colors.text }]}>
          Actions & Events
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
    width: 120,
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
    width: 120,
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
});
