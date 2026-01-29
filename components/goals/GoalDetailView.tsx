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
import { GoalJournalView } from './GoalJournalView';

interface GoalDetailViewProps {
  goal: UnifiedGoal;
  onClose: () => void;
  onGoalUpdated: () => void;
  onAddAction?: () => void;
  authenticScore: number;
}

type TabType = 'act' | 'ideas' | 'journal' | 'analytics';
type TimeRange = '4W' | '12W' | 'All';

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
  // Week-specific actions from fetchGoalActionsForWeek (has correct weeklyTarget)
  const [weekFilteredActions, setWeekFilteredActions] = useState<TaskWithLogs[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Timeline and weeks state for ActionEffortModal
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // ActionEffortModal state
  const [showActionEffortModal, setShowActionEffortModal] = useState(false);
  const [editingAction, setEditingAction] = useState<TaskWithLogs | null>(null);

  // EditGoalModal state
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(goal);

  // Get createTaskWithWeekPlan from useGoals hook
  const { createTaskWithWeekPlan } = useGoals();

  // Ideas tab state
  const [ideas, setIdeas] = useState<DepositIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [newIdeaText, setNewIdeaText] = useState('');

  // Journal tab state
  const [journalNotes, setJournalNotes] = useState<JournalNote[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [newJournalText, setNewJournalText] = useState('');

  // Analytics tab state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('12W');

  // Week navigation state
  const [displayedWeekNumber, setDisplayedWeekNumber] = useState<number>(goal.current_week || 1);

 // Calculate weekly completion percentage from weekFilteredActions
const weeklyCompletionPercent = useMemo(() => {
  if (weekFilteredActions.length === 0) return 0;
  
  const totalCompleted = weekFilteredActions.reduce((sum, action) => sum + (action.weeklyActual || 0), 0);
  const totalTarget = weekFilteredActions.reduce((sum, action) => sum + (action.weeklyTarget || 0), 0);
  
  if (totalTarget === 0) return 0;
  return Math.round((totalCompleted / totalTarget) * 100);
}, [weekFilteredActions]); 

  // Update displayedWeekNumber when goal changes or cycleWeeks loads
useEffect(() => {
  // If current_week is provided, use it
  if (currentGoal.current_week) {
    setDisplayedWeekNumber(currentGoal.current_week);
    return;
  }

  // Otherwise calculate from cycleWeeks
  if (cycleWeeks.length > 0) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const currentWeekData = cycleWeeks.find(
      week => week.start_date && week.end_date &&
              todayStr >= week.start_date && todayStr <= week.end_date
    );

    if (currentWeekData) {
      setDisplayedWeekNumber(currentWeekData.week_number);
    } else {
      // Fallback: if today is past the end, use last week; if before start, use first week
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

  // Update currentGoal when goal prop changes
  useEffect(() => {
    setCurrentGoal(goal);
  }, [goal]);

  // Calculate current week bounds (Sunday to Saturday)
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

  // Calculate the date range for a given week number
  const getWeekDateRange = useCallback((weekNumber: number): string => {
    if (cycleWeeks.length === 0) return '';

    const week = cycleWeeks.find(w => w.week_number === weekNumber);
    if (!week) return '';

    const start = new Date(week.start_date);
    const end = new Date(week.end_date);

    const formatDay = (d: Date) => d.getDate();
    const formatMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });

    // Format: "25 - 31 Jan" (no year)
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

    console.log('[DEBUG] Goal object:', {
      id: currentGoal.id,
      title: currentGoal.title,
      goal_type: currentGoal.goal_type,
      user_global_timeline_id: currentGoal.user_global_timeline_id,
      custom_timeline_id: currentGoal.custom_timeline_id,
      timeline_name: currentGoal.timeline_name,
      current_week: currentGoal.current_week,
    });

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

      console.log('[GoalDetailView] Determined timeline:', { timelineId, timelineSource });

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
          .select(`
            id,
            title,
            start_date,
            end_date,
            status,
            global_cycle:0008-ap-global-cycles(
              id,
              title,
              cycle_label,
              start_date,
              end_date
            )
          `)
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
        console.error('[GoalDetailView] Error fetching weeks:', weeksError);
        setTimelineError('Failed to load timeline weeks.');
        setCycleWeeks([]);
        return;
      }

      const normalizedWeeks: CycleWeek[] = (weeksData || []).map(week => ({
        week_number: week.week_number,
        start_date: week.week_start,
        end_date: week.week_end,
      }));

      console.log('[GoalDetailView] Final state:', {
        timeline: timelineData,
        weekCount: normalizedWeeks.length,
        timelineError: null,
      });

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
      fetchJournalNotes();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [currentGoal.id, activeTab, refreshTrigger, timeRange, displayedWeekNumber, timeline, cycleWeeks]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      // Fetch ALL actions for the goal (needed for one-time/boost actions)
      const result = await fetchGoalActions(currentGoal.id, currentGoal.goal_type);
      setRecurringActions(result.recurringActions);
      setOneTimeActions(result.oneTimeActions);

      console.log('[GoalDetailView] One-time actions:', {
        count: result.oneTimeActions.length,
        actions: result.oneTimeActions.map(a => ({
          id: a.id,
          title: a.title,
          status: a.status,
          due_date: a.due_date
        }))
      });

      // Fetch week-specific recurring actions if we have timeline info
      if (timeline && cycleWeeks.length > 0) {
        const weekResult = await fetchGoalActionsForWeek(
          [currentGoal.id],
          displayedWeekNumber,
          { id: timeline.id, source: timeline.source },
          cycleWeeks
        );

        const actionsForGoal = weekResult[currentGoal.id] || [];
        setWeekFilteredActions(actionsForGoal);

        console.log('[GoalDetailView] Week-filtered actions:', {
          weekNumber: displayedWeekNumber,
          count: actionsForGoal.length,
          actions: actionsForGoal.map(a => ({
            title: a.title,
            target: a.weeklyTarget,
            actual: a.weeklyActual,
            selectedWeeks: a.selectedWeeks
          }))
        });
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

  const handleToggleCompletion = async (
  actionId: string,
  dateString: string,
  currentlyCompleted: boolean
) => {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }
    if (currentlyCompleted) {
      await handleActionUncompletion(supabase, actionId, dateString);
    } else {
      const action = weekFilteredActions.find(a => a.id === actionId) 
        || recurringActions.find(a => a.id === actionId);
      
      await handleActionCompletion(
        supabase,
        user.id,
        actionId,
        dateString,
        timeline,
        action?.weeklyTarget
      );
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

      if (!user) {
        throw new Error('Not authenticated');
      }

      const isCompleted = task.status === 'completed';

      if (isCompleted) {
        // Mark as incomplete
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({
            status: 'pending',
            completed_at: null,
            updated_at: toLocalISOString(new Date()),
          })
          .eq('id', task.id);

        if (error) throw error;
      } else {
        // Mark as complete
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({
            status: 'completed',
            completed_at: toLocalISOString(new Date()),
            updated_at: toLocalISOString(new Date()),
          })
          .eq('id', task.id);

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
    console.log('[GoalDetailView] Edit action:', action.id, action.title);
    setEditingAction(action);
    setShowActionEffortModal(true);
  };

  // Handle Edit Goal Modal
  const handleEditGoalPress = () => {
    // Only allow editing for 12week and custom goals
    if (currentGoal.goal_type === '1y') {
      Alert.alert('Coming Soon', 'Editing annual goals will be available in a future update.');
      return;
    }
    setShowEditGoalModal(true);
  };

  const handleEditGoalUpdate = () => {
    // Refresh data after goal is updated
    setRefreshTrigger(prev => prev + 1);
    onGoalUpdated();
  };

  const handleDeleteGoal = async (goalId: string, goalType: '12week' | 'custom') => {
    const supabase = getSupabaseClient();
    const tableName = goalType === '12week' ? '0008-ap-goals-12wk' : '0008-ap-goals-custom';

    const { error } = await supabase
      .from(tableName)
      .update({
        status: 'cancelled',
        archived: true,
        updated_at: toLocalISOString(new Date()),
      })
      .eq('id', goalId);

    if (error) throw error;
  };

  const handleGoalDeleted = () => {
    // Navigate back to Goal Bank after deletion
    onClose();
  };

  // Calculate time elapsed percentage for timeline
  const calculateTimeElapsed = useCallback((timelineData: Timeline | null): number => {
    if (!timelineData?.start_date || !timelineData?.end_date) return 0;

    const start = new Date(timelineData.start_date).getTime();
    const end = new Date(timelineData.end_date).getTime();
    const now = Date.now();

    if (now <= start) return 0;
    if (now >= end) return 100;

    return Math.round(((now - start) / (end - start)) * 100);
  }, []);

  const timeElapsedPercent = useMemo(() =>
    calculateTimeElapsed(timeline),
    [timeline, calculateTimeElapsed]
  );

  // Prepare goal object for ActionEffortModal with proper typing
  const goalForModal = useMemo(() => {
    return {
      id: currentGoal.id,
      title: currentGoal.title,
      description: currentGoal.description,
      goal_type: currentGoal.goal_type as '12week' | 'custom',
      roles: currentGoal.roles || [],
      domains: currentGoal.domains || [],
      keyRelationships: currentGoal.keyRelationships || [],
    };
  }, [currentGoal]);

  // Prepare goal object for EditGoalModal
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
      notes: [], // Notes will be fetched by EditGoalModal
    };
  }, [currentGoal]);

  const fetchIdeas = async () => {
    setIdeasLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let ideaIds: string[] = [];

      // Annual goals (1y) don't have direct links in universal-goals-join
      // They aggregate from their child 12-week goals
      if (currentGoal.goal_type === '1y') {
        // For annual goals, find child 12-week goals first, then their linked ideas
        const { data: childGoals, error: childError } = await supabase
          .from('0008-ap-goals-12wk')
          .select('id')
          .eq('parent_goal_id', currentGoal.id)
          .is('deleted_at', null);

        if (childError) throw childError;

        if (!childGoals || childGoals.length === 0) {
          setIdeas([]);
          setIdeasLoading(false);
          return;
        }

        const childGoalIds = childGoals.map(g => g.id);

        const { data: goalJoins, error: joinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .in('twelve_wk_goal_id', childGoalIds)
          .eq('parent_type', 'deposit_idea');

        if (joinError) throw joinError;

        ideaIds = goalJoins?.map(j => j.parent_id).filter(Boolean) || [];
      } else {
        // Original logic for 12week and custom goals
        const goalJoinColumn = currentGoal.goal_type === '12week'
          ? 'twelve_wk_goal_id'
          : 'custom_goal_id';

        const { data: goalJoins, error: joinError } = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id')
          .eq(goalJoinColumn, currentGoal.id)
          .eq('parent_type', 'deposit_idea');

        if (joinError) throw joinError;

        ideaIds = goalJoins?.map(j => j.parent_id).filter(Boolean) || [];
      }

      if (ideaIds.length === 0) {
        setIdeas([]);
        setIdeasLoading(false);
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

      // Fetch associations for each idea (roles, domains, etc.)
      const enrichedIdeas = await Promise.all((ideasData || []).map(async (idea) => {
        const [rolesData, domainsData, krData] = await Promise.all([
          supabase
            .from('0008-ap-universal-roles-join')
            .select('role:0008-ap-roles(id, label, color)')
            .eq('parent_id', idea.id)
            .eq('parent_type', 'deposit_idea'),
          supabase
            .from('0008-ap-universal-domains-join')
            .select('domain:0008-ap-domains(id, name)')
            .eq('parent_id', idea.id)
            .eq('parent_type', 'deposit_idea'),
          supabase
            .from('0008-ap-universal-key-relationships-join')
            .select('key_relationship:0008-ap-key-relationships(id, name)')
            .eq('parent_id', idea.id)
            .eq('parent_type', 'deposit_idea'),
        ]);

        const roles = rolesData.data?.map((r: any) => r.role).filter(Boolean) || [];
        const domains = domainsData.data?.map((d: any) => d.domain).filter(Boolean) || [];
        const keyRelationships = krData.data?.map((kr: any) => kr.key_relationship).filter(Boolean) || [];

        return {
          ...idea,
          title: idea.idea_text || idea.title,
          roles,
          domains,
          keyRelationships,
        };
      }));

      setIdeas(enrichedIdeas);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching ideas:', error);
      Alert.alert('Error', 'Failed to load ideas for this goal');
    } finally {
      setIdeasLoading(false);
    }
  };
  
  const fetchJournalNotes = async () => {
    setJournalLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let goalJoins: any[] | null = null;
      let joinError: any = null;

      // Annual goals aggregate from child 12-week goals
      if (currentGoal.goal_type === '1y') {
        const { data: childGoals, error: childError } = await supabase
          .from('0008-ap-goals-12wk')
          .select('id')
          .eq('parent_goal_id', currentGoal.id)
          .is('deleted_at', null);

        if (childError) throw childError;

        if (childGoals && childGoals.length > 0) {
          const childGoalIds = childGoals.map(g => g.id);
          const result = await supabase
            .from('0008-ap-universal-goals-join')
            .select('parent_id, parent_type')
            .in('twelve_wk_goal_id', childGoalIds);
          goalJoins = result.data;
          joinError = result.error;
        } else {
          goalJoins = [];
        }
      } else {
        const goalJoinColumn = currentGoal.goal_type === '12week'
          ? 'twelve_wk_goal_id'
          : 'custom_goal_id';

        const result = await supabase
          .from('0008-ap-universal-goals-join')
          .select('parent_id, parent_type')
          .eq(goalJoinColumn, currentGoal.id);
        goalJoins = result.data;
        joinError = result.error;
      }

      if (joinError) throw joinError;

      const journalEntries: JournalNote[] = [];

      // Fetch completed tasks
      const taskIds = goalJoins?.filter(j => j.parent_type === 'task').map(j => j.parent_id) || [];

      if (taskIds.length > 0) {
        const { data: tasks, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .in('id', taskIds)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .order('completed_at', { ascending: false });

        if (!tasksError && tasks) {
          tasks.forEach(task => {
            journalEntries.push({
              id: task.id,
              created_at: task.completed_at || task.created_at,
              note_text: task.title,
              entry_type: task.type === 'event' ? 'event' : 'task',
              source_data: task,
            });
          });
        }
      }

      // Fetch reflections
      const reflectionIds = goalJoins?.filter(j => j.parent_type === 'reflection').map(j => j.parent_id) || [];

      if (reflectionIds.length > 0) {
        const { data: reflections, error: reflectionsError } = await supabase
          .from('0008-ap-reflections')
          .select('*')
          .in('id', reflectionIds)
          .eq('archived', false)
          .order('created_at', { ascending: false });

        if (!reflectionsError && reflections) {
          reflections.forEach(ref => {
            journalEntries.push({
              id: ref.id,
              created_at: ref.created_at,
              note_text: ref.content?.substring(0, 100) + (ref.content?.length > 100 ? '...' : ''),
              entry_type: 'reflection',
              source_data: ref,
            });
          });
        }
      }

      // Sort by date (newest first)
      journalEntries.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setJournalNotes(journalEntries);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching journal:', error);
      Alert.alert('Error', 'Failed to load journal entries for this goal');
    } finally {
      setJournalLoading(false);
    }
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
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekActions = result.recurringActions.filter(action => {
          return action.weeklyTarget > 0;
        });

        const avgCompletion = weekActions.length > 0
          ? weekActions.reduce((sum, a) => sum + (a.weeklyActual / a.weeklyTarget * 100), 0) / weekActions.length
          : 0;

        weeklyData.unshift({
          weekNumber: i + 1,
          completionPercent: Math.min(100, Math.round(avgCompletion)),
        });
      }

      const weeklyAverage = weeklyData.length > 0
        ? Math.round(weeklyData.reduce((sum, w) => sum + w.completionPercent, 0) / weeklyData.length)
        : 0;

      const weeksAt100 = weeklyData.filter(w => w.completionPercent >= 100).length;
      const consistency = weeklyData.length > 0
        ? Math.round((weeksAt100 / weeklyData.length) * 100)
        : 0;

      const totalActions = result.recurringActions.reduce((sum, a) => sum + a.weeklyActual, 0) +
                          result.oneTimeActions.length;

      setAnalyticsData({
        goalScore,
        weeklyAverage,
        consistency,
        totalActions,
        weeklyData: weeklyData.slice(0, 12),
      });
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
        .insert({
          user_id: user.id,
          idea_text: newIdeaText.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (ideaError) throw ideaError;

      const goalJoinColumn = currentGoal.goal_type === '1y'
        ? 'one_yr_goal_id'
        : currentGoal.goal_type === '12week'
        ? 'twelve_wk_goal_id'
        : 'custom_goal_id';

      const { error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .insert({
          [goalJoinColumn]: currentGoal.id,
          parent_id: ideaData.id,
          parent_type: 'deposit_idea',
        });

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
        .insert({
          user_id: user.id,
          note_text: newJournalText.trim(),
          note_date: toLocalISOString(new Date()),
        })
        .select()
        .single();

      if (noteError) throw noteError;

      const parentType = currentGoal.goal_type === '1y' ? 'goal_1y' :
                        currentGoal.goal_type === '12week' ? 'goal_12wk' : 'goal_custom';

      const { error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          note_id: noteData.id,
          parent_id: currentGoal.id,
          parent_type: parentType,
        });

      if (joinError) throw joinError;

      setNewJournalText('');
      setShowAddJournalModal(false);
      fetchJournalNotes();
      Alert.alert('Success', 'Journal entry added');
    } catch (error) {
      console.error('[GoalDetailView] Error adding journal entry:', error);
      Alert.alert('Error', 'Failed to add journal entry');
    }
  };

  const handleUpdateIdea = (idea: DepositIdeaType) => {
    // TODO: Open edit modal for deposit idea
    Alert.alert('Edit Idea', 'This feature will be available in a future update');
  };

  const handleActivateIdea = (idea: DepositIdeaType) => {
    Alert.alert(
      'Activate Idea',
      'Convert this idea into an action linked to this goal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Create a task from this idea
              const { data: newTask, error: taskError } = await supabase
                .from('0008-ap-tasks')
                .insert({
                  user_id: user.id,
                  title: idea.title,
                  status: 'pending',
                  type: 'task',
                  created_at: toLocalISOString(new Date()),
                  updated_at: toLocalISOString(new Date()),
                })
                .select()
                .single();

              if (taskError) throw taskError;

              // Link the task to this goal
              // Cannot add ideas directly to annual goals
      if (currentGoal.goal_type === '1y') {
        Alert.alert(
          'Cannot Add Idea Here',
          'Ideas should be added to specific 12-week goals that support this annual goal.'
        );
        setIdeasLoading(false);
        return;
      }

      const goalJoinColumn = currentGoal.goal_type === '12week'
        ? 'twelve_wk_goal_id'
        : 'custom_goal_id';

              const { error: joinError } = await supabase
                .from('0008-ap-universal-goals-join')
                .insert({
                  parent_id: newTask.id,
                  parent_type: 'task',
                  [goalJoinColumn]: currentGoal.id,
                  created_at: toLocalISOString(new Date()),
                });

              if (joinError) throw joinError;

              // Mark idea as activated
              const { error: updateError } = await supabase
                .from('0008-ap-deposit-ideas')
                .update({
                  is_active: false,
                  archived: true,
                  activated_task_id: newTask.id,
                })
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
      ]
    );
  };

  const handleCancelIdea = async (idea: DepositIdeaType) => {
    Alert.alert(
      'Cancel Idea',
      'Are you sure you want to cancel this idea?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();

              const { error } = await supabase
                .from('0008-ap-deposit-ideas')
                .update({
                  is_active: false,
                  archived: true,
                  updated_at: toLocalISOString(new Date()),
                })
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
      ]
    );
  };

  const handleIdeaPress = (idea: DepositIdeaType) => {
    // TODO: Open detail modal for deposit idea
    Alert.alert('Idea Details', idea.title);
  };

  const getTimelineBadge = () => {
    if (currentGoal.goal_type === '1y') {
      return currentGoal.year_target_date
        ? `${new Date(currentGoal.year_target_date).getFullYear()} Annual Goal`
        : 'Annual Goal';
    }

    if (currentGoal.goal_type === '12week' && currentGoal.timeline_name) {
      return currentGoal.timeline_name;
    }

    if (currentGoal.goal_type === 'custom' && currentGoal.timeline_name) {
      return currentGoal.timeline_name;
    }

    return 'Goal Timeline';
  };

  const getTotalWeeks = () => {
    if (currentGoal.goal_type === '12week') return 12;
    if (currentGoal.goal_type === 'custom') return currentGoal.total_weeks || 1;
    return 1;
  };

  const handlePreviousWeek = () => {
    if (displayedWeekNumber > 1) {
      setDisplayedWeekNumber(prev => prev - 1);
    }
  };

  const handleNextWeek = () => {
    const totalWeeks = getTotalWeeks();
    if (displayedWeekNumber < totalWeeks) {
      setDisplayedWeekNumber(prev => prev + 1);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
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
        <Text style={styles.title} numberOfLines={2}>
          {currentGoal.title}
        </Text>
      </View>

      <View style={styles.headerBottom}>
        <View style={styles.toggleGroup}>
          {(['act', 'ideas', 'journal', 'analytics'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.toggleButton, activeTab === tab && styles.activeToggle]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.toggleText,
                  activeTab === tab && styles.activeToggleText,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
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
              <TouchableOpacity
                onPress={handlePreviousWeek}
                disabled={displayedWeekNumber <= 1}
                style={[styles.weekNavArrow, displayedWeekNumber <= 1 && styles.weekNavArrowDisabled]}
              >
                <ChevronLeft size={20} color={displayedWeekNumber <= 1 ? colors.textSecondary : colors.text} />
              </TouchableOpacity>

              <View style={styles.weekNavCenter}>
                <Text style={[styles.weekNavText, { color: colors.text }]}>
                  Week {displayedWeekNumber} of {totalWeeks}
                </Text>
                <Text style={[styles.weekNavDateRange, { color: colors.textSecondary }]}>
                  {getWeekDateRange(displayedWeekNumber)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleNextWeek}
                disabled={displayedWeekNumber >= totalWeeks}
                style={[styles.weekNavArrow, displayedWeekNumber >= totalWeeks && styles.weekNavArrowDisabled]}
              >
                <ChevronRight size={20} color={displayedWeekNumber >= totalWeeks ? colors.textSecondary : colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekNavRight}>
              <TouchableOpacity onPress={handleEditGoalPress}>
                <Text style={[styles.editLink, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>

              <Text style={[styles.totalProgress, { color: colors.text }]}>
  Total {weeklyCompletionPercent}%
</Text>
            </View>
          </View>
        )}

        {/* Show simple Edit button only on Act tab for 1y goals */}
{(!showWeekNav && activeTab === 'act') && currentGoal.progress !== undefined && (
  <View style={styles.bannerRight}>
    <TouchableOpacity
      style={styles.editButton}
      onPress={handleEditGoalPress}
    >
      <Edit3 size={16} color={colors.primary} />
      <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
    </TouchableOpacity>
    <Text style={[styles.progressPercentage, { color: colors.text }]}>
      {cumulativeProgress}%
    </Text>
  </View>
)}

        {currentGoal.progress !== undefined && activeTab === 'act' && (
  <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
    <View
      style={[
        styles.progressBarFill,
        { backgroundColor: colors.primary, width: `${currentGoal.progress}%` },
      ]}
    />
  </View>
)}

        {currentGoal.parent_goal_title && (
          <TouchableOpacity style={styles.parentGoalLink} activeOpacity={0.7}>
            <Text style={[styles.parentGoalLinkText, { color: colors.textSecondary }]}>
              → supports <Text style={{ fontWeight: '600' }}>{currentGoal.parent_goal_title}</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getScheduledDaysFromRRule = (rrule: string): number[] => {
    if (!rrule) return [0, 1, 2, 3, 4, 5, 6]; // All days available if no rule

    const dayMap: Record<string, number> = {
      SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
    };

    const byDayMatch = rrule.match(/BYDAY=([^;]+)/);

    // If no BYDAY specified, ALL days are available
    // This happens when user selects preset frequency like "5 days" (any 5 days)
    if (!byDayMatch) {
      return [0, 1, 2, 3, 4, 5, 6]; // All days available
    }

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
    // TODO: Open ActionEffortModal in edit mode
    Alert.alert('Edit Action', `Edit "${action.title}" - Coming soon`);
  };

  const renderLeadingIndicatorCard = (action: RecurringActionResult) => {
    // Check if this is a custom schedule (has specific BYDAY) vs preset frequency
const hasSpecificDays = action.recurrence_rule?.includes('BYDAY=');
const scheduledDays = hasSpecificDays 
  ? getScheduledDaysFromRRule(action.recurrence_rule || '')
  : [0, 1, 2, 3, 4, 5, 6]; // All days available for preset frequencies
    const completedDays = getCompletedDaysForWeek(action);
    const targetDays = action.weeklyTarget || 1;
    const completionCount = action.weeklyActual || 0;
    const progressPercent = targetDays > 0 ? Math.round((completionCount / targetDays) * 100) : 0;

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <View key={action.id} style={[styles.liCard, { backgroundColor: colors.surface }]}>
        <View style={styles.liHeader}>
          <Text style={[styles.liTitle, { color: colors.text }]}>{action.title}</Text>
          <TouchableOpacity onPress={() => handleEditLeadingIndicator(action)}>
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
              const isScheduled = scheduledDays.includes(index);
              const isCompleted = completedDays.includes(index);

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.liDayColumn}
                  onPress={() => isScheduled && handleToggleDay(action.id, index)}
                  disabled={!isScheduled}
                >
                  <Text style={[styles.liDayLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <View style={[
                    styles.liBubble,
                    { borderColor: colors.border },
                    hasSpecificDays && isScheduled && !isCompleted && styles.liBubbleScheduled,
                    isCompleted && [styles.liBubbleCompleted, { backgroundColor: colors.primary, borderColor: colors.primary }],
                    !isScheduled && [styles.liBubbleDisabled, { backgroundColor: colors.border + '40' }],
                  ]}>
                    {isCompleted && <View style={styles.liBubbleFill} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.liCount, { color: colors.textSecondary }]}>
            {completionCount}/{targetDays}
          </Text>
        </View>
      </View>
    );
  };

  // Render card using TaskWithLogs from fetchGoalActionsForWeek (has correct weeklyTarget)
  const renderWeekFilteredActionCard = (action: TaskWithLogs) => {
  // Check if this is a custom schedule (has specific BYDAY) vs preset frequency
  const hasSpecificDays = action.recurrence_rule?.includes('BYDAY=');
  const scheduledDays = hasSpecificDays 
    ? getScheduledDaysFromRRule(action.recurrence_rule || '')
    : [0, 1, 2, 3, 4, 5, 6]; // All days available for preset frequencies
  
  const completedDays = action.logs?.map(log => {
  console.log('[DEBUG completedDays] log.measured_on:', log.measured_on);
  // Parse as local date to avoid timezone shift
  const [y, m, d] = log.measured_on.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}) || [];

console.log('[DEBUG] completedDays array:', completedDays);
  const targetDays = action.weeklyTarget || 1;
  const completionCount = action.weeklyActual || 0;
  const progressPercent = targetDays > 0 ? Math.min(Math.round((completionCount / targetDays) * 100), 100) : 0;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get today's day index and the week being displayed
  const today = new Date();
  const todayDayIndex = today.getDay();
  
  // Determine if we're viewing the current week
  const currentWeekData = cycleWeeks.find(w => w.week_number === displayedWeekNumber);
  const isCurrentWeek = currentWeekData && (() => {
    const todayStr = formatLocalDate(today);
    return todayStr >= currentWeekData.start_date && todayStr <= currentWeekData.end_date;
  })();
  
  // For past weeks, all days are "past". For future weeks, no days are "past"
  const isPastWeek = currentWeekData && formatLocalDate(today) > currentWeekData.end_date;
  const isFutureWeek = currentWeekData && formatLocalDate(today) < currentWeekData.start_date;

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
            
            // Determine if this day is in the past (for current week only)
            let isPastDay = false;
            if (isPastWeek) {
              isPastDay = true; // All days in past weeks are past
            } else if (isCurrentWeek) {
              isPastDay = index < todayDayIndex; // Days before today
            }
            // Future weeks: no days are past
            
            const isMissed = isPastDay && !isCompleted && isAvailable;

            return (
              <TouchableOpacity
                key={index}
                style={styles.liDayColumn}
                onPress={() => isAvailable && handleToggleDayForWeek(action.id, index)}
                disabled={!isAvailable}
                activeOpacity={0.6}
              >
                <Text style={[styles.liDayLabel, { color: colors.text }]}>{label}</Text>
                <View style={[
                  styles.liBubble,
                  // Completed state - green
                  isCompleted && styles.liBubbleCompleted,
                  // Missed state - red (past, available, not completed)
                  isMissed && styles.liBubbleMissed,
                  // Custom scheduled days get yellow (only if not completed/missed)
                  hasSpecificDays && isAvailable && !isCompleted && !isMissed && styles.liBubbleScheduled,
                  // Disabled state
                  !isAvailable && styles.liBubbleDisabled,
                ]}>
                  {isCompleted && (
                    <Check size={16} color="#22c55e" strokeWidth={3} />
                  )}
                  {isMissed && (
                    <X size={16} color="#ef4444" strokeWidth={3} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.liCount, { color: colors.textSecondary }]}>
          {completionCount}/{targetDays}
        </Text>
      </View>
    </View>
  );
};

  // Handle toggle for week-filtered actions
  const handleToggleDayForWeek = async (actionId: string, dayIndex: number) => {
  try {
    const week = cycleWeeks.find(w => w.week_number === displayedWeekNumber);
    if (!week) {
      console.error('[GoalDetailView] Week not found:', displayedWeekNumber);
      return;
    }

    // Parse week start date as LOCAL date (not UTC)
    const [year, month, day] = week.start_date.split('-').map(Number);
    const weekStartDate = new Date(year, month - 1, day); // month is 0-indexed
    
    // Get what day of week the timeline week starts on (0=Sun, 6=Sat)
    const weekStartDayOfWeek = weekStartDate.getDay();
    
    // dayIndex is the UI column: 0=Sun, 1=Mon, 2=Tue, etc.
    // We need to find how many days from weekStartDate to reach that day
    
    // Example: weekStart is Saturday (6), user taps Sunday (0)
    // daysToAdd = (0 - 6 + 7) % 7 = 1 ✓
    // Example: weekStart is Saturday (6), user taps Tuesday (2)  
    // daysToAdd = (2 - 6 + 7) % 7 = 3 ✓
    const daysToAdd = (dayIndex - weekStartDayOfWeek + 7) % 7;
    
    const targetDate = new Date(year, month - 1, day + daysToAdd);
    const dateString = formatLocalDate(targetDate);

    const action = weekFilteredActions.find(a => a.id === actionId);
    if (!action) return;

    // DEBUG
    console.log('[DEBUG handleToggleDayForWeek]', {
      dayIndex,
      dayLabel: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex],
      weekStart: week.start_date,
      weekStartDayOfWeek,
      daysToAdd,
      calculatedDateString: dateString,
      existingLogs: action.logs?.map(l => l.measured_on),
    });

    const isCurrentlyCompleted = action.logs?.some(log => log.measured_on === dateString) || false;
    
    console.log('[DEBUG] isCurrentlyCompleted:', isCurrentlyCompleted);

    // OPTIMISTIC UPDATE
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
      
      return {
        ...a,
        logs: newLogs,
        weeklyActual: newWeeklyActual,
      };
    }));

    // Database update
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

      const dayOfWeek = dayIndex;

      const daysFromToday = dayOfWeek - currentDayOfWeek;
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
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading actions...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {weekFilteredActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              RECURRING ACTIONS
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Leading Indicators • Tap circles to mark completion
            </Text>

            {weekFilteredActions.map(action => renderWeekFilteredActionCard(action))}
          </View>
        )}

        {oneTimeActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              BOOST ACTIONS
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              One-time tasks linked to this goal
            </Text>
            <View style={styles.boostList}>
              {oneTimeActions.map(task => {
                const isCompleted = task.status === 'completed';
                const formattedDueDate = task.due_date
                  ? formatLocalDate(task.due_date instanceof Date ? task.due_date : new Date(task.due_date))
                  : null;

                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.boostItem, { backgroundColor: colors.surface }]}
                    onPress={() => handleToggleBoostTask(task)}
                  >
                    <View style={styles.boostCheckbox}>
                      {isCompleted ? (
                        <CheckSquare size={20} color={colors.primary} />
                      ) : (
                        <Square size={20} color={colors.textSecondary} />
                      )}
                    </View>
                    <View style={styles.boostContent}>
                      <Text
                        style={[
                          styles.boostTitle,
                          { color: colors.text },
                          isCompleted && styles.boostTitleCompleted,
                        ]}
                      >
                        {task.title}
                      </Text>
                      <Text style={[styles.boostDue, { color: colors.textSecondary }]}>
                        {isCompleted
                          ? 'Completed'
                          : formattedDueDate
                          ? `Due: ${formattedDueDate}`
                          : 'No due date'}
                      </Text>
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
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Add actions to track progress toward this goal
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.addActionButton,
            { backgroundColor: colors.primary },
            (loadingTimeline || !!timelineError) && styles.addButtonDisabled
          ]}
          onPress={handleAddActionPress}
          disabled={loadingTimeline}
        >
          {loadingTimeline ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Plus size={20} color="#ffffff" />
              <Text style={styles.addActionButtonText}>Add Action</Text>
            </>
          )}
        </TouchableOpacity>

        {timelineError && currentGoal.goal_type !== '1y' && (
          <Text style={styles.timelineErrorText}>{timelineError}</Text>
        )}

        {timeline && currentGoal.goal_type !== '1y' && (
          <View style={[styles.timelineFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.timelineFooterName, { color: colors.textSecondary }]}>
              {timeline.title || 'Timeline'}
            </Text>
            <View style={styles.timelineFooterProgress}>
              <View style={[styles.timelineFooterBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.timelineFooterFill,
                    { backgroundColor: colors.primary, width: `${timeElapsedPercent}%` },
                  ]}
                />
              </View>
              <Text style={[styles.timelineFooterPercent, { color: colors.textSecondary }]}>
                {timeElapsedPercent}%
              </Text>
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
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading ideas...
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabScrollContent}>
        {ideas.length === 0 ? (
          <View style={styles.emptyState}>
            <Lightbulb size={64} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Ideas Yet</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Ideas linked to this goal will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.ideasList}>
            {ideas.map(idea => (
              <DepositIdeaCard
                key={idea.id}
                depositIdea={idea}
                onUpdate={handleUpdateIdea}
                onActivate={handleActivateIdea}
                onCancel={handleCancelIdea}
                onPress={handleIdeaPress}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const getEntryIcon = (type?: string) => {
    switch (type) {
      case 'task':
        return <CheckSquare size={20} color="#2563eb" />;
      case 'event':
        return <CalendarIcon size={20} color="#2563eb" />;
      case 'reflection':
        return <BookOpen size={20} color="#7c3aed" />;
      default:
        return <CheckSquare size={20} color={colors.textSecondary} />;
    }
  };

  const getIconStyle = (type?: string) => {
    switch (type) {
      case 'task':
      case 'event':
        return { backgroundColor: '#dbeafe' };
      case 'reflection':
        return { backgroundColor: '#f3e8ff' };
      default:
        return { backgroundColor: colors.surface };
    }
  };

  const handleJournalEntryPress = (entry: JournalNote) => {
    // TODO: Open detail modal for entry
    Alert.alert('Entry Details', entry.note_text);
  };

  const renderJournalTab = () => {
    if (!currentGoal) return null;

    return (
      <View style={styles.tabContent}>
        <GoalJournalView
          goalId={currentGoal.id}
          goalType={currentGoal.goal_type}
          goalStartDate={currentGoal.start_date}
          goalEndDate={currentGoal.end_date}
        />
      </View>
    );
  };

  const renderAnalyticsTab = () => {
    if (analyticsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Calculating analytics...
          </Text>
        </View>
      );
    }

    if (!analyticsData) {
      return (
        <View style={styles.emptyState}>
          <TrendingUp size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data Yet</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
            Complete some actions to see analytics
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.timeRangeSelector}>
          {(['4W', '12W', 'All'] as TimeRange[]).map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                { borderColor: colors.border },
                timeRange === range && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  { color: timeRange === range ? '#ffffff' : colors.text },
                ]}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.goalScoreCard, { backgroundColor: colors.surface }]}>
          <TrendingUp size={32} color={colors.primary} />
          <View style={styles.goalScoreContent}>
            <Text style={[styles.goalScoreLabel, { color: colors.textSecondary }]}>
              Goal Score
            </Text>
            <Text style={[styles.goalScoreValue, { color: colors.primary }]}>
              {analyticsData.goalScore}
            </Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Weekly Average
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {analyticsData.weeklyAverage}%
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Consistency
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {analyticsData.consistency}%
            </Text>
          </View>
        </View>

        <View style={[styles.metricCard, styles.fullWidthMetric, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
            Total Actions Completed
          </Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {analyticsData.totalActions}
          </Text>
        </View>

        {analyticsData.weeklyData.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              WEEKLY COMPLETION
            </Text>
            <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.chartBars}>
                {analyticsData.weeklyData.map((week, index) => (
                  <View key={index} style={styles.barWrapper}>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${week.completionPercent}%`,
                            backgroundColor:
                              week.completionPercent >= 100
                                ? '#10b981'
                                : week.completionPercent >= 75
                                ? colors.primary
                                : week.completionPercent >= 50
                                ? '#f59e0b'
                                : '#ef4444',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                      W{week.weekNumber}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    100%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    75-99%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    50-74%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    &lt;50%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'act':
        return renderActTab();
      case 'ideas':
        return renderIdeasTab();
      case 'journal':
        return renderJournalTab();
      case 'analytics':
        return renderAnalyticsTab();
      default:
        return null;
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
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ deleted_at: toLocalISOString(new Date()) })
        .eq('id', actionId);
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
      <Modal
        visible={showAddIdeaModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddIdeaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Idea</Text>
              <TouchableOpacity onPress={() => setShowAddIdeaModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Enter your idea..."
              placeholderTextColor={colors.textSecondary}
              value={newIdeaText}
              onChangeText={setNewIdeaText}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setNewIdeaText('');
                  setShowAddIdeaModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleAddIdea}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Journal Entry Modal */}
      <Modal
        visible={showAddJournalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddJournalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Journal Entry</Text>
              <TouchableOpacity onPress={() => setShowAddJournalModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, styles.journalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Write your thoughts..."
              placeholderTextColor={colors.textSecondary}
              value={newJournalText}
              onChangeText={setNewJournalText}
              multiline
              numberOfLines={8}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setNewJournalText('');
                  setShowAddJournalModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleAddJournalEntry}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  titleIcon: {
    marginTop: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  headerBottom: {
    marginTop: 8,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  goalBanner: {
  paddingHorizontal: 16,
  paddingBottom: 16,
  paddingTop: 8,  // Reduced top padding
  marginHorizontal: 16,
  marginTop: 0,   // Remove top margin
  borderRadius: 12,
  marginBottom: 8,
},
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timelineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timelineBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  parentGoalLink: {
    paddingVertical: 4,
  },
  parentGoalLinkText: {
    fontSize: 14,
  },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,  // Reduced from 12 to tighten spacing
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  weekNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  weekNavArrow: {
    padding: 4,
  },
  weekNavArrowDisabled: {
    opacity: 0.4,
  },
  weekNavCenter: {
    alignItems: 'center',
  },
  weekNavText: {
    fontSize: 16,
    fontWeight: '600',
  },
  weekNavDateRange: {
    fontSize: 12,
    marginTop: 2,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalProgress: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  tabScrollContent: {
    padding: 16,
  },
  ideasList: {
    gap: 8,
  },
  journalList: {
    gap: 8,
  },
  journalEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  journalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  journalContent: {
    flex: 1,
  },
  journalTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  journalDate: {
    fontSize: 12,
  },
  liCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  liHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  liEditLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  liProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  liProgressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  liProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  liProgressText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  liDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liDaysContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  liDayColumn: {
    alignItems: 'center',
    width: 36,
  },
  liDayLabel: {
  fontSize: 12,
  marginBottom: 4,
  fontWeight: '500',
},
liBubble: {
  width: 30,
  height: 30,
  borderRadius: 15,
  borderWidth: 2,
  borderColor: '#374151',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
},
liBubbleScheduled: {
  backgroundColor: '#fef3c7',
  borderColor: '#f59e0b',
},
liBubbleCompleted: {
  backgroundColor: '#dcfce7',
  borderColor: '#22c55e',
},
liBubbleMissed: {
  backgroundColor: '#fee2e2',
  borderColor: '#ef4444',
},
liBubbleDisabled: {
  opacity: 0.3,
  borderColor: '#d1d5db',
},
liBubbleFill: {
  // No longer used - we use icons now
},
  liCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  liChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  boostList: {
    gap: 8,
  },
  boostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  boostCheckbox: {
    marginRight: 12,
  },
  boostContent: {
    flex: 1,
  },
  boostTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  boostTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  boostDue: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addActionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timelineErrorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  timelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    marginTop: 0,
  },
  timelineFooterName: {
    fontSize: 14,
    flex: 1,
  },
  timelineFooterProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineFooterBar: {
    width: 100,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timelineFooterFill: {
    height: '100%',
    borderRadius: 3,
  },
  timelineFooterPercent: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ideaCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ideaDate: {
    fontSize: 13,
    flex: 1,
  },
  ideaText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  activateButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  journalCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  journalDate: {
    fontSize: 13,
    flex: 1,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachmentCount: {
    fontSize: 12,
  },
  journalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  goalScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 16,
  },
  goalScoreContent: {
    flex: 1,
  },
  goalScoreLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  goalScoreValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullWidthMetric: {
    marginBottom: 16,
  },
  metricLabel: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  chartContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    gap: 8,
    marginBottom: 16,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    width: '100%',
    height: 180,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  journalInput: {
    minHeight: 200,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});