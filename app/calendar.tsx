import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Header } from '@/components/Header';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { PriorityQuadrant } from '@/components/calendar/PriorityQuadrant';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { HourlyCalendarGrid } from '@/components/calendar/HourlyCalendarGrid';
import { WeekColumnHeader } from '@/components/calendar/WeekColumnHeader';
import { WeeklyTimeGrid } from '@/components/calendar/WeeklyTimeGrid';
import { MonthlyCalendarGrid } from '@/components/calendar/MonthlyCalendarGrid';
import { QuadrantTasksModal } from '@/components/calendar/QuadrantTasksModal';
import { CollapsibleQuadrantRow } from '@/components/calendar/CollapsibleQuadrantRow';
import { getSupabaseClient } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react-native';
import { expandEventsWithRecurrence } from '@/lib/recurrenceUtils';
import { getVisibleWindow } from '@/lib/recurrenceUtils';
import { formatLocalDate, parseLocalDate, formatTimeForDisplay } from '@/lib/dateUtils';
import { DraggableFab } from '@/components/DraggableFab';
import { fetchWeeklyAuthenticCount } from '@/lib/authenticDepositUtils';
import { useExpandedTasksWithAnytime, useExpandedTasksForWeek } from '@/hooks/useRecurrenceCache';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { getHolidaysForMonth, US_HOLIDAYS } from '@/lib/holidays';

