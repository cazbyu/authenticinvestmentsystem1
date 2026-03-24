/**
 * Today's Commitments Widget
 *
 * Shows the user's committed tasks and events for today on the dashboard,
 * beneath the compass. Users can mark tasks complete directly from here.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle, Circle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

interface CommittedItem {
  id: string;
  title: string;
  type: string;
  is_urgent: boolean;
  is_important: boolean;
  status: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  completed: boolean;
  roles: Array<{ id: string; label: string }>;
  domains: Array<{ id: string; label: string }>;
}

interface TodaysCommitmentsWidgetProps {
  userId: string;
  onRefresh?: () => void;
}

export default function TodaysCommitmentsWidget({ userId, onRefresh }: TodaysCommitmentsWidgetProps) {
  const { colors } = useTheme();
  const [items, setItems] = useState<CommittedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCommitments = useCallback(async () => {
    const supabase = getSupabaseClient();
    const todayStr = toLocalISOString(new Date()).split('T')[0];

    // Get tasks committed for today (one_thing = true) + today's events
    const { data: tasks } = await supabase
      .from('0008-ap-tasks')
      .select('id, title, type, is_urgent, is_important, status, due_date, start_time, end_time, is_all_day')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(`one_thing.eq.true,and(type.eq.event,due_date.eq.${todayStr})`)
      .order('type', { ascending: false }) // events first
      .order('is_urgent', { ascending: false })
      .order('start_time', { ascending: true });

    if (!tasks || tasks.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const taskIds = tasks.map((t) => t.id);

    // Fetch roles and domains
    const [rolesR, domainsR] = await Promise.all([
      supabase.from('0008-ap-universal-roles-join').select('parent_id, role_id').in('parent_id', taskIds).eq('parent_type', 'task'),
      supabase.from('0008-ap-universal-domains-join').select('parent_id, domain_id').in('parent_id', taskIds).eq('parent_type', 'task'),
    ]);

    const roleIds = [...new Set((rolesR.data || []).map((r: any) => r.role_id))];
    const domainIds = [...new Set((domainsR.data || []).map((d: any) => d.domain_id))];

    const [rLabels, dLabels] = await Promise.all([
      roleIds.length > 0 ? supabase.from('0008-ap-roles').select('id, label').in('id', roleIds) : { data: [] },
      domainIds.length > 0 ? supabase.from('0008-ap-domains').select('id, name').in('id', domainIds) : { data: [] },
    ]);

    const roleLabelMap = new Map((rLabels.data || []).map((r: any) => [r.id, r.label]));
    const domainLabelMap = new Map((dLabels.data || []).map((d: any) => [d.id, d.name]));

    const taskRolesMap = new Map<string, Array<{ id: string; label: string }>>();
    const taskDomainsMap = new Map<string, Array<{ id: string; label: string }>>();

    for (const r of rolesR.data || []) {
      const arr = taskRolesMap.get(r.parent_id) || [];
      arr.push({ id: r.role_id, label: roleLabelMap.get(r.role_id) || '' });
      taskRolesMap.set(r.parent_id, arr);
    }
    for (const d of domainsR.data || []) {
      const arr = taskDomainsMap.get(d.parent_id) || [];
      arr.push({ id: d.domain_id, label: domainLabelMap.get(d.domain_id) || '' });
      taskDomainsMap.set(d.parent_id, arr);
    }

    const result: CommittedItem[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type || 'task',
      is_urgent: t.is_urgent || false,
      is_important: t.is_important || false,
      status: t.status,
      due_date: t.due_date,
      start_time: t.start_time,
      end_time: t.end_time,
      is_all_day: t.is_all_day || false,
      completed: t.status === 'completed',
      roles: taskRolesMap.get(t.id) || [],
      domains: taskDomainsMap.get(t.id) || [],
    }));

    setItems(result);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadCommitments();
  }, [loadCommitments]);

  const toggleComplete = async (item: CommittedItem) => {
    const supabase = getSupabaseClient();
    const newStatus = item.completed ? 'pending' : 'completed';
    const completedAt = item.completed ? null : new Date().toISOString();

    await supabase
      .from('0008-ap-tasks')
      .update({ status: newStatus, completed_at: completedAt })
      .eq('id', item.id);

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, completed: !i.completed, status: newStatus } : i
      )
    );

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onRefresh?.();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  }

  if (items.length === 0) return null; // Don't show widget if no commitments

  const completedCount = items.filter((i) => i.completed).length;
  const events = items.filter((i) => i.type === 'event' && !i.completed);
  const tasks = items.filter((i) => i.type !== 'event');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, { color: colors.text }]}>Today's Plan</Text>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {completedCount}/{items.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: '#4169E1',
              width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%`,
            },
          ]}
        />
      </View>

      {/* Events */}
      {events.map((evt) => (
        <View
          key={evt.id}
          style={[styles.itemCard, { borderLeftColor: '#4169E1', backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.itemContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{evt.title}</Text>
              <Text style={{ fontSize: 12, color: '#4169E1', fontWeight: '600' }}>
                {evt.is_all_day ? 'All day' : evt.start_time || ''}
              </Text>
            </View>
          </View>
        </View>
      ))}

      {/* Tasks */}
      {tasks.map((task) => {
        const borderLeftColor = task.is_urgent && task.is_important ? '#E53935'
          : task.is_urgent ? '#FF9800'
          : task.is_important ? '#eab308'
          : colors.border;

        return (
          <TouchableOpacity
            key={task.id}
            activeOpacity={0.7}
            onPress={() => toggleComplete(task)}
            style={[
              styles.itemCard,
              {
                borderLeftColor,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: task.completed ? 0.6 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {task.completed ? (
                <CheckCircle size={22} color="#39b54a" style={{ marginRight: 10 }} />
              ) : (
                <Circle size={22} color={colors.border} style={{ marginRight: 10 }} />
              )}
              <View style={styles.itemContent}>
                <Text
                  style={[
                    styles.itemTitle,
                    { color: task.completed ? colors.textSecondary : colors.text },
                    task.completed && { textDecorationLine: 'line-through' },
                  ]}
                >
                  {task.title}
                </Text>
                {(task.roles.length > 0 || task.domains.length > 0) && (
                  <View style={styles.badgeRow}>
                    {task.roles.slice(0, 2).map((r) => (
                      <View key={r.id} style={[styles.badge, { backgroundColor: '#fce7f3' }]}>
                        <Text style={[styles.badgeText, { color: '#9333ea' }]} numberOfLines={1}>{r.label}</Text>
                      </View>
                    ))}
                    {task.domains.slice(0, 2).map((d) => (
                      <View key={d.id} style={[styles.badge, { backgroundColor: '#fed7aa' }]}>
                        <Text style={[styles.badgeText, { color: '#c2410c' }]} numberOfLines={1}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressText: {
    fontSize: 14,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  itemCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
