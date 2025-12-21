import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CheckSquare, Calendar, Check, Trash2 } from 'lucide-react-native';
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

  switch (period) {
    case 'today':
      const past = new Date('1900-01-01');
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      return { start: past, end: todayEnd };

    case 'week':
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: now, end: weekEnd };

    case 'month':
      const monthEnd = new Date(now);
      monthEnd.setDate(now.getDate() + 27);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: now, end: monthEnd };
  }
}

export function ActionsTableView({
  filter,
  period,
  userId,
  onRefresh,
}: ActionsTableViewProps) {
  const { colors } = useTheme();
  const [actions, setActions] = useState<ActionItem[]>([]);
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
          query = query.gte('due_date', startStr).lte('due_date', endStr);
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
          query = query.gte('start_date', startStr).lte('start_date', endStr);
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
          tasksQuery.gte('due_date', startStr).lte('due_date', endStr);
          eventsQuery.gte('start_date', startStr).lte('start_date', endStr);
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
        ].sort((a, b) => {
          const dateA = a.type === 'event' ? a.start_date : a.due_date;
          const dateB = b.type === 'event' ? b.start_date : b.due_date;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.localeCompare(dateB);
        });
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

        const actionsWithScores: ActionItem[] = tasksData.map((task) => {
          const roles = rolesByTask.get(task.id) || [];
          const domains = domainsByTask.get(task.id) || [];
          const goals = goalsByTask.get(task.id) || [];
          const score = calculateTaskPoints(task, roles, domains, goals);

          return {
            id: task.id,
            title: task.title,
            type: task.type,
            due_date: task.due_date,
            start_date: task.start_date,
            is_urgent: task.is_urgent,
            is_important: task.is_important,
            depositValue: score,
          };
        });

        setActions(actionsWithScores);
      } else {
        setActions([]);
      }
    } catch (error) {
      console.error('Error loading actions:', error);
      Alert.alert('Error', 'Failed to load actions');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (actionId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', actionId);

      if (error) throw error;

      await loadActions();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error completing action:', error);
      Alert.alert('Error', 'Failed to complete action');
    }
  };

  const handleDelete = async (actionId: string) => {
    Alert.alert('Delete Action', 'Are you sure you want to delete this action?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await supabase
              .from('0008-ap-tasks')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', actionId);

            if (error) throw error;

            await loadActions();
            if (onRefresh) onRefresh();
          } catch (error) {
            console.error('Error deleting action:', error);
            Alert.alert('Error', 'Failed to delete action');
          }
        },
      },
    ]);
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return { text: 'No date', isOverdue: false };

    const dueDate = new Date(dateString);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const isOverdue = dueDate < now;

    return {
      text: dueDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      isOverdue,
    };
  };

  const getPriorityStyle = (action: ActionItem) => {
    if (action.is_urgent && action.is_important) {
      return {
        backgroundColor: '#ffffff',
        borderColor: '#ef4444',
        borderWidth: 3,
      };
    } else if (!action.is_urgent && action.is_important) {
      return {
        backgroundColor: '#ffffff',
        borderColor: '#22c55e',
        borderWidth: 3,
      };
    } else if (action.is_urgent && !action.is_important) {
      return {
        backgroundColor: '#ffffff',
        borderColor: '#eab308',
        borderWidth: 3,
      };
    } else {
      return {
        backgroundColor: '#ffffff',
        borderColor: '#9ca3af',
        borderWidth: 3,
      };
    }
  };

  const renderItem = ({ item }: { item: ActionItem }) => {
    const displayDate = item.type === 'event' ? item.start_date : item.due_date;
    const dueInfo = formatDueDate(displayDate);
    const priorityStyle = getPriorityStyle(item);

    return (
      <View
        style={[
          styles.row,
          priorityStyle,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.iconColumn}>
          {item.type === 'task' ? (
            <CheckSquare size={18} color={colors.primary} />
          ) : (
            <Calendar size={18} color={colors.primary} />
          )}
        </View>

        <View style={styles.dueDateColumn}>
          <Text
            style={[
              styles.dueDateText,
              {
                color: dueInfo.isOverdue ? '#ef4444' : colors.text,
              },
            ]}
          >
            {dueInfo.text}
          </Text>
        </View>

        <View style={styles.titleColumn}>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>

        <View style={styles.scoreColumn}>
          <Text style={styles.scoreText}>+{item.depositValue.toFixed(1)}</Text>
        </View>

        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => handleComplete(item.id)}
        >
          <Check size={18} color="#22c55e" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Trash2 size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No pending actions found
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
        <Text style={[styles.headerIcon, { color: colors.text }]}></Text>
        <Text style={[styles.headerDueDate, { color: colors.text }]}>Due Date</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Title</Text>
        <Text style={[styles.headerScore, { color: colors.text }]}>Value</Text>
        <Text style={[styles.headerAction, { color: colors.text }]}></Text>
        <Text style={[styles.headerAction, { color: colors.text }]}></Text>
      </View>

      <FlatList
        data={actions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={actions.length === 0 ? styles.emptyList : undefined}
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
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    alignItems: 'center',
  },
  headerIcon: {
    width: 30,
    fontSize: 12,
    fontWeight: '600',
  },
  headerDueDate: {
    width: 90,
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  headerScore: {
    width: 60,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  headerAction: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  iconColumn: {
    width: 30,
    alignItems: 'center',
  },
  dueDateColumn: {
    width: 90,
  },
  dueDateText: {
    fontSize: 12,
  },
  titleColumn: {
    flex: 1,
    marginRight: 8,
  },
  titleText: {
    fontSize: 14,
  },
  scoreColumn: {
    width: 60,
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  completeButton: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
