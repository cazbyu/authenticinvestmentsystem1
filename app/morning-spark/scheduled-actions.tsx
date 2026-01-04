import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
// Renamed Calendar to CalendarIcon to avoid collision with the new Calendar component
import { ArrowLeft, CheckSquare, Calendar as CalendarIcon, Check, UserCircle, Trash2, X, Info, GripVertical } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
// Added parseLocalDate to imports
import { formatLocalDate, toLocalISOString, parseLocalDate } from '@/lib/dateUtils';
import { TimePickerDropdown } from '@/components/tasks/TimePickerDropdown';
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
  const [tasksInKeepZone, setTasksInKeepZone] = useState<ScheduledAction[]>([]);
  const [tasksInRescheduleZone, setTasksInRescheduleZone] = useState<ScheduledAction[]>([]);
  const [tasksInCancelZone, setTasksInCancelZone] = useState<ScheduledAction[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Date/time state for rescheduling
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const [rescheduleTimes, setRescheduleTimes] = useState<Record<string, { start?: string; end?: string; due?: string }>>({});

  // Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeCalendarTaskId, setActiveCalendarTaskId] = useState<string | null>(null);

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

  // Helper for displaying dates
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    try {
      // Ensure parseLocalDate exists in your dateUtils, otherwise use new Date(dateString)
      const date = parseLocalDate ? parseLocalDate(dateString) : new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

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

    // Initialize with tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    const initialDates: Record<string, string> = {};
    const initialTimes: Record<string, { start?: string; end?: string; due?: string }> = {};

    allActions.forEach(task => {
      initialDates[task.id] = tomorrowStr;
      if (task.type === 'task') {
        // ✅ FIXED: Use due_time instead of due_date
        initialTimes[task.id] = { due: task.due_time || '' };
      } else {
        initialTimes[task.id] = {
          start: task.start_time || '',
          end: task.end_time || ''
        };
      }
    });

    setTasksInKeepZone(allActions);
    setTasksInRescheduleZone([]);
    setTasksInCancelZone([]);
    setSelectedTaskId(null);
    setRescheduleDates(initialDates);
    setRescheduleTimes(initialTimes);
    setIsAdjustModalVisible(true);
  }

  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(prev => prev === taskId ? null : taskId);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const moveTaskToZone = (targetZone: 'keep' | 'reschedule' | 'cancel') => {
    if (!selectedTaskId) return;

    let task: ScheduledAction | undefined;

    setTasksInKeepZone(prev => {
      const found = prev.find(t => t.id === selectedTaskId);
      if (found) task = found;
      return prev.filter(t => t.id !== selectedTaskId);
    });

    setTasksInRescheduleZone(prev => {
      if (!task) {
        const found = prev.find(t => t.id === selectedTaskId);
        if (found) task = found;
      }
      return prev.filter(t => t.id !== selectedTaskId);
    });

    setTasksInCancelZone(prev => {
      if (!task) {
        const found = prev.find(t => t.id === selectedTaskId);
        if (found) task = found;
      }
      return prev.filter(t => t.id !== selectedTaskId);
    });

    if (task) {
      if (targetZone === 'keep') {
        setTasksInKeepZone(prev => [...prev, task!]);
      } else if (targetZone === 'reschedule') {
        setTasksInRescheduleZone(prev => [...prev, task!]);
      } else if (targetZone === 'cancel') {
        setTasksInCancelZone(prev => [...prev, task!]);
      }
    }

    setSelectedTaskId(null);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSaveAdjustments = async () => {
    if (tasksInCancelZone.length > 0) {
      const taskNames = tasksInCancelZone.map(t => `• ${t.title}`).join('\n');

      Alert.alert(
        'Confirm Deletion',
        `The following tasks will be permanently deleted:\n\n${taskNames}\n\nThis cannot be undone. Are you sure?`,
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

      // RESCHEDULE ZONE - Update dates/times
      for (const task of tasksInRescheduleZone) {
        const newDate = rescheduleDates[task.id];
        const newTimes = rescheduleTimes[task.id];

        if (task.type === 'task') {
          await supabase
            .from('0008-ap-tasks')
            .update({
              due_date: newDate,
              // ✅ FIXED: Use due_time instead of due_date
              due_time: newTimes?.due || task.due_time,
              updated_at: toLocalISOString(new Date())
            })
            .eq('id', task.id);
        } else {
          await supabase
            .from('0008-ap-tasks')
            .update({
              start_date: newDate,
              start_time: newTimes?.start || task.start_time,
              end_time: newTimes?.end || task.end_time,
              updated_at: toLocalISOString(new Date())
            })
            .eq('id', task.id);
        }
      }

      // CANCEL ZONE - Mark as deleted
      for (const task of tasksInCancelZone) {
        await supabase
          .from('0008-ap-tasks')
          .update({
            deleted_at: toLocalISOString(new Date()),
            status: 'cancelled'
          })
          .eq('id', task.id);
      }

      // KEEP ZONE - No changes needed!

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // SUCCESS FEEDBACK - Close modal and refresh
      Alert.alert('Success', 'Your schedule has been updated!', [
        {
          text: 'OK',
          onPress: async () => {
            setIsAdjustModalVisible(false);
            await loadData(); // Refresh the main screen
          }
        }
      ]);
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
        .update({ status: 'completed', completed_at: toLocalISOString(new Date()) })
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
                  deleted_at: toLocalISOString(new Date()),
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

    const getPriorityColor = () => {
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

    const priorityColor = getPriorityColor();
    const iconColor = colors.primary;
    const titleColor = priorityColor;

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
            <CalendarIcon size={16} color={iconColor} />
          )}
        </View>

        <View style={styles.actionContent}>
          <Text style={[styles.actionTitle, { color: titleColor }]} numberOfLines={1}>
            {action.title}
            {isOverdue && action.due_date && (
              <Text style={styles.overdueText}>
                {' '}(Overdue - {new Date(action.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </Text>
            )}
          </Text>
        </View>

        <Text style={[styles.points, { color: '#10B981' }]}>
          +{Math.round(action.points || 3)}
        </Text>
      </View>
    );
  }

  const ZoneTooltip = ({ message }: { message: string }) => {
    const [visible, setVisible] = useState(false);

    return (
      <View style={styles.tooltipContainer}>
        <TouchableOpacity
          onPress={() => setVisible(!visible)}
          // @ts-ignore - Web-only hover events
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => setVisible(false)}
          style={styles.tooltipButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Info size={18} color="#6b7280" />
        </TouchableOpacity>
        {visible && (
          <View style={styles.tooltipBubble}>
            <Text style={styles.tooltipText}>{message}</Text>
          </View>
        )}
      </View>
    );
  };

  const SimpleTaskCard = ({ item, zone }: { item: ScheduledAction; zone: 'keep' | 'reschedule' | 'cancel' }) => {
    const isSelected = selectedTaskId === item.id;
    const isTask = item.type === 'task';

    return (
      <View
        style={[
          styles.draggableCard,
          isSelected && styles.draggableCardSelected,
        ]}
      >
        <View style={styles.dragHandle}>
          <GripVertical size={16} color="#9ca3af" />
        </View>

        <View style={styles.taskIconContainer}>
          {isTask ? (
            <CheckSquare size={16} color="#6b7280" />
          ) : (
            <CalendarIcon size={16} color="#6b7280" />
          )}
        </View>

        <TouchableOpacity
          onPress={() => handleTaskSelect(item.id)}
          style={styles.taskContent}
        >
          <Text style={styles.taskTitle}>{item.title}</Text>
          <Text style={styles.taskTime}>
            {item.start_time ? formatTimeDisplay(item.start_time) : 'No time'}
          </Text>
        </TouchableOpacity>

        {/* Date/Time Pickers for Reschedule Zone */}
        {zone === 'reschedule' && (
          <View style={styles.rescheduleInputs}>
            {/* Date Picker Button */}
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => {
                setActiveCalendarTaskId(item.id);
                setShowCalendar(true);
              }}
            >
              <CalendarIcon size={14} color="#6b7280" />
              <Text style={styles.datePickerText}>
                {formatDateForDisplay(rescheduleDates[item.id] || item.due_date || item.start_date || '')}
              </Text>
            </TouchableOpacity>

            {/* Time Pickers */}
            {isTask ? (
              <TimePickerDropdown
                value={rescheduleTimes[item.id]?.due || ''}
                onChange={(time) => setRescheduleTimes({
                  ...rescheduleTimes,
                  [item.id]: { due: time }
                })}
                placeholder="Due time"
                isDark={isDarkMode}
              />
            ) : (
              <View style={styles.eventTimes}>
                <TimePickerDropdown
                  value={rescheduleTimes[item.id]?.start || ''}
                  onChange={(time) => setRescheduleTimes({
                    ...rescheduleTimes,
                    [item.id]: { ...rescheduleTimes[item.id], start: time }
                  })}
                  placeholder="Start"
                  isDark={isDarkMode}
                />
                <TimePickerDropdown
                  value={rescheduleTimes[item.id]?.end || ''}
                  onChange={(time) => setRescheduleTimes({
                    ...rescheduleTimes,
                    [item.id]: { ...rescheduleTimes[item.id], end: time }
                  })}
                  placeholder="End"
                  isDark={isDarkMode}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const SimpleDropZone = ({
    title,
    subtitle,
    color,
    tasks,
    tooltipMessage,
    zone,
  }: {
    title: string;
    subtitle: string;
    color: string;
    tasks: ScheduledAction[];
    tooltipMessage: string;
    zone: 'keep' | 'reschedule' | 'cancel';
  }) => (
    <View style={[styles.dropZone, { borderColor: color }]}>
      <View style={[styles.dropZoneHeader, { backgroundColor: color + '20' }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.dropZoneTitle, { color }]}>{title}</Text>
          <ZoneTooltip message={tooltipMessage} />
        </View>
        <Text style={styles.dropZoneSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.dropZoneContent}>
        {tasks.length === 0 ? (
          <View style={styles.emptyDropZone}>
            <Text style={styles.emptyZoneText}>Tap tasks below to move here</Text>
          </View>
        ) : (
          <View>
            {tasks.map(task => (
              <SimpleTaskCard key={task.id} item={task} zone={zone} />
            ))}
          </View>
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
                <View style={[styles.actionsTable, { backgroundColor: colors.surface }]}>
                  {actionsData.overdue.map((action) => renderActionRow(action, true))}
                </View>
              </View>
            )}

            {actionsData.today.length > 0 && (
              <View style={styles.section}>
                <View style={[styles.actionsTable, { backgroundColor: colors.surface }]}>
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
            <Text style={[styles.adjustTitle, { color: colors.text }]}>Adjust Today's Schedule</Text>
            <TouchableOpacity onPress={() => setIsAdjustModalVisible(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.adjustContent}>
            <Text style={[styles.sortInstructions, { color: colors.textSecondary }]}>
              Tap a task to select it, then use the buttons below to move between zones.
            </Text>

            <SimpleDropZone
              title="KEEP AS IS"
              subtitle="✓ These will stay on today"
              color="#10B981"
              tasks={tasksInKeepZone}
              tooltipMessage="These tasks will remain scheduled for today."
              zone="keep"
            />

            <SimpleDropZone
              title="RESCHEDULE"
              subtitle="📅 Adjust date and time"
              color="#3B82F6"
              tasks={tasksInRescheduleZone}
              tooltipMessage="Update the date and time for these tasks."
              zone="reschedule"
            />

            <SimpleDropZone
              title="CANCEL"
              subtitle="🗑️ These will be deleted"
              color="#EF4444"
              tasks={tasksInCancelZone}
              tooltipMessage="These tasks will be permanently deleted. This cannot be undone."
              zone="cancel"
            />
          </ScrollView>

          {selectedTaskId && (
            <View style={styles.zoneMoveButtons}>
              <TouchableOpacity
                style={[styles.zoneMoveButton, { backgroundColor: '#3B82F6' }]}
                onPress={() => moveTaskToZone('reschedule')}
              >
                <Text style={styles.zoneMoveText}>Move to Reschedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoneMoveButton, { backgroundColor: '#EF4444' }]}
                onPress={() => moveTaskToZone('cancel')}
              >
                <Text style={styles.zoneMoveText}>Move to Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

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

      {/* Calendar Modal for Reschedule Dates */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarOverlay}>
          <View style={[styles.calendarContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.calendarHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>
                Select New Date
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              onDayPress={(day: any) => {
                if (activeCalendarTaskId) {
                  setRescheduleDates({
                    ...rescheduleDates,
                    [activeCalendarTaskId]: day.dateString
                  });
                }
                setShowCalendar(false);
                setActiveCalendarTaskId(null);
              }}
              markedDates={
                activeCalendarTaskId
                  ? {
                    [rescheduleDates[activeCalendarTaskId] || '']: {
                      selected: true,
                      selectedColor: colors.primary
                    }
                  }
                  : {}
              }
              theme={{
                backgroundColor: colors.surface,
                calendarBackground: colors.surface,
                textSectionTitleColor: colors.textSecondary,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.textSecondary,
                dotColor: colors.primary,
                selectedDotColor: '#ffffff',
                arrowColor: colors.primary,
                monthTextColor: colors.text,
              }}
            />
          </View>
        </View>
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
  overdueText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '400',
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
    backgroundColor: '#fff',
  },
  dropZoneHeader: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
    minHeight: 100,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  emptyDropZone: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  emptyZoneText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  tooltipContainer: {
    position: 'relative',
  },
  tooltipButton: {
    padding: 4,
  },
  tooltipBubble: {
    position: 'absolute',
    right: 30,
    top: 0,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    width: 220,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 18,
  },
  draggableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  draggableCardSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  dragHandle: {
    marginRight: 8,
    paddingVertical: 4,
  },
  taskIconContainer: {
    marginRight: 12,
  },
  taskContent: {
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
  rescheduleInputs: {
    marginLeft: 12,
    gap: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    backgroundColor: '#fff',
    width: 140,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    backgroundColor: '#fff',
    width: 100,
  },
  eventTimes: {
    flexDirection: 'row',
    gap: 8,
  },
  zoneMoveButtons: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  zoneMoveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  zoneMoveText: {
    color: '#fff',
    fontSize: 12,
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
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    minWidth: 130,
  },
  datePickerText: {
    fontSize: 12,
    color: '#1f2937',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 350,
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});