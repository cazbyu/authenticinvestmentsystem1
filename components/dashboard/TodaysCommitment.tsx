// Enhanced Dashboard commitment component
// Shows committed items from Morning Spark V2 with real-time updates and completion tracking
// Uses committed_task_ids from daily-sparks to show ONLY items the user explicitly committed to

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Calendar,
  CheckSquare,
  Flame,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  MoreHorizontal,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import { formatTimeDisplay, getFuelEmoji } from '@/lib/sparkUtils';
import { DateTimePickerModal } from '@/components/DateTimePickerModal';

interface CommittedEvent {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  points: number;
  completed_at?: string | null;
}

interface CommittedTask {
  id: string;
  title: string;
  points: number;
  is_urgent?: boolean;
  is_important?: boolean;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  completed_at?: string | null;
}

interface TodaysCommitmentData {
  spark_id: string;
  fuel_level: 1 | 2 | 3;
  events: CommittedEvent[];
  tasks: CommittedTask[];
  commit_reflection: boolean;
  commit_rose: boolean;
  commit_thorn: boolean;
  target_score: number;
  current_score: number;
}

interface TodaysCommitmentProps {
  userId: string;
  onRefresh?: () => void;
}

export function TodaysCommitment({ userId, onRefresh }: TodaysCommitmentProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [commitment, setCommitment] = useState<TodaysCommitmentData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reschedulingItem, setReschedulingItem] = useState<{
    type: 'task' | 'event';
    id: string;
    currentDate?: string;
  } | null>(null);

  useEffect(() => {
    loadCommitment();
    setupRealtimeSubscriptions();
  }, [userId]);

  function setupRealtimeSubscriptions() {
    const supabase = getSupabaseClient();

    // Subscribe to task/event updates (both in same table)
    const taskChannel = supabase
      .channel('dashboard-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: '0008-ap-tasks',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadCommitment();
          onRefresh?.();
        }
      )
      .subscribe();

    return () => {
      taskChannel.unsubscribe();
    };
  }

  async function loadCommitment() {
    try {
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      // Get today's spark
      const { data: spark } = await supabase
        .from('0008-ap-daily-sparks')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', today)
        .single();

      if (!spark || !spark.committed_at) {
        setCommitment(null);
        setLoading(false);
        return;
      }

      // Get committed task IDs and pre-calculated points from V2 Morning Spark
      const committedTaskIds: string[] = spark.committed_task_ids || [];
      const committedTaskPoints: Record<string, number> = spark.committed_task_points || {};
      const hasV2CommittedIds = committedTaskIds.length > 0;

      console.log('[TodaysCommitment] Loading. V2 committed IDs:', committedTaskIds.length,
        'points map entries:', Object.keys(committedTaskPoints).length,
        'committed_at:', spark.committed_at);

      let events: CommittedEvent[] = [];
      let tasks: CommittedTask[] = [];

      if (hasV2CommittedIds) {
        // V2 flow: Load ONLY the tasks/events the user committed to
        // Note: 'points' is NOT a column in 0008-ap-tasks — use committedTaskPoints map instead
        const { data: committedData } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, start_date, start_time, end_time, due_date, is_urgent, is_important, completed_at, status')
          .in('id', committedTaskIds);

        const allItems = committedData || [];

        events = allItems
          .filter(item => item.type === 'event')
          .map(e => ({
            id: e.id,
            title: e.title,
            start_time: e.start_time || `${today}T09:00:00`,
            end_time: e.end_time,
            points: committedTaskPoints[e.id] || 3,
            completed_at: e.completed_at,
          }));

        tasks = allItems
          .filter(item => item.type === 'task')
          .map(t => ({
            id: t.id,
            title: t.title,
            points: committedTaskPoints[t.id] || 3,
            is_urgent: t.is_urgent,
            is_important: t.is_important,
            due_date: t.due_date,
            start_time: t.start_time,
            end_time: t.end_time,
            completed_at: t.completed_at,
          }));
      } else {
        // V1 fallback: Load all events/tasks for today (legacy behavior)
        // Points default to 3 since the tasks table has no 'points' column
        const { data: eventsData } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, start_date, start_time, end_time, completed_at')
          .eq('user_id', userId)
          .eq('type', 'event')
          .eq('start_date', today)
          .in('status', ['pending', 'in_progress', 'completed'])
          .order('start_time', { ascending: true });

        const { data: tasksData } = await supabase
          .from('0008-ap-tasks')
          .select('id, title, type, due_date, start_time, end_time, is_urgent, is_important, completed_at')
          .eq('user_id', userId)
          .eq('type', 'task')
          .eq('due_date', today)
          .in('status', ['pending', 'in_progress', 'completed'])
          .order('is_important', { ascending: false });

        events = (eventsData || []).map(e => ({
          id: e.id,
          title: e.title,
          start_time: e.start_time || `${today}T09:00:00`,
          end_time: e.end_time,
          points: 3,
          completed_at: e.completed_at,
        }));

        tasks = (tasksData || []).map(t => ({
          id: t.id,
          title: t.title,
          points: 3,
          is_urgent: t.is_urgent,
          is_important: t.is_important,
          due_date: t.due_date,
          start_time: t.start_time,
          end_time: t.end_time,
          completed_at: t.completed_at,
        }));
      }

      console.log('[TodaysCommitment] Loaded', events.length, 'events,', tasks.length, 'tasks');

      // Calculate current score
      const completedEventPoints = events
        .filter(e => e.completed_at)
        .reduce((sum, e) => sum + e.points, 0);

      const completedTaskPoints = tasks
        .filter(t => t.completed_at)
        .reduce((sum, t) => sum + t.points, 0);

      const reflectionPoints = Math.min(
        (spark.commit_reflection ? 1 : 0) +
        (spark.commit_rose ? 2 : 0) +
        (spark.commit_thorn ? 1 : 0),
        10
      );

      const currentScore = completedEventPoints + completedTaskPoints + reflectionPoints;

      setCommitment({
        spark_id: spark.id,
        fuel_level: spark.fuel_level,
        events: events,
        tasks: tasks,
        commit_reflection: spark.commit_reflection || false,
        commit_rose: spark.commit_rose || false,
        commit_thorn: spark.commit_thorn || false,
        target_score: spark.initial_target_score || 0,
        current_score: currentScore,
      });
    } catch (error) {
      console.error('Error loading commitment:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      setProcessingId(taskId);
      const supabase = getSupabaseClient();
      
      await supabase
        .from('0008-ap-tasks')
        .update({ 
          completed_at: toLocalISOString(new Date()),
          status: 'completed'
        })
        .eq('id', taskId);

      await loadCommitment();
      onRefresh?.();
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', 'Failed to complete task');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCompleteEvent(eventId: string) {
    try {
      setProcessingId(eventId);
      const supabase = getSupabaseClient();
      
      // Events are in the tasks table with type='event'
      await supabase
        .from('0008-ap-tasks')
        .update({ 
          completed_at: toLocalISOString(new Date()),
          status: 'completed'
        })
        .eq('id', eventId);

      await loadCommitment();
      onRefresh?.();
    } catch (error) {
      console.error('Error completing event:', error);
      Alert.alert('Error', 'Failed to complete event');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReschedule(newDate: Date, newTime?: Date) {
    if (!reschedulingItem) return;

    try {
      setProcessingId(reschedulingItem.id);
      const supabase = getSupabaseClient();
      
      const dateStr = toLocalISOString(newDate).split('T')[0];
      
      if (reschedulingItem.type === 'task') {
        // Tasks use due_date and can have start_time/end_time
        const updates: any = { due_date: dateStr };
        
        if (newTime) {
          // Update start_time if time provided
          updates.start_time = toLocalISOString(newTime);
        }
        
        await supabase
          .from('0008-ap-tasks')
          .update(updates)
          .eq('id', reschedulingItem.id);
      } else {
        // Events use start_date and have start_time/end_time
        const timeStr = newTime 
          ? toLocalISOString(newTime)
          : (reschedulingItem.currentDate 
              ? `${dateStr}T${reschedulingItem.currentDate.split('T')[1] || '09:00:00'}`
              : `${dateStr}T09:00:00`);
        
        await supabase
          .from('0008-ap-tasks')
          .update({ 
            start_date: dateStr,
            start_time: timeStr,
            // TODO: Handle end_time - may need duration calculation
          })
          .eq('id', reschedulingItem.id);
      }

      setReschedulingItem(null);
      await loadCommitment();
      onRefresh?.();
    } catch (error) {
      console.error('Error rescheduling:', error);
      Alert.alert('Error', 'Failed to reschedule');
    } finally {
      setProcessingId(null);
    }
  }

  function navigateToReflections() {
    // Navigate to reflections section or open reflection modal
    router.push('/(tabs)/dashboard?tab=reflect');
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!commitment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>☀️</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Start Your Morning Spark
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Set your energy level and commit to today's actions
          </Text>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/morning-spark-v2')}
          >
            <Text style={styles.startButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const progress = commitment.target_score > 0 
    ? Math.min(Math.round((commitment.current_score / commitment.target_score) * 100), 100)
    : 0;

  const totalItems = commitment.events.length + commitment.tasks.length;
  const completedItems = 
    commitment.events.filter(e => e.completed_at).length +
    commitment.tasks.filter(t => t.completed_at).length;

  const remainingPoints = Math.max(0, commitment.target_score - commitment.current_score);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header - Always Visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.emoji}>{getFuelEmoji(commitment.fuel_level)}</Text>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: colors.text }]}>
              Today's Contract
            </Text>
            <View style={styles.scoreRow}>
              <Flame size={14} color={colors.primary} />
              <Text style={[styles.score, { color: colors.primary }]}>
                {commitment.current_score}/{commitment.target_score}
              </Text>
              <Text style={[styles.remainingText, { color: colors.textSecondary }]}>
                • {remainingPoints} to go
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {collapsed ? (
            <ChevronDown size={20} color={colors.textSecondary} />
          ) : (
            <ChevronUp size={20} color={colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {/* Progress Bar - Always Visible */}
      <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: progress >= 100 ? '#10B981' : colors.primary,
              width: `${progress}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.progressText, { color: colors.textSecondary }]}>
        {progress}% Complete • {completedItems}/{totalItems} items done
      </Text>

      {/* Expandable Content */}
      {!collapsed && (
        <>
          {/* Events */}
          {commitment.events.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                EVENTS ({commitment.events.length})
              </Text>
              {commitment.events.map(event => (
                <View
                  key={event.id}
                  style={[
                    styles.item,
                    { borderBottomColor: colors.border },
                    event.completed_at && styles.completedItem,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => handleCompleteEvent(event.id)}
                    disabled={!!event.completed_at || processingId === event.id}
                  >
                    {event.completed_at ? (
                      <View style={[styles.checkedBox, { backgroundColor: '#10B981' }]}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={[styles.uncheckedBox, { borderColor: colors.border }]} />
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.itemContent}>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: colors.text },
                        event.completed_at && styles.completedText,
                      ]}
                    >
                      {event.title}
                    </Text>
                    <Text style={[styles.itemTime, { color: colors.textSecondary }]}>
                      {formatTimeDisplay(event.start_time)}
                    </Text>
                  </View>
                  
                  <Text style={[styles.points, { color: event.completed_at ? '#10B981' : colors.primary }]}>
                    +{event.points}
                  </Text>
                  
                  {!event.completed_at && (
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => setReschedulingItem({ type: 'event', id: event.id })}
                    >
                      <MoreHorizontal size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Tasks */}
          {commitment.tasks.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                TASKS ({commitment.tasks.length})
              </Text>
              {commitment.tasks.map(task => (
                <View
                  key={task.id}
                  style={[
                    styles.item,
                    { borderBottomColor: colors.border },
                    task.completed_at && styles.completedItem,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => handleCompleteTask(task.id)}
                    disabled={!!task.completed_at || processingId === task.id}
                  >
                    {task.completed_at ? (
                      <View style={[styles.checkedBox, { backgroundColor: '#10B981' }]}>
                        <Check size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={[styles.uncheckedBox, { borderColor: colors.border }]} />
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.itemContent}>
                    <Text
                      style={[
                        styles.itemTitle,
                        { color: colors.text },
                        task.completed_at && styles.completedText,
                      ]}
                    >
                      {task.title}
                    </Text>
                  </View>
                  
                  <Text style={[styles.points, { color: task.completed_at ? '#10B981' : colors.primary }]}>
                    +{task.points}
                  </Text>
                  
                  {!task.completed_at && (
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => setReschedulingItem({ 
                        type: 'task', 
                        id: task.id,
                        currentDate: task.due_date 
                      })}
                    >
                      <MoreHorizontal size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Reflections */}
          {(commitment.commit_reflection || commitment.commit_rose || commitment.commit_thorn) && (
            <View style={styles.section}>
              <View style={styles.reflectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  REFLECTIONS
                </Text>
                <TouchableOpacity onPress={navigateToReflections}>
                  <Text style={[styles.addLink, { color: colors.primary }]}>Add →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.reflections}>
                {commitment.commit_reflection && (
                  <View style={[styles.reflectionBadge, { backgroundColor: colors.background }]}>
                    <Text style={[styles.reflectionText, { color: colors.text }]}>
                      💭 Reflection
                    </Text>
                  </View>
                )}
                {commitment.commit_rose && (
                  <View style={[styles.reflectionBadge, { backgroundColor: colors.background }]}>
                    <Text style={[styles.reflectionText, { color: colors.text }]}>
                      🌹 Rose
                    </Text>
                  </View>
                )}
                {commitment.commit_thorn && (
                  <View style={[styles.reflectionBadge, { backgroundColor: colors.background }]}>
                    <Text style={[styles.reflectionText, { color: colors.text }]}>
                      🌵 Thorn
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Motivation Message */}
          <View style={[styles.motivation, { backgroundColor: colors.background }]}>
            <Text style={[styles.motivationText, { color: colors.text }]}>
              {getMotivationMessage(commitment.fuel_level, progress, remainingPoints)}
            </Text>
          </View>
        </>
      )}

      {/* Reschedule Modal */}
      {reschedulingItem && (
        <DateTimePickerModal
          visible={true}
          mode={reschedulingItem.type}
          initialDate={reschedulingItem.currentDate ? new Date(reschedulingItem.currentDate) : new Date()}
          onConfirm={handleReschedule}
          onCancel={() => setReschedulingItem(null)}
        />
      )}
    </View>
  );
}

function getMotivationMessage(fuelLevel: 1 | 2 | 3, progress: number, remaining: number): string {
  if (progress >= 100) {
    return "🎉 Crushed it! You completed everything you committed to today!";
  }
  
  if (remaining > 0 && remaining <= 10) {
    return `💪 Just ${remaining} more points! You're so close—finish strong!`;
  }
  
  if (progress >= 75) {
    return "🔥 Almost there! Keep the momentum going!";
  }
  
  if (progress >= 50) {
    return "👍 Great progress! You're over halfway!";
  }
  
  if (progress >= 25) {
    return "📈 Good start! Stay focused on your commitments.";
  }
  
  if (fuelLevel === 1) {
    return "🛡️ One step at a time. Every action counts.";
  } else if (fuelLevel === 2) {
    return "⚖️ Consistency is key. Let's keep moving forward!";
  } else {
    return "⚡ Channel that energy! Time to make things happen!";
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  emoji: {
    fontSize: 36,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  score: {
    fontSize: 15,
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerRight: {
    padding: 4,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  reflectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  completedItem: {
    opacity: 0.6,
  },
  checkbox: {
    padding: 2,
  },
  checkedBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckedBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  itemTime: {
    fontSize: 13,
    marginTop: 2,
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  moreButton: {
    padding: 4,
  },
  reflections: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reflectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reflectionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  motivation: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
  },
  motivationText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});