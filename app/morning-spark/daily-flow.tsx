import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSquare, Calendar, Check, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import {
  checkTodaysSpark,
  getScheduledActions,
  formatTimeDisplay,
  ScheduledAction,
  ScheduledActionsData,
  getFuelEmoji,
  getFuelColor,
} from '@/lib/sparkUtils';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { MindsetCapture } from '@/components/morning-spark/MindsetCapture';

export default function DailyFlowScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [fuelLevel, setFuelLevel] = useState<1 | 2 | 3 | null>(null);
  const [sparkId, setSparkId] = useState<string | null>(null);
  const [actionsData, setActionsData] = useState<ScheduledActionsData | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [mindsetPoints, setMindsetPoints] = useState(0);
  const [eventsAccepted, setEventsAccepted] = useState(false);
  const [tasksAccepted, setTasksAccepted] = useState(false);
  const [urgentTasks, setUrgentTasks] = useState<ScheduledAction[]>([]);
  const [allTasks, setAllTasks] = useState<ScheduledAction[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [loadingAllTasks, setLoadingAllTasks] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'events' | 'tasks'>('events');
  
  // Adjustment bins
  const [itemsInKeepZone, setItemsInKeepZone] = useState<ScheduledAction[]>([]);
  const [itemsInRescheduleZone, setItemsInRescheduleZone] = useState<ScheduledAction[]>([]);
  const [itemsInCancelZone, setItemsInCancelZone] = useState<ScheduledAction[]>([]);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const [rescheduleTimes, setRescheduleTimes] = useState<Record<string, string>>({});

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

      setUserId(user.id);

      const [spark, actions] = await Promise.all([
        checkTodaysSpark(user.id),
        getScheduledActions(user.id),
      ]);

      if (!spark) {
        router.replace('/morning-spark');
        return;
      }

      setSparkId(spark.id);
      setFuelLevel(spark.fuel_level);
      setActionsData(actions);

      // Load urgent tasks for EL1
      if (spark.fuel_level === 1) {
        await loadUrgentTasks(user.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load Morning Spark. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function loadUrgentTasks(uid: string) {
    try {
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', uid)
        .eq('type', 'task')
        .eq('is_urgent', true)
        .is('completed_at', null)
        .is('deleted_at', null)
        .or(`due_date.eq.${today},due_date.lt.${today}`)
        .order('due_date', { ascending: true });

      if (error) throw error;

      let tasks = (data || []) as ScheduledAction[];

      if (tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);

        // Fetch roles, domains, and goals for point calculation
        const [rolesRes, domainsRes, goalsRes] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-goals-join')
            .select('parent_id, goal_type, tw:0008-ap-goals-12wk(id, status), cg:0008-ap-goals-custom(id, status)')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
        ]);

        const rolesCount = new Map<string, number>();
        (rolesRes.data || []).forEach((r: any) => {
          rolesCount.set(r.parent_id, (rolesCount.get(r.parent_id) || 0) + 1);
        });

        const domainsCount = new Map<string, number>();
        (domainsRes.data || []).forEach((d: any) => {
          domainsCount.set(d.parent_id, (domainsCount.get(d.parent_id) || 0) + 1);
        });

        const goalsCount = new Map<string, number>();
        (goalsRes.data || []).forEach((g: any) => {
          const goal = g.goal_type === 'twelve_wk_goal' ? g.tw : g.cg;
          if (goal && goal.status !== 'archived' && goal.status !== 'cancelled') {
            goalsCount.set(g.parent_id, (goalsCount.get(g.parent_id) || 0) + 1);
          }
        });

        // Calculate points for each task
        tasks = tasks.map((task) => {
          const roles = Array(rolesCount.get(task.id) || 0).fill({});
          const domains = Array(domainsCount.get(task.id) || 0).fill({});
          const goals = Array(goalsCount.get(task.id) || 0).fill({});
          const points = calculateTaskPoints(task as any, roles, domains, goals);

          return { ...task, points };
        });
      }

      setUrgentTasks(tasks);
    } catch (error) {
      console.error('Error loading urgent tasks:', error);
    }
  }

  async function loadAllTasks() {
    if (loadingAllTasks) return;
    
    try {
      setLoadingAllTasks(true);
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'task')
        .is('completed_at', null)
        .is('deleted_at', null)
        .or(`due_date.eq.${today},due_date.lt.${today}`)
        .order('is_urgent', { ascending: false })
        .order('due_date', { ascending: true });

      if (error) throw error;

      let tasks = (data || []) as ScheduledAction[];

      if (tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);

        // Fetch roles, domains, and goals for point calculation
        const [rolesRes, domainsRes, goalsRes] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('parent_id')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('parent_id')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
          supabase
            .from('0008-ap-universal-goals-join')
            .select('parent_id, goal_type, tw:0008-ap-goals-12wk(id, status), cg:0008-ap-goals-custom(id, status)')
            .in('parent_id', taskIds)
            .eq('parent_type', 'task'),
        ]);

        const rolesCount = new Map<string, number>();
        (rolesRes.data || []).forEach((r: any) => {
          rolesCount.set(r.parent_id, (rolesCount.get(r.parent_id) || 0) + 1);
        });

        const domainsCount = new Map<string, number>();
        (domainsRes.data || []).forEach((d: any) => {
          domainsCount.set(d.parent_id, (domainsCount.get(d.parent_id) || 0) + 1);
        });

        const goalsCount = new Map<string, number>();
        (goalsRes.data || []).forEach((g: any) => {
          const goal = g.goal_type === 'twelve_wk_goal' ? g.tw : g.cg;
          if (goal && goal.status !== 'archived' && goal.status !== 'cancelled') {
            goalsCount.set(g.parent_id, (goalsCount.get(g.parent_id) || 0) + 1);
          }
        });

        // Calculate points for each task
        tasks = tasks.map((task) => {
          const roles = Array(rolesCount.get(task.id) || 0).fill({});
          const domains = Array(domainsCount.get(task.id) || 0).fill({});
          const goals = Array(goalsCount.get(task.id) || 0).fill({});
          const points = calculateTaskPoints(task as any, roles, domains, goals);

          return { ...task, points };
        });
      }

      setAllTasks(tasks);
      setShowAllTasks(true);
    } catch (error) {
      console.error('Error loading all tasks:', error);
      Alert.alert('Error', 'Failed to load tasks. Please try again.');
    } finally {
      setLoadingAllTasks(false);
    }
  }

  function handleAcceptEvents() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEventsAccepted(true);
  }

  function handleAdjustEvents() {
    // Initialize bins with all events in Keep zone
    const allEvents = [
      ...(actionsData?.overdue || []),
      ...(actionsData?.today || []),
    ];
    
    // Set up tomorrow as default reschedule date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalISOString(tomorrow).split('T')[0];
    
    const initialDates: Record<string, string> = {};
    const initialTimes: Record<string, string> = {};
    
    allEvents.forEach(event => {
      initialDates[event.id] = tomorrowStr;
      // Default to same time or "anytime"
      initialTimes[event.id] = event.start_time || 'anytime';
    });
    
    setItemsInKeepZone(allEvents);
    setItemsInRescheduleZone([]);
    setItemsInCancelZone([]);
    setRescheduleDates(initialDates);
    setRescheduleTimes(initialTimes);
    setAdjustType('events');
    setShowAdjustModal(true);
  }

  function handleAcceptTasks() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTasksAccepted(true);
  }

  function handleAdjustTasks() {
    // Initialize bins with all tasks in Keep zone
    const allTasksList = showAllTasks ? allTasks : urgentTasks;
    
    // Set up tomorrow as default reschedule date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalISOString(tomorrow).split('T')[0];
    
    const initialDates: Record<string, string> = {};
    const initialTimes: Record<string, string> = {};
    
    allTasksList.forEach(task => {
      initialDates[task.id] = tomorrowStr;
      initialTimes[task.id] = task.due_time || 'anytime';
    });
    
    setItemsInKeepZone(allTasksList);
    setItemsInRescheduleZone([]);
    setItemsInCancelZone([]);
    setRescheduleDates(initialDates);
    setRescheduleTimes(initialTimes);
    setAdjustType('tasks');
    setShowAdjustModal(true);
  }

  function getPriorityColor(task: ScheduledAction): string {
    if (task.is_urgent && task.is_important) {
      return '#ef4444'; // Red - Urgent & Important
    } else if (!task.is_urgent && task.is_important) {
      return '#22c55e'; // Green - Not Urgent but Important
    } else if (task.is_urgent && !task.is_important) {
      return '#eab308'; // Yellow - Urgent but Not Important
    } else {
      return '#9ca3af'; // Gray - Neither Urgent nor Important
    }
  }

  function getTimeOptions(item: ScheduledAction): Array<{label: string, value: string}> {
    const times: Array<{label: string, value: string}> = [
      { label: 'Anytime', value: 'anytime' }
    ];
    
    // Generate all times in 15-minute increments (96 slots in 24 hours)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
        const displayTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        times.push({ label: displayTime, value: timeStr });
      }
    }
    
    return times;
  }

  function moveItemToNextBin(itemId: string, currentBin: 'keep' | 'reschedule' | 'cancel') {
    // Single tap cycles: keep → reschedule → cancel → keep
    const nextBin = currentBin === 'keep' ? 'reschedule' : currentBin === 'reschedule' ? 'cancel' : 'keep';

    const allItems = [...itemsInKeepZone, ...itemsInRescheduleZone, ...itemsInCancelZone];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    // Remove from all bins
    setItemsInKeepZone(prev => prev.filter(i => i.id !== itemId));
    setItemsInRescheduleZone(prev => prev.filter(i => i.id !== itemId));
    setItemsInCancelZone(prev => prev.filter(i => i.id !== itemId));

    // Add to next bin
    if (nextBin === 'keep') {
      setItemsInKeepZone(prev => [...prev, item]);
    } else if (nextBin === 'reschedule') {
      setItemsInRescheduleZone(prev => [...prev, item]);
      // Set default reschedule values if not already set
      if (!rescheduleDates[itemId]) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRescheduleDates(prev => ({...prev, [itemId]: toLocalISOString(tomorrow).split('T')[0]}));
      }
      if (!rescheduleTimes[itemId]) {
        setRescheduleTimes(prev => ({...prev, [itemId]: 'anytime'}));
      }
    } else {
      setItemsInCancelZone(prev => [...prev, item]);
    }
  }

  async function applyAdjustments() {
    try {
      const supabase = getSupabaseClient();

      // Handle cancellations
      if (itemsInCancelZone.length > 0) {
        const cancelIds = itemsInCancelZone.map(i => i.id);
        await supabase
          .from('0008-ap-tasks')
          .update({ 
            deleted_at: toLocalISOString(new Date()),
            status: 'cancelled'
          })
          .in('id', cancelIds);
      }

      // Handle rescheduling
      if (itemsInRescheduleZone.length > 0) {
        for (const item of itemsInRescheduleZone) {
          const newDate = rescheduleDates[item.id];
          const newTime = rescheduleTimes[item.id];

          if (adjustType === 'events') {
            await supabase
              .from('0008-ap-tasks')
              .update({
                start_date: newDate,
                start_time: newTime === 'anytime' ? null : newTime,
              })
              .eq('id', item.id);
          } else {
            await supabase
              .from('0008-ap-tasks')
              .update({
                due_date: newDate,
                due_time: newTime === 'anytime' ? null : newTime,
              })
              .eq('id', item.id);
          }
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Changes applied successfully!');
      setShowAdjustModal(false);
      await loadData(); // Reload everything
    } catch (error) {
      console.error('Error applying adjustments:', error);
      Alert.alert('Error', 'Failed to apply changes. Please try again.');
    }
  }

  async function handleCompleteEvent(eventId: string) {
    try {
      const supabase = getSupabaseClient();

      await supabase
        .from('0008-ap-tasks')
        .update({
          status: 'completed',
          completed_at: toLocalISOString(new Date()),
        })
        .eq('id', eventId);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await loadData();
    } catch (error) {
      console.error('Error completing event:', error);
      Alert.alert('Error', 'Failed to complete event');
    }
  }

  async function handleDeleteEvent(eventId: string, eventTitle: string) {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${eventTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
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
                  status: 'cancelled',
                })
                .eq('id', eventId);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              await loadData();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  }

  function handleMindsetPointsAdded(points: number) {
    setMindsetPoints((prev) => prev + points);
  }

  async function handleComplete() {
    if (completing) return;

    try {
      setCompleting(true);

      const supabase = getSupabaseClient();

      // Calculate total committed points
      const eventPoints = (actionsData?.today || []).reduce(
        (sum, event) => sum + (event.points || 3),
        0
      );
      const overduePoints = (actionsData?.overdue || []).reduce(
        (sum, event) => sum + (event.points || 3),
        0
      );
      const sparkCompletionBonus = 10;
      const totalTarget = eventPoints + overduePoints + mindsetPoints + sparkCompletionBonus;

      // Update the spark with completion data
      await supabase
        .from('0008-ap-daily-sparks')
        .update({
          initial_target_score: totalTarget,
          committed_at: toLocalISOString(new Date()),
        })
        .eq('id', sparkId);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Morning Spark Complete!',
        `Your target for today is ${totalTarget} points. Let's make it happen!`,
        [
          {
            text: 'View Dashboard',
            onPress: () => router.replace('/(tabs)/dashboard'),
          },
        ]
      );
    } catch (error) {
      console.error('Error completing Morning Spark:', error);
      Alert.alert('Error', 'Failed to complete Morning Spark. Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  function renderEventRow(event: ScheduledAction, isOverdue: boolean) {
    const iconColor = colors.primary;
    const titleColor = isOverdue ? '#EF4444' : colors.text;

    return (
      <View
        key={event.id}
        style={[styles.eventRow, { borderBottomColor: colors.border }]}
      >
        <View style={styles.quickActions}>
          <TouchableOpacity
            onPress={() => handleCompleteEvent(event.id)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Check size={18} color="#22c55e" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteEvent(event.id, event.title)}
            style={styles.quickActionButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.iconContainer}>
          <Calendar size={16} color={iconColor} />
        </View>

        <View style={styles.eventContent}>
          <Text style={[styles.eventTitle, { color: titleColor }]} numberOfLines={1}>
            {event.title}
            {isOverdue && event.start_date && (
              <Text style={styles.overdueText}>
                {' '}(Overdue - {new Date(event.start_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })})
              </Text>
            )}
          </Text>
          {event.start_time && (
            <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
              {formatTimeDisplay(event.start_time)}
              {event.end_time && ` - ${formatTimeDisplay(event.end_time)}`}
            </Text>
          )}
        </View>

        <Text style={[styles.points, { color: '#10B981' }]}>
          +{Math.round(event.points || 3)}
        </Text>
      </View>
    );
  }

  function getCoachMessage(): string {
    if (fuelLevel === 1) {
      return 'Our goal is to reduce overwhelm and prevent spirals.';
    } else if (fuelLevel === 2) {
      return 'Our goal is to maintain steady momentum without burning out.';
    } else {
      return "Our goal is to harness your energy and make today count.";
    }
  }

  function getScheduleMessage(): string {
    const hasEvents = actionsData && (actionsData.overdue.length > 0 || actionsData.today.length > 0);
    
    if (fuelLevel === 1) {
      if (!hasEvents) {
        return "Nothing is currently on your calendar. Let's focus on doing something though.";
      }
      return 'Should we reschedule any of these to protect your energy?';
    } else if (fuelLevel === 2) {
      if (!hasEvents) {
        return "Your calendar is clear. You can add intentions below.";
      }
      return "Here's your schedule. Focus on steady progress.";
    } else {
      if (!hasEvents) {
        return "No scheduled events. Let's create some momentum!";
      }
      return "You're energized! Let's make the most of these opportunities.";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasEvents = actionsData && (actionsData.overdue.length > 0 || actionsData.today.length > 0);

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
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Morning Spark</Text>
          {fuelLevel && (
            <Text style={styles.fuelEmoji}>{getFuelEmoji(fuelLevel)}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Coach Comments Section */}
        <View style={[styles.coachSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.coachLabel, { color: colors.textSecondary }]}>
            Coach Comments
          </Text>
          <Text style={[styles.coachText, { color: colors.text }]}>
            {getCoachMessage()}
          </Text>
        </View>

        {/* Scheduled Events Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Schedule Today</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {getScheduleMessage()}
          </Text>

          {!hasEvents ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your schedule is clear!
              </Text>
            </View>
          ) : (
            <>
              {actionsData.overdue.length > 0 && (
                <View style={styles.overdueSection}>
                  <View style={styles.overdueBanner}>
                    <View style={styles.redLine} />
                    <Text style={styles.overdueLabel}>
                      Overdue ({actionsData.overdue.length})
                    </Text>
                    <View style={styles.redLine} />
                  </View>
                  <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                    {actionsData.overdue.map((event) => renderEventRow(event, true))}
                  </View>
                </View>
              )}

              {actionsData.today.length > 0 && (
                <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                  {actionsData.today.map((event) => renderEventRow(event, false))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Accept/Adjust Buttons for Events */}
        {hasEvents && !eventsAccepted && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.acceptButton, { backgroundColor: getFuelColor(fuelLevel || 2) }]}
              onPress={handleAcceptEvents}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>Accept Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjustButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleAdjustEvents}
              activeOpacity={0.8}
            >
              <Text style={[styles.adjustButtonText, { color: colors.text }]}>Adjust</Text>
            </TouchableOpacity>
          </View>
        )}

        {eventsAccepted && hasEvents && (
          <View style={[styles.acceptedBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
            <Check size={20} color="#10B981" />
            <Text style={[styles.acceptedText, { color: '#10B981' }]}>Schedule Accepted</Text>
          </View>
        )}

        {/* Urgent Tasks Section - EL1 Only */}
        {fuelLevel === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Urgent Tasks</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {urgentTasks.length > 0 
                ? "These need attention today. Accept or adjust to protect your energy."
                : "You don't show any Urgent actions listed for today."}
            </Text>

            {urgentTasks.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.emptyEmoji}>✅</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No urgent tasks for today
                </Text>
                <TouchableOpacity
                  style={[styles.viewAllTasksButton, { borderColor: colors.border }]}
                  onPress={loadAllTasks}
                  disabled={loadingAllTasks}
                >
                  {loadingAllTasks ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.viewAllTasksText, { color: colors.text }]}>
                      View All Tasks
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
                  {urgentTasks.map((task) => (
                <View
                  key={task.id}
                  style={[styles.eventRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      onPress={() => handleCompleteEvent(task.id)}
                      style={styles.quickActionButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Check size={18} color="#22c55e" strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteEvent(task.id, task.title)}
                      style={styles.quickActionButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={18} color="#ef4444" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.iconContainer}>
                    <CheckSquare size={16} color={colors.primary} />
                  </View>

                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: getPriorityColor(task) }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    {task.due_date && (
                      <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                        Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.points, { color: '#10B981' }]}>
                    +{Math.round(task.points || 3)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Accept/Adjust Buttons for Tasks */}
            {!tasksAccepted && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.acceptButton, { backgroundColor: getFuelColor(fuelLevel) }]}
                  onPress={handleAcceptTasks}
                  activeOpacity={0.8}
                >
                  <Text style={styles.acceptButtonText}>Accept Tasks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adjustButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={handleAdjustTasks}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text }]}>Adjust</Text>
                </TouchableOpacity>
              </View>
            )}

            {tasksAccepted && (
              <View style={[styles.acceptedBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
                <Check size={20} color="#10B981" />
                <Text style={[styles.acceptedText, { color: '#10B981' }]}>Tasks Accepted</Text>
              </View>
            )}
              </>
            )}
          </View>
        )}

        {/* All Tasks Section - When user clicks "View All Tasks" */}
        {fuelLevel === 1 && showAllTasks && allTasks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.allTasksHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>All Tasks for Today</Text>
              <TouchableOpacity
                onPress={() => setShowAllTasks(false)}
                style={styles.hideButton}
              >
                <Text style={[styles.hideButtonText, { color: colors.primary }]}>Hide</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              All tasks due today or overdue. Urgent tasks are marked in red.
            </Text>

            <View style={[styles.eventsTable, { backgroundColor: colors.surface }]}>
              {allTasks.map((task) => {
                const isUrgent = task.is_urgent;
                const isOverdue = task.due_date && task.due_date < toLocalISOString(new Date()).split('T')[0];
                
                return (
                  <View
                    key={task.id}
                    style={[styles.eventRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        onPress={() => handleCompleteEvent(task.id)}
                        style={styles.quickActionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Check size={18} color="#22c55e" strokeWidth={2.5} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteEvent(task.id, task.title)}
                        style={styles.quickActionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={18} color="#ef4444" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.iconContainer}>
                      <CheckSquare size={16} color={isUrgent ? '#EF4444' : colors.primary} />
                    </View>

                    <View style={styles.eventContent}>
                      <View style={styles.taskTitleRow}>
                        <Text 
                          style={[
                            styles.eventTitle, 
                            { color: getPriorityColor(task) }
                          ]} 
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        {isUrgent && (
                          <View style={styles.urgentBadge}>
                            <Text style={styles.urgentBadgeText}>URGENT</Text>
                          </View>
                        )}
                      </View>
                      {task.due_date && (
                        <Text style={[styles.eventTime, { color: colors.textSecondary }]}>
                          Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {isOverdue && ' (Overdue)'}
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.points, { color: '#10B981' }]}>
                      +{Math.round(task.points || 3)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Accept/Adjust Buttons for All Tasks */}
            {!tasksAccepted && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.acceptButton, { backgroundColor: getFuelColor(fuelLevel) }]}
                  onPress={handleAcceptTasks}
                  activeOpacity={0.8}
                >
                  <Text style={styles.acceptButtonText}>Accept Tasks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adjustButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={handleAdjustTasks}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.adjustButtonText, { color: colors.text }]}>Adjust</Text>
                </TouchableOpacity>
              </View>
            )}

            {tasksAccepted && (
              <View style={[styles.acceptedBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
                <Check size={20} color="#10B981" />
                <Text style={[styles.acceptedText, { color: '#10B981' }]}>Tasks Accepted</Text>
              </View>
            )}
          </View>
        )}

        {/* Mindset Capture Section */}
        {fuelLevel && sparkId && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {fuelLevel === 1 && 'Release Something'}
              {fuelLevel === 2 && 'Clear Your Mind'}
              {fuelLevel === 3 && 'Capture the Spark'}
            </Text>
            <MindsetCapture
              fuelLevel={fuelLevel}
              userId={userId}
              sparkId={sparkId}
              onPointsAdded={handleMindsetPointsAdded}
            />
          </View>
        )}

        {/* Review Your Plan Section */}
        {(eventsAccepted || (!hasEvents)) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Review Your Plan</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Everything looking good? If you'd like to make any changes to your schedule or tasks, now's the time.
            </Text>
            
            <TouchableOpacity
              style={[styles.reviewButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setShowAdjustModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.reviewButtonText, { color: colors.text }]}>
                Make Changes to Schedule/Tasks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => {
                // Just scroll to bottom / do nothing - they can hit Complete
              }}
            >
              <Text style={[styles.continueButtonText, { color: colors.textSecondary }]}>
                No changes needed, continue →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Your Target Today
          </Text>
          <Text style={[styles.summaryPoints, { color: getFuelColor(fuelLevel || 2) }]}>
            {((actionsData?.today || []).reduce((sum, e) => sum + (e.points || 3), 0) +
              (actionsData?.overdue || []).reduce((sum, e) => sum + (e.points || 3), 0) +
              mindsetPoints +
              10)}{' '}
            points
          </Text>
          <Text style={[styles.summaryBreakdown, { color: colors.textSecondary }]}>
            {actionsData?.today.length || 0} event{(actionsData?.today.length || 0) !== 1 ? 's' : ''} 
            {mindsetPoints > 0 && ` + ${mindsetPoints} mindset`} + 10 completion bonus
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Complete Button - Fixed at bottom */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            { backgroundColor: fuelLevel ? getFuelColor(fuelLevel) : colors.primary },
            completing && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={completing}
          activeOpacity={0.8}
        >
          {completing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.completeButtonText}>Complete Morning Spark</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Adjust Modal - Bin-based with Dropdowns */}
      <Modal
        visible={showAdjustModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Adjust {adjustType === 'events' ? 'Schedule' : 'Tasks'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowAdjustModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalInstructions, { color: colors.textSecondary }]}>
              Tap an item to select it, then use the buttons below to move between zones.
            </Text>

            {/* KEEP ZONE */}
            <View style={styles.binContainer}>
              <View style={[styles.binHeader, { backgroundColor: '#10B98120' }]}>
                <Text style={[styles.binTitle, { color: '#10B981' }]}>KEEP AS IS</Text>
                <Text style={[styles.binSubtitle, { color: '#10B981' }]}>
                  ✓ These will stay scheduled for today
                </Text>
              </View>
              <View style={[styles.binContent, { backgroundColor: colors.surface, borderColor: '#10B981' }]}>
                {itemsInKeepZone.length === 0 ? (
                  <Text style={[styles.emptyBinText, { color: colors.textSecondary }]}>
                    No items here
                  </Text>
                ) : (
                  itemsInKeepZone.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.binItem,
                        { 
                          backgroundColor: colors.background,
                          borderColor: colors.border
                        }
                      ]}
                      onPress={() => moveItemToNextBin(item.id, 'keep')}
                    >
                      <Text style={[
                        styles.binItemText,
                        { color: adjustType === 'tasks' ? getPriorityColor(item) : colors.text }
                      ]}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>

            {/* RESCHEDULE ZONE */}
            <View style={styles.binContainer}>
              <View style={[styles.binHeader, { backgroundColor: '#3B82F620' }]}>
                <Text style={[styles.binTitle, { color: '#3B82F6' }]}>RESCHEDULE</Text>
                <Text style={[styles.binSubtitle, { color: '#3B82F6' }]}>
                  📅 Adjust date and time
                </Text>
              </View>
              <View style={[styles.binContent, { backgroundColor: colors.surface, borderColor: '#3B82F6' }]}>
                {itemsInRescheduleZone.length === 0 ? (
                  <Text style={[styles.emptyBinText, { color: colors.textSecondary }]}>
                    No items here
                  </Text>
                ) : (
                  itemsInRescheduleZone.map(item => (
                    <View key={item.id} style={styles.rescheduleItemContainer}>
                      <TouchableOpacity
                        style={[
                          styles.binItem,
                          { 
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            marginBottom: 8
                          }
                        ]}
                        onPress={() => moveItemToNextBin(item.id, 'reschedule')}
                      >
                        <Text style={[
                          styles.binItemText,
                          { color: adjustType === 'tasks' ? getPriorityColor(item) : colors.text }
                        ]}>
                          {item.title}
                        </Text>
                      </TouchableOpacity>

                      {/* Date Picker - Inline like TaskEventForm */}
                      <View style={styles.pickerRow}>
                        <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Date:</Text>
                        <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                          <Picker
                            selectedValue={rescheduleDates[item.id]}
                            onValueChange={(value) => setRescheduleDates(prev => ({...prev, [item.id]: value}))}
                            style={[styles.picker, { color: colors.text }]}
                          >
                            {Array.from({length: 14}, (_, i) => {
                              const date = new Date();
                              date.setDate(date.getDate() + i + 1);
                              const dateStr = toLocalISOString(date).split('T')[0];
                              const label = i === 0 ? 'Tomorrow' : 
                                           i === 1 ? 'Day After Tomorrow' :
                                           date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                              return <Picker.Item key={dateStr} label={label} value={dateStr} />;
                            })}
                          </Picker>
                        </View>
                      </View>

                      {/* Time Picker - Inline like TaskEventForm */}
                      <View style={styles.pickerRow}>
                        <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Time:</Text>
                        <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                          <Picker
                            selectedValue={rescheduleTimes[item.id]}
                            onValueChange={(value) => setRescheduleTimes(prev => ({...prev, [item.id]: value}))}
                            style={[styles.picker, { color: colors.text }]}
                          >
                            {getTimeOptions(item).map(opt => (
                              <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                            ))}
                          </Picker>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* CANCEL ZONE */}
            <View style={styles.binContainer}>
              <View style={[styles.binHeader, { backgroundColor: '#EF444420' }]}>
                <Text style={[styles.binTitle, { color: '#EF4444' }]}>CANCEL</Text>
                <Text style={[styles.binSubtitle, { color: '#EF4444' }]}>
                  🗑️ These will be deleted
                </Text>
              </View>
              <View style={[styles.binContent, { backgroundColor: colors.surface, borderColor: '#EF4444' }]}>
                {itemsInCancelZone.length === 0 ? (
                  <Text style={[styles.emptyBinText, { color: colors.textSecondary }]}>
                    No items here
                  </Text>
                ) : (
                  itemsInCancelZone.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.binItem,
                        { 
                          backgroundColor: colors.background,
                          borderColor: colors.border
                        }
                      ]}
                      onPress={() => moveItemToNextBin(item.id, 'cancel')}
                    >
                      <Text style={[
                        styles.binItemText,
                        { color: adjustType === 'tasks' ? getPriorityColor(item) : colors.text }
                      ]}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.modalDoneButton, { backgroundColor: colors.primary }]}
              onPress={applyAdjustments}
            >
              <Text style={styles.modalDoneButtonText}>Apply Changes</Text>
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  fuelEmoji: {
    fontSize: 20,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  coachSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  coachLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  coachText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  overdueSection: {
    marginBottom: 16,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  redLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#EF4444',
  },
  overdueLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventsTable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickActionButton: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  overdueText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryPoints: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryBreakdown: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  completeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  adjustButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  adjustButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  acceptedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  viewAllTasksButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewAllTasksText: {
    fontSize: 15,
    fontWeight: '600',
  },
  allTasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hideButton: {
    padding: 4,
  },
  hideButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  reviewButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalInstructions: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  binContainer: {
    marginBottom: 20,
  },
  binHeader: {
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  binTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  binSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  binContent: {
    minHeight: 80,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    padding: 12,
  },
  emptyBinText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  binItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  binItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  binItemHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  rescheduleItemContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 60,
  },
  pickerWrapper: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: '#3B82F608',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  movementButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  movementButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  movementButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  adjustItemCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  adjustItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  adjustItemTime: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  adjustItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  adjustActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  modalDoneButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});