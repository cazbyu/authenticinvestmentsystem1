import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import {
  AlertCircle,
  Check,
  Clock,
  AlertTriangle,
  Users,
  Tag,
  Circle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { recommendTasks } from '@/lib/recommendTasks';
import { RescheduleModal } from './RescheduleModal';
import { DelegateModal } from './DelegateModal';
import { toLocalISOString, formatLocalDate } from '@/lib/dateUtils';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  due_time?: string;
  is_urgent?: boolean;
  role_id?: string;
  domain_id?: string;
  role_label?: string;
  domain_name?: string;
  points?: number;
}

interface TasksSectionProps {
  fuelLevel: 1 | 2 | 3;
  userId: string;
  onTasksAccepted: (tasks: Task[]) => void;
}

type TaskZone = 'keep' | 'reschedule' | 'cancel' | 'delegate';

interface TaskState {
  task: Task;
  zone: TaskZone;
  selected: boolean;
}

export function TasksSection({
  fuelLevel,
  userId,
  onTasksAccepted,
}: TasksSectionProps) {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [taskStates, setTaskStates] = useState<TaskState[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [recommendedTasks, setRecommendedTasks] = useState<Task[]>([]);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [delegateModalVisible, setDelegateModalVisible] = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<Task | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [userId, fuelLevel, showAllTasks]);

  async function loadTasks() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const today = formatLocalDate(new Date());

      let query = supabase
        .from('0008-ap-tasks')
        .select(`
          *,
          0008-ap-roles!left(label),
          0008-ap-domains!left(name)
        `)
        .eq('user_id', userId)
        .eq('type', 'task')
        .eq('status', 'pending')
        .is('deleted_at', null)
        .or(`due_date.eq.${today},due_date.lt.${today},due_date.is.null`);

      if (fuelLevel === 1 && !showAllTasks) {
        query = query.eq('is_urgent', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      const tasksWithPoints: Task[] = (data || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date,
        due_time: task.due_time,
        is_urgent: task.is_urgent,
        role_id: task.role_id,
        domain_id: task.domain_id,
        role_label: task['0008-ap-roles']?.label,
        domain_name: task['0008-ap-domains']?.name,
        points: calculateTaskPoints(task),
      }));

      const sortedTasks = tasksWithPoints.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        if (a.due_time && !b.due_time) return -1;
        if (!a.due_time && b.due_time) return 1;
        if (a.due_time && b.due_time) {
          return a.due_time.localeCompare(b.due_time);
        }

        return 0;
      });

      setTaskStates(
        sortedTasks.map((task) => ({
          task,
          zone: 'keep',
          selected: false,
        }))
      );

      onTasksAccepted(sortedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Error', 'Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecommend() {
    try {
      setLoading(true);
      const tasks = await recommendTasks(userId, 3);
      setRecommendedTasks(tasks);
      setTaskStates(
        tasks.map((task) => ({
          task,
          zone: 'keep',
          selected: false,
        }))
      );
      onTasksAccepted(tasks);
    } catch (error) {
      console.error('Error recommending tasks:', error);
      Alert.alert('Error', 'Failed to recommend tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getHeaderText(): string {
    if (fuelLevel === 1) {
      if (taskStates.length === 0 && !showAllTasks) {
        return "You do not have any tasks listed as 'Urgent'. Is there 1 or 2 you'd like to complete?";
      }
      return "Let's strip it down. Here are the items you listed as 'Urgent'. Shall we just focus on these today or would you like to see all your tasks?";
    }
    return 'Here are your targeted tasks. Do the priorities look right?';
  }

  function toggleTaskSelection(taskId: string) {
    setTaskStates((prev) =>
      prev.map((ts) =>
        ts.task.id === taskId ? { ...ts, selected: !ts.selected } : ts
      )
    );
  }

  function moveSelectedTo(zone: TaskZone) {
    setTaskStates((prev) =>
      prev.map((ts) => (ts.selected ? { ...ts, zone, selected: false } : ts))
    );
    setHasChanges(true);
  }

  function moveTaskTo(taskId: string, zone: TaskZone) {
    if (zone === 'reschedule' || zone === 'delegate') {
      const taskState = taskStates.find((ts) => ts.task.id === taskId);
      if (taskState) {
        setSelectedTaskForAction(taskState.task);
        if (zone === 'reschedule') {
          setRescheduleModalVisible(true);
        } else {
          setDelegateModalVisible(true);
        }
      }
      return;
    }

    setTaskStates((prev) =>
      prev.map((ts) => (ts.task.id === taskId ? { ...ts, zone } : ts))
    );
    setHasChanges(true);
  }

  async function handleReschedule(
    taskId: string,
    newDate: string,
    newStartTime: string,
    newEndTime: string | null
  ) {
    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({
          due_date: newDate,
          due_time: newStartTime,
          times_rescheduled: supabase.rpc('increment', { x: 1 }),
        })
        .eq('id', taskId);

      if (error) throw error;

      setTaskStates((prev) => prev.filter((ts) => ts.task.id !== taskId));
      setHasChanges(true);
      setRescheduleModalVisible(false);
      setSelectedTaskForAction(null);
    } catch (error) {
      console.error('Error rescheduling task:', error);
      Alert.alert('Error', 'Failed to reschedule task. Please try again.');
    }
  }

  async function handleDelegate(
    taskId: string,
    delegateId: string,
    dueDate: string | null,
    notes: string
  ) {
    try {
      const supabase = getSupabaseClient();

      const { error: updateError } = await supabase
        .from('0008-ap-tasks')
        .update({
          delegated_to: delegateId,
          delegation_due_date: dueDate,
          delegation_notes: notes,
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      const { error: trackingError } = await supabase
        .from('0008-ap-delegation-tracking')
        .insert({
          task_id: taskId,
          delegate_id: delegateId,
          delegated_at: new Date().toISOString(),
          due_date: dueDate,
          notes: notes,
        });

      if (trackingError) throw trackingError;

      setDelegateModalVisible(false);
      setSelectedTaskForAction(null);
      setHasChanges(true);

      Alert.alert(
        'Success',
        'Task delegated. It will remain on your contract as a force multiplier.'
      );
    } catch (error) {
      console.error('Error delegating task:', error);
      Alert.alert('Error', 'Failed to delegate task. Please try again.');
    }
  }

  async function handleUpdate() {
    try {
      setSaving(true);
      const supabase = getSupabaseClient();

      const tasksToCancel = taskStates
        .filter((ts) => ts.zone === 'cancel')
        .map((ts) => ts.task.id);

      if (tasksToCancel.length > 0) {
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({
            status: 'cancelled',
            deleted_at: toLocalISOString(new Date()),
          })
          .in('id', tasksToCancel);

        if (error) throw error;
      }

      const keptTasks = taskStates
        .filter((ts) => ts.zone === 'keep' || ts.zone === 'delegate')
        .map((ts) => ts.task);

      onTasksAccepted(keptTasks);

      setTaskStates((prev) =>
        prev.filter((ts) => ts.zone === 'keep' || ts.zone === 'delegate')
      );
      setHasChanges(false);
    } catch (error) {
      console.error('Error updating tasks:', error);
      Alert.alert('Error', 'Failed to update tasks. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleLetsFocus() {
    const urgentTasks = taskStates.map((ts) => ts.task);
    onTasksAccepted(urgentTasks);
    Alert.alert(
      'Focused Mode',
      `${urgentTasks.length} urgent task${urgentTasks.length !== 1 ? 's' : ''} added to your contract.`
    );
  }

  function getPriorityColor(priority?: string): string {
    switch (priority) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return colors.textSecondary;
    }
  }

  function formatTime(time?: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (fuelLevel === 1 && taskStates.length === 0 && !showAllTasks && recommendedTasks.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          {getHeaderText()}
        </Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleRecommend}
          >
            <Text style={styles.actionButtonText}>Recommend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => setShowAllTasks(true)}
          >
            <Text style={[styles.actionButtonTextSecondary, { color: colors.text }]}>
              Show All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => onTasksAccepted([])}
          >
            <Text style={[styles.actionButtonTextSecondary, { color: colors.text }]}>
              No, Not Today
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (fuelLevel === 1 && !showAllTasks && taskStates.length > 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.headerText, { color: colors.text }]}>
          {getHeaderText()}
        </Text>

        <ScrollView style={styles.taskList}>
          {taskStates.map(({ task }) => (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.taskContent}>
                <View
                  style={[
                    styles.priorityIndicator,
                    { backgroundColor: getPriorityColor(task.priority) },
                  ]}
                />

                <View style={styles.taskDetails}>
                  <Text style={[styles.taskTitle, { color: colors.text }]}>
                    {task.title}
                  </Text>

                  <View style={styles.taskMeta}>
                    {task.due_time && (
                      <View style={styles.metaItem}>
                        <Clock size={14} color={colors.textSecondary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          {formatTime(task.due_time)}
                        </Text>
                      </View>
                    )}

                    {task.role_label && (
                      <View style={styles.metaItem}>
                        <Tag size={14} color={colors.textSecondary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          {task.role_label}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.pointsText, { color: colors.primary }]}>
                    +{task.points}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleLetsFocus}
          >
            <Text style={styles.actionButtonText}>Let's Focus</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => setShowAllTasks(true)}
          >
            <Text style={[styles.actionButtonTextSecondary, { color: colors.text }]}>
              Show All
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const keptTasks = taskStates.filter((ts) => ts.zone === 'keep');
  const rescheduledTasks = taskStates.filter((ts) => ts.zone === 'reschedule');
  const cancelledTasks = taskStates.filter((ts) => ts.zone === 'cancel');
  const delegatedTasks = taskStates.filter((ts) => ts.zone === 'delegate');
  const hasSelectedTasks = taskStates.some((ts) => ts.selected);

  return (
    <View style={styles.container}>
      <Text style={[styles.headerText, { color: colors.text }]}>
        {getHeaderText()}
      </Text>

      {taskStates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertCircle size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No tasks for today
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.zoneContainer}>
            <View style={styles.zoneHeader}>
              <Check size={18} color="#10B981" />
              <Text style={[styles.zoneTitle, { color: colors.text }]}>
                Keep ({keptTasks.length})
              </Text>
            </View>

            {keptTasks.map(({ task, selected }) => (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
                onPress={() => toggleTaskSelection(task.id)}
                activeOpacity={0.7}
              >
                <View style={styles.taskContent}>
                  <View
                    style={[
                      styles.priorityIndicator,
                      { backgroundColor: getPriorityColor(task.priority) },
                    ]}
                  />

                  <View style={styles.taskDetails}>
                    <Text style={[styles.taskTitle, { color: colors.text }]}>
                      {task.title}
                    </Text>

                    <View style={styles.taskMeta}>
                      {task.due_time && (
                        <View style={styles.metaItem}>
                          <Clock size={14} color={colors.textSecondary} />
                          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {formatTime(task.due_time)}
                          </Text>
                        </View>
                      )}

                      {task.role_label && (
                        <View style={styles.metaItem}>
                          <Tag size={14} color={colors.textSecondary} />
                          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {task.role_label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.pointsText, { color: colors.primary }]}>
                      +{task.points}
                    </Text>
                  </View>
                </View>

                <View style={styles.taskActions}>
                  <TouchableOpacity
                    style={[styles.taskActionButton, { backgroundColor: '#F59E0B20' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      moveTaskTo(task.id, 'reschedule');
                    }}
                  >
                    <Clock size={14} color="#F59E0B" />
                    <Text style={[styles.taskActionButtonText, { color: '#F59E0B' }]}>
                      Reschedule
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.taskActionButton, { backgroundColor: '#8B5CF620' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      moveTaskTo(task.id, 'delegate');
                    }}
                  >
                    <Users size={14} color="#8B5CF6" />
                    <Text style={[styles.taskActionButtonText, { color: '#8B5CF6' }]}>
                      Delegate
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.taskActionButton, { backgroundColor: '#EF444420' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      moveTaskTo(task.id, 'cancel');
                    }}
                  >
                    <AlertTriangle size={14} color="#EF4444" />
                    <Text style={[styles.taskActionButtonText, { color: '#EF4444' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {rescheduledTasks.length > 0 && (
            <View style={[styles.zoneContainer, styles.warningZone]}>
              <View style={styles.zoneHeader}>
                <Clock size={18} color="#F59E0B" />
                <Text style={[styles.zoneTitle, { color: colors.text }]}>
                  To Reschedule ({rescheduledTasks.length})
                </Text>
              </View>

              {rescheduledTasks.map(({ task }) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    { backgroundColor: '#F59E0B10', borderColor: '#F59E0B' },
                  ]}
                >
                  <Text style={[styles.taskTitle, { color: colors.text }]}>
                    {task.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {delegatedTasks.length > 0 && (
            <View style={[styles.zoneContainer, styles.delegateZone]}>
              <View style={styles.zoneHeader}>
                <Users size={18} color="#8B5CF6" />
                <Text style={[styles.zoneTitle, { color: colors.text }]}>
                  Delegated ({delegatedTasks.length})
                </Text>
              </View>

              {delegatedTasks.map(({ task }) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    { backgroundColor: '#8B5CF610', borderColor: '#8B5CF6' },
                  ]}
                >
                  <Text style={[styles.taskTitle, { color: colors.text }]}>
                    {task.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {cancelledTasks.length > 0 && (
            <View style={[styles.zoneContainer, styles.dangerZone]}>
              <View style={styles.zoneHeader}>
                <AlertTriangle size={18} color="#EF4444" />
                <Text style={[styles.zoneTitle, { color: '#EF4444' }]}>
                  ⚠️ Items here will be deleted ({cancelledTasks.length})
                </Text>
              </View>

              {cancelledTasks.map(({ task }) => (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    { backgroundColor: '#EF444410', borderColor: '#EF4444' },
                  ]}
                >
                  <Text style={[styles.taskTitle, { color: colors.text }]}>
                    {task.title}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {hasSelectedTasks && (
            <View style={[styles.actionBar, { backgroundColor: colors.surface }]}>
              <Text style={[styles.actionBarText, { color: colors.text }]}>
                Selected: {taskStates.filter((ts) => ts.selected).length}
              </Text>
              <View style={styles.actionBarButtons}>
                <TouchableOpacity
                  style={[styles.moveButton, { backgroundColor: '#F59E0B' }]}
                  onPress={() => moveSelectedTo('reschedule')}
                >
                  <Text style={styles.moveButtonText}>Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moveButton, { backgroundColor: '#8B5CF6' }]}
                  onPress={() => moveSelectedTo('delegate')}
                >
                  <Text style={styles.moveButtonText}>Delegate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moveButton, { backgroundColor: '#EF4444' }]}
                  onPress={() => moveSelectedTo('cancel')}
                >
                  <Text style={styles.moveButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.updateButton,
              { backgroundColor: hasChanges ? colors.primary : colors.border },
            ]}
            onPress={handleUpdate}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.updateButtonText}>
                {hasChanges ? 'Update' : 'Keep As Is'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <RescheduleModal
        visible={rescheduleModalVisible}
        event={
          selectedTaskForAction
            ? {
                id: selectedTaskForAction.id,
                title: selectedTaskForAction.title,
                start_date: selectedTaskForAction.due_date || '',
                start_time: selectedTaskForAction.due_time || '',
                end_time: undefined,
              }
            : null
        }
        onClose={() => {
          setRescheduleModalVisible(false);
          setSelectedTaskForAction(null);
        }}
        onReschedule={handleReschedule}
      />

      <DelegateModal
        visible={delegateModalVisible}
        task={selectedTaskForAction}
        userId={userId}
        onClose={() => {
          setDelegateModalVisible(false);
          setSelectedTaskForAction(null);
        }}
        onDelegate={handleDelegate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
  },
  taskList: {
    marginBottom: 20,
  },
  zoneContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  warningZone: {
    backgroundColor: '#F59E0B05',
    borderColor: '#F59E0B',
  },
  delegateZone: {
    backgroundColor: '#8B5CF605',
    borderColor: '#8B5CF6',
  },
  dangerZone: {
    backgroundColor: '#EF444405',
    borderColor: '#EF4444',
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  zoneTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  taskCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
    minHeight: 40,
  },
  taskDetails: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 6,
  },
  taskActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 6,
  },
  taskActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionBarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  moveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  updateButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
