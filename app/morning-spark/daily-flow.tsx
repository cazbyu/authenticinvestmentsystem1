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
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSquare, Calendar, Check, Trash2, X, ChevronRight, ChevronLeft, Plus } from 'lucide-react-native';
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
import { DraggableFab } from '@/components/DraggableFab';
import TaskEventForm from '@/components/tasks/TaskEventForm';

// Import Morning Spark Components
import { ScheduleSection } from '@/components/morning-spark/ScheduleSection';
import { UrgentTasksSection } from '@/components/morning-spark/UrgentTasksSection';
import { BrainDumpSection } from '@/components/morning-spark/BrainDumpSection';
import { FollowUpSection } from '@/components/morning-spark/FollowUpSection';
import { RemainingTasksSection } from '@/components/morning-spark/RemainingTasksSection';
import { FinalCommitmentSection } from '@/components/morning-spark/FinalCommitmentSection';
import { ReflectionsSection } from '@/components/morning-spark/ReflectionsSection';

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Brain Dump state
  const [brainDumpNotes, setBrainDumpNotes] = useState<Array<{id: string; content: string}>>([]);
  const [loadingBrainDump, setLoadingBrainDump] = useState(false);
  
  // Follow Up state
  interface FollowUpItem {
    id: string;
    user_id: string;
    parent_type: string;
    parent_id: string;
    follow_up_date: string;
    title: string;
    completed_at?: string;
    archived: boolean;
  }
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [loadingFollowUp, setLoadingFollowUp] = useState(false);
  
  // EL1 Collapsible Sections state
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [depositIdeasCount, setDepositIdeasCount] = useState(0);
  const [activeGoalsCount, setActiveGoalsCount] = useState(0);
  const [delegationsCount, setDelegationsCount] = useState(0);
  const [showDepositIdeas, setShowDepositIdeas] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showDelegations, setShowDelegations] = useState(false);
  const [loadingDepositIdeas, setLoadingDepositIdeas] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  
  // Final Commitment state
  const [commitReflection, setCommitReflection] = useState(false);
  const [commitRose, setCommitRose] = useState(false);
  const [commitThorn, setCommitThorn] = useState(false);
  const [commitEveningReview, setCommitEveningReview] = useState(false);
  const [showFinalCommitment, setShowFinalCommitment] = useState(false);
  const [includeAllTasks, setIncludeAllTasks] = useState(false);
  const [finalCommitmentTasks, setFinalCommitmentTasks] = useState<ScheduledAction[]>([]);
  const [loadingFinalTasks, setLoadingFinalTasks] = useState(false);
  
  // Task/Event commitment states
  type CommitmentState = 'uncommitted' | 'committed' | 'rescheduled';
  const [itemCommitmentStates, setItemCommitmentStates] = useState<Record<string, CommitmentState>>({});
  
  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<ScheduledAction | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('anytime');
  const [isRescheduling, setIsRescheduling] = useState(false);
  
  // FAB modal state
  const [isFabModalVisible, setIsFabModalVisible] = useState(false);
  
  // Collapsible section state
  const [showReflections, setShowReflections] = useState(false);
  const [showUrgentTasks, setShowUrgentTasks] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showRemainingTasks, setShowRemainingTasks] = useState(false);

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

      // Load brain dump after we have userId
      await loadBrainDump(user.id);
      
      // Load follow-ups
      await loadFollowUps(user.id);
      
      // Load counts for EL1 dropdowns (don't load full data yet)
      if (spark.fuel_level === 1) {
        await loadDropdownCounts(user.id);
      }

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

  async function loadBrainDump(uid: string) {
    try {
      setLoadingBrainDump(true);
      const supabase = getSupabaseClient();
      
      // Query yesterday's brain dump reflections
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toLocalISOString(yesterday).split('T')[0];

      const { data, error } = await supabase
        .from('0008-ap-reflections')
        .select('id, content')
        .eq('user_id', uid)
        .eq('reflection_type', 'brain_dump')
        .gte('created_at', `${yesterdayStr}T00:00:00`)
        .lt('created_at', `${yesterdayStr}T23:59:59`)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBrainDumpNotes(data || []);
    } catch (error) {
      console.error('Error loading brain dump:', error);
    } finally {
      setLoadingBrainDump(false);
    }
  }

  async function handleDeferNote(noteId: string) {
    // Just remove from display - note stays in database for Journal view
    setBrainDumpNotes(prev => prev.filter(note => note.id !== noteId));
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleFollowUpNote(noteId: string) {
    try {
      const supabase = getSupabaseClient();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toLocalISOString(tomorrow).split('T')[0];

      // Set follow_up date to tomorrow
      await supabase
        .from('0008-ap-reflections')
        .update({ follow_up: tomorrowStr })
        .eq('id', noteId);

      // Remove from display
      setBrainDumpNotes(prev => prev.filter(note => note.id !== noteId));

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Note will appear in tomorrow\'s Follow Up section.');
    } catch (error) {
      console.error('Error setting follow-up:', error);
      Alert.alert('Error', 'Failed to set follow-up. Please try again.');
    }
  }

  async function loadFollowUps(uid: string) {
    try {
      setLoadingFollowUp(true);
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      // Use the view we created
      const { data, error } = await supabase
        .from('v_morning_spark_follow_ups')
        .select('*')
        .eq('user_id', uid);

      if (error) throw error;

      setFollowUpItems(data || []);
    } catch (error) {
      console.error('Error loading follow-ups:', error);
    } finally {
      setLoadingFollowUp(false);
    }
  }

  async function handleCompleteFollowUp(item: FollowUpItem) {
    try {
      const supabase = getSupabaseClient();
      const now = toLocalISOString(new Date());

      // Determine which table to update based on parent_type
      let tableName = '';
      if (item.parent_type === 'task' || item.parent_type === 'event') {
        tableName = '0008-ap-tasks';
      } else if (item.parent_type === 'depositIdea') {
        tableName = '0008-ap-deposit-ideas';
      } else if (item.parent_type === 'reflection') {
        tableName = '0008-ap-reflections';
      } else if (item.parent_type === 'goal_12wk') {
        tableName = '0008-ap-goals-12wk';
      } else if (item.parent_type === 'goal_1y') {
        tableName = '0008-ap-goals-1y';
      } else if (item.parent_type === 'goal_custom') {
        tableName = '0008-ap-goals-custom';
      }

      if (tableName) {
        // Clear follow_up and set followed_up_at
        await supabase
          .from(tableName)
          .update({
            follow_up: null,
            followed_up_at: now,
          })
          .eq('id', item.id);

        // Remove from display
        setFollowUpItems(prev => prev.filter(i => i.id !== item.id));

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error completing follow-up:', error);
      Alert.alert('Error', 'Failed to mark as followed up. Please try again.');
    }
  }

  async function handleSnoozeFollowUp(item: FollowUpItem) {
    try {
      const supabase = getSupabaseClient();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = toLocalISOString(tomorrow).split('T')[0];

      // Determine which table to update
      let tableName = '';
      if (item.parent_type === 'task' || item.parent_type === 'event') {
        tableName = '0008-ap-tasks';
      } else if (item.parent_type === 'depositIdea') {
        tableName = '0008-ap-deposit-ideas';
      } else if (item.parent_type === 'reflection') {
        tableName = '0008-ap-reflections';
      } else if (item.parent_type === 'goal_12wk') {
        tableName = '0008-ap-goals-12wk';
      } else if (item.parent_type === 'goal_1y') {
        tableName = '0008-ap-goals-1y';
      } else if (item.parent_type === 'goal_custom') {
        tableName = '0008-ap-goals-custom';
      }

      if (tableName) {
        // Update follow_up to tomorrow
        await supabase
          .from(tableName)
          .update({ follow_up: tomorrowStr })
          .eq('id', item.id);

        // Remove from display
        setFollowUpItems(prev => prev.filter(i => i.id !== item.id));

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        Alert.alert('Success', 'Follow-up snoozed until tomorrow.');
      }
    } catch (error) {
      console.error('Error snoozing follow-up:', error);
      Alert.alert('Error', 'Failed to snooze follow-up. Please try again.');
    }
  }

  async function loadDepositIdeas() {
    if (loadingDepositIdeas) return;
    
    try {
      setLoadingDepositIdeas(true);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('0008-ap-deposit-ideas')
        .select('id, title, created_at, activated_at')
        .eq('user_id', userId)
        .eq('archived', false)
        .eq('is_active', true)
        .is('activated_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setDepositIdeas(data || []);
      setShowDepositIdeas(true);
    } catch (error) {
      console.error('Error loading deposit ideas:', error);
      Alert.alert('Error', 'Failed to load deposit ideas. Please try again.');
    } finally {
      setLoadingDepositIdeas(false);
    }
  }

  async function loadActiveGoals() {
    if (loadingGoals) return;
    
    try {
      setLoadingGoals(true);
      const supabase = getSupabaseClient();

      // Load from all 3 goal tables
      const [goals12wk, goals1y, goalsCustom] = await Promise.all([
        supabase
          .from('0008-ap-goals-12wk')
          .select('id, title, status, progress, start_date, end_date')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('archived', false)
          .order('start_date', { ascending: false }),
        supabase
          .from('0008-ap-goals-1y')
          .select('id, title, status, year_target_date')
          .eq('user_id', userId)
          .eq('status', 'active')
          .is('archived_at', null)
          .order('year_target_date', { ascending: true }),
        supabase
          .from('0008-ap-goals-custom')
          .select('id, title, status, progress, start_date, end_date')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('archived', false)
          .order('start_date', { ascending: false }),
      ]);

      const combined = [
        ...(goals12wk.data || []).map(g => ({ ...g, type: '12-Week' })),
        ...(goals1y.data || []).map(g => ({ ...g, type: '1-Year' })),
        ...(goalsCustom.data || []).map(g => ({ ...g, type: 'Custom' })),
      ];

      setActiveGoals(combined);
      setShowGoals(true);
    } catch (error) {
      console.error('Error loading goals:', error);
      Alert.alert('Error', 'Failed to load goals. Please try again.');
    } finally {
      setLoadingGoals(false);
    }
  }

  async function loadDelegations() {
    if (loadingDelegations) return;
    
    try {
      setLoadingDelegations(true);
      const supabase = getSupabaseClient();

      // Use the view we have
      const { data, error } = await supabase
        .from('v_morning_spark_delegations')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      setDelegations(data || []);
      setShowDelegations(true);
    } catch (error) {
      console.error('Error loading delegations:', error);
      Alert.alert('Error', 'Failed to load delegations. Please try again.');
    } finally {
      setLoadingDelegations(false);
    }
  }

  async function loadDropdownCounts(uid: string) {
    try {
      const supabase = getSupabaseClient();

      // Count deposit ideas
      const { count: ideasCount } = await supabase
        .from('0008-ap-deposit-ideas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('archived', false)
        .eq('is_active', true)
        .is('activated_at', null);

      // Count goals from all 3 tables
      const [goals12wkCount, goals1yCount, goalsCustomCount] = await Promise.all([
        supabase
          .from('0008-ap-goals-12wk')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('status', 'active')
          .eq('archived', false),
        supabase
          .from('0008-ap-goals-1y')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('status', 'active')
          .is('archived_at', null),
        supabase
          .from('0008-ap-goals-custom')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('status', 'active')
          .eq('archived', false),
      ]);

      const totalGoals = (goals12wkCount.count || 0) + (goals1yCount.count || 0) + (goalsCustomCount.count || 0);

      // Count delegations
      const { count: delegationsCount } = await supabase
        .from('v_morning_spark_delegations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid);

      setDepositIdeasCount(ideasCount || 0);
      setActiveGoalsCount(totalGoals);
      setDelegationsCount(delegationsCount || 0);
    } catch (error) {
      console.error('Error loading dropdown counts:', error);
    }
  }

  async function loadAllTasksForCommitment() {
    if (loadingFinalTasks) return;
    
    try {
      setLoadingFinalTasks(true);
      const supabase = getSupabaseClient();
      const today = toLocalISOString(new Date()).split('T')[0];

      // Load ALL tasks due today or overdue (not just urgent)
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'task')
        .is('completed_at', null)
        .is('deleted_at', null)
        .or(`due_date.eq.${today},due_date.lt.${today}`)
        .order('is_urgent', { ascending: false }) // Urgent first
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

      setFinalCommitmentTasks(tasks);
    } catch (error) {
      console.error('Error loading all tasks for commitment:', error);
    } finally {
      setLoadingFinalTasks(false);
    }
  }

  function handleIncludeAllTasksToggle() {
    const newValue = !includeAllTasks;
    setIncludeAllTasks(newValue);
    
    if (newValue) {
      // Load all tasks
      loadAllTasksForCommitment();
    } else {
      // Clear and go back to just urgent tasks
      setFinalCommitmentTasks([]);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }

  function handleCommitItem(itemId: string) {
    console.log('Toggling commit for item:', itemId);
    setItemCommitmentStates(prev => {
      const currentState = prev[itemId];
      const newState = currentState === 'committed' ? 'uncommitted' : 'committed';
      const updatedStates = {
        ...prev,
        [itemId]: newState as CommitmentState
      };
      console.log('New commitment states:', updatedStates);
      return updatedStates;
    });
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  function openRescheduleModal(item: ScheduledAction) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalISOString(tomorrow).split('T')[0];
    
    setRescheduleItem(item);
    setRescheduleDate(tomorrowStr);
    setRescheduleTime(item.start_time || 'anytime');
    setShowRescheduleModal(true);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  async function handleRescheduleConfirm() {
    if (!rescheduleItem || isRescheduling) return;
    
    try {
      setIsRescheduling(true);
      const supabase = getSupabaseClient();
      
      const isEvent = !!rescheduleItem.start_date;
      
      if (isEvent) {
        // Update event
        await supabase
          .from('0008-ap-tasks')
          .update({
            start_date: rescheduleDate,
            start_time: rescheduleTime === 'anytime' ? null : rescheduleTime,
          })
          .eq('id', rescheduleItem.id);
      } else {
        // Update task
        if (rescheduleTime === 'anytime') {
          await supabase
            .from('0008-ap-tasks')
            .update({
              due_date: rescheduleDate,
              is_anytime: true,
              start_time: null,
              end_time: null,
            })
            .eq('id', rescheduleItem.id);
        } else {
          await supabase
            .from('0008-ap-tasks')
            .update({
              due_date: rescheduleDate,
              is_anytime: false,
              start_time: rescheduleTime,
              end_time: rescheduleTime,
            })
            .eq('id', rescheduleItem.id);
        }
      }
      
      // Mark as rescheduled
      setItemCommitmentStates(prev => ({
        ...prev,
        [rescheduleItem.id]: 'rescheduled'
      }));
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setShowRescheduleModal(false);
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error rescheduling item:', error);
      Alert.alert('Error', 'Failed to reschedule. Please try again.');
    } finally {
      setIsRescheduling(false);
    }
  }

  function getCommittedItems(items: ScheduledAction[]) {
    return items.filter(item => {
      const state = itemCommitmentStates[item.id];
      // Default to uncommitted, only show if explicitly committed
      return state === 'committed';
    });
  }

  function getVisibleItems(items: ScheduledAction[]) {
    return items.filter(item => {
      const state = itemCommitmentStates[item.id];
      // Hide rescheduled items
      return state !== 'rescheduled';
    });
  }

  function getTodayDate() {
    return toLocalISOString(new Date()).split('T')[0];
  }

  function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalISOString(tomorrow).split('T')[0];
  }

  function formatRescheduleDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date(getTodayDate() + 'T00:00:00');
    const tomorrow = new Date(getTomorrowDate() + 'T00:00:00');
    
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
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

  function selectItem(itemId: string) {
    setSelectedItemId(itemId);
  }

  function moveSelectedItemTo(targetBin: 'keep' | 'reschedule' | 'cancel') {
    if (!selectedItemId) return;

    const allItems = [...itemsInKeepZone, ...itemsInRescheduleZone, ...itemsInCancelZone];
    const item = allItems.find(i => i.id === selectedItemId);
    if (!item) return;

    // Remove from all bins
    setItemsInKeepZone(prev => prev.filter(i => i.id !== selectedItemId));
    setItemsInRescheduleZone(prev => prev.filter(i => i.id !== selectedItemId));
    setItemsInCancelZone(prev => prev.filter(i => i.id !== selectedItemId));

    // Add to target bin
    if (targetBin === 'keep') {
      setItemsInKeepZone(prev => [...prev, item]);
    } else if (targetBin === 'reschedule') {
      setItemsInRescheduleZone(prev => [...prev, item]);
      // Set default reschedule values if not already set
      if (!rescheduleDates[selectedItemId]) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRescheduleDates(prev => ({...prev, [selectedItemId]: toLocalISOString(tomorrow).split('T')[0]}));
      }
      if (!rescheduleTimes[selectedItemId]) {
        setRescheduleTimes(prev => ({...prev, [selectedItemId]: 'anytime'}));
      }
    } else {
      setItemsInCancelZone(prev => [...prev, item]);
    }

    setSelectedItemId(null);
  }

  // Mobile tap fallback (cycle through bins)
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

          console.log('Rescheduling:', item.title, 'to', newDate, newTime);

          // Determine if it's an event or task based on which date field is populated
          const isEvent = !!item.start_date;
          
          if (isEvent) {
            // Events: update start_date and start_time
            await supabase
              .from('0008-ap-tasks')
              .update({
                start_date: newDate,
                start_time: newTime === 'anytime' ? null : newTime,
              })
              .eq('id', item.id);
          } else {
            // Tasks: update due_date, is_anytime, start_time, and end_time
            if (newTime === 'anytime') {
              await supabase
                .from('0008-ap-tasks')
                .update({
                  due_date: newDate,
                  is_anytime: true,
                  start_time: null,
                  end_time: null,
                })
                .eq('id', item.id);
            } else {
              await supabase
                .from('0008-ap-tasks')
                .update({
                  due_date: newDate,
                  is_anytime: false,
                  start_time: newTime,
                  end_time: newTime,
                })
                .eq('id', item.id);
            }
          }
        }
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Build success message
      let message = 'Changes applied successfully!';
      if (itemsInRescheduleZone.length > 0) {
        const rescheduledCount = itemsInRescheduleZone.length;
        message += `\n\n${rescheduledCount} item${rescheduledCount > 1 ? 's' : ''} rescheduled and will appear on the new date.`;
      }
      if (itemsInCancelZone.length > 0) {
        const cancelledCount = itemsInCancelZone.length;
        message += `\n\n${cancelledCount} item${cancelledCount > 1 ? 's' : ''} cancelled.`;
      }

      Alert.alert('Success', message);
      setShowAdjustModal(false);
      await loadData(); // Reload everything
      
      // If "All Tasks" was expanded, reload it too
      if (showAllTasks) {
        await loadAllTasks();
      }
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
      
      // Calculate commitment points (max 10 from reflections, separate 10 from evening review)
      const reflectionPoints = Math.min(
        (commitReflection ? 1 : 0) + 
        (commitRose ? 2 : 0) + 
        (commitThorn ? 1 : 0),
        10
      );
      const eveningReviewPoints = commitEveningReview ? 10 : 0;
      const commitmentPoints = reflectionPoints + eveningReviewPoints;
      
      const sparkCompletionBonus = 10;
      const totalTarget = eventPoints + overduePoints + mindsetPoints + commitmentPoints + sparkCompletionBonus;

      // Update the spark with completion data and commitment flags
      await supabase
        .from('0008-ap-daily-sparks')
        .update({
          initial_target_score: totalTarget,
          committed_at: toLocalISOString(new Date()),
          commit_reflection: commitReflection,
          commit_rose: commitRose,
          commit_thorn: commitThorn,
          commit_evening_review: commitEveningReview,
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
    const isCommitted = itemCommitmentStates[event.id] === 'committed';
    const isRescheduled = itemCommitmentStates[event.id] === 'rescheduled';
    
    // Don't render rescheduled events
    if (isRescheduled) return null;

    return Platform.OS === 'web' ? (
      // Web version
      <View
        key={event.id}
        style={[
          styles.eventRow,
          { borderBottomColor: colors.border },
          isCommitted && { 
            backgroundColor: '#10B98120',
            borderLeftWidth: 4,
            borderLeftColor: '#10B981'
          }
        ]}
      >
        <TouchableOpacity
          style={styles.webTaskClickArea}
          onPress={() => handleCommitItem(event.id)}
        >
          <View style={styles.iconContainer}>
            {isCommitted ? (
              <Check size={20} color="#10B981" strokeWidth={3} />
            ) : (
              <Calendar size={16} color={iconColor} />
            )}
          </View>

          <View style={styles.eventContent}>
            <Text style={[
              styles.eventTitle, 
              { color: titleColor },
              isCommitted && { fontWeight: '600' }
            ]} numberOfLines={1}>
              {isCommitted && '✓ '}{event.title}
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
        </TouchableOpacity>

        {/* Reschedule button for web */}
        <TouchableOpacity
          style={[styles.webRescheduleButton, { backgroundColor: colors.background }]}
          onPress={() => openRescheduleModal(event)}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    ) : (
      // Mobile version
      <TouchableOpacity
        key={event.id}
        style={[
          styles.eventRow,
          { borderBottomColor: colors.border },
          isCommitted && { 
            backgroundColor: '#10B98120',
            borderLeftWidth: 4,
            borderLeftColor: '#10B981'
          }
        ]}
        onPress={() => handleCommitItem(event.id)}
        onLongPress={() => openRescheduleModal(event)}
      >
        <View style={styles.iconContainer}>
          {isCommitted ? (
            <Check size={20} color="#10B981" strokeWidth={3} />
          ) : (
            <Calendar size={16} color={iconColor} />
          )}
        </View>

        <View style={styles.eventContent}>
          <Text style={[
            styles.eventTitle, 
            { color: titleColor },
            isCommitted && { fontWeight: '600' }
          ]} numberOfLines={1}>
            {isCommitted && '✓ '}{event.title}
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
      </TouchableOpacity>
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
        <ScheduleSection
          events={actionsData.today}
          colors={colors}
          formatTimeDisplay={formatTimeDisplay}
          getScheduleMessage={getScheduleMessage}
          itemCommitmentStates={itemCommitmentStates}
          handleCommitItem={handleCommitItem}
          openRescheduleModal={openRescheduleModal}
        />

        {/* Urgent Tasks Section - EL1 Only */}
        <UrgentTasksSection
          fuelLevel={fuelLevel}
          urgentTasks={urgentTasks}
          colors={colors}
          itemCommitmentStates={itemCommitmentStates}
          handleCommitItem={handleCommitItem}
          openRescheduleModal={openRescheduleModal}
          getVisibleItems={getVisibleItems}
          getCommittedItems={getCommittedItems}
          getPriorityColor={getPriorityColor}
        />

        {/* Brain Dump Section */}
        <BrainDumpSection
          brainDumpNotes={brainDumpNotes}
          colors={colors}
          loadingBrainDump={loadingBrainDump}
          handleDeferNote={handleDeferNote}
          handleFollowUpNote={handleFollowUpNote}
        />

        {/* Follow Up Section */}
        <FollowUpSection
          followUpItems={followUpItems}
          colors={colors}
          loadingFollowUp={loadingFollowUp}
          handleCompleteFollowUp={handleCompleteFollowUp}
          handleSnoozeFollowUp={handleSnoozeFollowUp}
        />

        {/* Remaining Tasks Section - EL1 Only */}
        <RemainingTasksSection
          fuelLevel={fuelLevel}
          allTasks={allTasks}
          colors={colors}
          loadingAllTasks={loadingAllTasks}
          itemCommitmentStates={itemCommitmentStates}
          handleCommitItem={handleCommitItem}
          openRescheduleModal={openRescheduleModal}
          getVisibleItems={getVisibleItems}
          getCommittedItems={getCommittedItems}
          getPriorityColor={getPriorityColor}
          loadAllTasks={loadAllTasks}
          toLocalISOString={toLocalISOString}
        />

        {/* EL1 Only: Collapsible Review Sections */}
        {fuelLevel === 1 && (
          <>
            {/* Deposit Ideas Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  if (!showDepositIdeas) {
                    loadDepositIdeas();
                  } else {
                    setShowDepositIdeas(false);
                  }
                }}
              >
                <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
                  💡 Review Deposit Ideas ({depositIdeasCount})
                </Text>
                <Text style={[styles.collapsibleArrow, { color: colors.textSecondary }]}>
                  {showDepositIdeas ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {showDepositIdeas && (
                loadingDepositIdeas ? (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : depositIdeas.length === 0 ? (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No active deposit ideas
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {depositIdeas.map((idea) => (
                      <View key={idea.id} style={[styles.reviewItem, { borderColor: colors.border }]}>
                        <Text style={[styles.reviewItemTitle, { color: colors.text }]}>
                          {idea.title}
                        </Text>
                        <Text style={[styles.reviewItemDate, { color: colors.textSecondary }]}>
                          Added {new Date(idea.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>

            {/* Goals Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  if (!showGoals) {
                    loadActiveGoals();
                  } else {
                    setShowGoals(false);
                  }
                }}
              >
                <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
                  🎯 Review Active Goals ({activeGoalsCount})
                </Text>
                <Text style={[styles.collapsibleArrow, { color: colors.textSecondary }]}>
                  {showGoals ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {showGoals && (
                loadingGoals ? (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : activeGoals.length === 0 ? (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No active goals
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {activeGoals.map((goal) => (
                      <View key={goal.id} style={[styles.reviewItem, { borderColor: colors.border }]}>
                        <View style={styles.goalHeader}>
                          <Text style={[styles.reviewItemTitle, { color: colors.text }]}>
                            {goal.title}
                          </Text>
                          <Text style={[styles.goalType, { color: colors.textSecondary }]}>
                            {goal.type}
                          </Text>
                        </View>
                        {goal.progress !== undefined && (
                          <Text style={[styles.goalProgress, { color: colors.primary }]}>
                            {goal.progress}% complete
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>

            {/* Delegations Section */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.collapsibleHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  if (!showDelegations) {
                    loadDelegations();
                  } else {
                    setShowDelegations(false);
                  }
                }}
              >
                <Text style={[styles.collapsibleTitle, { color: colors.text }]}>
                  👥 Review Delegations ({delegationsCount})
                </Text>
                <Text style={[styles.collapsibleArrow, { color: colors.textSecondary }]}>
                  {showDelegations ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {showDelegations && (
                loadingDelegations ? (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : delegations.length === 0 ? (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No pending delegations
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.collapsibleContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {delegations.map((delegation) => (
                      <View key={delegation.delegation_id} style={[styles.reviewItem, { borderColor: colors.border }]}>
                        <Text style={[styles.reviewItemTitle, { color: colors.text }]}>
                          {delegation.task_title}
                        </Text>
                        <Text style={[styles.delegationInfo, { color: colors.textSecondary }]}>
                          Delegated to: {delegation.delegate_name}
                        </Text>
                        {delegation.due_date && (
                          <Text style={[styles.reviewItemDate, { color: colors.textSecondary }]}>
                            Due: {new Date(delegation.due_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>
          </>
        )}

        {/* Final Commitment View */}
        <FinalCommitmentSection
          actionsData={actionsData}
          fuelLevel={fuelLevel}
          urgentTasks={urgentTasks}
          allTasks={allTasks}
          colors={colors}
          formatTimeDisplay={formatTimeDisplay}
          getPriorityColor={getPriorityColor}
          getCommittedItems={getCommittedItems}
          commitReflection={commitReflection}
          commitRose={commitRose}
          commitThorn={commitThorn}
          commitEveningReview={commitEveningReview}
          mindsetPoints={mindsetPoints}
        />

          {/* Reflections Section */}
        <ReflectionsSection
          colors={colors}
          commitReflection={commitReflection}
          setCommitReflection={setCommitReflection}
          commitRose={commitRose}
          setCommitRose={setCommitRose}
          commitThorn={commitThorn}
          setCommitThorn={setCommitThorn}
          commitEveningReview={commitEveningReview}
          setCommitEveningReview={setCommitEveningReview}
        />

          {/* Final Target Display */}
          <View style={[styles.finalTargetCard, { backgroundColor: colors.surface, borderColor: getFuelColor(fuelLevel || 2) }]}>
            <Text style={[styles.finalTargetLabel, { color: colors.textSecondary }]}>
              🎯 Your Target Score Today
            </Text>
            <Text style={[styles.finalTargetPoints, { color: getFuelColor(fuelLevel || 2) }]}>
              {(() => {
                const eventPoints = (actionsData?.today || []).reduce((sum, e) => sum + (e.points || 3), 0);
                const overduePoints = (actionsData?.overdue || []).reduce((sum, e) => sum + (e.points || 3), 0);
                
                // Only count COMMITTED tasks
                const committedUrgent = fuelLevel === 1 ? getCommittedItems(urgentTasks) : [];
                const committedFromAll = fuelLevel === 1 ? getCommittedItems(allTasks) : [];
                const allCommittedTasks = [...committedUrgent];
                committedFromAll.forEach(task => {
                  if (!allCommittedTasks.find(t => t.id === task.id)) {
                    allCommittedTasks.push(task);
                  }
                });
                const taskPoints = allCommittedTasks.reduce((sum, t) => sum + (t.points || 3), 0);
                
                const reflectionPoints = Math.min((commitReflection ? 1 : 0) + (commitRose ? 2 : 0) + (commitThorn ? 1 : 0), 10);
                const eveningReviewPoints = commitEveningReview ? 10 : 0;
                const completionBonus = 10;
                
                return eventPoints + overduePoints + taskPoints + mindsetPoints + reflectionPoints + eveningReviewPoints + completionBonus;
              })()}{' '}
              points
            </Text>
            <Text style={[styles.finalTargetBreakdown, { color: colors.textSecondary }]}>
              {(actionsData?.today.length || 0) + (actionsData?.overdue.length || 0)} events
              {(() => {
                const committedUrgent = fuelLevel === 1 ? getCommittedItems(urgentTasks) : [];
                const committedFromAll = fuelLevel === 1 ? getCommittedItems(allTasks) : [];
                const allCommittedTasks = [...committedUrgent];
                committedFromAll.forEach(task => {
                  if (!allCommittedTasks.find(t => t.id === task.id)) {
                    allCommittedTasks.push(task);
                  }
                });
                return allCommittedTasks.length > 0 ? ` + ${allCommittedTasks.length} tasks` : '';
              })()}
              {mindsetPoints > 0 && ` + ${mindsetPoints} mindset`}
              {(commitReflection || commitRose || commitThorn) && ` + ${Math.min((commitReflection ? 1 : 0) + (commitRose ? 2 : 0) + (commitThorn ? 1 : 0), 10)} reflections`}
              {commitEveningReview && ' + 10 evening review'}
              {' + 10 completion bonus'}
            </Text>
          </View>
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
              Click an item to select it, then click a bin below to move it there
            </Text>

            {/* Move Buttons - Show when item is selected */}
            {selectedItemId && (
              <View style={[styles.moveButtonsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.moveButtonsLabel, { color: colors.text }]}>
                  Move selected item to:
                </Text>
                <View style={styles.moveButtonsRow}>
                  <TouchableOpacity
                    style={[styles.moveButton, { backgroundColor: '#10B981' }]}
                    onPress={() => moveSelectedItemTo('keep')}
                  >
                    <Text style={styles.moveButtonText}>✓ KEEP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moveButton, { backgroundColor: '#3B82F6' }]}
                    onPress={() => moveSelectedItemTo('reschedule')}
                  >
                    <Text style={styles.moveButtonText}>📅 RESCHEDULE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moveButton, { backgroundColor: '#EF4444' }]}
                    onPress={() => moveSelectedItemTo('cancel')}
                  >
                    <Text style={styles.moveButtonText}>🗑️ CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* KEEP ZONE */}
            <View style={styles.binContainer}>
              <View style={[
                styles.binHeader, 
                { backgroundColor: '#10B98120' }
              ]}>
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
                          backgroundColor: selectedItemId === item.id ? '#10B98130' : colors.background,
                          borderColor: selectedItemId === item.id ? '#10B981' : colors.border,
                          borderWidth: selectedItemId === item.id ? 2 : 1
                        }
                      ]}
                      onPress={() => selectItem(item.id)}
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
                            backgroundColor: selectedItemId === item.id ? '#3B82F630' : colors.background,
                            borderColor: selectedItemId === item.id ? '#3B82F6' : colors.border,
                            borderWidth: selectedItemId === item.id ? 2 : 1,
                            marginBottom: 8
                          }
                        ]}
                        onPress={() => selectItem(item.id)}
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
                          backgroundColor: selectedItemId === item.id ? '#EF444430' : colors.background,
                          borderColor: selectedItemId === item.id ? '#EF4444' : colors.border,
                          borderWidth: selectedItemId === item.id ? 2 : 1
                        }
                      ]}
                      onPress={() => selectItem(item.id)}
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

      {/* Reschedule Modal */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowRescheduleModal(false)} style={styles.modalBackButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Reschedule{rescheduleItem ? ` "${rescheduleItem.title}"` : ''}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.rescheduleContent}>
            <Text style={[styles.rescheduleQuestion, { color: colors.text }]}>
              When should we tackle this?
            </Text>

            {/* Quick Date Selection */}
            <Text style={[styles.rescheduleLabel, { color: colors.textSecondary }]}>
              📅 Date
            </Text>
            <View style={styles.quickButtons}>
              <TouchableOpacity
                style={[
                  styles.quickButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleDate === getTodayDate() && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleDate(getTodayDate())}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleDate === getTodayDate() ? '#FFFFFF' : colors.text }
                ]}>
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleDate === getTomorrowDate() && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleDate(getTomorrowDate())}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleDate === getTomorrowDate() ? '#FFFFFF' : colors.text }
                ]}>
                  Tomorrow
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.selectedValue, { color: colors.primary }]}>
              {formatRescheduleDate(rescheduleDate)}
            </Text>

            {/* Quick Time Selection */}
            <Text style={[styles.rescheduleLabel, { color: colors.textSecondary, marginTop: 24 }]}>
              🕐 Time
            </Text>
            <View style={styles.quickButtons}>
              <TouchableOpacity
                style={[
                  styles.quickButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleTime === 'anytime' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleTime('anytime')}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleTime === 'anytime' ? '#FFFFFF' : colors.text }
                ]}>
                  Anytime
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleTime === '09:00' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleTime('09:00')}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleTime === '09:00' ? '#FFFFFF' : colors.text }
                ]}>
                  Morning
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleTime === '14:00' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleTime('14:00')}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleTime === '14:00' ? '#FFFFFF' : colors.text }
                ]}>
                  Afternoon
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleTime === '18:00' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleTime('18:00')}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleTime === '18:00' ? '#FFFFFF' : colors.text }
                ]}>
                  Evening
                </Text>
              </TouchableOpacity>
            </View>

            {rescheduleItem?.start_time && (
              <TouchableOpacity
                style={[
                  styles.sameTimeButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  rescheduleTime === rescheduleItem.start_time && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setRescheduleTime(rescheduleItem.start_time || 'anytime')}
              >
                <Text style={[
                  styles.quickButtonText,
                  { color: rescheduleTime === rescheduleItem.start_time ? '#FFFFFF' : colors.text }
                ]}>
                  Same Time ({formatTimeDisplay(rescheduleItem.start_time)})
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.selectedValue, { color: colors.primary }]}>
              {rescheduleTime === 'anytime' ? 'Anytime' : formatTimeDisplay(rescheduleTime)}
            </Text>
          </ScrollView>

          <View style={[styles.rescheduleActions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.rescheduleCancelButton, { borderColor: colors.border }]}
              onPress={() => setShowRescheduleModal(false)}
            >
              <Text style={[styles.rescheduleCancelText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rescheduleConfirmButton, { backgroundColor: colors.primary }]}
              onPress={handleRescheduleConfirm}
              disabled={isRescheduling}
            >
              {isRescheduling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.rescheduleConfirmText}>
                  Schedule
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Draggable FAB for quick task/event creation */}
      <DraggableFab onPress={() => setIsFabModalVisible(true)} size={56}>
        <Plus size={28} color="#ffffff" />
      </DraggableFab>

      {/* TaskEventForm Modal */}
      <Modal visible={isFabModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode="create"
          onSubmitSuccess={async () => {
            setIsFabModalVisible(false);
            // Reload data after creating task/event
            await loadData();
          }}
          onClose={() => setIsFabModalVisible(false)}
        />
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
  moveButtonsContainer: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  moveButtonsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  moveButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  moveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
  brainDumpContainer: {
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  brainDumpNote: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  brainDumpContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  brainDumpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  brainDumpButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  brainDumpButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  followUpContainer: {
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  followUpItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  followUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followUpFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followUpFlagEmoji: {
    fontSize: 16,
  },
  followUpType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followUpTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  followUpActions: {
    flexDirection: 'row',
    gap: 8,
  },
  followUpButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  followUpButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  collapsibleHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsibleCount: {
    fontSize: 14,
    fontWeight: '400',
  },
  collapsibleIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  collapsibleArrow: {
    fontSize: 14,
    fontWeight: '600',
  },
  collapsibleContent: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  reviewItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  reviewItemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  reviewItemDate: {
    fontSize: 13,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalProgress: {
    fontSize: 13,
    fontWeight: '600',
  },
  delegationInfo: {
    fontSize: 13,
  },
  commitmentHeader: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  commitmentSubtitle: {
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  commitmentTable: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  commitmentTableTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  commitmentSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  commitmentItemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  commitmentItemPoints: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  optionalCommitments: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  optionalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionalNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  finalTargetCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    alignItems: 'center',
  },
  finalTargetLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  finalTargetPoints: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 8,
  },
  finalTargetBreakdown: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  includeAllTasksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
    marginBottom: 8,
  },
  includeAllTasksLabel: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  emptyTasksState: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTasksText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  webTaskClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  webRescheduleButton: {
    padding: 8,
    borderRadius: 4,
  },
  mobileSwipeHints: {
    position: 'absolute',
    bottom: 4,
    right: 12,
  },
  swipeHint: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  commitmentSummary: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  rescheduleContent: {
    flex: 1,
    padding: 20,
  },
  rescheduleQuestion: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  rescheduleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sameTimeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  selectedValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  rescheduleActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  rescheduleCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rescheduleCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rescheduleConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  rescheduleConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});