import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSquare, Calendar, Check, UserCircle, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/dateUtils';
import {
  checkTodaysSpark,
  getScheduledActions,
  getFuelLevelMessage,
  formatTimeDisplay,
  ScheduledAction,
  ScheduledActionsData,
} from '@/lib/sparkUtils';

export default function ScheduledActionsScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [actionsData, setActionsData] = useState<ScheduledActionsData | null>(null);

  const [isAdjustModalVisible, setIsAdjustModalVisible] = useState(false);
  const [unsortedTasks, setUnsortedTasks] = useState<ScheduledAction[]>([]);
  const [tasksInKeepZone, setTasksInKeepZone] = useState<ScheduledAction[]>([]);
  const [tasksInRescheduleZone, setTasksInRescheduleZone] = useState<ScheduledAction[]>([]);
  const [tasksInCancelZone, setTasksInCancelZone] = useState<ScheduledAction[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      const [spark, actions] = await Promise.all([
        checkTodaysSpark(user.id),
        getScheduledActions(user.id),
      ]);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      setFuelLevel(spark.fuel_level);
      setActionsData(actions);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load scheduled actions. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push('/morning-spark/brain-dump');
  }

  function handleAdjust() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    const allActions = [
      ...(actionsData?.overdue || []),
      ...(actionsData?.today || []),
    ];

    setTasksInKeepZone(allActions);
    setUnsortedTasks([]);
    setTasksInRescheduleZone([]);
    setTasksInCancelZone([]);
    setSelectedTaskIds([]);
    setIsAdjustModalVisible(true);
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const moveSelectedTasksToZone = (zone: 'keep' | 'reschedule' | 'cancel') => {
    const allTasks = [...tasksInKeepZone, ...tasksInRescheduleZone, ...tasksInCancelZone];
    const selectedTasks = allTasks.filter(t => selectedTaskIds.includes(t.id));

    setTasksInKeepZone(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
    setTasksInRescheduleZone(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
    setTasksInCancelZone(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));

    if (zone === 'keep') {
      setTasksInKeepZone(prev => [...prev, ...selectedTasks]);
    } else if (zone === 'reschedule') {
      setTasksInRescheduleZone(prev => [...prev, ...selectedTasks]);
    } else if (zone === 'cancel') {
      setTasksInCancelZone(prev => [...prev, ...selectedTasks]);
    }

    setSelectedTaskIds([]);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeTaskFromZone = (taskId: string) => {
    let removedTask: ScheduledAction | undefined;

    setTasksInRescheduleZone(prev => {
      const task = prev.find(t => t.id === taskId);
      if (task) removedTask = task;
      return prev.filter(t => t.id !== taskId);
    });
    setTasksInCancelZone(prev => {
      const task = prev.find(t => t.id === taskId);
      if (task) removedTask = task;
      return prev.filter(t => t.id !== taskId);
    });

    if (removedTask) {
      setTasksInKeepZone(prev => [...prev, removedTask!]);
    }
  };

  const handleSaveAdjustments = async () => {
    if (tasksInCancelZone.length > 0) {
      const taskNames = tasksInCancelZone.map(t => `• ${t.title}`).join('\n');

      Alert.alert(
        'Confirm Deletion',
        `The following tasks will be deleted:\n\n${taskNames}\n\nAre you sure?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await performAdjustments();
            }
          }
        ]
      );
    } else {
      await performAdjustments();
    }
  };

  const performAdjustments = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatLocalDate(tomorrow);

      for (const task of tasksInRescheduleZone) {
        if (task.type === 'task') {
          await supabase
            .from('0008-ap-tasks')
            .update({ due_date: tomorrowStr, updated_at: new Date().toISOString() })
            .eq('id', task.id);
        } else {
          await supabase
            .from('0008-ap-tasks')
            .update({ start_date: tomorrowStr, updated_at: new Date().toISOString() })
            .eq('id', task.id);
        }
      }

      for (const task of tasksInCancelZone) {
        await supabase
          .from('0008-ap-tasks')
          .update({
            deleted_at: new Date().toISOString(),
            status: 'cancelled'
          })
          .eq('id', task.id);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Schedule adjusted!');
      setIsAdjustModalVisible(false);

      await loadData();
    } catch (error) {
      console.error('Error adjusting schedule:', error);
      Alert.alert('Error', 'Failed to adjust schedule');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', 'Failed to complete task');
    }
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    Alert.alert(
      'Delete Action',
      `Are you sure you want to delete "${taskTitle}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              await supabase
                .from('0008-ap-tasks')
                .update({
                  deleted_at: new Date().toISOString(),
                  status: 'cancelled'
                })
                .eq('id', taskId);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              await loadData();
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  function renderActionRow(action: ScheduledAction, isOverdue: boolean) {
    const isTask = action.type === 'task';
    const isDueToday = action.due_date === new Date().toISOString().split('T')[0];

    const timeDisplay = action.start_time
      ? formatTimeDisplay(action.start_time)
      : action.due_date
      ? new Date(action.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    const iconColor = isOverdue ? '#EF4444' : isDueToday ? '#F59E0B' : colors.textSecondary;
    const titleColor = isOverdue ? '#EF4444' : isDueToday ? '#F59E0B' : colors.text;

    return (
      <View
        key={action.id}
        style={[
          styles.actionRow,
          { borderBottomColor: colors.border }
        ]}
      >
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            onPress={() => handleCompleteTask(action.id)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Check size={18} color="#22c55e" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Delegate', 'Delegate feature coming soon!')}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <UserCircle size={18} color="#3b82f6" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteTask(action.id, action.title)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.iconContainer}>
          {isTask ? (
            <CheckSquare size={16} color={iconColor} />
          ) : (
            <Calendar size={16} color={iconColor} />
          )}
        </View>

        <View style={styles.actionContent}>
          <Text style={[styles.actionTitle, { color: titleColor }]} numberOfLines={1}>
            {action.title}
          </Text>
          <Text style={[styles.actionMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {timeDisplay}
            {action.is_all_day && ' • All Day'}
          </Text>
        </View>

        {isOverdue && (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueBadgeText}>OVERDUE</Text>
          </View>
        )}

        <Text style={[styles.points, { color: '#10B981' }]}>
          +{action.points ? action.points.toFixed(1) : '2.5'}
        </Text>
      </View>
    );
  }

  const TaskSelectionCard = ({ task, isSelected }: { task: ScheduledAction; isSelected: boolean }) => (
    <TouchableOpacity
      style={[
        styles.taskSelectionCard,
        isSelected && styles.taskSelectionCardSelected
      ]}
      onPress={() => toggleTaskSelection(task.id)}
    >
      <View style={[
        styles.checkbox,
        isSelected && styles.checkboxSelected
      ]}>
        {isSelected && <Check size={16} color="#fff" />}
      </View>
      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={styles.taskTime}>
          {task.start_time ? formatTimeDisplay(task.start_time) : 'No time'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const DropZone = ({
    title,
    subtitle,
    color,
    tasks,
    infoMessage
  }: {
    title: string;
    subtitle: string;
    color: string;
    tasks: ScheduledAction[];
    infoMessage?: string;
  }) => (
    <View style={[styles.dropZone, { borderColor: color }]}>
      <View style={[styles.dropZoneHeader, { backgroundColor: color + '20' }]}>
        <Text style={[styles.dropZoneTitle, { color }]}>{title}</Text>
        <Text style={styles.dropZoneSubtitle}>{subtitle}</Text>
      </View>

      {infoMessage && (
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => Alert.alert('Custom Date', infoMessage)}
        >
          <Text style={styles.infoText}>Need a different date? 📅</Text>
        </TouchableOpacity>
      )}

      <View style={styles.dropZoneContent}>
        {tasks.length === 0 ? (
          <Text style={styles.emptyZoneText}>No tasks here yet</Text>
        ) : (
          tasks.map(task => (
            <TaskSelectionCard
              key={task.id}
              task={task}
              isSelected={selectedTaskIds.includes(task.id)}
            />
          ))
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasActions = actionsData && (actionsData.overdue.length > 0 || actionsData.today.length > 0);
  const totalCount = actionsData ? actionsData.totalTasks + actionsData.totalEvents : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Schedule</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Your Schedule Today</Text>
          {fuelLevel && (
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              {getFuelLevelMessage(fuelLevel)}
            </Text>
          )}
          {hasActions && (
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              {actionsData.totalTasks > 0 && `${actionsData.totalTasks} task${actionsData.totalTasks > 1 ? 's' : ''}`}
              {actionsData.totalTasks > 0 && actionsData.totalEvents > 0 && ' and '}
              {actionsData.totalEvents > 0 && `${actionsData.totalEvents} event${actionsData.totalEvents > 1 ? 's' : ''}`}
              {' scheduled'}
            </Text>
          )}
        </View>

        {!hasActions ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your schedule is clear!</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You can add Deposit Ideas in the next step.
            </Text>
          </View>
        ) : (
          <>
            {actionsData.overdue.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.redLine, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
                    Overdue ({actionsData.overdue.length})
                  </Text>
                  <View style={[styles.redLine, { backgroundColor: '#EF4444' }]} />
                </View>
                <View style={[styles.actionsTable, { backgroundColor: colors.card }]}>
                  {actionsData.overdue.map((action) => renderActionRow(action, true))}
                </View>
              </View>
            )}

            {actionsData.today.length > 0 && (
              <View style={styles.section}>
                <View style={[styles.actionsTable, { backgroundColor: colors.card }]}>
                  {actionsData.today.map((action) => renderActionRow(action, false))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleAccept}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>✓ Accept Schedule</Text>
        </TouchableOpacity>

        {hasActions && (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleAdjust}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>✏️ Adjust</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={isAdjustModalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setIsAdjustModalVisible(false)}
      >
        <SafeAreaView style={styles.adjustModalContainer}>
          <View style={styles.adjustHeader}>
            <TouchableOpacity onPress={() => setIsAdjustModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.adjustTitle, { color: colors.text }]}>Adjust Today's Schedule</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.adjustContent}>
            <Text style={[styles.sortInstructions, { color: colors.textSecondary }]}>
              Sort as desired. Select tasks and move them between zones.
            </Text>

            <DropZone
              title="KEEP AS IS"
              subtitle="✓ These will stay on today"
              color="#10B981"
              tasks={tasksInKeepZone}
            />

            <DropZone
              title="RESCHEDULE (+1 Day)"
              subtitle="📅 Tomorrow"
              color="#3B82F6"
              tasks={tasksInRescheduleZone}
              infoMessage="Need a different date? Let's finish the morning spark, then we can reschedule these tasks and events."
            />

            <DropZone
              title="CANCEL"
              subtitle="🗑️ These will be deleted"
              color="#EF4444"
              tasks={tasksInCancelZone}
            />

            {selectedTaskIds.length > 0 && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#10B981' }]}
                  onPress={() => moveSelectedTasksToZone('keep')}
                >
                  <Text style={styles.actionButtonText}>Move to Keep</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                  onPress={() => moveSelectedTasksToZone('reschedule')}
                >
                  <Text style={styles.actionButtonText}>Move to Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                  onPress={() => moveSelectedTasksToZone('cancel')}
                >
                  <Text style={styles.actionButtonText}>Move to Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={[styles.adjustFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsAdjustModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAdjustments}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
  },
  titleSection: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  redLine: {
    flex: 1,
    height: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsTable: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionMeta: {
    fontSize: 13,
  },
  overdueBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  overdueBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  adjustModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  adjustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  adjustTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  adjustContent: {
    flex: 1,
    padding: 16,
  },
  sortInstructions: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  dropZone: {
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropZoneHeader: {
    padding: 12,
  },
  dropZoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dropZoneSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dropZoneContent: {
    padding: 12,
    minHeight: 80,
  },
  emptyZoneText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  infoButton: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dbeafe',
  },
  infoText: {
    fontSize: 12,
    color: '#3b82f6',
    textAlign: 'center',
  },
  tasksToSortSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  sectionTitleAdjust: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  taskSelectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  taskSelectionCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  taskTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  zonedTaskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
  },
  zonedTaskTitle: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  actionButtons: {
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  adjustFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
