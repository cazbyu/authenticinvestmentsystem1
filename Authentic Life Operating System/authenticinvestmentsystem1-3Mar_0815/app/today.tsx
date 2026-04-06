// Today Screen — Simple "ground level" view of what's on your plate today
// Accessible from South on the compass

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Sun, CheckCircle2 } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Task, TaskCard } from '@/components/tasks/TaskCard';
const ActionDetailsModal = lazy(() => import('@/components/tasks/ActionDetailsModal').then(m => ({ default: m.ActionDetailsModal })));
const TaskEventForm = lazy(() => import('@/components/tasks/TaskEventForm'));
import { formatLocalDate, toLocalISOString } from '@/lib/dateUtils';
import { completeTask } from '@/lib/taskUtils';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { eventBus, EVENTS } from '@/lib/eventBus';

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { refreshScore } = useAuthenticScore();

  const [userId, setUserId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formType, setFormType] = useState<'task' | 'event'>('task');

  const today = formatLocalDate(new Date());

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchTodayItems();
    }, [userId])
  );

  const fetchTodayItems = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Fetch tasks due today (not completed, not archived)
      const { data: taskData, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('archived', false)
        .lte('due_date', today)
        .or('status.eq.pending,status.eq.in_progress,status.is.null')
        .neq('type', 'event')
        .order('is_urgent', { ascending: false })
        .order('is_important', { ascending: false })
        .order('due_date', { ascending: true });

      if (taskError) throw taskError;

      // Fetch events for today
      const { data: eventData, error: eventError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('archived', false)
        .eq('type', 'event')
        .eq('due_date', today)
        .or('status.eq.pending,status.eq.in_progress,status.is.null')
        .order('start_time', { ascending: true });

      if (eventError) throw eventError;

      setTasks(taskData || []);
      setEvents(eventData || []);
    } catch (error) {
      console.error('Error fetching today items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (task: Task) => {
    try {
      await completeTask(task.id);
      await refreshScore();
      eventBus.emit(EVENTS.TASK_COMPLETED, { taskId: task.id });
      fetchTodayItems();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  const handleAddTask = () => {
    setFormType('task');
    setFormVisible(true);
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length + events.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Sun size={20} color="#f59e0b" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Today</Text>
        </View>
        <TouchableOpacity onPress={handleAddTask} style={styles.addButton}>
          <Plus size={24} color={colors.primary || '#3b82f6'} />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={[styles.statsBar, { backgroundColor: colors.card || '#f9fafb' }]}>
        <Text style={[styles.statsText, { color: colors.textSecondary || '#6b7280' }]}>
          {totalCount === 0
            ? 'Nothing scheduled — enjoy your day!'
            : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} · ${events.length} event${events.length !== 1 ? 's' : ''}`
          }
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary || '#3b82f6'} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Events Section */}
            {events.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Events</Text>
                {events.map((event) => (
                  <TaskCard
                    key={event.id}
                    task={event}
                    onComplete={handleComplete}
                    onPress={handleTaskPress}
                  />
                ))}
              </View>
            )}

            {/* Tasks Section */}
            {tasks.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Tasks</Text>
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onPress={handleTaskPress}
                  />
                ))}
              </View>
            )}

            {/* Empty State */}
            {totalCount === 0 && !loading && (
              <View style={styles.emptyState}>
                <CheckCircle2 size={48} color="#10b981" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>All clear!</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary || '#6b7280' }]}>
                  No tasks or events for today. Tap + to add something.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Task Detail Modal */}
      {detailModalVisible && (
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
          <ActionDetailsModal
            visible={detailModalVisible}
            task={selectedTask}
            onClose={() => {
              setDetailModalVisible(false);
              setSelectedTask(null);
            }}
            onComplete={handleComplete}
            onEdit={() => {
              setDetailModalVisible(false);
              setSelectedTask(selectedTask);
              setFormType(selectedTask?.type === 'event' ? 'event' : 'task');
              setFormVisible(true);
            }}
            onDelete={async (task) => {
              try {
                const supabase = getSupabaseClient();
                await supabase.from('0008-ap-tasks').update({ deleted_at: toLocalISOString(new Date()) }).eq('id', task.id);
                fetchTodayItems();
                setDetailModalVisible(false);
              } catch (error) {
                console.error('Error deleting task:', error);
              }
            }}
          />
        </Suspense>
      )}

      {/* Task/Event Form */}
      {formVisible && (
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
          <TaskEventForm
            visible={formVisible}
            onClose={() => {
              setFormVisible(false);
              setSelectedTask(null);
              fetchTodayItems();
            }}
            editTask={selectedTask}
            preSelectedType={formType}
            defaultDueDate={today}
          />
        </Suspense>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    padding: 4,
  },
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statsText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineWidth: 260,
  },
});