// Constants
const MINUTE_HEIGHT = 0.75;

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
  const { width: screenWidth } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticScore, setAuthenticScore] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [currentTimeString, setCurrentTimeString] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [enabledHolidays, setEnabledHolidays] = useState<string[]>(
    US_HOLIDAYS.filter(h => h.enabled).map(h => h.id)
  );
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [isQuadrantRowExpanded, setIsQuadrantRowExpanded] = useState(true);

  // Responsive breakpoints
  const isMobile = screenWidth < 400;
  const isTablet = screenWidth >= 400 && screenWidth < 768;
  const isDesktop = screenWidth >= 768;

  // Performance optimization: recurring templates cache
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
  const latestFetchId = useRef(0);

  // Modal states
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isQuadrantModalVisible, setIsQuadrantModalVisible] = useState(false);
  const [selectedQuadrant, setSelectedQuadrant] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [quadrantTasks, setQuadrantTasks] = useState<Task[]>([]);
  const [isDayTasksModalVisible, setIsDayTasksModalVisible] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState<Task[]>([]);
  
  // Layout measurements for proper centering

  // Load recurring templates once on mount
  useEffect(() => {
    loadRecurringTemplates();
  }, []);

  useEffect(() => {
    // Direct fetch without cache pre-rendering
    fetchTasksAndEvents(currentDate, viewMode);

    if (viewMode === 'weekly') {
      setScrollTrigger(prev => prev + 1);
    }
  }, [viewMode, currentDate]);

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

  useEffect(() => {
    // Event bus listeners for task lifecycle events
    const handleTaskCreated = () => {
      console.log('[Calendar] Received task created event, refreshing...');
      fetchTasksAndEvents(currentDate, viewMode);
      calculateAuthenticScore();
    };

    const handleTaskUpdated = () => {
      console.log('[Calendar] Received task updated event, refreshing...');
      fetchTasksAndEvents(currentDate, viewMode);
      calculateAuthenticScore();
    };

    const handleTaskDeleted = () => {
      console.log('[Calendar] Received task deleted event, refreshing...');
      fetchTasksAndEvents(currentDate, viewMode);
      calculateAuthenticScore();
    };

    const handleRefreshAll = () => {
      console.log('[Calendar] Received refresh all event, refreshing...');
      fetchTasksAndEvents(currentDate, viewMode);
      calculateAuthenticScore();
    };

    eventBus.on(EVENTS.TASK_CREATED, handleTaskCreated);
    eventBus.on(EVENTS.TASK_UPDATED, handleTaskUpdated);
    eventBus.on(EVENTS.TASK_DELETED, handleTaskDeleted);
    eventBus.on(EVENTS.REFRESH_ALL_TASKS, handleRefreshAll);
    eventBus.on(EVENTS.DEPOSIT_IDEA_CREATED, handleRefreshAll);
    eventBus.on(EVENTS.WITHDRAWAL_CREATED, handleRefreshAll);

    return () => {
      eventBus.off(EVENTS.TASK_CREATED, handleTaskCreated);
      eventBus.off(EVENTS.TASK_UPDATED, handleTaskUpdated);
      eventBus.off(EVENTS.TASK_DELETED, handleTaskDeleted);
      eventBus.off(EVENTS.REFRESH_ALL_TASKS, handleRefreshAll);
      eventBus.off(EVENTS.DEPOSIT_IDEA_CREATED, handleRefreshAll);
      eventBus.off(EVENTS.WITHDRAWAL_CREATED, handleRefreshAll);
    };
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

  const loadRecurringTemplates = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select(`
          id, title, type, due_date, start_date, end_date, start_time, end_time,
          is_all_day, is_anytime, is_urgent, is_important, is_authentic_deposit,
          recurrence_rule, recurrence_end_date, recurrence_exceptions,
          status, user_global_timeline_id, custom_timeline_id
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .not('recurrence_rule', 'is', null);

      if (error) throw error;
      if (data) {
        const templateIds = data.map(t => t.id);
        const { data: rolesData } = await supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role:0008-ap-roles(color)')
          .in('parent_id', templateIds)
          .eq('parent_type', 'task');

        const templatesWithColors = data.map(t => {
          const primaryRole = rolesData?.find(r => r.parent_id === t.id)?.role;
          return {
            ...t,
            roleColor: primaryRole?.color || '#0078d4'
          };
        });
        setRecurringTemplates(templatesWithColors);
      }
    } catch (error) {
      console.error('Error loading recurring templates:', error);
    }
  };


  const fetchTasksAndEvents = async (centerDate: Date = currentDate, mode: 'daily' | 'weekly' | 'monthly' = viewMode) => {
    latestFetchId.current += 1;
    const fetchId = latestFetchId.current;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const center = centerDate || new Date();
      const startRange = new Date(center);
      const endRange = new Date(center);

      switch (mode) {
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

      if (fetchId !== latestFetchId.current) {
        console.log('[Calendar] Discarding stale fetch request');
        return;
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('v_tasks_with_recurrence_expanded')
        .select(`
          id, title, type, status, due_date, start_date, end_date, start_time, end_time,
          is_urgent, is_important, is_all_day, is_anytime, is_authentic_deposit,
          occurrence_date, is_virtual_occurrence, source_task_id, recurrence_rule
        `)
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .in('type', ['task', 'event'])
        .or(`and(occurrence_date.gte.${startStr},occurrence_date.lte.${endStr}),and(due_date.gte.${startStr},due_date.lte.${endStr}),and(start_date.gte.${startStr},start_date.lte.${endStr})`);

      if (tasksError) throw tasksError;

      if (fetchId !== latestFetchId.current) {
        console.log('[Calendar] Discarding stale fetch after query');
        return;
      }

      if (!tasksData || tasksData.length === 0) {
        setTasks([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const visibleSourceIds = [...new Set(tasksData.map(t => t.source_task_id || t.id))];

      if (fetchId !== latestFetchId.current) {
        console.log('[Calendar] Discarding stale fetch before joins');
        return;
      }

      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: goalsData, error: goalsError },
        { data: notesData, error: notesError },
        { data: delegatesData, error: delegatesError },
        { data: keyRelationshipsData, error: keyRelationshipsError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', visibleSourceIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', visibleSourceIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', visibleSourceIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', visibleSourceIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', visibleSourceIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', visibleSourceIds).eq('parent_type', 'task')
      ]);

      if (fetchId !== latestFetchId.current) {
        console.log('[Calendar] Discarding stale fetch after joins');
        return;
      }

      if (rolesError) throw rolesError;
      if (domainsError) throw domainsError;
      if (goalsError) throw goalsError;
      if (notesError) throw notesError;
      if (delegatesError) throw delegatesError;
      if (keyRelationshipsError) throw keyRelationshipsError;

      const transformedTasks = tasksData
        .map(task => {
          const lookupId = task.source_task_id || task.id;
          const taskRoles = rolesData?.filter(r => r.parent_id === lookupId).map(r => r.role).filter(Boolean) || [];
          const primaryRole = taskRoles[0];
          const taskGoals = goalsData?.filter(g => g.parent_id === lookupId).map(g => g.goal).filter(Boolean) || [];

          return {
            ...task,
            roles: taskRoles,
            domains: domainsData?.filter(d => d.parent_id === lookupId).map(d => d.domain).filter(Boolean) || [],
            goals: taskGoals,
            keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === lookupId).map(kr => kr.key_relationship).filter(Boolean) || [],
            has_notes: notesData?.some(n => n.parent_id === lookupId),
            has_delegates: delegatesData?.some(d => d.parent_id === lookupId),
            has_attachments: false,
            roleColor: primaryRole?.color || '#0078d4',
            isGoalActionTask: taskGoals.length > 0,
          };
        })
        .filter(task => !task.isGoalActionTask);

      if (fetchId !== latestFetchId.current) {
        console.log('[Calendar] Discarding stale fetch before setState');
        return;
      }

      setTasks(transformedTasks);

      const calendarEvents: CalendarEvent[] = transformedTasks.map(task => ({
        id: task.id,
        title: task.title,
        date: task.occurrence_date || task.start_date || task.due_date!,
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
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', taskId);

        if (error) throw error;
      }

      fetchTasksAndEvents(currentDate, viewMode);
      calculateAuthenticScore();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [tasks, events, currentDate, viewMode]);

  const handleTaskPress = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsDetailModalVisible(true);
  }, []);

  const filterTasksByQuadrant = useCallback((tasks: Task[], quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    return tasks.filter(task => {
      if (task.status === 'completed') return false;

      switch (quadrant) {
        case 'Q1':
          return task.is_urgent && task.is_important;
        case 'Q2':
          return !task.is_urgent && task.is_important;
        case 'Q3':
          return task.is_urgent && !task.is_important;
        case 'Q4':
          return !task.is_urgent && !task.is_important;
        default:
          return false;
      }
    });
  }, []);

  const handleQuadrantPress = useCallback((quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4', tasks: Task[]) => {
    const filtered = filterTasksByQuadrant(tasks, quadrant);
    setSelectedQuadrant(quadrant);
    setQuadrantTasks(filtered);
    setIsQuadrantModalVisible(true);
  }, [filterTasksByQuadrant]);

  const handleDayPress = useCallback((date: Date, tasks: Task[]) => {
    setSelectedDayDate(date);
    setSelectedDayTasks(tasks);
    setIsDayTasksModalVisible(true);
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
      fetchTasksAndEvents(currentDate, viewMode);
      calculateAuthenticScore();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchTasksAndEvents(currentDate, viewMode);
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
    // Tasks are already expanded by the database view if they have is_virtual_occurrence flag
    const hasVirtualOccurrences = tasks.some(t => t.is_virtual_occurrence);

    let expandedTasks: any[];
    if (hasVirtualOccurrences) {
      // Use database-expanded tasks directly
      expandedTasks = tasks;
    } else {
      // Legacy path: expand recurrence client-side (for older data)
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
      expandedTasks = uniqByIdAndDate([...expandedRecurring, ...anytimeMonthly]);
    }

    // Group tasks by date and collect dots (one per task)
    const dotsByDate: Record<string, any[]> = {};

    expandedTasks.forEach(task => {
      const taskDate = task.occurrence_date || task.start_date || task.due_date;
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
    // Filter tasks based on showCompleted toggle
    const filteredDailyTasks = dailyExpandedTasks.filter(task =>
      showCompleted ? task.status === 'completed' : task.status !== 'completed'
    );

    return (
      <View style={styles.dailyViewContainer}>
        <View style={styles.dailyHeader}>
          <View style={styles.dailyHeaderLeft}>
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
          <View style={styles.dailyHeaderRight}>
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, isMobile && styles.toggleLabelMobile]}>Total:</Text>
              <TouchableOpacity
                onPress={() => setShowCompleted(!showCompleted)}
                style={[styles.toggleButton, isMobile && styles.toggleButtonMobile]}
              >
                <Text style={[styles.toggleButtonText, isMobile && styles.toggleButtonTextMobile]}>
                  {showCompleted ? 'Completed' : 'Pending'}
                </Text>
              </TouchableOpacity>
            </View>
            <PriorityQuadrant
              tasks={filteredDailyTasks}
              size={isMobile ? 'small' : 'medium'}
              onPress={(quadrant) => handleQuadrantPress(quadrant, filteredDailyTasks)}
              showCompleted={showCompleted}
            />
          </View>
        </View>

        <View style={styles.dailyContent}>
          <HourlyCalendarGrid
            selectedDate={selectedDate}
            expandedTasks={filteredDailyTasks}
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

  const [screenDimensions, setScreenDimensions] = useState({ width: 0, height: 0 });
  const TIME_COLUMN_WIDTH = 70;
  const columnWidth = screenDimensions.width > 0
    ? (screenDimensions.width - TIME_COLUMN_WIDTH) / 7
    : 0;

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(formatLocalDate(today));
  };

  const filteredTasksByDate = useMemo(() => {
    const filtered: Record<string, Task[]> = {};
    Object.keys(weeklyTasksByDate).forEach(dateStr => {
      filtered[dateStr] = weeklyTasksByDate[dateStr].filter(task =>
        showCompleted ? task.status === 'completed' : task.status !== 'completed'
      );
    });
    return filtered;
  }, [weeklyTasksByDate, showCompleted]);

  const allWeekTasks = useMemo(() => {
    return Object.values(filteredTasksByDate).flat();
  }, [filteredTasksByDate]);

  const getWeekDateRangeDisplay = () => {
    const firstDate = weekDates[0];
    const lastDate = weekDates[6];

    const firstMonth = firstDate.getMonth();
    const lastMonth = lastDate.getMonth();
    const firstYear = firstDate.getFullYear();
    const lastYear = lastDate.getFullYear();

    if (firstMonth === lastMonth && firstYear === lastYear) {
      return firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      const firstMonthYear = firstDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const lastMonthYear = lastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${firstMonthYear} - ${lastMonthYear}`;
    }
  };

  const renderWeeklyView = () => {
    return (
      <View style={styles.weeklyViewRedesigned}>
        <View style={styles.weeklyHeaderRedesigned}>
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>

          <View style={styles.navigationSection}>
            <TouchableOpacity onPress={() => navigateDate('prev')}>
              <ChevronLeft size={20} color="#0078d4" />
            </TouchableOpacity>
            <Text style={styles.monthYearText}>
              {getWeekDateRangeDisplay()}
            </Text>
            <TouchableOpacity onPress={() => navigateDate('next')}>
              <ChevronRight size={20} color="#0078d4" />
            </TouchableOpacity>
          </View>

          <View style={styles.spacer} />

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Total:</Text>
            <TouchableOpacity
              onPress={() => setShowCompleted(!showCompleted)}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleButtonText}>
                {showCompleted ? 'Completed' : 'Pending'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Show quadrant in header only on desktop */}
          {isDesktop && (
            <PriorityQuadrant
              tasks={allWeekTasks}
              size="medium"
              style={styles.weeklyQuadrant}
              onPress={(quadrant) => handleQuadrantPress(quadrant, allWeekTasks)}
              showCompleted={showCompleted}
            />
          )}
        </View>

        <View
          style={styles.weekColumnHeaders}
          onLayout={(e) => setScreenDimensions({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height
          })}
        >
          <View style={styles.timeColumnSpacer} />
          {weekDates.map((date, index) => {
            const dateStr = formatLocalDate(date);
            const isToday = dateStr === formatLocalDate(new Date());
            const dayTasks = filteredTasksByDate[dateStr] || [];
            const dayLabel = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][index];

            return (
              <View key={index} style={[styles.weekColumnHeaderContainer, columnWidth > 0 && { width: columnWidth }]}>
                <WeekColumnHeader
                  dayLabel={dayLabel}
                  dateNumber={date.getDate()}
                  isToday={isToday}
                  tasks={dayTasks}
                  showCompleted={showCompleted}
                />
              </View>
            );
          })}
        </View>

        <CollapsibleQuadrantRow
          weekDates={weekDates}
          tasksByDate={filteredTasksByDate}
          columnWidth={columnWidth}
          isExpanded={isQuadrantRowExpanded}
          onToggle={() => setIsQuadrantRowExpanded(!isQuadrantRowExpanded)}
          onQuadrantPress={handleQuadrantPress}
          onDayPress={handleDayPress}
          showCompleted={showCompleted}
        />

        <WeeklyTimeGrid
          weekDates={weekDates}
          tasksByDate={filteredTasksByDate}
          onCompleteTask={handleCompleteTask}
          onTaskPress={handleTaskPress}
          shouldScrollToNow={scrollTrigger}
          columnWidth={columnWidth}
        />
      </View>
    );
  };

  const renderMonthlyView = () => {
    const holidays = getHolidaysForMonth(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      enabledHolidays
    );

    return (
      <View style={styles.monthlyView}>
        <View style={styles.monthlyHeader}>
          <TouchableOpacity onPress={() => navigateDate('prev')} style={styles.monthNavButton}>
            <ChevronLeft size={24} color="#0078d4" />
          </TouchableOpacity>
          <Text style={styles.monthYearTitle}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateDate('next')} style={styles.monthNavButton}>
            <ChevronRight size={24} color="#0078d4" />
          </TouchableOpacity>
        </View>

        <MonthlyCalendarGrid
          currentDate={currentDate}
          tasks={tasks}
          holidays={holidays}
          onDayPress={(date) => {
            setSelectedDate(formatLocalDate(date));
          }}
        />
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
      <Header
        title="Calendar View"
        authenticScore={authenticScore}
        activeView={viewMode}
        onViewChange={(view) => setViewMode(view as 'daily' | 'weekly' | 'monthly')}
      />

      {viewMode === 'daily' ? (
        <View style={styles.dailyViewContainer}>
          {renderDailyView()}
        </View>
      ) : viewMode === 'weekly' ? (
        <View style={styles.weeklyContainer}>
          {renderContent()}
        </View>
      ) : (
        <ScrollView style={styles.scrollViewBase} contentContainerStyle={styles.content}>
          {renderContent()}
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

      <QuadrantTasksModal
        visible={isQuadrantModalVisible}
        quadrant={selectedQuadrant}
        tasks={quadrantTasks}
        onClose={() => setIsQuadrantModalVisible(false)}
      />

      <Modal visible={isDayTasksModalVisible} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDayTasksModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.dayTasksModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedDayDate?.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDayTasksModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.dayTasksList}>
              {selectedDayTasks.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>No tasks for this day</Text>
                </View>
              ) : (
                selectedDayTasks
                  .sort((a, b) => {
                    const aCompleted = a.status === 'completed' ? 1 : 0;
                    const bCompleted = b.status === 'completed' ? 1 : 0;
                    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
                    if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
                    if (a.start_time) return -1;
                    if (b.start_time) return 1;
                    return 0;
                  })
                  .map((task, index) => {
                    const priorityColor = task.is_urgent && task.is_important ? '#ef4444' :
                                         !task.is_urgent && task.is_important ? '#22c55e' :
                                         task.is_urgent && !task.is_important ? '#f59e0b' : '#9ca3af';
                    return (
                      <TouchableOpacity
                        key={`${task.id}-${index}`}
                        style={[styles.dayTaskItem, task.status === 'completed' && styles.completedTaskItem]}
                        onPress={() => handleTaskPress(task)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.taskColorBar, { backgroundColor: priorityColor }]} />
                        <View style={styles.taskContent}>
                          {task.start_time && (
                            <Text style={[styles.taskTime, task.status === 'completed' && styles.completedText]}>
                              {formatTimeForDisplay(task.start_time)}
                              {task.end_time && ` - ${formatTimeForDisplay(task.end_time)}`}
                            </Text>
                          )}
                          <Text style={[styles.taskTitle, task.status === 'completed' && styles.completedText]}>
                            {task.title}
                          </Text>
                          <View style={styles.taskMetadata}>
                            {task.status === 'completed' ? (
                              <Text style={styles.taskCompleted}>✓ Completed</Text>
                            ) : (
                              <Text style={styles.taskPending}>Pending</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
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
  monthlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  monthNavButton: {
    padding: 8,
  },
  monthYearTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
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
    flexWrap: 'wrap',
    gap: 12,
  },
  dailyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dailyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

  // Redesigned Weekly View Styles
  weeklyContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  weeklyViewRedesigned: {
    flex: 1,
  },
  weeklyHeaderRedesigned: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  navigationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    minWidth: 160,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  toggleLabelMobile: {
    fontSize: 12,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0078d4',
    borderRadius: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 28,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },
  toggleButtonTextMobile: {
    fontSize: 11,
  },
  weeklyQuadrant: {
    marginLeft: 12,
  },
  weekColumnHeaders: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  timeColumnSpacer: {
    width: 70,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  weekColumnHeaderContainer: {
    minWidth: 0,
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
  weekDayColumn: {
    alignItems: 'center',
    width: '100%',
  },
  weekDayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    gap: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dayTasksModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  dayTasksList: {
    maxHeight: 400,
  },
  dayTaskItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  completedTaskItem: {
    backgroundColor: '#f9fafb',
  },
  taskColorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0078d4',
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  completedText: {
    opacity: 0.6,
  },
  taskMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  taskCompleted: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  taskPending: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});