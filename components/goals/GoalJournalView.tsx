// components/goals/GoalJournalView.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Check, Calendar } from 'lucide-react-native';
import { Image } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { useTheme } from '@/contexts/ThemeContext';

interface GoalJournalEntry {
  id: string;
  date: string;
  title: string;
  type: 'task' | 'event' | 'reflection' | 'depositIdea';
  points: number;
  roles: Array<{ id: string; label: string }>;
  domains: Array<{ id: string; name: string }>;
  source_data?: any;
}

interface GroupedEntries {
  dateLabel: string;
  dateKey: string;
  entries: GoalJournalEntry[];
}

interface GoalJournalViewProps {
  goalId: string;
  goalType: '12week' | 'custom';
  goalStartDate?: string;
  goalEndDate?: string;
  onEntryPress?: (entry: GoalJournalEntry) => void;
}

export function GoalJournalView({
  goalId,
  goalType,
  goalStartDate,
  goalEndDate,
  onEntryPress,
}: GoalJournalViewProps) {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<GoalJournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'timeline'>('week');
  const [totalPoints, setTotalPoints] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to format date for display
  const formatDateLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()} (${days[date.getDay()]})`;
  };

  // Helper to get date filter based on period
  const getDateFilter = (): { start: string; end?: string } | null => {
    const now = new Date();
    
    if (selectedPeriod === 'today') {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      return { start: todayStart.toISOString() };
    }
    
    if (selectedPeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: weekAgo.toISOString() };
    }
    
    if (selectedPeriod === 'timeline' && goalStartDate && goalEndDate) {
      return { start: goalStartDate, end: goalEndDate };
    }
    
    return null;
  };

  // Group entries by date
  const groupEntriesByDate = (entries: GoalJournalEntry[]): GroupedEntries[] => {
    const groups: Record<string, GoalJournalEntry[]> = {};
    
    entries.forEach(entry => {
      const dateKey = entry.date.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });

    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(dateKey => ({
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        entries: groups[dateKey],
      }));
  };

  // Fetch journal entries for this goal
  const fetchGoalJournalEntries = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || controller.signal.aborted) return;

      const dateFilter = getDateFilter();
      const journalEntries: GoalJournalEntry[] = [];
      let runningPoints = 0;

      const goalTypeForJoin = goalType === '12week' ? 'twelve_wk_goal' : 'custom_goal';
      const goalIdField = goalType === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

      // 1. Get all task IDs linked to this goal
      const { data: taskJoins, error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id, parent_type')
        .eq(goalIdField, goalId)
        .eq('goal_type', goalTypeForJoin);

      if (joinError) throw joinError;

      // Separate by parent type
      const taskIds = (taskJoins || [])
        .filter(j => j.parent_type === 'task')
        .map(j => j.parent_id);
      const reflectionIds = (taskJoins || [])
        .filter(j => j.parent_type === 'reflection')
        .map(j => j.parent_id);
      const depositIdeaIds = (taskJoins || [])
        .filter(j => j.parent_type === 'depositIdea')
        .map(j => j.parent_id);

      // 2. Fetch completed tasks linked to this goal
      if (taskIds.length > 0) {
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('id, title, type, status, completed_at, is_urgent, is_important, is_deposit_idea')
          .in('id', taskIds)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .not('completed_at', 'is', null);

        if (dateFilter) {
          tasksQuery = tasksQuery.gte('completed_at', dateFilter.start);
          if (dateFilter.end) {
            tasksQuery = tasksQuery.lte('completed_at', dateFilter.end);
          }
        }

        const { data: tasksData, error: tasksError } = await tasksQuery;
        if (tasksError) throw tasksError;

        if (tasksData && tasksData.length > 0) {
          const completedTaskIds = tasksData.map(t => t.id);

          // Fetch roles, domains, goals for these tasks
          const [rolesRes, domainsRes, goalsRes] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role:0008-ap-roles(id, label)')
              .in('parent_id', completedTaskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain:0008-ap-domains(id, name)')
              .in('parent_id', completedTaskIds)
              .eq('parent_type', 'task'),
            supabase
              .from('0008-ap-universal-goals-join')
              .select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)')
              .in('parent_id', completedTaskIds)
              .eq('parent_type', 'task'),
          ]);

          // Group by parent_id
          const rolesByTask = new Map<string, any[]>();
          (rolesRes.data || []).forEach(r => {
            const arr = rolesByTask.get(r.parent_id) || [];
            arr.push(r);
            rolesByTask.set(r.parent_id, arr);
          });

          const domainsByTask = new Map<string, any[]>();
          (domainsRes.data || []).forEach(d => {
            const arr = domainsByTask.get(d.parent_id) || [];
            arr.push(d);
            domainsByTask.set(d.parent_id, arr);
          });

          const goalsByTask = new Map<string, any[]>();
          (goalsRes.data || []).forEach(g => {
            const arr = goalsByTask.get(g.parent_id) || [];
            arr.push(g);
            goalsByTask.set(g.parent_id, arr);
          });

          for (const task of tasksData) {
            const roles = (rolesByTask.get(task.id) || [])
              .map(r => r.role)
              .filter(Boolean);
            const domains = (domainsByTask.get(task.id) || [])
              .map(d => d.domain)
              .filter(Boolean);
            const goals = (goalsByTask.get(task.id) || [])
              .map(g => {
                if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
                  const goal = g.twelve_wk_goal;
                  if (!goal || goal.status === 'archived' || goal.status === 'cancelled') return null;
                  return { ...goal, goal_type: '12week' };
                } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
                  const goal = g.custom_goal;
                  if (!goal || goal.status === 'archived' || goal.status === 'cancelled') return null;
                  return { ...goal, goal_type: 'custom' };
                }
                return null;
              })
              .filter(Boolean);

            const points = calculateTaskPoints(task, roles, domains, goals);
            runningPoints += points;

            journalEntries.push({
              id: task.id,
              date: task.completed_at,
              title: task.title,
              type: task.type === 'event' ? 'event' : 'task',
              points,
              roles,
              domains,
              source_data: { ...task, roles, domains, goals },
            });
          }
        }
      }

      // 3. Fetch reflections linked to this goal
      if (reflectionIds.length > 0) {
        let reflectionsQuery = supabase
          .from('0008-ap-reflections')
          .select('id, content, created_at, daily_rose, daily_thorn')
          .in('id', reflectionIds)
          .eq('user_id', user.id);

        if (dateFilter) {
          reflectionsQuery = reflectionsQuery.gte('created_at', dateFilter.start);
          if (dateFilter.end) {
            reflectionsQuery = reflectionsQuery.lte('created_at', dateFilter.end);
          }
        }

        const { data: reflectionsData, error: reflectionsError } = await reflectionsQuery;
        if (reflectionsError) throw reflectionsError;

        if (reflectionsData && reflectionsData.length > 0) {
          const rIds = reflectionsData.map(r => r.id);

          const [rRolesRes, rDomainsRes] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role:0008-ap-roles(id, label)')
              .in('parent_id', rIds)
              .eq('parent_type', 'reflection'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain:0008-ap-domains(id, name)')
              .in('parent_id', rIds)
              .eq('parent_type', 'reflection'),
          ]);

          const rolesByRef = new Map<string, any[]>();
          (rRolesRes.data || []).forEach(r => {
            const arr = rolesByRef.get(r.parent_id) || [];
            arr.push(r);
            rolesByRef.set(r.parent_id, arr);
          });

          const domainsByRef = new Map<string, any[]>();
          (rDomainsRes.data || []).forEach(d => {
            const arr = domainsByRef.get(d.parent_id) || [];
            arr.push(d);
            domainsByRef.set(d.parent_id, arr);
          });

          for (const ref of reflectionsData) {
            const roles = (rolesByRef.get(ref.id) || []).map(r => r.role).filter(Boolean);
            const domains = (domainsByRef.get(ref.id) || []).map(d => d.domain).filter(Boolean);

            // Reflections get points from points_awarded column if available
            const points = ref.points_awarded || 1;
            runningPoints += points;

            journalEntries.push({
              id: ref.id,
              date: ref.created_at,
              title: ref.content.substring(0, 80) + (ref.content.length > 80 ? '...' : ''),
              type: 'reflection',
              points,
              roles,
              domains,
              source_data: { ...ref, roles, domains, daily_rose: ref.daily_rose, daily_thorn: ref.daily_thorn },
            });
          }
        }
      }

      // 4. Fetch deposit ideas linked to this goal (active ones)
      if (depositIdeaIds.length > 0) {
        let depositQuery = supabase
          .from('0008-ap-deposit-ideas')
          .select('id, title, created_at, is_active')
          .in('id', depositIdeaIds)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('archived', false);

        if (dateFilter) {
          depositQuery = depositQuery.gte('created_at', dateFilter.start);
          if (dateFilter.end) {
            depositQuery = depositQuery.lte('created_at', dateFilter.end);
          }
        }

        const { data: depositData, error: depositError } = await depositQuery;
        if (depositError) throw depositError;

        if (depositData && depositData.length > 0) {
          const dIds = depositData.map(d => d.id);

          const [dRolesRes, dDomainsRes] = await Promise.all([
            supabase
              .from('0008-ap-universal-roles-join')
              .select('parent_id, role:0008-ap-roles(id, label)')
              .in('parent_id', dIds)
              .eq('parent_type', 'depositIdea'),
            supabase
              .from('0008-ap-universal-domains-join')
              .select('parent_id, domain:0008-ap-domains(id, name)')
              .in('parent_id', dIds)
              .eq('parent_type', 'depositIdea'),
          ]);

          const rolesByD = new Map<string, any[]>();
          (dRolesRes.data || []).forEach(r => {
            const arr = rolesByD.get(r.parent_id) || [];
            arr.push(r);
            rolesByD.set(r.parent_id, arr);
          });

          const domainsByD = new Map<string, any[]>();
          (dDomainsRes.data || []).forEach(d => {
            const arr = domainsByD.get(d.parent_id) || [];
            arr.push(d);
            domainsByD.set(d.parent_id, arr);
          });

          for (const dep of depositData) {
            const roles = (rolesByD.get(dep.id) || []).map(r => r.role).filter(Boolean);
            const domains = (domainsByD.get(dep.id) || []).map(d => d.domain).filter(Boolean);

            // Deposit ideas get 1 point for creation
            const points = 1;
            runningPoints += points;

            journalEntries.push({
              id: dep.id,
              date: dep.created_at,
              title: dep.title,
              type: 'depositIdea',
              points,
              roles,
              domains,
              source_data: { ...dep, roles, domains, is_deposit_idea: true },
            });
          }
        }
      }

      // Sort entries by date (newest first)
      journalEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (!controller.signal.aborted) {
        setEntries(journalEntries);
        setTotalPoints(runningPoints);
      }
    } catch (err: any) {
      if (!abortControllerRef.current?.signal.aborted) {
        console.error('Error fetching goal journal entries:', err);
        Alert.alert('Error', err?.message || 'Failed to load journal entries');
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchGoalJournalEntries();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [goalId, goalType, selectedPeriod]);

  // Get icon for entry type
  const getEntryIcon = (entry: GoalJournalEntry) => {
    if (entry.type === 'task') {
      return <Check size={18} color="#3b82f6" strokeWidth={3} />;
    }
    if (entry.type === 'event') {
      return <Calendar size={18} color="#10b981" />;
    }
    if (entry.type === 'depositIdea') {
      return (
        <Image
          source={require('@/assets/images/deposit-idea.png')}
          style={{ width: 22, height: 22 }}
          resizeMode="contain"
        />
      );
    }
    if (entry.type === 'reflection') {
      if (entry.source_data?.daily_rose) {
        return (
          <Image
            source={require('@/assets/images/rose-81.png')}
            style={{ width: 22, height: 22 }}
            resizeMode="contain"
          />
        );
      }
      if (entry.source_data?.daily_thorn) {
        return (
          <Image
            source={require('@/assets/images/thorn-81.png')}
            style={{ width: 22, height: 22 }}
            resizeMode="contain"
          />
        );
      }
      return (
        <Image
          source={require('@/assets/images/reflections-72.png')}
          style={{ width: 22, height: 22 }}
          resizeMode="contain"
        />
      );
    }
    return <Check size={18} color="#3b82f6" strokeWidth={3} />;
  };

  // Get icon background color (light backgrounds to match Take Action modal style)
  const getIconBgColor = (entry: GoalJournalEntry): string => {
    if (entry.type === 'task') return '#dbeafe'; // light blue
    if (entry.type === 'event') return '#d1fae5'; // light green
    if (entry.type === 'depositIdea') return '#fef3c7'; // light yellow
    if (entry.type === 'reflection') {
      if (entry.source_data?.daily_rose) return '#fce7f3'; // light pink
      if (entry.source_data?.daily_thorn) return '#d1fae5'; // light green (cactus)
      return '#f3e8ff'; // light purple
    }
    return '#f3f4f6'; // light gray
  };

  const groupedEntries = groupEntriesByDate(entries);

  return (
    <View style={styles.container}>
      {/* Header with time period selector and total points */}
      <View style={styles.header}>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'today' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('today')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'today' && styles.periodButtonTextActive]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'timeline' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('timeline')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'timeline' && styles.periodButtonTextActive]}>
              Timeline
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.totalPoints, { color: '#22c55e' }]}>
          +{totalPoints.toFixed(1)}
        </Text>
      </View>

      {/* Entry list */}
      <ScrollView style={styles.scrollView}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading journal...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No entries found for this {selectedPeriod === 'timeline' ? 'timeline' : selectedPeriod}
            </Text>
          </View>
        ) : (
          groupedEntries.map(group => (
            <View key={group.dateKey}>
              {/* Day separator */}
              <View style={[styles.daySeparator, { backgroundColor: colors.surface }]}>
                <Text style={[styles.daySeparatorText, { color: colors.textSecondary }]}>
                  {group.dateLabel}
                </Text>
              </View>

              {/* Entries for this day */}
              {group.entries.map(entry => (
                <TouchableOpacity
                  key={`${entry.type}-${entry.id}`}
                  style={[styles.entryRow, { backgroundColor: colors.background }]}
                  onPress={() => onEntryPress?.(entry)}
                >
                  {/* Icon */}
                  <View style={[styles.entryIcon, { backgroundColor: getIconBgColor(entry) }]}>
                    {getEntryIcon(entry)}
                  </View>

                  {/* Content */}
                  <View style={styles.entryContent}>
                    <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <View style={styles.entryTags}>
                      {entry.roles.map(role => (
                        <View key={role.id} style={[styles.tag, styles.roleTag]}>
                          <Text style={styles.tagText}>{role.label}</Text>
                        </View>
                      ))}
                      {entry.domains.map(domain => (
                        <View key={domain.id} style={[styles.tag, styles.domainTag]}>
                          <Text style={styles.tagText}>{domain.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Points */}
                  <Text style={styles.entryPoints}>+{entry.points.toFixed(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#0078d4',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
  totalPoints: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  daySeparator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  daySeparatorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  entryContent: {
    flex: 1,
    marginRight: 8,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  entryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  domainTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
  },
  entryPoints: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22c55e',
  },
});