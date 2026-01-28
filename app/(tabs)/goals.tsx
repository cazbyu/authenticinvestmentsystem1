import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Modal, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UniversalHeader } from '@/components/UniversalHeader';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
const CreateGoalModal = lazy(() => import('@/components/goals/CreateGoalModal').then(m => ({ default: m.CreateGoalModal })));
const EditGoalModal = lazy(() => import('@/components/goals/EditGoalModal').then(m => ({ default: m.EditGoalModal })));
const ActionEffortModal = lazy(() => import('@/components/goals/ActionEffortModal'));
const ManageCustomTimelinesModal = lazy(() => import('@/components/timelines/ManageCustomTimelinesModal').then(m => ({ default: m.ManageCustomTimelinesModal })));
const ManageGlobalTimelinesModal = lazy(() => import('@/components/timelines/ManageGlobalTimelinesModal').then(m => ({ default: m.ManageGlobalTimelinesModal })));
const ManageTimelinesView = lazy(() => import('@/components/timelines/ManageTimelinesView').then(m => ({ default: m.ManageTimelinesView })));
const WithdrawalForm = lazy(() => import('@/components/journal/WithdrawalForm').then(m => ({ default: m.WithdrawalForm })));
import { GoalBankTabbedHeader, GoalBankTab } from '@/components/goals/GoalBankTabbedHeader';
import { MyGoalsView, UnifiedGoal } from '@/components/goals/MyGoalsView';
import { GoalDetailView } from '@/components/goals/GoalDetailView';
import { NorthStarQuickView } from '@/components/northStar/NorthStarQuickView';
import { NorthStarEditor } from '@/components/northStar/NorthStarEditor';
import { getSupabaseClient } from '@/lib/supabase';
import { useGoals } from '@/hooks/useGoals';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { fetchGoalActionsForWeek } from '@/hooks/fetchGoalActionsForWeek';
import { calculateAuthenticScore, calculateTotalGoalProgress } from '@/lib/taskUtils';
import { formatLocalDate, toLocalISOString, parseLocalDate } from '@/lib/dateUtils';
import { handleActionCompletion, handleActionUncompletion } from '@/lib/completionHandler';
import { getWeeklyCompletionCountWithTarget, syncCompletionAcrossViews, completionEvents } from '@/lib/completionSync';
import { Plus, ChevronLeft, ChevronRight, Target, Users, Minus, X } from 'lucide-react-native';
import { DraggableFab } from '@/components/DraggableFab';
import { router } from 'expo-router';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { goalsReducer, initialGoalsState, type Timeline, type TimelineWeek } from '@/reducers/goalsReducer';

