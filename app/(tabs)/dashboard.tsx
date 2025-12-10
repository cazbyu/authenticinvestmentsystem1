import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { X, Plus, CreditCard as Edit, UserX, Ban } from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Header } from '@/components/Header';
import { Task, TaskCard } from '@/components/tasks/TaskCard';
import { ActionDetailsModal } from '@/components/tasks/ActionDetailsModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import RecurringTaskActionModal from '@/components/tasks/RecurringTaskActionModal';
import DelegateModal from '@/components/tasks/DelegateModal';
import JournalForm from '@/components/reflections/JournalForm';
import { getSupabaseClient } from '@/lib/supabase';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import { JournalView } from '@/components/journal/JournalView';
import { calculateTaskPoints, calculateAuthenticScore as calculateScoreUtil } from '@/lib/taskUtils';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { DraggableFab } from '@/components/DraggableFab';
import { formatLocalDate } from '@/lib/dateUtils';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { eventBus, EVENTS } from '@/lib/eventBus';

// --- Main Dashboard Screen Component ---
// This screen has 4 views accessible via tabs in the header:
// 1. DEPOSITS: Shows pending/in-progress tasks and events (your upcoming actions)
//              Note: Despite the name "deposits", this shows PENDING TASKS, not completed authentic deposits
//              Completed authentic deposits are shown in the Journal view
// 2. IDEAS: Shows deposit ideas that haven't been activated yet
// 3. JOURNAL: Shows historical data (completed tasks, withdrawals, reflections)
// 4. ANALYTICS: Shows charts and visualizations of your progress
export default function Dashboard() {
  const { authenticScore, refreshScore } = useAuthenticScore();
  const { registerResetHandler, unregisterResetHandler } = useTabReset();
  // activeView controls which of the 4 tabs is displayed
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');
  const [sortOption, setSortOption] = useState('due_date');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [recurringActionModal, setRecurringActionModal] = useState<{
    visible: boolean;
    task: Task | null;
    actionType: 'delete' | 'edit';
  }>({ visible: false, task: null, actionType: 'delete' });
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDelegateModalVisible, setIsDelegateModalVisible] = useState(false);
  const [delegatingTask, setDelegatingTask] = useState<Task | null>(null);
  const [delegates, setDelegates] = useState<Array<{id: string; name: string; email?: string; phone?: string}>>([]);
  const [userId, setUserId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const [isReflectionModalVisible, setIsReflectionModalVisible] = useState(false);
  const [editingReflection, setEditingReflection] = useState<any>(null);

  // Follow-through TaskEventForm state
  const [refreshAssociatedItemsKey, setRefreshAssociatedItemsKey] = useState(0);

  // Import functions from useGoalProgress hook
  const {
    deleteTask,
  } = useGoalProgress();
  

  // Reset to main Actions & Ideas view when tab is pressed
  const resetToMain = useCallback(() => {
    setActiveView('deposits');
    setSortOption('due_date');
    setIsSortModalVisible(false);
    setIsFormModalVisible(false);
    setIsDetailModalVisible(false);
    setSelectedTask(null);
    setEditingTask(null);
    setSelectedDepositIdea(null);
    setTasks([]);
    setDepositIdeas([]);
  }, []);

  const fetchData = async () => {
    console.log('[Dashboard] fetchData called, activeView:', activeView);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (activeView === 'deposits') {
        // DEPOSITS VIEW: Fetch pending/in-progress tasks and events
        // Note: "deposits" is a misnomer - this actually shows PENDING ACTIONS you need to complete
        // Completed tasks marked as authentic deposits are shown in the Journal view instead

        // Calculate current week boundaries
        const today = new Date();
        const todayStr = formatLocalDate(today);
        const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday
        const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = formatLocalDate(weekStart);
        const weekEndStr = formatLocalDate(weekEnd);

        // Fetch all pending/in-progress tasks directly from the tasks table
        // This includes both recurring and non-recurring tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress'])
          .in('type', ['task', 'event'])
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .order('created_at', { ascending: false });

        if (tasksError) throw tasksError;

        // Filter out Goal Bank actions by checking for week plans
        // Goal Bank actions are identified by having entries in task-week-plan table
        // Those are managed separately in the Goal Bank tab
        let allTasks: any[] = [];

        if (tasksData && tasksData.length > 0) {
          const taskIds = tasksData.map(t => t.id);
          const { data: weekPlans, error: weekPlansError } = await supabase
            .from('0008-ap-task-week-plan')
            .select('task_id')
            .in('task_id', taskIds)
            .is('deleted_at', null);

          if (weekPlansError) throw weekPlansError;

          // Create a Set of task IDs that have week plans (Goal Bank actions)
          const goalBankActionIds = new Set(weekPlans?.map(wp => wp.task_id) || []);

          // Only include standalone tasks (tasks WITHOUT week plans)
          allTasks = tasksData.filter(task => !goalBankActionIds.has(task.id));
        }

        // Fetch join data only if we have tasks
        let rolesData: any[] = [];
        let domainsData: any[] = [];
        let goalsData: any[] = [];
        let notesData: any[] = [];
        let delegatesData: any[] = [];
        let keyRelationshipsData: any[] = [];

        if (allTasks.length > 0) {
          const taskIdsForJoins = allTasks.map(t => t.id);

          const [
            { data: rolesDataResult, error: rolesError },
            { data: domainsDataResult, error: domainsError },
            { data: goalsDataResult, error: goalsError },
            { data: notesDataResult, error: notesError },
            { data: delegatesDataResult, error: delegatesError },
            { data: keyRelationshipsDataResult, error: keyRelationshipsError }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-goals-join').select('parent_id, goal_type, twelve_wk_goal:0008-ap-goals-12wk(id, title, status), custom_goal:0008-ap-goals-custom(id, title, status)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-delegates-join').select('parent_id, delegate_id').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task')
          ]);

          if (rolesError) throw rolesError;
          if (domainsError) throw domainsError;
          if (goalsError) throw goalsError;
          if (notesError) throw notesError;
          if (delegatesError) throw delegatesError;
          if (keyRelationshipsError) throw keyRelationshipsError;

          rolesData = rolesDataResult || [];
          domainsData = domainsDataResult || [];
          goalsData = goalsDataResult || [];
          notesData = notesDataResult || [];
          delegatesData = delegatesDataResult || [];
          keyRelationshipsData = keyRelationshipsDataResult || [];
        }

        const transformedTasks = allTasks.map(task => {
          // Derive timeline information for recurring tasks
          const timeline_id = task.custom_timeline_id || task.user_global_timeline_id || null;
          const timeline_source = task.user_global_timeline_id ? 'global' : 'custom';

          // Transform polymorphic goals
          const taskGoals = goalsData?.filter(g => g.parent_id === task.id).map(g => {
            if (g.goal_type === 'twelve_wk_goal' && g.twelve_wk_goal) {
              const goal = g.twelve_wk_goal;
              if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
              }
              return { ...goal, goal_type: '12week' };
            } else if (g.goal_type === 'custom_goal' && g.custom_goal) {
              const goal = g.custom_goal;
              if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
                return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
              }
              return { ...goal, goal_type: 'custom' };
            } else if (g.goal_type === 'twelve_wk_goal' && !g.twelve_wk_goal) {
              return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
            } else if (g.goal_type === 'custom_goal' && !g.custom_goal) {
              return { id: 'deleted', title: 'Goal no longer available', goal_type: 'deleted', status: 'deleted' };
            }
            return null;
          }).filter(Boolean) || [];

          return {
            ...task,
            timeline_id,
            timeline_source,
            roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
            domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
            goals: taskGoals,
            keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            has_notes: notesData?.some(n => n.parent_id === task.id),
            has_delegates: delegatesData?.some(d => d.parent_id === task.id),
            has_attachments: false,
          };
        });

        let sortedTasks = [...transformedTasks];
        if (sortOption === 'due_date') {
          sortedTasks.sort((a, b) => (new Date(a.due_date).getTime() || 0) - (new Date(b.due_date).getTime() || 0));
        } else if (sortOption === 'priority') {
          sortedTasks.sort((a, b) => ((b.is_urgent ? 2 : 0) + (b.is_important ? 1 : 0)) - ((a.is_urgent ? 2 : 0) + (a.is_important ? 1 : 0)));
        } else if (sortOption === 'delegated') {
          sortedTasks.sort((a, b) => (b.has_delegates ? 1 : 0) - (a.has_delegates ? 1 : 0));
        }

        console.log('[Dashboard] Setting tasks:', sortedTasks.length, 'tasks found');
        setTasks(sortedTasks);
        setDepositIdeas([]);

      } else {
        // Fetch deposit ideas
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false)
          .eq('is_active', true)
          .is('activated_task_id', null);

        if (depositIdeasError) throw depositIdeasError;

        // Fetch join data only if we have deposit ideas
        let rolesData: any[] = [];
        let domainsData: any[] = [];
        let krData: any[] = [];
        let notesData: any[] = [];

        if (depositIdeasData && depositIdeasData.length > 0) {
          const depositIdeaIds = depositIdeasData.map(di => di.id);

          const [
            { data: rolesDataResult, error: rolesError },
            { data: domainsDataResult, error: domainsError },
            { data: krDataResult, error: krError },
            { data: notesDataResult, error: notesError }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
          ]);

          if (rolesError) throw rolesError;
          if (domainsError) throw domainsError;
          if (krError) throw krError;
          if (notesError) throw notesError;

          rolesData = rolesDataResult || [];
          domainsData = domainsDataResult || [];
          krData = krDataResult || [];
          notesData = notesDataResult || [];
        }

        const transformedDepositIdeas = (depositIdeasData || []).map(di => ({
          ...di,
          roles: rolesData?.filter(r => r.parent_id === di.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === di.id).map(d => d.domain).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === di.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === di.id),
          has_attachments: false,
        }));

        console.log('[Dashboard] Setting deposit ideas:', transformedDepositIdeas.length, 'ideas found');
        setDepositIdeas(transformedDepositIdeas);
        setTasks([]);
      }

      // Calculate authentic score (total balance) for header
      await refreshScore();

    } catch (error) {
      console.error(`Error fetching ${activeView}:`, error);
      Alert.alert('Error', (error as Error).message || `Failed to fetch ${activeView}.`);
    } finally {
      setLoading(false);
    }
  };


  // Automatic midnight refresh effect
  // This ensures recurring tasks appear at 12:01 AM local time
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 1, 0, 0); // Set to 12:01 AM

      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      console.log('[Dashboard] Scheduling midnight refresh in', Math.round(msUntilMidnight / 1000 / 60), 'minutes');

      const timeoutId = setTimeout(() => {
        console.log('[Dashboard] Midnight refresh triggered - fetching new tasks');
        fetchData();
        // Schedule the next one for tomorrow
        scheduleNextMidnightRefresh();
      }, msUntilMidnight);

      return timeoutId;
    };

    // Only schedule midnight refresh if we're on the deposits view
    let midnightTimeoutId: NodeJS.Timeout | null = null;
    if (activeView === 'deposits') {
      midnightTimeoutId = scheduleNextMidnightRefresh();
    }

    return () => {
      if (midnightTimeoutId) {
        clearTimeout(midnightTimeoutId);
      }
    };
  }, [activeView, fetchData]);

  useEffect(() => {
    registerResetHandler('dashboard', resetToMain);
    fetchData();

    // Listen for task creation events from other components
    const handleTaskCreated = () => {
      console.log('[Dashboard] Received task created event, refreshing...');
      fetchData();
    };

    const handleTaskUpdated = () => {
      console.log('[Dashboard] Received task updated event, refreshing...');
      fetchData();
    };

    const handleTaskDeleted = () => {
      console.log('[Dashboard] Received task deleted event, refreshing...');
      fetchData();
    };

    const handleRefreshAll = () => {
      console.log('[Dashboard] Received refresh all event, refreshing...');
      fetchData();
    };

    eventBus.on(EVENTS.TASK_CREATED, handleTaskCreated);
    eventBus.on(EVENTS.TASK_UPDATED, handleTaskUpdated);
    eventBus.on(EVENTS.TASK_DELETED, handleTaskDeleted);
    eventBus.on(EVENTS.REFRESH_ALL_TASKS, handleRefreshAll);
    eventBus.on(EVENTS.DEPOSIT_IDEA_CREATED, handleRefreshAll);
    eventBus.on(EVENTS.WITHDRAWAL_CREATED, handleRefreshAll);

    return () => {
      unregisterResetHandler('dashboard');
      eventBus.off(EVENTS.TASK_CREATED, handleTaskCreated);
      eventBus.off(EVENTS.TASK_UPDATED, handleTaskUpdated);
      eventBus.off(EVENTS.TASK_DELETED, handleTaskDeleted);
      eventBus.off(EVENTS.REFRESH_ALL_TASKS, handleRefreshAll);
      eventBus.off(EVENTS.DEPOSIT_IDEA_CREATED, handleRefreshAll);
      eventBus.off(EVENTS.WITHDRAWAL_CREATED, handleRefreshAll);
    };
  }, [activeView, sortOption, registerResetHandler, unregisterResetHandler, resetToMain]);

  const handleCompleteTask = async (task: Task) => {
    try {
      console.log('[Dashboard] Completing task:', task.id, task.title);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check if this is a recurring task (either virtual occurrence or has recurrence_rule)
      if (task.is_virtual_occurrence || task.recurrence_rule) {
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
        // Regular standalone task - just update status
        const { error } = await supabase
          .from('0008-ap-tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', task.id);

        if (error) throw error;
      }

      // Remove from UI after successful database update
      setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));

      console.log('[Dashboard] Waiting for database commits, then refreshing score');
      // Small delay to ensure all database writes (including RPC joins) complete
      await new Promise(resolve => setTimeout(resolve, 200));
      await refreshScore(true);
    } catch (error) {
      console.error('[Dashboard] Error completing task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to complete action.');
      fetchData();
    }
  };

  const handleDeleteTask = async (task: Task) => {
    // Check if this is a recurring task
    if (task.recurrence_rule || task.is_virtual_occurrence) {
      setRecurringActionModal({ visible: true, task, actionType: 'delete' });
      return;
    }

    try {
      // Optimistically remove the task from the list immediately
      setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));

      // Use the soft delete function from useGoals hook
      await deleteTask(task.id);
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete task');
      // Revert optimistic update on error
      fetchData();
    }
  };

  const handleDeleteThisOccurrence = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const sourceTaskId = task.source_task_id || task.id;
      const occurrenceDate = task.occurrence_date || task.due_date;

      // Add the date to recurrence_exceptions array
      const { data: sourceTask } = await supabase
        .from('0008-ap-tasks')
        .select('recurrence_exceptions')
        .eq('id', sourceTaskId)
        .single();

      const currentExceptions = sourceTask?.recurrence_exceptions || [];
      const updatedExceptions = [...currentExceptions, occurrenceDate];

      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ recurrence_exceptions: updatedExceptions })
        .eq('id', sourceTaskId);

      if (error) throw error;

      setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id));
      Alert.alert('Success', 'This occurrence has been removed');
    } catch (error) {
      console.error('Error deleting occurrence:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete occurrence');
      fetchData();
    }
  };

  const handleDeleteAllOccurrences = async (task: Task) => {
    try {
      const sourceTaskId = task.source_task_id || task.id;
      await deleteTask(sourceTaskId);
      setTasks(prevTasks => prevTasks.filter(t => (t.source_task_id || t.id) !== sourceTaskId));
      Alert.alert('Success', 'All occurrences have been deleted');
    } catch (error) {
      console.error('Error deleting all occurrences:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete task');
      fetchData();
    }
  };
  const handleCancelTask = async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('0008-ap-tasks').update({ status: 'cancelled' }).eq('id', task.id);
      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setIsDetailModalVisible(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel task.');
    }
  };

  const handleTaskPress = (task: Task) => { setSelectedTask(task); setIsDetailModalVisible(true); };
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [isDepositIdeaDetailVisible, setIsDepositIdeaDetailVisible] = useState(false);

  const handleDepositIdeaPress = (depositIdea: any) => {
    setSelectedDepositIdea(depositIdea);
    setIsDepositIdeaDetailVisible(true);
  };
  const handleUpdateDepositIdea = async (depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setIsDepositIdeaDetailVisible(false);
    setIsFormModalVisible(true);
  };
  const handleCancelDepositIdea = async (depositIdea: any) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({
          is_active: false,
          archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositIdea.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to cancel deposit idea.');
    }
  };

  const handleActivateDepositIdea = async (depositIdea: any) => {
    try {
      setIsDepositIdeaDetailVisible(false); // Close modal immediately
      
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Create a new task based on the deposit idea
      const { data: newTask, error: taskError } = await supabase
        .from('0008-ap-tasks')
        .insert({
          user_id: user.id,
          title: depositIdea.title,
          type: 'task',
          status: 'pending',
          due_date: formatLocalDate(new Date()),
        })
        .select()
        .single();

      if (taskError) throw taskError;

      const taskId = newTask.id;

      // Copy all the joins from the deposit idea to the new task
      const joinPromises = [];

      // Copy role joins
      if (depositIdea.roles && depositIdea.roles.length > 0) {
        const roleJoins = depositIdea.roles.map(role => ({
          parent_id: taskId,
          parent_type: 'task',
          role_id: role.id,
          user_id: user.id,
        }));
        joinPromises.push(
          supabase.from('0008-ap-universal-roles-join').insert(roleJoins)
        );
      }

      // Copy domain joins
      if (depositIdea.domains && depositIdea.domains.length > 0) {
        const domainJoins = depositIdea.domains.map(domain => ({
          parent_id: taskId,
          parent_type: 'task',
          domain_id: domain.id,
          user_id: user.id,
        }));
        joinPromises.push(
          supabase.from('0008-ap-universal-domains-join').insert(domainJoins)
        );
      }

      // Copy key relationship joins
      if (depositIdea.keyRelationships && depositIdea.keyRelationships.length > 0) {
        const krJoins = depositIdea.keyRelationships.map(kr => ({
          parent_id: taskId,
          parent_type: 'task',
          key_relationship_id: kr.id,
          user_id: user.id,
        }));
        joinPromises.push(
          supabase.from('0008-ap-universal-key-relationships-join').insert(krJoins)
        );
      }

      // Execute all join insertions
      if (joinPromises.length > 0) {
        const joinResults = await Promise.all(joinPromises);
        for (const result of joinResults) {
          if (result.error) throw result.error;
        }
      }

      // Mark the deposit idea as activated
      const { error: updateError } = await supabase
        .from('0008-ap-deposit-ideas')
        .update({
          is_active: false,
          archived: true,
          activated_at: new Date().toISOString(),
          activated_task_id: taskId,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositIdea.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Deposit idea has been activated as a task!');
      fetchData(); // Refresh the task list
    } catch (error) {
      console.error('Error activating deposit idea:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to activate deposit idea.');
    }
  };
  const handleUpdateTask = (task: Task) => {
    console.log('[Dashboard] Opening task for edit:', {
      id: task.id,
      title: task.title,
      status: task.status,
      completed_at: task.completed_at
    });

    // Check if this is a recurring task
    if (task.recurrence_rule || task.is_virtual_occurrence) {
      // Close detail modal first, then show recurring action modal
      setIsDetailModalVisible(false);
      setTimeout(() => {
        setRecurringActionModal({ visible: true, task, actionType: 'edit' });
      }, 200);
      return;
    }

    setEditingTask(task);
    setIsDetailModalVisible(false);
    setTimeout(() => setIsFormModalVisible(true), 100); // Small delay to ensure modal transition
  };
  const handleDelegateTask = async (task: Task) => {
    setDelegatingTask(task);
    setIsDetailModalVisible(false);

    // Fetch delegates for the user
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase
          .from('0008-ap-delegates')
          .select('id, name, email, phone')
          .eq('user_id', user.id)
          .order('name');
        if (data) setDelegates(data);
      }
    } catch (error) {
      console.error('Error fetching delegates:', error);
    }

    setTimeout(() => setIsDelegateModalVisible(true), 150);
  };
  const handleFormSubmitSuccess = async () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
    fetchData();
    // Trigger Journal refresh if we're on Journal view
    setJournalRefreshKey(prev => prev + 1);
    // Refresh the authentic score
    await refreshScore(true);
  };

  const handleFormClose = () => {
    setIsFormModalVisible(false);
    setEditingTask(null);
  };


  const handleJournalEntryPress = (entry: any) => {
    if (entry.source_type === 'task') {
      console.log('[Dashboard] Journal entry pressed - Task data:', {
        id: entry.source_data.id,
        title: entry.source_data.title,
        status: entry.source_data.status,
        completed_at: entry.source_data.completed_at
      });
      setSelectedTask(entry.source_data);
      setIsDetailModalVisible(true);
    } else if (entry.source_type === 'withdrawal') {
      // Open TaskEventForm in withdrawal mode for editing
      const editData = {
        ...entry.source_data,
        type: 'withdrawal'
      };
      setEditingTask(editData);
      setIsFormModalVisible(true);
    } else if (entry.source_type === 'depositIdea') {
      // Open DepositIdeaDetailModal for deposit ideas
      setSelectedDepositIdea(entry.source_data);
      setIsDepositIdeaDetailVisible(true);
    } else if (entry.source_type === 'reflection') {
      // Open JournalForm in edit mode for reflections
      setEditingReflection(entry.source_data);
      setIsReflectionModalVisible(true);
    }
  };

  const handleAssociatedItemPress = async (item: any) => {
    console.log('[Dashboard] Associated item pressed:', item);

    // Close all modals first
    setIsDetailModalVisible(false);
    setIsReflectionModalVisible(false);
    setIsDepositIdeaDetailVisible(false);

    // Wait a bit for the modal to close before opening the new one
    setTimeout(async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      if (item.type === 'task' || item.type === 'event') {
        // Fetch full task data
        const { data: taskData } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single();

        if (taskData) {
          setSelectedTask(taskData);
          setIsDetailModalVisible(true);
        }
      } else if (item.type === 'rose' || item.type === 'thorn' || item.type === 'reflection') {
        // Fetch full reflection data
        const { data: reflectionData } = await supabase
          .from('0008-ap-reflections')
          .select('*')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single();

        if (reflectionData) {
          setEditingReflection(reflectionData);
          setIsReflectionModalVisible(true);
        }
      } else if (item.type === 'depositIdea') {
        // Fetch full deposit idea data
        const { data: depositIdeaData } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('id', item.id)
          .eq('user_id', user.id)
          .single();

        if (depositIdeaData) {
          setSelectedDepositIdea(depositIdeaData);
          setIsDepositIdeaDetailVisible(true);
        }
      }
    }, 300);
  };

  const handleDragEnd = ({ data }: { data: Task[] }) => setTasks(data);
  const sortOptions = [
    { value: 'due_date', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'delegated', label: 'Delegated' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Authentic Intelligence" activeView={activeView} onViewChange={setActiveView} onSortPress={() => setIsSortModalVisible(true)} authenticScore={authenticScore} forceShowMenu={true} />
      <View style={styles.content} pointerEvents="box-none">
        
        {activeView === 'journal' ? (
          <JournalView
            scope={{ type: 'user' }}
            onEntryPress={handleJournalEntryPress}
            refreshKey={journalRefreshKey}
          />
        ) : activeView === 'analytics' ? (
          <AnalyticsView
            scope={{ type: 'user' }}
          />
        ) : loading ? null
          : (activeView === 'deposits' && tasks.length === 0) || (activeView === 'ideas' && depositIdeas.length === 0) ? 
            <View style={styles.emptyContainer}><Text style={styles.emptyText}>No {activeView} found</Text></View>
          : activeView === 'deposits' ? 
            Platform.OS === 'web' ? (
              <FlatList
                data={tasks}
                renderItem={({ item }) => (
                  <TaskCard
                    task={item}
                    onComplete={handleCompleteTask}
                    onDelete={handleDeleteTask}
                    onLongPress={() => {}}
                    onPress={handleTaskPress}
                    isDragging={false}
                  />
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.taskList}
                showsVerticalScrollIndicator={true}
                style={styles.draggableList}
              />
            ) : (
              <DraggableFlatList 
                data={tasks} 
                renderItem={({ item, drag, isActive }) => (
                  <TaskCard
                    task={item}
                    onComplete={handleCompleteTask}
                    onDelete={handleDeleteTask}
                    onLongPress={drag}
                    onPress={handleTaskPress}
                    isDragging={isActive}
                  />
                )}
                keyExtractor={(item) => item.id} 
                onDragEnd={handleDragEnd} 
                contentContainerStyle={styles.taskList} 
                showsVerticalScrollIndicator={true}
                scrollEnabled={true}
                style={styles.draggableList}
              />
            )
          : <ScrollView 
              style={styles.scrollContent} 
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <View style={styles.taskList}>
                {depositIdeas.map(depositIdea => 
                  <DepositIdeaCard
                    key={depositIdea.id}
                    depositIdea={depositIdea}
                    onUpdate={handleUpdateDepositIdea}
                    onCancel={handleCancelDepositIdea}
                    onPress={handleDepositIdeaPress}
                  />
                )}
              </View>
            </ScrollView>
        }
      </View>
      <DraggableFab onPress={() => setIsFormModalVisible(true)} size={44}>
        <Plus size={28} color="#ffffff" />
      </DraggableFab>
      <Modal visible={isFormModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>
      <ActionDetailsModal
        visible={isDetailModalVisible}
        task={selectedTask}
        onClose={() => setIsDetailModalVisible(false)}
        onDelete={handleDeleteTask}
        onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
        onItemPress={handleAssociatedItemPress}
      />
      <DepositIdeaDetailModal
        visible={isDepositIdeaDetailVisible}
        depositIdea={selectedDepositIdea}
        onClose={() => setIsDepositIdeaDetailVisible(false)}
        onDelete={handleCancelDepositIdea}
        onActivate={handleActivateDepositIdea}
        onEdit={handleUpdateDepositIdea}
        onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
        onItemPress={handleAssociatedItemPress}
      />
      <Modal visible={isSortModalVisible} transparent animationType="fade" onRequestClose={() => setIsSortModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Sort by</Text><TouchableOpacity onPress={() => setIsSortModalVisible(false)} style={styles.closeButton}><X size={20} color="#6b7280" /></TouchableOpacity></View>
            <View style={styles.sortOptions}>{sortOptions.map(option => <TouchableOpacity key={option.value} style={[styles.sortOption, sortOption === option.value && styles.activeSortOption]} onPress={() => { setSortOption(option.value); setIsSortModalVisible(false); }}><Text style={[styles.sortOptionText, sortOption === option.value && styles.activeSortOptionText]}>{option.label}</Text></TouchableOpacity>)}</View>
          </View>
        </View>
      </Modal>

      <RecurringTaskActionModal
        visible={recurringActionModal.visible}
        onClose={() => setRecurringActionModal({ visible: false, task: null, actionType: 'delete' })}
        onThisOccurrence={() => {
          if (recurringActionModal.task) {
            if (recurringActionModal.actionType === 'delete') {
              handleDeleteThisOccurrence(recurringActionModal.task);
            } else {
              // Edit this occurrence - open form with task data
              setEditingTask(recurringActionModal.task);
              setIsFormModalVisible(true);
            }
          }
        }}
        onAllOccurrences={() => {
          if (recurringActionModal.task) {
            if (recurringActionModal.actionType === 'delete') {
              handleDeleteAllOccurrences(recurringActionModal.task);
            } else {
              // Edit template - open form with source task data
              const sourceTaskId = recurringActionModal.task.source_task_id || recurringActionModal.task.id;
              setEditingTask({ ...recurringActionModal.task, id: sourceTaskId });
              setIsFormModalVisible(true);
            }
          }
        }}
        actionType={recurringActionModal.actionType}
        taskTitle={recurringActionModal.task?.title || ''}
      />

      <JournalForm
        visible={isReflectionModalVisible}
        mode="edit"
        initialData={editingReflection}
        onClose={() => {
          setIsReflectionModalVisible(false);
          setEditingReflection(null);
        }}
        onSaveSuccess={() => {
          setIsReflectionModalVisible(false);
          setEditingReflection(null);
          setJournalRefreshKey(prev => prev + 1);
        }}
        openedFromJournal={true}
      />

      <DelegateModal
        visible={isDelegateModalVisible}
        onClose={() => {
          setIsDelegateModalVisible(false);
          setDelegatingTask(null);
        }}
        onSave={async (delegateId) => {
          if (!delegatingTask) return;

          try {
            const supabase = getSupabaseClient();

            // Clear existing delegate joins for this task
            await supabase
              .from('0008-ap-universal-delegates-join')
              .delete()
              .eq('parent_id', delegatingTask.id)
              .eq('parent_type', 'task');

            // Insert new delegate join
            const { error } = await supabase
              .from('0008-ap-universal-delegates-join')
              .insert({
                parent_id: delegatingTask.id,
                parent_type: 'task',
                delegate_id: delegateId,
                user_id: userId,
              });

            if (error) throw error;

            Alert.alert('Success', 'Task delegated successfully!');
            setIsDelegateModalVisible(false);
            setDelegatingTask(null);
            fetchData(); // Refresh the task list

            // Refresh delegates list
            const { data } = await supabase
              .from('0008-ap-delegates')
              .select('id, name, email, phone')
              .eq('user_id', userId)
              .order('name');
            if (data) setDelegates(data);
          } catch (error) {
            console.error('Error delegating task:', error);
            Alert.alert('Error', 'Failed to delegate task. Please try again.');
          }
        }}
        existingDelegates={delegates}
        userId={userId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { flex: 1 },
    draggableList: { flex: 1 },
    scrollContent: { flex: 1 },
    scrollContentContainer: { flexGrow: 1, paddingBottom: 100 },
    taskList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    roleTag: { backgroundColor: '#fce7f3' },
    domainTag: { backgroundColor: '#fed7aa' },
    goalTag: { backgroundColor: '#bfdbfe' },
    tagText: { fontSize: 10, fontWeight: '500', color: '#374151' },
    loadingContainer: { padding: 40, alignItems: 'center' },
    loadingText: { color: '#6b7280', fontSize: 16 },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#ffffff', borderRadius: 12, margin: 20, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
    modalTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
    closeButton: { padding: 4 },
    sortOptions: { padding: 8 },
    sortOption: { padding: 12, borderRadius: 8, marginVertical: 2 },
    activeSortOption: { backgroundColor: '#eff6ff' },
    sortOptionText: { fontSize: 14, color: '#374151' },
    activeSortOptionText: { color: '#0078d4', fontWeight: '600' },
    goalsSection: {
      backgroundColor: '#ffffff',
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    goalsSectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: 12,
    },
    goalsList: {
      gap: 12,
    },
});