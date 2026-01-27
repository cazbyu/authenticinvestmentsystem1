import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { ArrowLeft, Target, Plus, Lightbulb, BookOpen, TrendingUp, Paperclip, X, CreditCard as Edit3, ChevronLeft, ChevronRight, Square, SquareCheck as CheckSquare, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { UnifiedGoal } from './MyGoalsView';
import ActionEffortModal from './ActionEffortModal';
import { EditGoalModal } from './EditGoalModal';
import { DepositIdeaCard, type DepositIdea as DepositIdeaType } from '@/components/depositIdeas/DepositIdeaCard';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { handleActionCompletion, handleActionUncompletion } from '@/lib/completionHandler';
import { formatLocalDate, toLocalISOString, parseLocalDate } from '@/lib/dateUtils';
import { fetchGoalActions, RecurringActionResult, OneTimeActionResult } from '@/hooks/fetchGoalActions';
import { fetchGoalActionsForWeek, TaskWithLogs } from '@/hooks/fetchGoalActionsForWeek';
import { useGoals, Timeline } from '@/hooks/useGoals';
import { calculateTaskPoints } from '@/lib/taskUtils';

interface GoalDetailViewProps {
  goal: UnifiedGoal;
  onClose: () => void;
  onGoalUpdated: () => void;
  onAddAction?: () => void;
  authenticScore: number;
}

type TabType = 'act' | 'ideas' | 'journal' | 'analytics';
type TimeRange = '4W' | '12W' | 'All';
type JournalPeriod = 'today' | 'week' | 'timeline';

interface DepositIdea {
  id: string;
  idea_text: string;
  created_at: string;
  status: string;
  [key: string]: any;
}

interface JournalNote {
  id: string;
  note_text: string;
  created_at: string;
  entry_type?: 'task' | 'event' | 'reflection';
  source_data?: any;
  attachment_count?: number;
  [key: string]: any;
}

// New interface for Dashboard-style journal entries
interface JournalEntry {
  id: string;
  title: string;
  type: 'task' | 'event' | 'reflection';
  completed_at: string;
  points: number;
  roles: Array<{ id: string; label: string; color?: string }>;
  domains: Array<{ id: string; name: string }>;
  is_deposit_idea?: boolean;
  is_important?: boolean;
  is_urgent?: boolean;
}

interface AnalyticsData {
  goalScore: number;
  weeklyAverage: number;
  consistency: number;
  totalActions: number;
  weeklyData: Array<{
    weekNumber: number;
    completionPercent: number;
  }>;
}

interface CycleWeek {
  week_number: number;
  start_date: string;
  end_date: string;
}

export function GoalDetailView({
  goal,
  onClose,
  onGoalUpdated,
  onAddAction,
  authenticScore,
}: GoalDetailViewProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('act');
  const [loading, setLoading] = useState(true);
  const [recurringActions, setRecurringActions] = useState<RecurringActionResult[]>([]);
  const [oneTimeActions, setOneTimeActions] = useState<OneTimeActionResult[]>([]);
  const [weekFilteredActions, setWeekFilteredActions] = useState<TaskWithLogs[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Timeline and weeks state
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Modal states
  const [showActionEffortModal, setShowActionEffortModal] = useState(false);
  const [editingAction, setEditingAction] = useState<TaskWithLogs | null>(null);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(goal);

  const { createTaskWithWeekPlan } = useGoals();

  // Ideas tab state
  const [ideas, setIdeas] = useState<DepositIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [newIdeaText, setNewIdeaText] = useState('');

  // Journal tab state (legacy)
  const [journalNotes, setJournalNotes] = useState<JournalNote[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [newJournalText, setNewJournalText] = useState('');

  // NEW: Journal tab state (Dashboard-style)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalPeriod, setJournalPeriod] = useState<JournalPeriod>('week');
  const [journalTotalPoints, setJournalTotalPoints] = useState<number>(0);

  // Analytics tab state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('12W');

  // Week navigation state
  const [displayedWeekNumber, setDisplayedWeekNumber] = useState<number>(goal.current_week || 1);

  // Calculate weekly completion percentage
  const weeklyCompletionPercent = useMemo(() => {
    if (weekFilteredActions.length === 0) return 0;
    const totalCompleted = weekFilteredActions.reduce((sum, action) => sum + (action.weeklyActual || 0), 0);
    const totalTarget = weekFilteredActions.reduce((sum, action) => sum + (action.weeklyTarget || 0), 0);
    if (totalTarget === 0) return 0;
    return Math.round((totalCompleted / totalTarget) * 100);
  }, [weekFilteredActions]);

  // Update displayedWeekNumber when goal changes or cycleWeeks loads
  useEffect(() => {
    if (currentGoal.current_week) {
      setDisplayedWeekNumber(currentGoal.current_week);
      return;
    }
    if (cycleWeeks.length > 0) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentWeekData = cycleWeeks.find(
        week => week.start_date && week.end_date && todayStr >= week.start_date && todayStr <= week.end_date
      );
      if (currentWeekData) {
        setDisplayedWeekNumber(currentWeekData.week_number);
      } else {
        const lastWeek = cycleWeeks[cycleWeeks.length - 1];
        const firstWeek = cycleWeeks[0];
        if (todayStr > lastWeek.end_date) {
          setDisplayedWeekNumber(lastWeek.week_number);
        } else if (todayStr < firstWeek.start_date) {
          setDisplayedWeekNumber(firstWeek.week_number);
        } else {
          setDisplayedWeekNumber(1);
        }
      }
    }
  }, [currentGoal.current_week, cycleWeeks]);

  useEffect(() => {
    setCurrentGoal(goal);
  }, [goal]);

  const currentWeekData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sundayOffset = -dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + sundayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekNumber = currentGoal.current_week || 1;
    return {
      weekNumber,
      startDate: formatLocalDate(weekStart),
      endDate: formatLocalDate(weekEnd),
    };
  }, [currentGoal.current_week]);

  const getWeekDateRange = useCallback((weekNumber: number): string => {
    if (cycleWeeks.length === 0) return '';
    const week = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!week) return '';
    const start = new Date(week.start_date);
    const end = new Date(week.end_date);
    const formatDay = (d: Date) => d.getDate();
    const formatMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
    if (start.getMonth() === end.getMonth()) {
      return `${formatDay(start)} - ${formatDay(end)} ${formatMonth(end)}`;
    } else {
      return `${formatDay(start)} ${formatMonth(start)} - ${formatDay(end)} ${formatMonth(end)}`;
    }
  }, [cycleWeeks]);

  // Fetch timeline and weeks for the goal
  const fetchTimelineAndWeeks = useCallback(async () => {
    setLoadingTimeline(true);
    setTimelineError(null);
    try {
      const supabase = getSupabaseClient();
      let timelineId: string | null = null;
      let timelineSource: 'global' | 'custom' | null = null;

      if (currentGoal.goal_type === '12week' && currentGoal.user_global_timeline_id) {
        timelineId = currentGoal.user_global_timeline_id;
        timelineSource = 'global';
      } else if (currentGoal.goal_type === 'custom' && currentGoal.custom_timeline_id) {
        timelineId = currentGoal.custom_timeline_id;
        timelineSource = 'custom';
      }

      if (!timelineId || !timelineSource) {
        if (currentGoal.goal_type === '1y') {
          setTimelineError('Annual goals use 12-week or custom goals for actions.');
        } else {
          setTimelineError('This goal is not assigned to an active timeline.');
        }
        setTimeline(null);
        setCycleWeeks([]);
        return;
      }

      let timelineData: any = null;

      if (timelineSource === 'global') {
        const { data, error } = await supabase
          .from('0008-ap-user-global-timelines')
          .select(`id, title, start_date, end_date, status, global_cycle:0008-ap-global-cycles(id, title, cycle_label, start_date, end_date)`)
          .eq('id', timelineId)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          setTimelineError('This timeline is no longer active.');
          setTimeline(null);
          setCycleWeeks([]);
          return;
        }

        timelineData = {
          id: data.id,
          source: 'global' as const,
          title: data.global_cycle?.title || data.global_cycle?.cycle_label || data.title || 'Global Timeline',
          start_date: data.global_cycle?.start_date || data.start_date,
          end_date: data.global_cycle?.end_date || data.end_date,
          global_cycle_id: data.global_cycle?.id,
        };
      } else {
        const { data, error } = await supabase
          .from('0008-ap-custom-timelines')
          .select('*')
          .eq('id', timelineId)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          setTimelineError('This timeline is no longer active.');
          setTimeline(null);
          setCycleWeeks([]);
          return;
        }

        timelineData = {
          id: data.id,
          source: 'custom' as const,
          title: data.title,
          start_date: data.start_date,
          end_date: data.end_date,
        };
      }

      setTimeline(timelineData);

      const { data: weeksData, error: weeksError } = await supabase
        .from('v_unified_timeline_weeks')
        .select('week_number, week_start, week_end')
        .eq('timeline_id', timelineId)
        .eq('source', timelineSource)
        .order('week_number', { ascending: true });

      if (weeksError) {
        setTimelineError('Failed to load timeline weeks.');
        setCycleWeeks([]);
        return;
      }

      const normalizedWeeks: CycleWeek[] = (weeksData || []).map(week => ({
        week_number: week.week_number,
        start_date: week.week_start,
        end_date: week.week_end,
      }));

      setCycleWeeks(normalizedWeeks);
      if (normalizedWeeks.length === 0) {
        setTimelineError('No weeks found for this timeline.');
      }
    } catch (error) {
      console.error('[GoalDetailView] Error fetching timeline:', error);
      setTimelineError('Failed to load timeline data.');
      setTimeline(null);
      setCycleWeeks([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, [currentGoal.goal_type, currentGoal.user_global_timeline_id, currentGoal.custom_timeline_id]);

  useEffect(() => {
    fetchTimelineAndWeeks();
  }, [fetchTimelineAndWeeks]);

  useEffect(() => {
    if (activeTab === 'act') {
      fetchActions();
    } else if (activeTab === 'ideas') {
      fetchIdeas();
    } else if (activeTab === 'journal') {
      fetchJournalEntries();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [currentGoal.id, activeTab, refreshTrigger, timeRange, displayedWeekNumber, timeline, cycleWeeks, journalPeriod]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const result = await fetchGoalActions(currentGoal.id, currentGoal.goal_type);
      setRecurringActions(result.recurringActions);
      setOneTimeActions(result.oneTimeActions);

      if (timeline && cycleWeeks.length > 0) {
        const weekResult = await fetchGoalActionsForWeek(
          [currentGoal.id],
          displayedWeekNumber,
          { id: timeline.id, source: timeline.source },
          cycleWeeks
        );
        const actionsForGoal = weekResult[currentGoal.id] || [];
        setWeekFilteredActions(actionsForGoal);
      } else {
        setWeekFilteredActions([]);
      }
    } catch (error) {
      console.error('[GoalDetailView] Error fetching goal actions:', error);
      Alert.alert('Error', 'Failed to load actions for this goal');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCompletion = async (actionId: string, dateString: string, currentlyCompleted: boolean) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (currentlyCompleted) {
        await handleActionUncompletion(supabase, actionId, dateString);
      } else {
        const action = weekFilteredActions.find(a => a.id === actionId) || recurringActions.find(a => a.id === actionId);
        await handleActionCompletion(supabase, user.id, actionId, dateString, timeline, action?.weeklyTarget);
      }
      onGoalUpdated();
    } catch (error) {
      console.error('[GoalDetailView] Error toggling completion:', error);
      setRefreshTrigger(prev => prev + 1);
      Alert.alert('Error', 'Failed to update completion status');
    }
  };

  const handleToggleBoostTask = async (task: OneTimeActionResult) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isCompleted = task.status === 'completed';

      if (isCompleted) {
        const { error } = await supabase.from('0008-ap-tasks').update({
          status: 'pending',
          completed_at: null,
          updated_at: toLocalISOString(new Date()),
        }).eq('id', task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('0008-ap-tasks').update({
          status: 'completed',
          completed_at: toLocalISOString(new Date()),
          updated_at: toLocalISOString(new Date()),
        }).eq('id', task.id);
        if (error) throw error;
      }

      setRefreshTrigger(prev => prev + 1);
      onGoalUpdated();
    } catch (error) {
      console.error('[GoalDetailView] Error toggling boost task:', error);
      Alert.alert('Error', 'Failed to update task status');
    }
  };

  const handleAddActionPress = () => {
    if (timelineError) {
      Alert.alert('Cannot Add Action', timelineError);
      return;
    }
    if (!timeline) {
      Alert.alert('Cannot Add Action', 'Timeline information is not available.');
      return;
    }
    if (cycleWeeks.length === 0) {
      Alert.alert('Cannot Add Action', 'No weeks available for this timeline.');
      return;
    }
    setShowActionEffortModal(true);
  };

  const handleActionEffortModalClose = async () => {
    setShowActionEffortModal(false);
    setEditingAction(null);
    setRefreshTrigger(prev => prev + 1);
    onGoalUpdated();
  };

  const handleEditAction = (action: TaskWithLogs) => {
    setEditingAction(action);
    setShowActionEffortModal(true);
  };

  const handleEditGoalPress = () => {
    if (currentGoal.goal_type === '1y') {
      Alert.alert('Coming Soon', 'Editing annual goals will be available in a future update.');
      return;
    }
    setShowEditGoalModal(true);
  };

  const handleEditGoalUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
    onGoalUpdated();
  };

  const handleDeleteGoal = async (goalId: string, goalType: '12week' | 'custom') => {
    const supabase = getSupabaseClient();
    const tableName = goalType === '12week' ? '0008-ap-goals-12wk' : '0008-ap-goals-custom';
    const { error } = await supabase.from(tableName).update({
      status: 'cancelled',
      archived: true,
      updated_at: toLocalISOString(new Date()),
    }).eq('id', goalId);
    if (error) throw error;
  };

  const handleGoalDeleted = () => {
    onClose();
  };

  const calculateTimeElapsed = useCallback((timelineData: Timeline | null): number => {
    if (!timelineData?.start_date || !timelineData?.end_date) return 0;
    const start = new Date(timelineData.start_date).getTime();
    const end = new Date(timelineData.end_date).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }, []);

  const timeElapsedPercent = useMemo(() => calculateTimeElapsed(timeline), [timeline, calculateTimeElapsed]);

  const goalForModal = useMemo(() => ({
    id: currentGoal.id,
    title: currentGoal.title,
    description: currentGoal.description,
    goal_type: currentGoal.goal_type as '12week' | 'custom',
    roles: currentGoal.roles || [],
    domains: currentGoal.domains || [],
    keyRelationships: currentGoal.keyRelationships || [],
  }), [currentGoal]);

  const goalForEditModal = useMemo(() => {
    if (currentGoal.goal_type === '1y') return null;
    return {
      id: currentGoal.id,
      title: currentGoal.title,
      description: currentGoal.description,
      goal_type: currentGoal.goal_type as '12week' | 'custom',
      status: currentGoal.status,
      roles: currentGoal.roles || [],
      domains: currentGoal.domains || [],
      keyRelationships: currentGoal.keyRelationships || [],
      notes: [],
    };
  }, [currentGoal]);

  const fetchIdeas = async () => {
    setIdeasLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const goalJoinColumn = currentGoal.goal_type === '1y' ? 'one_yr_goal_id' : currentGoal.goal_type === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

      const { data: goalJoins, error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id')
        .eq(goalJoinColumn, currentGoal.id)
        .eq('parent_type', 'deposit_idea');

      if (joinError) throw joinError;

      const ideaIds = goalJoins?.map(j => j.parent_id).filter(Boolean) || [];
      if (ideaIds.length === 0) {
        setIdeas([]);
        return;
      }

      const { data: ideasData, error: ideasError } = await supabase
        .from('0008-ap-deposit-ideas')
        .select('*')
        .in('id', ideaIds)
        .eq('is_active', true)
        .eq('archived', false)
        .is('activated_task_id', null)
        .order('created_at', { ascending: false });

      if (ideasError) throw ideasError;

      const enrichedIdeas = await Promise.all((ideasData || []).map(async (idea) => {
        const [rolesData, domainsData, krData] = await Promise.all([
          supabase.from('0008-ap-universal-roles-join').select('role:0008-ap-roles(id, label, color)').eq('parent_id', idea.id).eq('parent_type', 'deposit_idea'),
          supabase.from('0008-ap-universal-domains-join').select('domain:0008-ap-domains(id, name)').eq('parent_id', idea.id).eq('parent_type', 'deposit_idea'),
          supabase.from('0008-ap-universal-key-relationships-join').select('key_relationship:0008-ap-key-relationships(id, name)').eq('parent_id', idea.id).eq('parent_type', 'deposit_idea'),
        ]);

        const roles = rolesData.data?.map((r: any) => r.role).filter(Boolean) || [];
        const domains = domainsData.data?.map((d: any) => d.domain).filter(Boolean) || [];
        const keyRelationships = krData.data?.map((kr: any) => kr.key_relationship).filter(Boolean) || [];

        return { ...idea, title: idea.idea_text || idea.title, roles, domains, keyRelationships };
      }));

      setIdeas(enrichedIdeas);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching ideas:', error);
      Alert.alert('Error', 'Failed to load ideas for this goal');
    } finally {
      setIdeasLoading(false);
    }
  };

  // NEW: Fetch journal entries with points calculation (Dashboard-style)
  const fetchJournalEntries = async () => {
    setJournalLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const goalJoinColumn = currentGoal.goal_type === '1y' ? 'one_yr_goal_id' : currentGoal.goal_type === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

      const { data: goalJoins, error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('parent_id, parent_type')
        .eq(goalJoinColumn, currentGoal.id)
        .eq('parent_type', 'task');

      if (joinError) throw joinError;

      const taskIds = goalJoins?.map(j => j.parent_id).filter(Boolean) || [];
      if (taskIds.length === 0) {
        setJournalEntries([]);
        setJournalTotalPoints(0);
        return;
      }

      // Calculate date range based on journalPeriod
      let dateFilter: { start: string; end: string } | null = null;
      const today = new Date();
      const todayStr = formatLocalDate(today);

      if (journalPeriod === 'today') {
        dateFilter = { start: todayStr, end: todayStr };
      } else if (journalPeriod === 'week') {
        const dayOfWeek = today.getDay();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        dateFilter = { start: formatLocalDate(weekStart), end: formatLocalDate(weekEnd) };
      } else if (journalPeriod === 'timeline' && timeline) {
        dateFilter = { start: timeline.start_date, end: timeline.end_date };
      }

      let tasksQuery = supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('id', taskIds)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (dateFilter) {
        tasksQuery = tasksQuery
          .gte('completed_at', `${dateFilter.start}T00:00:00`)
          .lte('completed_at', `${dateFilter.end}T23:59:59`);
      }

      const { data: tasks, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;

      if (!tasks || tasks.length === 0) {
        setJournalEntries([]);
        setJournalTotalPoints(0);
        return;
      }

      const completedTaskIds = tasks.map(t => t.id);

      const [rolesData, domainsData, goalsData] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', completedTaskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', completedTaskIds).eq('parent_type', 'task'),
        supabase.from('0008-ap-universal-goals-join').select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)').in('parent_id', completedTaskIds).eq('parent_type', 'task'),
      ]);

      let totalPoints = 0;
      const entries: JournalEntry[] = tasks.map(task => {
        const taskRoles = rolesData.data?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [];
        const taskDomains = domainsData.data?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [];
        const taskGoals = goalsData.data?.filter(g => g.parent_id === task.id).map(g => {
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
        }).filter(Boolean) || [];

        const points = calculateTaskPoints(task, taskRoles, taskDomains, taskGoals);
        totalPoints += points;

        return {
          id: task.id,
          title: task.title,
          type: task.type === 'event' ? 'event' : 'task',
          completed_at: task.completed_at,
          points,
          roles: taskRoles,
          domains: taskDomains,
          is_deposit_idea: task.is_deposit_idea || task.deposit_idea,
          is_important: task.is_important,
          is_urgent: task.is_urgent,
        };
      });

      setJournalEntries(entries);
      setJournalTotalPoints(totalPoints);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching journal entries:', error);
      Alert.alert('Error', 'Failed to load journal entries');
    } finally {
      setJournalLoading(false);
    }
  };

  const fetchJournalNotes = async () => {
    await fetchJournalEntries();
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      let startDate: Date;

      if (timeRange === '4W') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - (4 * 7));
      } else if (timeRange === '12W') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - (12 * 7));
      } else {
        startDate = new Date(currentGoal.created_at || today);
      }

      const result = await fetchGoalActions(currentGoal.id, currentGoal.goal_type);
      const goalScore = result.oneTimeActions.reduce((sum, action) => sum + action.pointsEarned, 0);

      const weeklyData: Array<{ weekNumber: number; completionPercent: number }> = [];
      const weekCount = timeRange === '4W' ? 4 : timeRange === '12W' ? 12 : 24;

      for (let i = 0; i < weekCount; i++) {
        const weekActions = result.recurringActions.filter(action => action.weeklyTarget > 0);
        const avgCompletion = weekActions.length > 0
          ? weekActions.reduce((sum, a) => sum + (a.weeklyActual / a.weeklyTarget * 100), 0) / weekActions.length
          : 0;
        weeklyData.unshift({ weekNumber: i + 1, completionPercent: Math.min(100, Math.round(avgCompletion)) });
      }

      const weeklyAverage = weeklyData.length > 0 ? Math.round(weeklyData.reduce((sum, w) => sum + w.completionPercent, 0) / weeklyData.length) : 0;
      const weeksAt100 = weeklyData.filter(w => w.completionPercent >= 100).length;
      const consistency = weeklyData.length > 0 ? Math.round((weeksAt100 / weeklyData.length) * 100) : 0;
      const totalActions = result.recurringActions.reduce((sum, a) => sum + a.weeklyActual, 0) + result.oneTimeActions.length;

      setAnalyticsData({ goalScore, weeklyAverage, consistency, totalActions, weeklyData: weeklyData.slice(0, 12) });
    } catch (error) {
      console.error('[GoalDetailView] Error fetching analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAddIdea = async () => {
    if (!newIdeaText.trim()) {
      Alert.alert('Error', 'Please enter an idea');
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ideaData, error: ideaError } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({ user_id: user.id, idea_text: newIdeaText.trim(), status: 'pending' })
        .select()
        .single();

      if (ideaError) throw ideaError;

      const goalJoinColumn = currentGoal.goal_type === '1y' ? 'one_yr_goal_id' : currentGoal.goal_type === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

      const { error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .insert({ [goalJoinColumn]: currentGoal.id, parent_id: ideaData.id, parent_type: 'deposit_idea' });

      if (joinError) throw joinError;

      setNewIdeaText('');
      setShowAddIdeaModal(false);
      fetchIdeas();
      Alert.alert('Success', 'Idea added to this goal');
    } catch (error) {
      console.error('[GoalDetailView] Error adding idea:', error);
      Alert.alert('Error', 'Failed to add idea');
    }
  };

  const handleAddJournalEntry = async () => {
    if (!newJournalText.trim()) {
      Alert.alert('Error', 'Please enter journal content');
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({ user_id: user.id, note_text: newJournalText.trim(), note_date: toLocalISOString(new Date()) })
        .select()
        .single();

      if (noteError) throw noteError;

      const parentType = currentGoal.goal_type === '1y' ? 'goal_1y' : currentGoal.goal_type === '12week' ? 'goal_12wk' : 'goal_custom';

      const { error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({ note_id: noteData.id, parent_id: currentGoal.id, parent_type: parentType });

      if (joinError) throw joinError;

      setNewJournalText('');
      setShowAddJournalModal(false);
      fetchJournalEntries();
      Alert.alert('Success', 'Journal entry added');
    } catch (error) {
      console.error('[GoalDetailView] Error adding journal entry:', error);
      Alert.alert('Error', 'Failed to add journal entry');
    }
  };

  const handleUpdateIdea = (idea: DepositIdeaType) => {
    Alert.alert('Edit Idea', 'This feature will be available in a future update');
  };

  const handleActivateIdea = (idea: DepositIdeaType) => {
    Alert.alert('Activate Idea', 'Convert this idea into an action linked to this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Activate',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: newTask, error: taskError } = await supabase
              .from('0008-ap-tasks')
              .insert({ user_id: user.id, title: idea.title, status: 'pending', type: 'task', created_at: toLocalISOString(new Date()), updated_at: toLocalISOString(new Date()) })
              .select()
              .single();

            if (taskError) throw taskError;

            const goalJoinColumn = currentGoal.goal_type === '1y' ? 'one_yr_goal_id' : currentGoal.goal_type === '12week' ? 'twelve_wk_goal_id' : 'custom_goal_id';

            const { error: joinError } = await supabase
              .from('0008-ap-universal-goals-join')
              .insert({ parent_id: newTask.id, parent_type: 'task', [goalJoinColumn]: currentGoal.id, created_at: toLocalISOString(new Date()) });

            if (joinError) throw joinError;

            const { error: updateError } = await supabase
              .from('0008-ap-deposit-ideas')
              .update({ is_active: false, archived: true, activated_task_id: newTask.id })
              .eq('id', idea.id);

            if (updateError) throw updateError;

            fetchIdeas();
            Alert.alert('Success', 'Idea activated! You can now find it in your actions.');
          } catch (error) {
            console.error('[GoalDetailView] Error activating idea:', error);
            Alert.alert('Error', 'Failed to activate idea');
          }
        },
      },
    ]);
  };

  const handleCancelIdea = async (idea: DepositIdeaType) => {
    Alert.alert('Cancel Idea', 'Are you sure you want to cancel this idea?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await supabase
              .from('0008-ap-deposit-ideas')
              .update({ is_active: false, archived: true, updated_at: toLocalISOString(new Date()) })
              .eq('id', idea.id);

            if (error) throw error;
            fetchIdeas();
            Alert.alert('Success', 'Idea cancelled');
          } catch (error) {
            console.error('[GoalDetailView] Error cancelling idea:', error);
            Alert.alert('Error', 'Failed to cancel idea');
          }
        },
      },
    ]);
  };

  const handleIdeaPress = (idea: DepositIdeaType) => {
    Alert.alert('Idea Details', idea.title);
  };

  const getTimelineBadge = () => {
    if (currentGoal.goal_type === '1y') {
      return currentGoal.year_target_date ? `${new Date(currentGoal.year_target_date).getFullYear()} Annual Goal` : 'Annual Goal';
    }
    if (currentGoal.goal_type === '12week' && currentGoal.timeline_name) return currentGoal.timeline_name;
    if (currentGoal.goal_type === 'custom' && currentGoal.timeline_name) return currentGoal.timeline_name;
    return 'Goal Timeline';
  };

  const getTotalWeeks = () => {
    if (currentGoal.goal_type === '12week') return 12;
    if (currentGoal.goal_type === 'custom') return currentGoal.total_weeks || 1;
    return 1;
  };

  const handlePreviousWeek = () => {
    if (displayedWeekNumber > 1) setDisplayedWeekNumber(prev => prev - 1);
  };

  const handleNextWeek = () => {
    const totalWeeks = getTotalWeeks();
    if (displayedWeekNumber < totalWeeks) setDisplayedWeekNumber(prev => prev + 1);
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity style={styles.backButton} onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <ArrowLeft size={24} color="#ffffff" />
          <Text style={styles.backText}>Goal Bank</Text>
        </TouchableOpacity>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
      </View>
      <View style={styles.headerTitle}>
        <Target size={28} color="#ffffff" style={styles.titleIcon} />
        <Text style={styles.title} numberOfLines={2}>{currentGoal.title}</Text>
      </View>
      <View style={styles.headerBottom}>
        <View style={styles.toggleGroup}>
          {(['act', 'ideas', 'journal', 'analytics'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.toggleButton, activeTab === tab && styles.activeToggle]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.toggleText, activeTab === tab && styles.activeToggleText]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderGoalBanner = () => {
    const totalWeeks = getTotalWeeks();
    const cumulativeProgress = currentGoal.progress !== undefined ? Math.round(currentGoal.progress) : 0;
    const showWeekNav = currentGoal.goal_type === '12week' || currentGoal.goal_type === 'custom';

    return (
      <View style={[styles.goalBanner, { backgroundColor: colors.surface }]}>
        {/* Week Navigation - Only show on Act tab */}
        {showWeekNav && activeTab === 'act' && (
          <View style={[styles.weekNavRow, { borderBottomColor: colors.border }]}>
            <View style={styles.weekNavLeft}>
              <TouchableOpacity onPress={handlePreviousWeek} disabled={displayedWeekNumber <= 1} style={[styles.weekNavArrow, displayedWeekNumber <= 1 && styles.weekNavArrowDisabled]}>
                <ChevronLeft size={20} color={displayedWeekNumber <= 1 ? colors.textSecondary : colors.text} />
              </TouchableOpacity>
              <View style={styles.weekNavCenter}>
                <Text style={[styles.weekNavText, { color: colors.text }]}>Week {displayedWeekNumber} of {totalWeeks}</Text>
                <Text style={[styles.weekNavDateRange, { color: colors.textSecondary }]}>{getWeekDateRange(displayedWeekNumber)}</Text>
              </View>
              <TouchableOpacity onPress={handleNextWeek} disabled={displayedWeekNumber >= totalWeeks} style={[styles.weekNavArrow, displayedWeekNumber >= totalWeeks && styles.weekNavArrowDisabled]}>
                <ChevronRight size={20} color={displayedWeekNumber >= totalWeeks ? colors.textSecondary : colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekNavRight}>
              <TouchableOpacity onPress={handleEditGoalPress}>
                <Text style={[styles.editLink, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
              <Text style={[styles.totalProgress, { color: colors.text }]}>Total {weeklyCompletionPercent}%</Text>
            </View>
          </View>
        )}

        {/* Show simple Edit button only on Act tab for 1y goals */}
        {(!showWeekNav && activeTab === 'act') && currentGoal.progress !== undefined && (
          <View style={styles.bannerRight}>
            <TouchableOpacity style={styles.editButton} onPress={handleEditGoalPress}>
              <Edit3 size={16} color={colors.primary} />
              <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <Text style={[styles.progressPercentage, { color: colors.text }]}>{cumulativeProgress}%</Text>
          </View>
        )}

        {/* Progress bar - Only show on Act tab */}
        {currentGoal.progress !== undefined && activeTab === 'act' && (
          <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
            <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${currentGoal.progress}%` }]} />
          </View>
        )}

        {currentGoal.parent_goal_title && (
          <TouchableOpacity style={styles.parentGoalLink} activeOpacity={0.7}>
            <Text style={[styles.parentGoalLinkText, { color: colors.textSecondary }]}>→ supports <Text style={{ fontWeight: '600' }}>{currentGoal.parent_goal_title}</Text></Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getScheduledDaysFromRRule = (rrule: string): number[] => {
    if (!rrule) return [0, 1, 2, 3, 4, 5, 6];
    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byDayMatch = rrule.match(/BYDAY=([^;]+)/);
    if (!byDayMatch) return [0, 1, 2, 3, 4, 5, 6];
    const days = byDayMatch[1].split(',');
    return days.map(day => dayMap[day]).filter(d => d !== undefined);
  };

  const getCompletedDaysForWeek = (action: RecurringActionResult): number[] => {
    return action.completedDates?.map(dateStr => {
      const date = parseLocalDate(dateStr);
      return date.getDay();
    }) || [];
  };

  const handleEditLeadingIndicator = (action: RecurringActionResult) => {
    Alert.alert('Edit Action', `Edit "${action.title}" - Coming soon`);
  };

  const renderWeekFilteredActionCard = (action: TaskWithLogs) => {
    const hasSpecificDays = action.recurrence_rule?.includes('BYDAY=');
    const scheduledDays = hasSpecificDays ? getScheduledDaysFromRRule(action.recurrence_rule || '') : [0, 1, 2, 3, 4, 5, 6];
    const completedDays = action.logs?.map(log => {
      const [y, m, d] = log.measured_on.split('-').map(Number);
      return new Date(y, m - 1, d).getDay();
    }) || [];
    const targetDays = action.weeklyTarget || 1;
    const completionCount = action.weeklyActual || 0;
    const progressPercent = targetDays > 0 ? Math.min(Math.round((completionCount / targetDays) * 100), 100) : 0;
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const today = new Date();
    const todayDayIndex = today.getDay();
    const currentWeekDataForCard = cycleWeeks.find(w => w.week_number === displayedWeekNumber);
    const isCurrentWeek = currentWeekDataForCard && (() => {
      const todayStr = formatLocalDate(today);
      return todayStr >= currentWeekDataForCard.start_date && todayStr <= currentWeekDataForCard.end_date;
    })();
    const isPastWeek = currentWeekDataForCard && formatLocalDate(today) > currentWeekDataForCard.end_date;

    return (
      <View key={action.id} style={[styles.liCard, { backgroundColor: colors.surface }]}>
        <View style={styles.liHeader}>
          <Text style={[styles.liTitle, { color: colors.text }]}>{action.title}</Text>
          <TouchableOpacity onPress={() => handleEditAction(action)}>
            <Text style={[styles.liEditLink, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.liProgressContainer}>
          <View style={[styles.liProgressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.liProgressFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]} />
          </View>
          <Text style={[styles.liProgressText, { color: colors.text }]}>{progressPercent}%</Text>
        </View>
        <View style={styles.liDaysRow}>
          <View style={styles.liDaysContainer}>
            {dayLabels.map((label, index) => {
              const isAvailable = scheduledDays.includes(index);
              const isCompleted = completedDays.includes(index);
              let isPastDay = false;
              if (isPastWeek) isPastDay = true;
              else if (isCurrentWeek) isPastDay = index < todayDayIndex;
              const isMissed = isPastDay && !isCompleted && isAvailable;

              return (
                <TouchableOpacity key={index} style={styles.liDayColumn} onPress={() => isAvailable && handleToggleDayForWeek(action.id, index)} disabled={!isAvailable} activeOpacity={0.6}>
                  <Text style={[styles.liDayLabel, { color: colors.text }]}>{label}</Text>
                  <View style={[styles.liBubble, isCompleted && styles.liBubbleCompleted, isMissed && styles.liBubbleMissed, hasSpecificDays && isAvailable && !isCompleted && !isMissed && styles.liBubbleScheduled, !isAvailable && styles.liBubbleDisabled]}>
                    {isCompleted && <Check size={16} color="#22c55e" strokeWidth={3} />}
                    {isMissed && <X size={16} color="#ef4444" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.liCount, { color: colors.textSecondary }]}>{completionCount}/{targetDays}</Text>
        </View>
      </View>
    );
  };

  const handleToggleDayForWeek = async (actionId: string, dayIndex: number) => {
    try {
      const week = cycleWeeks.find(w => w.week_number === displayedWeekNumber);
      if (!week) return;

      const [year, month, day] = week.start_date.split('-').map(Number);
      const weekStartDate = new Date(year, month - 1, day);
      const weekStartDayOfWeek = weekStartDate.getDay();
      const daysToAdd = (dayIndex - weekStartDayOfWeek + 7) % 7;
      const targetDate = new Date(year, month - 1, day + daysToAdd);
      const dateString = formatLocalDate(targetDate);

      const action = weekFilteredActions.find(a => a.id === actionId);
      if (!action) return;

      const isCurrentlyCompleted = action.logs?.some(log => log.measured_on === dateString) || false;

      setWeekFilteredActions(prev => prev.map(a => {
        if (a.id !== actionId) return a;
        let newLogs = [...(a.logs || [])];
        let newWeeklyActual = a.weeklyActual || 0;
        if (isCurrentlyCompleted) {
          newLogs = newLogs.filter(log => log.measured_on !== dateString);
          newWeeklyActual = Math.max(0, newWeeklyActual - 1);
        } else {
          newLogs.push({ measured_on: dateString } as any);
          newWeeklyActual = newWeeklyActual + 1;
        }
        return { ...a, logs: newLogs, weeklyActual: newWeeklyActual };
      }));

      await handleToggleCompletion(actionId, dateString, isCurrentlyCompleted);
    } catch (error) {
      console.error('[GoalDetailView] Error toggling day:', error);
      setRefreshTrigger(prev => prev + 1);
      Alert.alert('Error', 'Failed to toggle completion');
    }
  };

  const handleToggleDay = async (actionId: string, dayIndex: number) => {
    try {
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      const daysFromToday = dayIndex - currentDayOfWeek;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysFromToday);
      targetDate.setHours(0, 0, 0, 0);
      const dateString = formatLocalDate(targetDate);
      const action = recurringActions.find(a => a.id === actionId);
      const isCurrentlyCompleted = action?.completedDates?.includes(dateString) || false;
      await handleToggleCompletion(actionId, dateString, isCurrentlyCompleted);
    } catch (error) {
      console.error('[GoalDetailView] Error toggling day:', error);
      Alert.alert('Error', 'Failed to toggle completion');
    }
  };

  const renderActTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading actions...</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {weekFilteredActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>RECURRING ACTIONS</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Leading Indicators • Tap circles to mark completion</Text>
            {weekFilteredActions.map(action => renderWeekFilteredActionCard(action))}
          </View>
        )}

        {oneTimeActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>BOOST ACTIONS</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>One-time tasks linked to this goal</Text>
            <View style={styles.boostList}>
              {oneTimeActions.map(task => {
                const isCompleted = task.status === 'completed';
                const formattedDueDate = task.due_date ? formatLocalDate(task.due_date instanceof Date ? task.due_date : new Date(task.due_date)) : null;

                return (
                  <TouchableOpacity key={task.id} style={[styles.boostItem, { backgroundColor: colors.surface }]} onPress={() => handleToggleBoostTask(task)}>
                    <View style={styles.boostCheckbox}>
                      {isCompleted ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors.textSecondary} />}
                    </View>
                    <View style={styles.boostContent}>
                      <Text style={[styles.boostTitle, { color: colors.text }, isCompleted && styles.boostTitleCompleted]}>{task.title}</Text>
                      <Text style={[styles.boostDue, { color: colors.textSecondary }]}>{isCompleted ? 'Completed' : formattedDueDate ? `Due: ${formattedDueDate}` : 'No due date'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {weekFilteredActions.length === 0 && oneTimeActions.length === 0 && (
          <View style={styles.emptyState}>
            <Target size={64} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Actions Yet</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>Add actions to track progress toward this goal</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.addActionButton, { backgroundColor: colors.primary }, (loadingTimeline || !!timelineError) && styles.addButtonDisabled]} onPress={handleAddActionPress} disabled={loadingTimeline}>
          {loadingTimeline ? <ActivityIndicator size="small" color="#ffffff" /> : (<><Plus size={20} color="#ffffff" /><Text style={styles.addActionButtonText}>Add Action</Text></>)}
        </TouchableOpacity>

        {timelineError && currentGoal.goal_type !== '1y' && <Text style={styles.timelineErrorText}>{timelineError}</Text>}

        {timeline && currentGoal.goal_type !== '1y' && (
          <View style={[styles.timelineFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.timelineFooterName, { color: colors.textSecondary }]}>{timeline.title || 'Timeline'}</Text>
            <View style={styles.timelineFooterProgress}>
              <View style={[styles.timelineFooterBar, { backgroundColor: colors.border }]}>
                <View style={[styles.timelineFooterFill, { backgroundColor: colors.primary, width: `${timeElapsedPercent}%` }]} />
              </View>
              <Text style={[styles.timelineFooterPercent, { color: colors.textSecondary }]}>{timeElapsedPercent}%</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderIdeasTab = () => {
    if (ideasLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading ideas...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabScrollContent}>
        {ideas.length === 0 ? (
          <View style={styles.emptyState}>
            <Lightbulb size={64} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Ideas Yet</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>Ideas linked to this goal will appear here</Text>
          </View>
        ) : (
          <View style={styles.ideasList}>
            {ideas.map(idea => (
              <DepositIdeaCard key={idea.id} depositIdea={idea} onUpdate={handleUpdateIdea} onActivate={handleActivateIdea} onCancel={handleCancelIdea} onPress={handleIdeaPress} />
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // Helper function to format date for day separator
  const formatDaySeparator = (dateStr: string): string => {
    const date = new Date(dateStr);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getDay()];
    const monthName = monthNames[date.getMonth()];
    const dayNum = date.getDate();
    const year = date.getFullYear();
    return `${monthName} ${dayNum} ${year} (${dayName})`;
  };

  // Group entries by date
  const groupEntriesByDate = (entries: JournalEntry[]): Record<string, JournalEntry[]> => {
    const groups: Record<string, JournalEntry[]> = {};
    entries.forEach(entry => {
      const dateKey = entry.completed_at.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    });
    return groups;
  };

  const handleJournalEntryPress = (entry: JournalEntry) => {
    Alert.alert('Entry Details', entry.title);
  };

  // NEW: Redesigned Journal Tab (Dashboard-style)
  const renderJournalTab = () => {
    if (journalLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading journal...</Text>
        </View>
      );
    }

    const groupedEntries = groupEntriesByDate(journalEntries);
    const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

    return (
      <View style={styles.tabContent}>
        {/* Time Period Selector Header */}
        <View style={[styles.journalHeader, { backgroundColor: colors.surface }]}>
          <View style={styles.periodSelector}>
            {(['today', 'week', 'timeline'] as JournalPeriod[]).map(period => (
              <TouchableOpacity
                key={period}
                style={[styles.periodButton, journalPeriod === period && [styles.periodButtonActive, { backgroundColor: colors.primary }]]}
                onPress={() => setJournalPeriod(period)}
              >
                <Text style={[styles.periodButtonText, { color: journalPeriod === period ? '#ffffff' : colors.text }]}>
                  {period === 'today' ? 'Today' : period === 'week' ? 'Week' : 'Timeline'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.journalTotalPoints, { color: '#22c55e' }]}>+{journalTotalPoints}</Text>
        </View>

        <ScrollView style={styles.journalScrollView} contentContainerStyle={styles.journalScrollContent}>
          {journalEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen size={64} color={colors.textSecondary} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Entries</Text>
              <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>Complete tasks linked to this goal to see them here</Text>
            </View>
          ) : (
            <>
              {sortedDates.map(dateKey => (
                <View key={dateKey}>
                  {/* Day Separator */}
                  <View style={[styles.daySeparator, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.daySeparatorText, { color: colors.textSecondary }]}>{formatDaySeparator(dateKey)}</Text>
                  </View>

                  {/* Entries for this day */}
                  {groupedEntries[dateKey].map(entry => (
                    <TouchableOpacity key={entry.id} style={[styles.journalEntryRow, { backgroundColor: colors.surface }]} onPress={() => handleJournalEntryPress(entry)} activeOpacity={0.7}>
                      {/* Icon */}
                      <View style={[styles.journalEntryIcon, { backgroundColor: entry.type === 'event' ? '#dbeafe' : '#dcfce7' }]}>
                        {entry.type === 'event' ? <CalendarIcon size={18} color="#2563eb" /> : <CheckSquare size={18} color="#22c55e" />}
                      </View>

                      {/* Content */}
                      <View style={styles.journalEntryContent}>
                        <Text style={[styles.journalEntryTitle, { color: colors.text }]} numberOfLines={1}>{entry.title}</Text>
                        
                        {/* Roles and Domains */}
                        {(entry.roles.length > 0 || entry.domains.length > 0) && (
                          <View style={styles.journalEntryTags}>
                            {entry.roles.map(role => (
                              <View key={role.id} style={[styles.journalTag, { backgroundColor: role.color || '#e5e7eb' }]}>
                                <Text style={styles.journalTagText}>{role.label}</Text>
                              </View>
                            ))}
                            {entry.domains.map(domain => (
                              <View key={domain.id} style={[styles.journalTag, { backgroundColor: '#fef3c7' }]}>
                                <Text style={styles.journalTagText}>{domain.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Points */}
                      <Text style={styles.journalEntryPoints}>+{entry.points}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderAnalyticsTab = () => {
    if (analyticsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Calculating analytics...</Text>
        </View>
      );
    }

    if (!analyticsData) {
      return (
        <View style={styles.emptyState}>
          <TrendingUp size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data Yet</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>Complete some actions to see analytics</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.timeRangeSelector}>
          {(['4W', '12W', 'All'] as TimeRange[]).map(range => (
            <TouchableOpacity key={range} style={[styles.timeRangeButton, { borderColor: colors.border }, timeRange === range && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setTimeRange(range)}>
              <Text style={[styles.timeRangeText, { color: timeRange === range ? '#ffffff' : colors.text }]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.goalScoreCard, { backgroundColor: colors.surface }]}>
          <TrendingUp size={32} color={colors.primary} />
          <View style={styles.goalScoreContent}>
            <Text style={[styles.goalScoreLabel, { color: colors.textSecondary }]}>Goal Score</Text>
            <Text style={[styles.goalScoreValue, { color: colors.primary }]}>{analyticsData.goalScore}</Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Weekly Average</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{analyticsData.weeklyAverage}%</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Consistency</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{analyticsData.consistency}%</Text>
          </View>
        </View>

        <View style={[styles.metricCard, styles.fullWidthMetric, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Actions Completed</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{analyticsData.totalActions}</Text>
        </View>

        {analyticsData.weeklyData.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>WEEKLY COMPLETION</Text>
            <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.chartBars}>
                {analyticsData.weeklyData.map((week, index) => (
                  <View key={index} style={styles.barWrapper}>
                    <View style={styles.barContainer}>
                      <View style={[styles.bar, { height: `${week.completionPercent}%`, backgroundColor: week.completionPercent >= 100 ? '#10b981' : week.completionPercent >= 75 ? colors.primary : week.completionPercent >= 50 ? '#f59e0b' : '#ef4444' }]} />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.textSecondary }]}>W{week.weekNumber}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10b981' }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>100%</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.primary }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>75-99%</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>50-74%</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>&lt;50%</Text></View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'act': return renderActTab();
      case 'ideas': return renderIdeasTab();
      case 'journal': return renderJournalTab();
      case 'analytics': return renderAnalyticsTab();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderGoalBanner()}
        {renderContent()}
      </ScrollView>

      {/* ActionEffortModal - Full featured modal for adding/editing actions */}
      {showActionEffortModal && !editingAction && (
        <ActionEffortModal
          visible={showActionEffortModal}
          onClose={handleActionEffortModalClose}
          goal={goalForModal}
          cycleWeeks={cycleWeeks}
          timeline={timeline}
          createTaskWithWeekPlan={createTaskWithWeekPlan}
          mode="create"
        />
      )}

      {/* ActionEffortModal for editing */}
      {showActionEffortModal && editingAction && (
        <ActionEffortModal
          visible={showActionEffortModal}
          onClose={handleActionEffortModalClose}
          goal={goalForModal}
          cycleWeeks={cycleWeeks}
          timeline={timeline}
          createTaskWithWeekPlan={createTaskWithWeekPlan}
          onDelete={async (actionId: string) => {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('0008-ap-tasks').update({ deleted_at: toLocalISOString(new Date()) }).eq('id', actionId);
            if (error) throw error;
          }}
          initialData={{
            id: editingAction.id,
            title: editingAction.title,
            recurrence_rule: editingAction.recurrence_rule,
            selectedWeeks: editingAction.selectedWeeks || [],
            weeklyTarget: editingAction.weeklyTarget,
          }}
          mode="edit"
        />
      )}

      {/* EditGoalModal - For editing goal details */}
      {goalForEditModal && (
        <EditGoalModal
          visible={showEditGoalModal}
          onClose={() => setShowEditGoalModal(false)}
          onUpdate={handleEditGoalUpdate}
          goal={goalForEditModal}
          deleteGoal={handleDeleteGoal}
        />
      )}

      {/* Add Idea Modal */}
      <Modal visible={showAddIdeaModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddIdeaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Idea</Text>
              <TouchableOpacity onPress={() => setShowAddIdeaModal(false)}><X size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <TextInput style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]} placeholder="Enter your idea..." placeholderTextColor={colors.textSecondary} value={newIdeaText} onChangeText={setNewIdeaText} multiline numberOfLines={4} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]} onPress={() => { setNewIdeaText(''); setShowAddIdeaModal(false); }}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleAddIdea}>
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Journal Entry Modal */}
      <Modal visible={showAddJournalModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddJournalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Journal Entry</Text>
              <TouchableOpacity onPress={() => setShowAddJournalModal(false)}><X size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <TextInput style={[styles.modalInput, styles.journalInput, { color: colors.text, borderColor: colors.border }]} placeholder="Write your thoughts..." placeholderTextColor={colors.textSecondary} value={newJournalText} onChangeText={setNewJournalText} multiline numberOfLines={8} autoFocus />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]} onPress={() => { setNewJournalText(''); setShowAddJournalModal(false); }}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleAddJournalEntry}>
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  liHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  liTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12 },
  liEditLink: { fontSize: 14, fontWeight: '500' },
  liProgressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  liProgressBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  liProgressFill: { height: '100%', borderRadius: 3 },
  liProgressText: { fontSize: 13, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  liDaysRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  liDaysContainer: { flexDirection: 'row', gap: 8 },
  liDayColumn: { alignItems: 'center', gap: 4 },
  liDayLabel: { fontSize: 11, fontWeight: '500' },
  liBubble: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  liBubbleCompleted: { borderColor: '#22c55e', backgroundColor: '#dcfce7' },
  liBubbleMissed: { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
  liBubbleScheduled: { borderColor: '#3b82f6', backgroundColor: '#dbeafe' },
  liBubbleDisabled: { borderColor: '#e5e7eb', backgroundColor: '#f9fafb', opacity: 0.5 },
  liCount: { fontSize: 14, fontWeight: '600' },
  timeRangeSelector: { flexDirection: 'row', gap: 8, marginBottom: 16, paddingHorizontal: 16 },
  timeRangeButton: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  timeRangeText: { fontSize: 14, fontWeight: '600' },
  goalScoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 12, marginHorizontal: 16, marginBottom: 16 },
  goalScoreContent: { flex: 1 },
  goalScoreLabel: { fontSize: 14, marginBottom: 4 },
  goalScoreValue: { fontSize: 32, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 12 },
  metricCard: { flex: 1, padding: 16, borderRadius: 12 },
  fullWidthMetric: { marginHorizontal: 16, marginBottom: 16 },
  metricLabel: { fontSize: 13, marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: '700' },
  chartContainer: { borderRadius: 12, padding: 16, marginHorizontal: 16 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120, marginBottom: 16 },
  barWrapper: { alignItems: 'center', width: 24 },
  barContainer: { height: 100, width: 16, backgroundColor: '#e5e7eb', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, marginTop: 4 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 400, borderRadius: 16, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, textAlignVertical: 'top', minHeight: 100 },
  journalInput: { minHeight: 200 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { borderWidth: 1 },
  saveButton: {},
  modalButtonText: { fontSize: 16, fontWeight: '600' },

  // NEW: Journal Tab Styles (Dashboard-style)
  journalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginHorizontal: 16, marginTop: 8, borderRadius: 12 },
  periodSelector: { flexDirection: 'row', gap: 8 },
  periodButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f3f4f6' },
  periodButtonActive: { backgroundColor: '#0078d4' },
  periodButtonText: { fontSize: 14, fontWeight: '600' },
  journalTotalPoints: { fontSize: 24, fontWeight: '700' },
  journalScrollView: { flex: 1 },
  journalScrollContent: { paddingBottom: 24 },
  daySeparator: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, marginTop: 8 },
  daySeparatorText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  journalEntryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 4, borderRadius: 8 },
  journalEntryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  journalEntryContent: { flex: 1, marginRight: 12 },
  journalEntryTitle: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  journalEntryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  journalTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  journalTagText: { fontSize: 11, fontWeight: '500', color: '#374151' },
  journalEntryPoints: { fontSize: 16, fontWeight: '700', color: '#22c55e' },
});