export default function Goals() {
  const { authenticScore, refreshScore } = useAuthenticScore();
  const { colors } = useTheme();
  const [settingsSidebarVisible, setSettingsSidebarVisible] = useState(false);

  // Use reducer for core business logic state
  const [state, dispatch] = useReducer(goalsReducer, initialGoalsState);
  const {
    activeTab,
    selectedTimeline,
    currentWeekIndex,
    weekGoalActions,
    loadingWeekActions,
    allTimelines,
    timelineWeeks,
    timelineDaysLeft,
    timelinesWithGoals,
    loadingTimelines,
    timelineGoals,
    timelineGoalProgress,
    totalGoalProgress,
    expandedGoals,
  } = state;

  // Wrapper functions for dispatch (maintains compatibility with existing code)
  const setActiveTab = useCallback((tab: typeof activeTab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }), []);
  const setSelectedTimeline = useCallback((timeline: Timeline | null) => dispatch({ type: 'SET_SELECTED_TIMELINE', payload: timeline }), []);
  const setCurrentWeekIndex = useCallback((index: number) => dispatch({ type: 'SET_CURRENT_WEEK_INDEX', payload: index }), []);
  const setWeekGoalActions = useCallback((actions: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)) => {
    if (typeof actions === 'function') {
      dispatch({ type: 'SET_WEEK_GOAL_ACTIONS', payload: actions(weekGoalActions) });
    } else {
      dispatch({ type: 'SET_WEEK_GOAL_ACTIONS', payload: actions });
    }
  }, [weekGoalActions]);
  const setLoadingWeekActions = useCallback((loading: boolean) => dispatch({ type: 'SET_LOADING_WEEK_ACTIONS', payload: loading }), []);
  const setAllTimelines = useCallback((timelines: Timeline[]) => dispatch({ type: 'SET_ALL_TIMELINES', payload: timelines }), []);
  const setTimelineWeeks = useCallback((weeks: TimelineWeek[]) => dispatch({ type: 'SET_TIMELINE_WEEKS', payload: weeks }), []);
  const setTimelineDaysLeft = useCallback((days: any) => dispatch({ type: 'SET_TIMELINE_DAYS_LEFT', payload: days }), []);
  const setTimelinesWithGoals = useCallback((timelines: any[]) => dispatch({ type: 'SET_TIMELINES_WITH_GOALS', payload: timelines }), []);
  const setLoadingTimelines = useCallback((loading: boolean) => dispatch({ type: 'SET_LOADING_TIMELINES', payload: loading }), []);
  const setTimelineGoals = useCallback((goals: any[]) => dispatch({ type: 'SET_TIMELINE_GOALS', payload: goals }), []);
  const setTimelineGoalProgress = useCallback((progress: Record<string, any>) => dispatch({ type: 'SET_TIMELINE_GOAL_PROGRESS', payload: progress }), []);
  const setTotalGoalProgress = useCallback((progress: Record<string, { totalActual: number; totalTarget: number; percentage: number }>) => dispatch({ type: 'SET_TOTAL_GOAL_PROGRESS', payload: progress }), []);
  const setExpandedGoals = useCallback((goals: Record<string, boolean>) => dispatch({ type: 'SET_EXPANDED_GOALS', payload: goals }), []);
  const toggleGoalExpanded = useCallback((goalId: string) => dispatch({ type: 'TOGGLE_GOAL_EXPANDED', payload: goalId }), []);

  // Helper function to format dates without timezone shift
  const formatDateDisplay = (dateString: string): string => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const [northStarData, setNorthStarData] = useState<any>(null);
  const [loadingNorthStar, setLoadingNorthStar] = useState(false);
  const [northStarEditorVisible, setNorthStarEditorVisible] = useState(false);
  const [northStarInitialSection, setNorthStarInitialSection] = useState<'mission' | 'vision' | 'goals'>('mission');
  const [myGoalsRefreshTrigger, setMyGoalsRefreshTrigger] = useState(0);
  const [selectedGoalForDetail, setSelectedGoalForDetail] = useState<UnifiedGoal | null>(null);

  // Form data cache - fetched once and passed to modals
  const [formDataCache, setFormDataCache] = useState<{
    roles: any[];
    domains: any[];
    keyRelationships: any[];
    oneYearGoals: any[];
    loaded: boolean;
  }>({
    roles: [],
    domains: [],
    keyRelationships: [],
    oneYearGoals: [],
    loaded: false
  });

  // Import functions from useGoalProgress hook (but NOT fetchGoalActionsForWeek or completion functions - we handle those locally)
  const {
    toggleTaskDay,
  } = useGoalProgress();

  // Goals state now managed by reducer above

  // Memoize current week computation for better performance
  const currentWeek = useMemo(() => {
    if (!selectedTimeline || !timelineWeeks || timelineWeeks.length === 0) return null;
    return timelineWeeks[currentWeekIndex] || null;
  }, [selectedTimeline, timelineWeeks, currentWeekIndex]);

  // Memoize goal IDs for efficient comparison
  const goalIds = useMemo(() => timelineGoals.map(g => g.id), [timelineGoals]);

  // MODIFIED: This function now accepts the goals array directly to avoid using stale state.
  const fetchWeekActions = async (goalsToFetch: any[]) => {
    console.log('[fetchWeekActions] Called with goals:', goalsToFetch.length);
    if (!selectedTimeline || timelineWeeks.length === 0 || goalsToFetch.length === 0) {
      console.log('[fetchWeekActions] Early return - timeline:', !!selectedTimeline, 'weeks:', timelineWeeks.length, 'goals:', goalsToFetch.length);
      setWeekGoalActions({});
      return;
    }

    const currentWeek = timelineWeeks[currentWeekIndex];
    if (!currentWeek) {
      console.log('[fetchWeekActions] No current week at index:', currentWeekIndex);
      setWeekGoalActions({});
      return;
    }

    console.log('[fetchWeekActions] Fetching for week:', currentWeek.week_number);
    setLoadingWeekActions(true);
    try {
      const goalIds = goalsToFetch.map(g => g.id);
      console.log('[fetchWeekActions] Goal IDs:', goalIds);
      const actions = await fetchGoalActionsForWeek(
        goalIds,
        currentWeek.week_number,
        selectedTimeline,
        timelineWeeks
      );
      console.log('[fetchWeekActions] Actions returned:', JSON.stringify(actions, null, 2));
      setWeekGoalActions(actions);
    } catch (error) {
      console.error('[fetchWeekActions] Error fetching week actions:', error);
      setWeekGoalActions({});
    } finally {
      setLoadingWeekActions(false);
    }
  };

  const fetchTotalGoalProgress = async (goals: any[]) => {
    if (!selectedTimeline || goals.length === 0) {
      setTotalGoalProgress({});
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const progressMap: Record<string, { totalActual: number; totalTarget: number; percentage: number }> = {};

      await Promise.all(
        goals.map(async (goal) => {
          const result = await calculateTotalGoalProgress(
            supabase,
            goal.id,
            goal.goal_type,
            selectedTimeline
          );
          progressMap[goal.id] = result;
        })
      );

      setTotalGoalProgress(progressMap);
    } catch (error) {
      console.error('[fetchTotalGoalProgress] Error:', error);
      setTotalGoalProgress({});
    }
  };

  // MODIFIED: The useEffect now passes the state variable `timelineGoals` to the updated fetchWeekActions.
  useEffect(() => {
    if (selectedTimeline && timelineWeeks.length > 0 && timelineGoals.length > 0) {
      fetchWeekActions(timelineGoals);
      fetchTotalGoalProgress(timelineGoals);
    }
  }, [selectedTimeline, currentWeekIndex, timelineGoals]);

  const handleToggleCompletion = async (actionId: string, date: string, completed: boolean) => {
    if (!selectedTimeline) {
      Alert.alert('Error', 'No timeline selected');
      return;
    }

    const currentWeek = timelineWeeks[currentWeekIndex];
    if (!currentWeek) {
      Alert.alert('Error', 'No current week found');
      return;
    }

    // Find goal and action info before state updates
    let goalIdForAction: string | undefined;
    let weeklyTarget = 0;

    for (const goalId in weekGoalActions) {
      const action = weekGoalActions[goalId]?.find(a => a.id === actionId);
      if (action) {
        goalIdForAction = goalId;
        weeklyTarget = action.weeklyTarget;
        break;
      }
    }

    // Store previous state for rollback on error
    const previousState = { ...weekGoalActions };

    // OPTIMISTIC UI UPDATE - Update immediately
    setWeekGoalActions(prevActions => {
      const updatedActions = { ...prevActions };

      for (const goalId in updatedActions) {
        const goalActions = updatedActions[goalId];
        const actionIndex = goalActions.findIndex(action => action.id === actionId);

        if (actionIndex !== -1) {
          const updatedAction = { ...goalActions[actionIndex] };

          if (completed) {
            // Remove the log optimistically
            updatedAction.logs = updatedAction.logs.filter(log => log.measured_on !== date);
            updatedAction.weeklyActual = Math.max(0, updatedAction.weeklyActual - 1);
          } else {
            // Add the log optimistically
            const logIndex = updatedAction.logs.findIndex(log => log.measured_on === date);
            if (logIndex !== -1) {
              updatedAction.logs[logIndex] = { ...updatedAction.logs[logIndex], completed: true };
            } else {
              updatedAction.logs.push({
                id: `temp-${Date.now()}`,
                task_id: actionId,
                measured_on: date,
                week_number: currentWeek.week_number,
                day_of_week: new Date(date).getDay(),
                value: 1,
                completed: true,
                created_at: toLocalISOString(new Date()),
              });
            }
            updatedAction.weeklyActual = updatedAction.weeklyActual + 1;
          }

          updatedActions[goalId] = [
            ...goalActions.slice(0, actionIndex),
            updatedAction,
            ...goalActions.slice(actionIndex + 1)
          ];

          break;
        }
      }

      return updatedActions;
    });

    // Perform database operations in background
    try {
      console.log('[Goals] Toggling completion (background):', { actionId, date, completed });

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (completed) {
        const result = await handleActionUncompletion(supabase, actionId, date);

        if (!result.success) {
          throw new Error(result.error || 'Failed to uncomplete action');
        }

        console.log('[Goals] Action uncompleted, syncing count');
        const countResult = await getWeeklyCompletionCountWithTarget(
          supabase,
          actionId,
          currentWeek.week_number,
          currentWeek.start_date,
          currentWeek.end_date,
          selectedTimeline
        );

        // Update with actual count from database
        setWeekGoalActions(prevActions => {
          const updatedActions = { ...prevActions };

          for (const goalId in updatedActions) {
            const goalActions = updatedActions[goalId];
            const actionIndex = goalActions.findIndex(action => action.id === actionId);

            if (actionIndex !== -1) {
              const updatedAction = { ...goalActions[actionIndex] };
              updatedAction.weeklyActual = countResult.completedCount;

              updatedActions[goalId] = [
                ...goalActions.slice(0, actionIndex),
                updatedAction,
                ...goalActions.slice(actionIndex + 1)
              ];

              break;
            }
          }

          return updatedActions;
        });

        await syncCompletionAcrossViews(
          supabase,
          actionId,
          goalIdForAction,
          currentWeek.week_number,
          currentWeek.start_date,
          currentWeek.end_date,
          selectedTimeline,
          false
        );
      } else {
        const result = await handleActionCompletion(
          supabase,
          user.id,
          actionId,
          date,
          selectedTimeline,
          weeklyTarget
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to complete action');
        }

        console.log('[Goals] Action completed, syncing count');
        const countResult = await getWeeklyCompletionCountWithTarget(
          supabase,
          actionId,
          currentWeek.week_number,
          currentWeek.start_date,
          currentWeek.end_date,
          selectedTimeline
        );

        // Update with actual count from database
        setWeekGoalActions(prevActions => {
          const updatedActions = { ...prevActions };

          for (const goalId in updatedActions) {
            const goalActions = updatedActions[goalId];
            const actionIndex = goalActions.findIndex(action => action.id === actionId);

            if (actionIndex !== -1) {
              const updatedAction = { ...goalActions[actionIndex] };
              updatedAction.weeklyActual = countResult.completedCount;

              updatedActions[goalId] = [
                ...goalActions.slice(0, actionIndex),
                updatedAction,
                ...goalActions.slice(actionIndex + 1)
              ];

              if (result.shouldRemoveFromUI || countResult.isComplete) {
                updatedActions[goalId] = updatedActions[goalId].filter(a => a.id !== actionId);
              }

              break;
            }
          }

          return updatedActions;
        });

        await syncCompletionAcrossViews(
          supabase,
          actionId,
          goalIdForAction,
          currentWeek.week_number,
          currentWeek.start_date,
          currentWeek.end_date,
          selectedTimeline,
          true
        );
      }

      console.log('[Goals] Refreshing score and total goal progress');
      // Small delay to ensure all database writes (including RPC joins) complete
      await new Promise(resolve => setTimeout(resolve, 200));
      await refreshScore(true);
      if (selectedTimeline) {
        await fetchTotalGoalProgress(timelineGoals);
      }
    } catch (error) {
      console.error('[Goals] Error toggling completion:', error);

      // ROLLBACK - Restore previous state on error
      setWeekGoalActions(previousState);

      Alert.alert('Error', (error as Error).message || 'Failed to update completion status');
    }
  };

  // Undo state for delete operations
  const [undoState, setUndoState] = useState<{
    taskId: string;
    weekNumber?: number;
    deleteType: 'week' | 'all';
    timeout: any;
  } | null>(null);

  // Delete confirmation modal state
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteActionData, setDeleteActionData] = useState<{ actionId: string; weekNumber: number } | null>(null);

  // Undo confirmation modal state
  const [undoConfirmVisible, setUndoConfirmVisible] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');

  const handleDeleteAction = async (actionId: string, weekNumber: number) => {
    if (!selectedTimeline) return;

    setDeleteActionData({ actionId, weekNumber });
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDeleteWeek = async () => {
    if (!deleteActionData || !selectedTimeline) return;

    const { actionId, weekNumber } = deleteActionData;
    setDeleteConfirmVisible(false);

    try {
      await deleteTaskWeekPlan(actionId, weekNumber, selectedTimeline as any);

      // Refresh the data
      const newGoals = await fetchTimelineGoals(selectedTimeline);
      await fetchWeekActions(newGoals);

      // Set up undo with timeout
      const timeout = setTimeout(() => {
        setUndoState(null);
      }, 5000);

      setUndoState({
        taskId: actionId,
        weekNumber,
        deleteType: 'week',
        timeout,
      });

      setUndoMessage('Action removed from this week only.');
      setUndoConfirmVisible(true);
    } catch (error) {
      console.error('Error deleting action for week:', error);
      if (Platform.OS === 'web') {
        window.alert((error as Error).message || 'Failed to delete action');
      } else {
        Alert.alert('Error', (error as Error).message || 'Failed to delete action');
      }
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!deleteActionData || !selectedTimeline) return;

    const { actionId } = deleteActionData;
    setDeleteConfirmVisible(false);

    try {
      await deleteTask(actionId);

      // Refresh the data
      const newGoals = await fetchTimelineGoals(selectedTimeline);
      await fetchWeekActions(newGoals);

      // Set up undo with timeout
      const timeout = setTimeout(() => {
        setUndoState(null);
      }, 5000);

      setUndoState({
        taskId: actionId,
        deleteType: 'all',
        timeout,
      });

      setUndoMessage('Action removed from all weeks.');
      setUndoConfirmVisible(true);
    } catch (error) {
      console.error('Error deleting action:', error);
      if (Platform.OS === 'web') {
        window.alert((error as Error).message || 'Failed to delete action');
      } else {
        Alert.alert('Error', (error as Error).message || 'Failed to delete action');
      }
    }
  };


  const handleUndoDelete = async () => {
    if (!undoState || !selectedTimeline) return;

    try {
      // Clear the timeout
      clearTimeout(undoState.timeout);

      if (undoState.deleteType === 'week' && undoState.weekNumber) {
        await undoDeleteTaskWeekPlan(undoState.taskId, undoState.weekNumber, selectedTimeline as any);
      } else {
        await undoDeleteTask(undoState.taskId);
      }

      // Refresh the data
      const newGoals = await fetchTimelineGoals(selectedTimeline);
      await fetchWeekActions(newGoals);

      setUndoState(null);
      Alert.alert('Success', 'Action restored successfully!');
    } catch (error) {
      console.error('Error undoing delete:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to restore action');
    }
  };

  // Modal states
  const [createGoalModalVisible, setCreateGoalModalVisible] = useState(false);
  const [editGoalModalVisible, setEditGoalModalVisible] = useState(false);
  const [actionEffortModalVisible, setActionEffortModalVisible] = useState(false);
  const [manageCustomTimelinesModalVisible, setManageCustomTimelinesModalVisible] = useState(false);
  const [manageGlobalTimelinesModalVisible, setManageGlobalTimelinesModalVisible] = useState(false);
  const [withdrawalFormVisible, setWithdrawalFormVisible] = useState(false);
  
  // Selected items
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<any>(null);
  const [actionModalMode, setActionModalMode] = useState<'create' | 'edit'>('create');
  const [editingAction, setEditingAction] = useState<any>(null);
  const [editingActionGoal, setEditingActionGoal] = useState<any>(null);

  // Timeline and goals state now managed by reducer above (see line 38)

  // Refs for initialization
  const initializedWeekRef = useRef(false);
  const lastSelectedTimelineIdRef = useRef<string | null>(null);
  const timelinesLoadedRef = useRef(false);
  const timelinesDataCache = useRef<any[]>([]);
  
  // Use the goals hook with timeline scope
  const {
    loading,
    allGoals,
    refreshGoals,
    refreshAllData,
    createTwelveWeekGoal,
    createCustomGoal,
    createTaskWithWeekPlan,
    deleteTask,
    deleteTaskWeekPlan,
    deleteGoal,
    undoDeleteTask,
    undoDeleteTaskWeekPlan,
  } = useGoals();


  // Soft reset - clears selected timeline but preserves timeline list
  const softResetToTimelines = useCallback(() => {
    setActiveTab('goals');
    setSelectedTimeline(null);
    setCurrentWeekIndex(0);
    setTimelineWeeks([]);
    setTimelineGoals([]);
    setTimelineGoalProgress({});
    setTotalGoalProgress({});
    setWeekGoalActions({});
    setLoadingWeekActions(false);
    setTimelineDaysLeft(null);
    setExpandedGoals({});
    setSelectedGoal(null);
    setSelectedGoalForAction(null);
    setEditingAction(null);
    setEditingActionGoal(null);
    setActionModalMode('create');
    setCreateGoalModalVisible(false);
    setEditGoalModalVisible(false);
    setActionEffortModalVisible(false);
    setManageCustomTimelinesModalVisible(false);
    setManageGlobalTimelinesModalVisible(false);
    setWithdrawalFormVisible(false);
    setNorthStarEditorVisible(false);
    setNorthStarInitialSection('mission');
    setDeleteConfirmVisible(false);
    setDeleteActionData(null);
    setUndoConfirmVisible(false);
    setUndoMessage('');
    setUndoState(prev => {
      if (prev?.timeout) {
        clearTimeout(prev.timeout);
      }
      return null;
    });
    initializedWeekRef.current = false;
    // Restore cached timelines if available
    if (timelinesDataCache.current.length > 0) {
      setTimelinesWithGoals(timelinesDataCache.current);
    }
    // Don't clear timelinesLoadedRef or lastSelectedTimelineIdRef - we want to keep them
  }, []);

  // Full reset - clears everything (used on unmount)
  const resetToMain = useCallback(() => {
    softResetToTimelines();
    setTimelinesWithGoals([]);
    timelinesLoadedRef.current = false;
    timelinesDataCache.current = [];
    lastSelectedTimelineIdRef.current = null;
  }, [softResetToTimelines]);

  useEffect(() => {
    console.log('[Goals] Component mounted, initializing...');
    // Register soft reset for tab press
    registerResetHandler('goals', softResetToTimelines);

    const initializeGoals = async () => {
      try {
        await fetchAllTimelines();
        fetchFormDataCache();
        refreshScore();
        fetchNorthStarData();
      } catch (error) {
        console.error('[Goals] Error in initialization:', error);
      }
    };

    initializeGoals();

    // Cleanup undo timeout on unmount
    return () => {
      unregisterResetHandler('goals');
      if (undoState?.timeout) {
        clearTimeout(undoState.timeout);
      }
      // Full reset on unmount
      resetToMain();
    };
  }, [registerResetHandler, unregisterResetHandler, softResetToTimelines, resetToMain]);

  // Parallel fetch all timeline data when timeline is selected
  useEffect(() => {
    if (selectedTimeline) {
      // Store the last selected timeline ID
      lastSelectedTimelineIdRef.current = selectedTimeline.id;

      // Fetch all timeline data in parallel for better performance
      Promise.all([
        fetchTimelineGoals(selectedTimeline),
        fetchTimelineWeeks(selectedTimeline),
        fetchTimelineDaysLeft(selectedTimeline)
      ]).catch(error => {
        console.error('[Goals] Error loading timeline data:', error);
      });
    }
  }, [selectedTimeline]);

  // Initialize all goals as expanded when timeline goals are fetched
  useEffect(() => {
    if (timelineGoals.length > 0) {
      const initialExpandedState: Record<string, boolean> = {};
      timelineGoals.forEach(goal => {
        if (expandedGoals[goal.id] === undefined) {
          initialExpandedState[goal.id] = true;
        }
      });
      if (Object.keys(initialExpandedState).length > 0) {
        setExpandedGoals(prev => ({ ...prev, ...initialExpandedState }));
      }
    }
  }, [timelineGoals]);

  // Set current week index when timeline weeks are loaded
  useEffect(() => {
    if (timelineWeeks.length > 0) {
      const currentWeekIndex = getCurrentWeekIndex();
      setCurrentWeekIndex(currentWeekIndex);
    }
  }, [timelineWeeks]);

  const getCurrentWeekIndex = () => {
    if (timelineWeeks.length === 0) return 0;

    const today = formatLocalDate(new Date());

    // Find the week that contains today's date
    const currentWeekIndex = timelineWeeks.findIndex(week =>
      today >= week.start_date && today <= week.end_date
    );
    
    // If today is before the timeline starts, show week 0
    if (currentWeekIndex === -1) {
      if (today < timelineWeeks[0].start_date) {
        return 0;
      }
      // If today is after the timeline ends, show the last week
      return timelineWeeks.length - 1;
    }
    
    return currentWeekIndex;
  };


  const fetchAllTimelines = useCallback(async () => {
    console.log('[Goals] fetchAllTimelines called');
    setLoadingTimelines(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Goals] No authenticated user found');
        setLoadingTimelines(false);
        return;
      }

      console.log('[Goals] Fetching timelines for user:', user.id);
      const timelines: Timeline[] = [];

      // Fetch custom timelines
      console.log('[Goals] Querying custom timelines...');
      const { data: customData, error: customError } = await supabase
        .from('0008-ap-custom-timelines')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      console.log('[Goals] Custom timelines query result:', {
        data: customData,
        error: customError,
        count: customData?.length || 0
      });
      if (customError) throw customError;

      if (customData) {
        customData.forEach(timeline => {
          timelines.push({
            id: timeline.id,
            source: 'custom',
            title: timeline.title,
            start_date: timeline.start_date,
            end_date: timeline.end_date,
            timeline_type: timeline.timeline_type,
          });
        });
        console.log('[Goals] Added', customData.length, 'custom timelines');
      }

      // Fetch global timelines
      console.log('[Goals] Querying global timelines...');
      const { data: globalData, error: globalError } = await supabase
        .from('0008-ap-user-global-timelines')
        .select(`
          id,
          user_id,
          global_cycle_id,
          status,
          week_start_day,
          activated_at,
          created_at,
          updated_at,
          title,
          start_date,
          end_date,
          global_cycle:0008-ap-global-cycles(
            id,
            title,
            cycle_label,
            start_date,
            end_date
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      console.log('[Goals] Global timelines query result:', {
        data: globalData,
        error: globalError,
        count: globalData?.length || 0,
        timelines: globalData?.map(t => ({
          id: t.id,
          cycle_id: t.global_cycle_id,
          title: t.global_cycle?.title || t.global_cycle?.cycle_label
        }))
      });

      if (globalError) throw globalError;

      if (globalData) {
        globalData.forEach(timeline => {
          // Use snapshot data if global_cycle join failed
          const title = timeline.global_cycle?.title
            || timeline.global_cycle?.cycle_label
            || timeline.title
            || 'Global Timeline';
          const startDate = timeline.global_cycle?.start_date
            || timeline.start_date
            || '';
          const endDate = timeline.global_cycle?.end_date
            || timeline.end_date
            || '';

          timelines.push({
            id: timeline.id,
            source: 'global',
            title: title,
            start_date: startDate,
            end_date: endDate,
            global_cycle_id: timeline.global_cycle_id ?? timeline.global_cycle?.id,
            global_cycle: timeline.global_cycle || null,
          });
        });
        console.log('[Goals] Added', globalData.length, 'global timelines');
      }

      console.log('[Goals] Total timelines:', timelines.length);
      setAllTimelines(timelines);

      console.log('[Goals] Hydrated timelines:', timelines.map(t => ({
        id: t.id,
        source: t.source,
        title: t.title,
        start_date: t.start_date,
        end_date: t.end_date
      })));

      // Fetch goal counts for each timeline
      console.log('[Goals] Fetching goal counts...');
      await fetchTimelinesWithGoalCounts(timelines);
      console.log('[Goals] fetchAllTimelines complete');

      // Mark timelines as loaded
      timelinesLoadedRef.current = true;
      setLoadingTimelines(false);

    } catch (error) {
      console.error('[Goals] Error fetching timelines:', error);
      setLoadingTimelines(false);
      Alert.alert('Error', (error as Error).message);
    }
  }, []); // Memoized with empty deps - only fetches from server

  const fetchFormDataCache = async () => {
    if (formDataCache.loaded) return; // Already loaded, skip

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: rolesData },
        { data: domainsData },
        { data: krData },
        { data: oneYearGoalsData }
      ] = await Promise.all([
        supabase.from('0008-ap-roles')
          .select('id, label, color')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('label'),
        supabase.from('0008-ap-domains')
          .select('id, name')
          .order('name'),
        supabase.from('0008-ap-key-relationships')
          .select('id, name, role_id')
          .eq('user_id', user.id),
        supabase.from('0008-ap-goals-1y')
          .select('id, title, year_target_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('title')
      ]);

      setFormDataCache({
        roles: rolesData || [],
        domains: domainsData || [],
        keyRelationships: krData || [],
        oneYearGoals: oneYearGoalsData || [],
        loaded: true
      });
    } catch (error) {
      console.error('Error fetching form data cache:', error);
    }
  };

  const fetchTimelinesWithGoalCounts = async (timelines: Timeline[]) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timelinesWithCounts = await Promise.all(
        timelines.map(async (timeline) => {
          let goalCount = 0;
          let daysRemaining = 0;

          // Calculate days remaining
          if (timeline.start_date && timeline.end_date) {
            const now = new Date();
            const endDate = new Date(timeline.end_date);
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }

          // Get goal count based on timeline source
          if (timeline.source === 'global') {
            // Count 12-week goals for global timelines
            const globalCycleId = timeline.global_cycle_id ?? timeline.global_cycle?.id;
            const orFilter = globalCycleId
              ? `user_global_timeline_id.eq.${timeline.id},global_cycle_id.eq.${globalCycleId}`
              : `user_global_timeline_id.eq.${timeline.id}`;

            const { data: twelveWeekGoals, error } = await supabase
              .from('0008-ap-goals-12wk')
              .select('id')
              .eq('user_id', user.id)
              .or(orFilter)
              .eq('status', 'active');

            if (!error) {
              goalCount = twelveWeekGoals?.length || 0;
            }
          } else if (timeline.source === 'custom') {
            // Count custom goals for custom timelines
            console.log('Fetching custom goals for timeline:', {
              timelineId: timeline.id,
              timelineSource: timeline.source,
              userId: user.id
            });
            
            const { data: customGoals, error } = await supabase
              .from('0008-ap-goals-custom')
              .select('id')
              .eq('user_id', user.id)
              .eq('custom_timeline_id', timeline.id)
              .eq('status', 'active');

            console.log('Custom goals query result:', {
              data: customGoals,
              error: error,
              count: customGoals?.length || 0
            });
            if (!error) {
              goalCount = customGoals?.length || 0;
            }
          }

          return {
            ...timeline,
            goalCount,
            daysRemaining,
          };
        })
      );

      setTimelinesWithGoals(timelinesWithCounts);
      // Cache the timeline data
      timelinesDataCache.current = timelinesWithCounts;
    } catch (error) {
      console.error('Error fetching timeline goal counts:', error);
    }
  };

  // MODIFIED: This function now returns the fetched goals to be used in the refresh chain.
  const fetchTimelineGoals = async (timeline: Timeline) => {
    if (!timeline) {
      setTimelineGoals([]);
      setTimelineGoalProgress({});
      return [];
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let goalsData: any[] = [];

      if (timeline.source === 'global') {
        const { data, error } = await supabase
          .from('0008-ap-goals-12wk')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_global_timeline_id', timeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          goalsData = data.map(goal => ({ ...goal, goal_type: '12week' }));
        } else {
          const globalCycleId = timeline.global_cycle_id || timeline.global_cycle?.id;
          if (globalCycleId) {
            const { data: fallbackData } = await supabase
              .from('0008-ap-goals-12wk')
              .select('*')
              .eq('user_id', user.id)
              .eq('global_cycle_id', globalCycleId)
              .eq('status', 'active')
              .order('created_at', { ascending: false });
            if (fallbackData) {
              goalsData = fallbackData.map(goal => ({ ...goal, goal_type: '12week' }));
            }
          }
        }
      } else if (timeline.source === 'custom') {
        const { data, error } = await supabase
          .from('0008-ap-goals-custom')
          .select('*')
          .eq('user_id', user.id)
          .eq('custom_timeline_id', timeline.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (error) throw error;
        goalsData = (data || []).map(goal => ({ ...goal, goal_type: 'custom' }));
      }

      if (goalsData.length === 0) {
        setTimelineGoals([]);
        setTimelineGoalProgress({});
        return [];
      }

      const goalIds = goalsData.map(g => g.id);

      console.log('[fetchTimelineGoals] Fetching associations for goal IDs:', goalIds);
      console.log('[fetchTimelineGoals] Timeline source:', timeline.source);

      const [
        { data: rolesData, error: rolesError },
        { data: domainsData, error: domainsError },
        { data: krData, error: krError }
      ] = await Promise.all([
        supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label, color)').in('parent_id', goalIds).in('parent_type', ['twelve_wk_goal', 'custom_goal']),
        supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', goalIds).in('parent_type', ['twelve_wk_goal', 'custom_goal']),
        supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', goalIds).in('parent_type', ['twelve_wk_goal', 'custom_goal'])
      ]);

      console.log('[fetchTimelineGoals] Roles data:', rolesData);
      console.log('[fetchTimelineGoals] Domains data:', domainsData);
      console.log('[fetchTimelineGoals] Key Relationships data:', krData);

      if (rolesError || domainsError || krError) throw rolesError || domainsError || krError;

      const goalsWithData = goalsData.map(goal => {
        const goalRoles = rolesData?.filter(r => r.parent_id === goal.id).map(r => r.role).filter(Boolean) || [];
        const goalDomains = domainsData?.filter(d => d.parent_id === goal.id).map(d => d.domain).filter(Boolean) || [];
        const goalKRs = krData?.filter(kr => kr.parent_id === goal.id).map(kr => kr.key_relationship).filter(Boolean) || [];

        console.log(`[fetchTimelineGoals] Goal ${goal.id} (${goal.title}):`, {
          goal_type: goal.goal_type,
          roles: goalRoles.length,
          domains: goalDomains.length,
          keyRelationships: goalKRs.length
        });

        return {
          ...goal,
          roles: goalRoles,
          domains: goalDomains,
          keyRelationships: goalKRs,
        };
      });

      setTimelineGoals(goalsWithData);
      setTimelineGoalProgress({});
      return goalsWithData;

    } catch (error) {
      console.error('Error fetching timeline goals:', error);
      Alert.alert('Error', `Failed to fetch goals: ${(error as Error).message}`);
      setTimelineGoals([]);
      setTimelineGoalProgress({});
      return [];
    }
  };

  const fetchTimelineWeeks = async (timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();
      const { data: weeks, error } = await supabase
        .from('v_unified_timeline_weeks')
        .select('week_number, week_start, week_end, timeline_id, source')
        .eq('timeline_id', timeline.id)
        .eq('source', timeline.source)
        .order('week_number', { ascending: true });
      if (error) throw error;
      const normalizedWeeks = (weeks || []).map(week => ({
        week_number: week.week_number,
        start_date: week.week_start,
        end_date: week.week_end,
      }));
      setTimelineWeeks(normalizedWeeks);
    } catch (error) {
      console.error('Error fetching timeline weeks:', error);
      setTimelineWeeks([]);
    }
  };

  const fetchTimelineDaysLeft = async (timeline: Timeline) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('v_unified_timeline_days_left')
        .select('timeline_id, days_left, pct_elapsed, source')
        .eq('timeline_id', timeline.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setTimelineDaysLeft(data);
    } catch (error) {
      console.error('Error fetching timeline days left:', error);
      setTimelineDaysLeft(null);
    }
  };

  const handleTimelineSelect = (timeline: Timeline) => {
    console.log('[Goals] Timeline selected:', timeline.title);
    setSelectedTimeline(timeline);
    setCurrentWeekIndex(0);
    // Store for future restoration
    lastSelectedTimelineIdRef.current = timeline.id;
  };

  const handleBackToTimelines = () => {
    setSelectedTimeline(null);
    setTimelineGoals([]);
    setTimelineWeeks([]);
    setTimelineDaysLeft(null);
    setWeekGoalActions({});
    setExpandedGoals({});
  };

  // toggleGoalExpanded is now defined above using useCallback and dispatch

  const handleEditAction = (action: any, goal: any) => {
    console.log('[handleEditAction] Editing action:', action);
    console.log('[handleEditAction] Goal:', goal);
    setEditingAction(action);
    setEditingActionGoal(goal);
    setActionModalMode('edit');
    setActionEffortModalVisible(true);
  };

  const fetchNorthStarData = async () => {
    setLoadingNorthStar(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      console.log('[fetchNorthStarData] Starting fetch, user:', user?.id);

      if (!user) {
        console.log('[fetchNorthStarData] No user found');
        return;
      }

      const { data: userData, error: userError } = await supabase
  .from('0008-ap-north-star')
  .select('mission_statement, "5yr_vision"')
  .eq('user_id', user.id)
  .maybeSingle();

      console.log('[fetchNorthStarData] User data query result:', { userData, userError });

      if (userError) {
        console.error('[fetchNorthStarData] Error fetching user data:', userError);
        throw userError;
      }

      const { data: oneYearGoals, error: goalsError } = await supabase
        .from('0008-ap-goals-1y')
        .select('id, title, description, status, year_target_date, priority')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: true });

      console.log('[fetchNorthStarData] Goals query result:', { goalsCount: oneYearGoals?.length, goalsError });

      if (goalsError) {
        console.error('[fetchNorthStarData] Error fetching goals:', goalsError);
        throw goalsError;
      }

      const northStarResult = {
  mission_text: userData?.mission_statement || '',
  vision_text: userData?.['5yr_vision'] || '',
        vision_timeframe: '5_year',
        oneYearGoals: oneYearGoals || [],
      };

      console.log('[fetchNorthStarData] Setting North Star data:', {
        hasMission: !!northStarResult.mission_text,
        hasVision: !!northStarResult.vision_text,
        goalsCount: northStarResult.oneYearGoals.length
      });

      setNorthStarData(northStarResult);
    } catch (error) {
      console.error('[fetchNorthStarData] Caught error:', error);
      setNorthStarData({
        mission_text: '',
        vision_text: '',
        vision_timeframe: '5_year',
        oneYearGoals: [],
      });
    } finally {
      setLoadingNorthStar(false);
    }
  };

  const handleNavigateToSettings = () => {
    router.push('/settings');
  };

  const handleOpenNorthStarEditor = (section: 'mission' | 'vision' | 'goals' = 'mission') => {
    setNorthStarInitialSection(section);
    setNorthStarEditorVisible(true);
  };

  const handleCloseNorthStarEditor = () => {
    setNorthStarEditorVisible(false);
    fetchNorthStarData();
  };

  const handleGoalPress = useCallback((goal: UnifiedGoal) => {
    console.log('Goal pressed:', goal.id, goal.title);
    setSelectedGoalForDetail(goal);
  }, []);

  const handleCloseGoalDetail = useCallback(() => {
    setSelectedGoalForDetail(null);
  }, []);

  const handleGoalDetailUpdated = useCallback(() => {
    setMyGoalsRefreshTrigger(prev => prev + 1);
    refreshScore(true);
  }, [refreshScore]);

  const handleAddActionFromGoalDetail = useCallback(() => {
    setCreateGoalModalVisible(true);
  }, []);

  const renderTimelinesTab = () => (
    <View style={styles.content} pointerEvents="box-none">
      <MyGoalsView
        onGoalPress={handleGoalPress}
        refreshTrigger={myGoalsRefreshTrigger}
      />
    </View>
  );

  const renderNorthStarTab = () => (
    <View style={styles.content} pointerEvents="box-none">
      <NorthStarQuickView
        data={northStarData}
        loading={loadingNorthStar}
        onEditMission={() => handleOpenNorthStarEditor('mission')}
        onEditVision={() => handleOpenNorthStarEditor('vision')}
        onEditGoals={() => handleOpenNorthStarEditor('goals')}
      />
    </View>
  );

  const renderManageTab = () => (
    <ManageTimelinesView
      onUpdate={() => {
        setMyGoalsRefreshTrigger(prev => prev + 1);
        fetchAllTimelines();
        if (selectedTimeline) {
          fetchTimelineGoals(selectedTimeline);
        }
      }}
    />
  );

  const renderSelectedTimeline = () => {
    if (!selectedTimeline) return null;

    const currentWeek = timelineWeeks[currentWeekIndex];
    const weekGoalActionsForWeek = weekGoalActions || {};

    return (
      <View style={styles.content} pointerEvents="box-none">

        {/* Week Navigation */}
        {timelineWeeks.length > 0 && (
          <View style={styles.weekNavigationContainer}>
            <View style={styles.weekNavigation}>
              <TouchableOpacity
                style={[styles.weekNavButton, currentWeekIndex === 0 && styles.weekNavButtonDisabled]}
                onPress={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
                disabled={currentWeekIndex === 0}
              >
                <ChevronLeft size={20} color={currentWeekIndex === 0 ? '#9ca3af' : '#0078d4'} />
              </TouchableOpacity>

              <View style={styles.weekInfo}>
                <Text style={styles.weekTitle}>
                  Week {currentWeek?.week_number || 1}
                </Text>
                {currentWeek && (
                  <Text style={styles.weekDates}>
                    {formatDateDisplay(currentWeek.start_date)} - {formatDateDisplay(currentWeek.end_date)}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.weekNavButton, currentWeekIndex === timelineWeeks.length - 1 && styles.weekNavButtonDisabled]}
                onPress={() => setCurrentWeekIndex(Math.min(timelineWeeks.length - 1, currentWeekIndex + 1))}
                disabled={currentWeekIndex === timelineWeeks.length - 1}
              >
                <ChevronRight size={20} color={currentWeekIndex === timelineWeeks.length - 1 ? '#9ca3af' : '#0078d4'} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {timelineGoals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No goals found for this timeline</Text>
            <TouchableOpacity
              style={styles.createGoalButton}
              onPress={() => setCreateGoalModalVisible(true)}
            >
              <Plus size={20} color="#ffffff" />
              <Text style={styles.createGoalButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={timelineGoals}
            keyExtractor={(goal) => goal.id}
            renderItem={({ item: goal }) => {
              const totalProgress = totalGoalProgress[goal.id] || { totalActual: 0, totalTarget: 0, percentage: 0 };
              const progress = timelineGoalProgress[goal.id] || {
                currentWeek: currentWeek?.week_number || 1,
                daysRemaining: timelineDaysLeft?.days_left || 0,
                weeklyActual: 0,
                weeklyTarget: goal.weekly_target || 0,
                overallActual: 0,
                overallTarget: goal.total_target || 0,
                overallProgress: totalProgress.percentage,
                totalActual: totalProgress.totalActual,
                totalTarget: totalProgress.totalTarget,
              };

              return (
                <GoalProgressCard
                  key={goal.id}
                  goal={goal}
                  progress={progress}
                  expanded={expandedGoals[goal.id] !== false}
                  week={currentWeek ? {
                    weekNumber: currentWeek.week_number,
                    startDate: currentWeek.start_date,
                    endDate: currentWeek.end_date,
                  } : null}
                  weekActions={weekGoalActionsForWeek[goal.id] || []}
                  loadingWeekActions={loadingWeekActions}
                  onAddAction={() => {
                    if (!selectedTimeline) {
                      Alert.alert('Error', 'Please select a timeline first.');
                      return;
                    }

                    // Validate goal type matches timeline source
                    if (goal.goal_type === '12week' && selectedTimeline.source !== 'global') {
                      Alert.alert('Error', '12-week goals can only be used with global timelines.');
                      return;
                    }

                    if (goal.goal_type === 'custom' && selectedTimeline.source !== 'custom') {
                      Alert.alert('Error', 'Custom goals can only be used with custom timelines.');
                      return;
                    }

                    setSelectedGoalForAction(goal);
                    setActionModalMode('create');
                    setEditingAction(null);
                    setEditingActionGoal(null);
                    setActionEffortModalVisible(true);
                  }}
                  onEdit={() => {
                    setSelectedGoal(goal);
                    setEditGoalModalVisible(true);
                  }}
                  selectedWeekNumber={currentWeek?.week_number}
                  onToggleCompletion={handleToggleCompletion}
                  onEditAction={(action) => handleEditAction(action, goal)}
                  onDeleteAction={handleDeleteAction}
                  onToggleExpanded={() => toggleGoalExpanded(goal.id)}
                />
              );
            }}
            style={styles.goalsList}
            contentContainerStyle={styles.goalsListContent}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={true}
            getItemLayout={(data, index) => ({
              length: 300, // Approximate height of GoalProgressCard
              offset: 300 * index,
              index,
            })}
          />
        )}
      </View>
    );
  };

  const renderMainContent = () => {
    // Show selected timeline if one is selected
    if (selectedTimeline) {
      return renderSelectedTimeline();
    }

    // Show manage timelines tab
    if (activeTab === 'manage-timelines') {
      return renderManageTab();
    }

    // For goals tab, if we have loaded timelines and auto-selected one,
    // it will be shown above. Otherwise show the timeline list.
    return renderTimelinesTab();
  };

  return (
    <SafeAreaView style={styles.container}>
      <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />
      <GoalBankTabbedHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        authenticScore={authenticScore}
        showBackButton={!!selectedTimeline}
        onBackPress={handleBackToTimelines}
        timelineTitle={selectedTimeline?.title}
        daysRemaining={timelineDaysLeft?.days_left}
        cycleProgressPercentage={timelineDaysLeft?.pct_elapsed}
        backgroundColor="#f8fafc"
        isSubHeader={true}
      />

      {renderMainContent()}

      {/* FAB for creating goals - show when on goals tab or viewing a timeline */}
      {(activeTab === 'goals' || selectedTimeline) && (
        <DraggableFab onPress={() => {
  console.log('[Goals] FAB pressed, opening CreateGoalModal');
  setCreateGoalModalVisible(true);
}} size={44} backgroundColor="#10b981">
  <Plus size={28} color="#ffffff" />
</DraggableFab>
      )}

      {/* Modals */}
      <Suspense fallback={null}>
        <CreateGoalModal
          visible={createGoalModalVisible}
          onClose={() => setCreateGoalModalVisible(false)}
          onSubmitSuccess={() => {
            setCreateGoalModalVisible(false);
            setMyGoalsRefreshTrigger(prev => prev + 1);
            if (selectedTimeline) {
              fetchTimelineGoals(selectedTimeline);
            }
            fetchAllTimelines();
          }}
          createTwelveWeekGoal={createTwelveWeekGoal}
          createCustomGoal={createCustomGoal}
          selectedTimeline={selectedTimeline}
          allTimelines={allTimelines}
          cachedRoles={formDataCache.roles}
          cachedDomains={formDataCache.domains}
          cachedKeyRelationships={formDataCache.keyRelationships}
          cachedOneYearGoals={formDataCache.oneYearGoals}
        />

        <EditGoalModal
          visible={editGoalModalVisible}
          onClose={() => setEditGoalModalVisible(false)}
          onUpdate={() => {
            setEditGoalModalVisible(false);
            setMyGoalsRefreshTrigger(prev => prev + 1);
            if (selectedTimeline) {
              fetchTimelineGoals(selectedTimeline);
            }
            fetchAllTimelines();
          }}
          goal={selectedGoal}
          deleteGoal={deleteGoal}
        />

        <ActionEffortModal
          visible={actionEffortModalVisible}
          onClose={async () => { // MODIFIED: The handler is now async.
            console.log('[Goals] ActionEffortModal onClose - starting refresh');
            setActionEffortModalVisible(false);
            setEditingAction(null);
            setEditingActionGoal(null);
            setActionModalMode('create');
            // MODIFIED: This logic now chains the fetches to prevent race conditions.
            if (selectedTimeline) {
              console.log('[Goals] Fetching timeline goals for:', selectedTimeline.id);
              const newGoals = await fetchTimelineGoals(selectedTimeline);
              console.log('[Goals] Timeline goals fetched, count:', newGoals.length);
              console.log('[Goals] Fetching week actions for goals:', newGoals.map(g => g.id));
              await fetchWeekActions(newGoals);
              await fetchTotalGoalProgress(newGoals);
              console.log('[Goals] Week actions and total progress fetch completed');
            }
          }}
          goal={actionModalMode === 'create' ? selectedGoalForAction : editingActionGoal}
          cycleWeeks={timelineWeeks}
          timeline={selectedTimeline}
          createTaskWithWeekPlan={createTaskWithWeekPlan}
          initialData={editingAction}
          mode={actionModalMode}
        />

        <ManageCustomTimelinesModal
          visible={manageCustomTimelinesModalVisible}
          onClose={() => setManageCustomTimelinesModalVisible(false)}
          onUpdate={async () => {
            console.log('[Goals] ManageCustomTimelinesModal onUpdate called');
            setMyGoalsRefreshTrigger(prev => prev + 1);
            await fetchAllTimelines();
            if (selectedTimeline) {
              console.log('[Goals] Refreshing selected timeline goals');
              await fetchTimelineGoals(selectedTimeline);
            }
            console.log('[Goals] Custom timeline update complete');
          }}
        />

        <ManageGlobalTimelinesModal
          visible={manageGlobalTimelinesModalVisible}
          onClose={() => setManageGlobalTimelinesModalVisible(false)}
          onUpdate={async () => {
            console.log('[Goals] ManageGlobalTimelinesModal onUpdate called');
            setMyGoalsRefreshTrigger(prev => prev + 1);
            await fetchAllTimelines();
            if (selectedTimeline) {
              console.log('[Goals] Refreshing selected timeline goals');
              await fetchTimelineGoals(selectedTimeline);
            }
            console.log('[Goals] Global timeline update complete');
          }}
        />

        <WithdrawalForm
          visible={withdrawalFormVisible}
          onClose={() => setWithdrawalFormVisible(false)}
          onSubmitSuccess={() => {
            setWithdrawalFormVisible(false);
            refreshScore(true);
          }}
        />
      </Suspense>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalTitle}>Delete Action</Text>
              <TouchableOpacity onPress={() => setDeleteConfirmVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.deleteModalMessage}>
              Choose how to delete this action:
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalButton}
                onPress={handleConfirmDeleteWeek}
              >
                <Minus size={16} color="#ffffff" />
                <Text style={styles.deleteModalButtonText}>This Week Only</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonDanger]}
                onPress={handleConfirmDeleteAll}
              >
                <Minus size={16} color="#ffffff" />
                <Text style={styles.deleteModalButtonText}>All Weeks</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={styles.deleteModalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo Confirmation Modal */}
      <Modal
        visible={undoConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUndoConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalTitle}>Action Deleted</Text>
              <TouchableOpacity onPress={() => setUndoConfirmVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.deleteModalMessage}>
              {undoMessage}
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalButton}
                onPress={() => {
                  setUndoConfirmVisible(false);
                  handleUndoDelete();
                }}
              >
                <Text style={styles.deleteModalButtonText}>Undo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                onPress={() => setUndoConfirmVisible(false)}
              >
                <Text style={styles.deleteModalButtonCancelText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* North Star Editor Modal */}
      <Modal visible={northStarEditorVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>North Star</Text>
            <TouchableOpacity onPress={handleCloseNorthStarEditor}>
              <Text style={styles.closeModalButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <NorthStarEditor
            onUpdate={handleCloseNorthStarEditor}
            initialSection={northStarInitialSection}
          />
        </SafeAreaView>
      </Modal>

{/* Settings Sidebar */}
      <SettingsSidebar
        visible={settingsSidebarVisible}
        onClose={() => setSettingsSidebarVisible(false)}
      />
      
      {/* Goal Detail View Modal */}
      {selectedGoalForDetail && (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <GoalDetailView
            goal={selectedGoalForDetail}
            onClose={handleCloseGoalDetail}
            onGoalUpdated={handleGoalDetailUpdated}
            onAddAction={handleAddActionFromGoalDetail}
            authenticScore={authenticScore}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  timelinesList: {
    flex: 1,
    padding: 16,
  },
  timelinesGrid: {
    gap: 12,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  timelineType: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timelineTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  timelineStats: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  timelineDates: {
    fontSize: 12,
    color: '#9ca3af',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  timelineButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  createTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6b7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createTimelineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  createGlobalTimelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createGlobalTimelineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  weekNavigationContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
  },
  weekNavButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  weekNavButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  weekDates: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  goalsList: {
    flex: 1,
  },
  goalsListContent: {
    paddingBottom: 20,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createGoalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModal: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  deleteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 24,
  },
  deleteModalButtons: {
    gap: 12,
  },
  deleteModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  deleteModalButtonDanger: {
    backgroundColor: '#dc2626',
  },
  deleteModalButtonCancel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  deleteModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalButtonCancelText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeModalButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0078d4',
  },
});
