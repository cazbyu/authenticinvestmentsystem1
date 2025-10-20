import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Header } from '@/components/Header';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { HourlyCalendarGrid } from '@/components/calendar/HourlyCalendarGrid';
import { getSupabaseClient } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { expandEventsWithRecurrence } from '@/lib/recurrenceUtils';
import { getVisibleWindow } from '@/lib/recurrenceUtils';
import { formatLocalDate, parseLocalDate, formatTimeForDisplay } from '@/lib/dateUtils';
import { DraggableFab } from '@/components/DraggableFab';
import { fetchWeeklyAuthenticCount } from '@/lib/authenticDepositUtils';
import { useExpandedTasksWithAnytime, useExpandedTasksForWeek } from '@/hooks/useRecurrenceCache';

// Constants
const MINUTE_HEIGHT = 1.5;

// Ensure no duplicate instances when merging arrays (e.g., expanded events + "Anytime" tasks)
const uniqByIdAndDate = <T extends { id: string; start_date?: string; due_date?: string; occurrence_date?: string }>(arr: T[]) => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const dateKey = (item as any).occurrence_date || (item as any).date || item.start_date || item.due_date || '';
    const k = `${item.id}::${dateKey}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
};

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  type: 'task' | 'event';
  color: string;
  isAllDay?: boolean;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticScore, setAuthenticScore] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [currentTimeString, setCurrentTimeString] = useState('');
  
  // Modal states
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Layout measurements for proper centering

  useEffect(() => {
    fetchTasksAndEvents();
  }, [viewMode]);

  useEffect(() => {
    calculateAuthenticScore();
  }, []);

  useEffect(() => {
    // Set up current time tracking
    const updateCurrentTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      setCurrentTimePosition(totalMinutes * MINUTE_HEIGHT);
      setCurrentTimeString(now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }));
    };

    updateCurrentTime();
    const timeInterval = setInterval(updateCurrentTime, 60000); // Update every minute

    return () => clearInterval(timeInterval);
  }, []);


  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    let points = 0;
    if (roles && roles.length > 0) points += roles.length;
    if (domains && domains.length > 0) points += domains.length;
    if (task.is_authentic_deposit) points += 2;
    if (task.is_urgent && task.is_important) points += 1.5;
    else if (!task.is_urgent && task.is_important) points += 3;
    else if (task.is_urgent && !task.is_important) points += 1;
    else points += 0.5;
    if (task.is_twelve_week_goal) points += 2;
    return Math.round(points * 10) / 10;
  };

  const calculateAuthenticScore = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = await fetchWeeklyAuthenticCount(supabase, user.id);
      setAuthenticScore(score);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    }
  };

  const fetchTasksAndEvents = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate intelligent date range based on view mode
      // Daily: today +/- 7 days, Weekly: current week +/- 2 weeks, Monthly: current month +/- 1 month
      const today = new Date();
      const startRange = new Date(today);
      const endRange = new Date(today);

      switch (viewMode) {
        case 'daily':
          startRange.setDate(startRange.getDate() - 7);
          endRange.setDate(endRange.getDate() + 7);
          break;
        case 'weekly':
          startRange.setDate(startRange.getDate() - 14);
          endRange.setDate(endRange.getDate() + 14);
          break;
        case 'monthly':
          startRange.setMonth(startRange.getMonth() - 1);
          endRange.setMonth(endRange.getMonth() + 1);
          break;
      }

      const startStr = formatLocalDate(startRange);
      const endStr = formatLocalDate(endRange);

      // Fetch tasks and events using expanded view for recurring task support
      // Exclude goal action tasks from calendar view (tasks that are children of goals)
      const { data: tasksData, error: tasksError } = await supabase
        .from('v_tasks_with_recurrence_expanded')
        .select('*')
        .eq('user_id', user.id)
        .not('status', 'in', '(completed,cancelled)')
        .in('type', ['task', 'event'])
        .or(`and(due_date.gte.${startStr},due_date.lte.${endStr}),and(start_date.gte.${startStr},start_date.lte.${endStr})`);

      if (tasksError) throw tasksError;

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const taskIds = tasksData.map(t => t.id);

      // Fetch comprehensive task data
      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: goalsData, error: goalsError },
        { data: notesData, error: notesError },
        { data: delegatesData, error: delegatesError },
        { data: keyRelationshipsData, error: keyRelationshipsError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
      ]);

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (goalsError) throw goalsError;
      if (notesError) throw notesError;
      if (delegatesError) throw delegatesError;
      if (keyRelationshipsError) throw keyRelationshipsError;

      // Transform tasks with role colors and filter out goal action tasks
      const transformedTasks = tasksData
        .map(task => {
          const taskRoles = rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [];
          const primaryRole = taskRoles[0];
          const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [];

          return {
            ...task,
            roles: taskRoles,
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
            goals: taskGoals,
            keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            has_notes: notesData?.some(n => n.parent_id === task.id),
            has_delegates: delegatesData?.some(d => d.parent_id === task.id),
            has_attachments: false,
            roleColor: primaryRole?.color || '#0078d4',
            isGoalActionTask: taskGoals.length > 0,
          };
        })
        .filter(task => !task.isGoalActionTask);

      setTasks(transformedTasks);

      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = transformedTasks.map(task => ({
        id: task.id,
        title: task.title,
        date: task.start_date || task.due_date!,
        time: task.start_time ? formatTime(task.start_time) : undefined,
        endTime: task.end_time ? formatTime(task.end_time) : undefined,
        type: task.type as 'task' | 'event',
        color: task.roleColor,
        isAllDay: task.is_all_day || task.is_anytime || (!task.start_time && !task.end_time),
      }));

      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error fetching tasks and events:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Find the task in our current data to check if it's recurring
      const task = [...tasks, ...events].find(t => t.id === taskId);

      if (task && (task.is_virtual_occurrence || task.recurrence_rule)) {
        const { handleRecurringTaskCompletion } = await import('@/lib/completionHandler');
        const result = await handleRecurringTaskCompletion(
          supabase,
          user.id,
          task,
          task.occurrence_date || task.due_date
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to complete recurring task');
        }
      } else {
        // Regular task - just update status
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', taskId);

        if (error) throw error;
      }

      fetchTasksAndEvents();
      calculateAuthenticScore();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [tasks, events]);

  const handleTaskPress = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  }, []);

  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsFormModalVisible(true), 100);
  };

  const handleDelegateTask = (task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setIsDetailModalVisible(false);
  };

  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id);

      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchTasksAndEvents();
      calculateAuthenticScore();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchTasksAndEvents();
    calculateAuthenticScore();
  };

  const handleFormClose = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
  };

  const formatTime = (timeString: string) => {
    // Use the time-only string formatter from dateUtils
    return formatTimeForDisplay(timeString);
  };

  const formatDateForDisplay = (dateString: string) => {
    // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone shifts
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getMarkedDates = useMemo(() => {
    const marked: any = {};

    // Mark selected date
    marked[selectedDate] = {
      selected: true,
      selectedColor: '#0078d4',
    };

    // Only calculate marks if we're in monthly view
    if (viewMode !== 'monthly') {
      return marked;
    }

    // Mark dates with events (including recurring instances)
    const { start, end } = getVisibleWindow('monthly', currentDate);
    const startStr = formatLocalDate(start);
    const endStr = formatLocalDate(end);

    const expandedRecurring = expandEventsWithRecurrence(tasks, 'monthly', currentDate);
    const anytimeMonthly = tasks.filter(t => {
      const d = t.start_date || t.due_date;
      return (t.type === 'task') &&
             d &&
             (d >= startStr && d <= endStr) &&
             (t.is_all_day || t.is_anytime || (!t.start_time && !t.end_time));
    });
    const expandedTasks = uniqByIdAndDate([...expandedRecurring, ...anytimeMonthly]);

    // Group tasks by date and collect dots (one per task)
    const dotsByDate: Record<string, any[]> = {};

    expandedTasks.forEach(task => {
      const taskDate = task.start_date || task.due_date;
      if (taskDate) {
        if (!dotsByDate[taskDate]) {
          dotsByDate[taskDate] = [];
        }
        dotsByDate[taskDate].push({
          key: `${task.id}-${taskDate}`,
          color: task.roleColor || '#0078d4',
        });
      }
    });

    // Apply marks with multiple dots
    Object.entries(dotsByDate).forEach(([date, dots]) => {
      const visibleDots = dots.slice(0, 3);

      if (marked[date]) {
        marked[date] = {
          ...marked[date],
          dots: visibleDots,
        };
      } else {
        marked[date] = {
          dots: visibleDots,
        };
      }
    });

    return marked;
  }, [tasks, selectedDate, currentDate, viewMode]);

  const getEventsForDate = (date: string) => {
    // Use the new recurrence expansion for the specific date
    const expandedEvents = expandEventsForDate(tasks, date);
    return expandedEvents.map(task => ({
      id: task.id,
      title: task.title,
      date: task.start_date || task.due_date,
      time: task.start_time ? formatTime(task.start_time) : undefined,
      endTime: task.end_time ? formatTime(task.end_time) : undefined,
      type: task.type as 'task' | 'event',
      color: task.roleColor,
      isAllDay: task.is_all_day || task.is_anytime || (!task.start_time && !task.end_time),
    }));
  };

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      week.push(weekDate);
    }
    return week;
  };


  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    if (viewMode === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    setCurrentDate(newDate);
    setSelectedDate(formatLocalDate(newDate));
  }, [currentDate, viewMode]);


  const dailyExpandedTasks = useExpandedTasksWithAnytime(tasks, selectedDate, true);

  const renderDailyView = () => {
    return (
      <View style={styles.dailyViewContainer}>
        <View style={styles.dailyHeader}>
          <TouchableOpacity onPress={() => navigateDate('prev')}>
            <ChevronLeft size={24} color="#0078d4" />
          </TouchableOpacity>
          <Text style={styles.dailyTitle}>
            {formatDateForDisplay(selectedDate)}
          </Text>
          <TouchableOpacity onPress={() => navigateDate('next')}>
            <ChevronRight size={24} color="#0078d4" />
          </TouchableOpacity>
        </View>

        <View style={styles.dailyContent}>
          <HourlyCalendarGrid
            selectedDate={selectedDate}
            expandedTasks={dailyExpandedTasks}
            currentTimePosition={currentTimePosition}
            currentTimeString={currentTimeString}
            onCompleteTask={handleCompleteTask}
            onTaskPress={handleTaskPress}
            viewMode="daily"
          />
        </View>
      </View>
    );
  };

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const weeklyTasksByDate = useExpandedTasksForWeek(tasks, weekDates);
  const weeklyExpandedTasks = useExpandedTasksWithAnytime(tasks, selectedDate, true);

  const renderWeeklyView = () => {
    return (
      <View style={styles.weeklyView}>
        <View style={styles.weeklyHeader}>
          <TouchableOpacity onPress={() => navigateDate('prev')}>
            <ChevronLeft size={24} color="#0078d4" />
          </TouchableOpacity>
          <Text style={styles.weeklyTitle}>
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateDate('next')}>
            <ChevronRight size={24} color="#0078d4" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekGrid}>
          {weekDates.map((date, index) => {
            const dateString = formatLocalDate(date);
            const expandedTasks = weeklyTasksByDate[dateString] || [];

            const dayEvents = expandedTasks.map(task => ({
              id: task.id,
              title: task.title,
              date: task.start_date || task.due_date,
              time: task.start_time ? formatTime(task.start_time) : undefined,
              endTime: task.end_time ? formatTime(task.end_time) : undefined,
              type: task.type as 'task' | 'event',
              color: task.roleColor,
              isAllDay: task.is_all_day || task.is_anytime || (!task.start_time && !task.end_time),
            }));
            const isToday = dateString === formatLocalDate(new Date());
            const isSelected = dateString === selectedDate;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDay,
                  isSelected && styles.selectedWeekDay,
                  isToday && styles.todayWeekDay
                ]}
                onPress={() => setSelectedDate(dateString)}
              >
                <View>
                  <Text style={[
                    styles.weekDayLabel,
                    isSelected && styles.selectedWeekDayLabel
                  ]}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]}
                  </Text>
                  <Text style={[
                    styles.weekDayNumber,
                    isSelected && styles.selectedWeekDayNumber,
                    isToday && styles.todayWeekDayNumber
                  ]}>
                    {date.getDate()}
                  </Text>
                  <View style={styles.weekDayEvents}>
                    {uniqByIdAndDate(dayEvents).slice(0, 3).map((event, idx) => (
                      <View
                        key={`${event.id}-${event.date}-${event.type}-${idx}`}
                        style={[styles.weekEventDot, { backgroundColor: event.color }]}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <Text style={styles.moreEventsText}>+{dayEvents.length - 3}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.selectedDayDetails}>
          <Text style={styles.selectedDayTitle}>
            {formatDateForDisplay(selectedDate)}
          </Text>
          <HourlyCalendarGrid
            selectedDate={selectedDate}
            expandedTasks={weeklyExpandedTasks}
            currentTimePosition={currentTimePosition}
            currentTimeString={currentTimeString}
            onCompleteTask={handleCompleteTask}
            onTaskPress={handleTaskPress}
            viewMode="weekly"
          />
        </View>
      </View>
    );
  };

  const monthlyExpandedTasks = useExpandedTasksWithAnytime(tasks, selectedDate, false);

  const renderMonthlyView = () => {
    return (
      <View style={styles.monthlyView}>
        <Calendar
          onDayPress={(day) => {
            // Ensure date is in consistent local format
            const date = parseLocalDate(day.dateString);
            setSelectedDate(formatLocalDate(date));
          }}
          markedDates={getMarkedDates}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#0078d4',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#0078d4',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#00adf5',
            selectedDotColor: '#ffffff',
            arrowColor: '#0078d4',
            disabledArrowColor: '#d9e1e8',
            monthTextColor: '#0078d4',
            indicatorColor: '#0078d4',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13
          }}
        />

        <View style={styles.selectedDateContainer}>
          <Text style={styles.selectedDateLabel}>
            {formatDateForDisplay(selectedDate)}
          </Text>
          <HourlyCalendarGrid
            selectedDate={selectedDate}
            expandedTasks={monthlyExpandedTasks}
            currentTimePosition={currentTimePosition}
            currentTimeString={currentTimeString}
            onCompleteTask={handleCompleteTask}
            onTaskPress={handleTaskPress}
            viewMode="monthly"
          />
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (viewMode === 'weekly') {
      return renderWeeklyView();
    } else {
      return renderMonthlyView();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Calendar View" authenticScore={authenticScore} />
      
      {/* View Mode Toggle */}
      <View style={styles.viewToggleContainer}>
        {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.viewToggleButton,
              viewMode === mode && styles.activeViewToggleButton
            ]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === mode && styles.activeViewToggleText
            ]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'daily' ? (
        <View style={styles.dailyViewContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading calendar...</Text>
            </View>
          ) : (
            renderDailyView()
          )}
        </View>
      ) : (
        <ScrollView style={styles.scrollViewBase} contentContainerStyle={styles.content}>
          {loading ? (
            null
          ) : (
            renderContent()
          )}
        </ScrollView>
      )}

      {/* Modals */}
      <TaskDetailModal
        visible={isDetailModalVisible}
        task={selectedTask}
        onClose={() => setIsDetailModalVisible(false)}
        onUpdate={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
      />

      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      <DraggableFab onPress={() => setIsFormModalVisible(true)}>
        <Plus size={24} color="#ffffff" />
      </DraggableFab>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollViewBase: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeViewToggleButton: {
    backgroundColor: '#0078d4',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeViewToggleText: {
    color: '#ffffff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  
  // Monthly View Styles
  monthlyView: {
    flex: 1,
    padding: 16,
  },
  selectedDateContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    minHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDateLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  dayEventsListScroll: {
    flex: 1,
  },
  dayEventsList: {
    flexGrow: 1,
  },
  
  // Daily View Styles
  dailyViewContainer: {
    flex: 1,
    padding: 16,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  dailyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  dailyContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  allDaySection: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 12,
  },
  allDayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  allDayEvents: {
    gap: 8,
  },
  timeGrid: {
    position: 'relative',
    paddingLeft: 8,
  },
  hourSlot: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: 60,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    paddingRight: 8,
    position: 'absolute',
    left: 0,
    top: -6,
  },
  halfHourLabel: {
    width: 60,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    paddingRight: 8,
    position: 'absolute',
    left: 0,
    top: -6,
  },
  hourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  quarterHourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#e5e7eb',
    opacity: 0.8,
  },
  halfHourLine: {
    position: 'absolute',
    left: 70,
    right: 0,
    height: 1,
    backgroundColor: '#d1d5db',
    opacity: 0.9,
  },
  
  // Weekly View Styles
  weeklyView: {
    flex: 1,
    padding: 16,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  weeklyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  weekGrid: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  selectedWeekDay: {
    backgroundColor: '#0078d4',
  },
  todayWeekDay: {
    backgroundColor: '#f0f9ff',
  },
  weekDayLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  selectedWeekDayLabel: {
    color: '#ffffff',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  selectedWeekDayNumber: {
    color: '#ffffff',
  },
  todayWeekDayNumber: {
    color: '#0078d4',
  },
  weekDayEvents: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 40,
  },
  weekEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  moreEventsText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  selectedDayDetails: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    minHeight: 320,
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  selectedDayEventsScroll: {
    flex: 1,
  },
  selectedDayEvents: {
    flexGrow: 1,
  },
  
  // Event Item Styles
  eventItem: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  eventTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  eventTypeBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  eventType: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },
  noEventsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  fabLarge: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  hoursScrollView: {
    flex: 1,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginRight: 4,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#dc2626',
    marginRight: 8,
  },
  currentTimeLabel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentTimeLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dc2626',
  },
});