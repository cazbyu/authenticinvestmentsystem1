import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { ActionDetailsModal } from '@/components/tasks/ActionDetailsModal';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import { JournalView } from '@/components/journal/JournalView';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import JournalForm from '@/components/reflections/JournalForm';
import { ReflectionDetailsModal } from '@/components/reflections/ReflectionDetailsModal';
import { ReflectionWithRelations, fetchReflectionById } from '@/lib/reflectionUtils';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { BalanceScoresView } from '@/components/wellness/BalanceScoresView';
import { getSupabaseClient } from '@/lib/supabase';
import { Plus, Heart, CreditCard as Edit, UserX, Ban, Menu, CreditCard as Edit2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { DraggableFab } from '@/components/DraggableFab';
import { calculateAuthenticScore as calculateAuthenticScoreUtil, calculateAuthenticScoreForDomain, calculateAuthenticScoreForPeriod } from '@/lib/taskUtils';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { WebNavigationMenu } from '@/components/WebNavigationMenu';
import { DomainStatisticsCard } from '@/components/wellness/DomainStatisticsCard';
import { getDomainStatistics, DomainStatistics } from '@/lib/roleStatistics';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Domain {
  id: string;
  name: string;
  description?: string;
}

export default function Wellness() {
  const navigation = useNavigation<DrawerNavigation>();
  const { authenticScore, refreshScoreForDomain } = useAuthenticScore();
  const { registerResetHandler, unregisterResetHandler } = useTabReset();
  const { colors } = useTheme();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');

  // Main tab navigation state
  const [activeMainTab, setActiveMainTab] = useState<'domains' | 'balance'>('domains');
  const [isWebMenuVisible, setIsWebMenuVisible] = useState(false);

  // Modal states
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [depositIdeaDetailVisible, setDepositIdeaDetailVisible] = useState(false);
  const [reflectionFormVisible, setReflectionFormVisible] = useState(false);
  const [selectedReflection, setSelectedReflection] = useState<ReflectionWithRelations | null>(null);
  const [reflectionDetailVisible, setReflectionDetailVisible] = useState(false);
  const [selectedReflectionDetail, setSelectedReflectionDetail] = useState<ReflectionWithRelations | null>(null);

  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [domainAuthenticScore, setDomainAuthenticScore] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scoreAbortControllerRef = useRef<AbortController | null>(null);
  const [periodScore, setPeriodScore] = useState<number | undefined>(undefined);
  const [journalDateRange, setJournalDateRange] = useState<'week' | 'month' | 'all'>('week');

  // Follow-through TaskEventForm state
  const [followThroughFormVisible, setFollowThroughFormVisible] = useState(false);
  const [followThroughPreSelectedType, setFollowThroughPreSelectedType] = useState<'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection'>('task');
  const [followThroughParentId, setFollowThroughParentId] = useState<string>('');
  const [followThroughParentType, setFollowThroughParentType] = useState<string>('');
  const [refreshAssociatedItemsKey, setRefreshAssociatedItemsKey] = useState(0);

  // Domain Bank statistics
  const [domainStatsPeriod, setDomainStatsPeriod] = useState<'week' | 'month'>('week');
  const [domainStatistics, setDomainStatistics] = useState<Record<string, DomainStatistics>>({});
  const [loadingStatistics, setLoadingStatistics] = useState(false);

  // 12-Week Goals for selected domain (only fetch when domain is selected)
  const goalProgressScope = useMemo(() =>
    selectedDomain ? { type: 'domain' as const, id: selectedDomain.id } : undefined,
    [selectedDomain?.id]
  );

  const {
    goals: twelveWeekGoals,
    goalProgress,
    loading: goalsLoading,
    refreshGoals
  } = useGoalProgress({
    scope: goalProgressScope
  });

  const fetchAuthenticScoreLocal = useCallback(async (forceRefresh = false, domainId?: string) => {
    // Cancel any in-flight score calculation
    if (scoreAbortControllerRef.current) {
      scoreAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    scoreAbortControllerRef.current = controller;

    try {
      let score: number;
      if (domainId) {
        score = await refreshScoreForDomain(domainId, forceRefresh);
      } else {
        score = authenticScore;
      }

      if (!controller.signal.aborted) {
        setDomainAuthenticScore(score);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error calculating authentic score:', error);
      }
    }
  }, [authenticScore, refreshScoreForDomain]);

  const fetchDomains = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-domains')
        .select('*')
        .order('name');

      if (error) throw error;
      setDomains(data || []);
      // Fetch score in background without blocking
      fetchAuthenticScoreLocal(false);
    } catch (error) {
      console.error('Error fetching domains:', error);
      Alert.alert('Error', (error as Error).message);
    }
  }, [fetchAuthenticScoreLocal]);

  const fetchDomainTasks = useCallback(async (domainId: string, view: 'deposits' | 'ideas' = activeView) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      if (view === 'deposits') {
        // First, get task IDs that are associated with this specific domain
        const { data: domainJoinData, error: domainJoinError } = await supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id')
          .eq('parent_type', 'task')
          .eq('domain_id', domainId);

        if (domainJoinError) throw domainJoinError;

        const domainTaskIds = domainJoinData?.map(dj => dj.parent_id) || [];

        if (domainTaskIds.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          return;
        }

        // Now fetch only the tasks that have this domain
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*, custom_timeline_id')
          .eq('user_id', user.id)
          .in('id', domainTaskIds)
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event']);

        if (tasksError) throw tasksError;

        // Check if aborted
        if (controller.signal.aborted) {
          return;
        }

        // Filter out Goal Bank actions by checking for week plans
        let allTasks: any[] = [];

        if (tasksData && tasksData.length > 0) {
          const taskIds = tasksData.map(t => t.id);
          const { data: weekPlans, error: weekPlansError } = await supabase
            .from('0008-ap-task-week-plan')
            .select('task_id')
            .in('task_id', taskIds)
            .is('deleted_at', null);

          if (weekPlansError) throw weekPlansError;

          // Check if aborted
          if (controller.signal.aborted) {
            return;
          }

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
        let keyRelationshipsData: any[] = [];

        if (allTasks.length > 0) {
          const taskIdsForJoins = allTasks.map(t => t.id);

          const [
            { data: rolesDataResult, error: rolesError },
            { data: domainsDataResult, error: domainsError },
            { data: goalsDataResult, error: goalsError },
            { data: notesDataResult, error: notesError },
            { data: keyRelationshipsDataResult, error: keyRelationshipsError }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-notes-join').select('parent_id, note_id').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task')
          ]);

          if (rolesError) throw rolesError;
          if (domainsError) throw domainsError;
          if (goalsError) throw goalsError;
          if (notesError) throw notesError;
          if (keyRelationshipsError) throw keyRelationshipsError;

          rolesData = rolesDataResult || [];
          domainsData = domainsDataResult || [];
          goalsData = goalsDataResult || [];
          notesData = notesDataResult || [];
          keyRelationshipsData = keyRelationshipsDataResult || [];
        }

        // Check if aborted before processing
        if (controller.signal.aborted) {
          return;
        }

        const transformedTasks = allTasks.map(task => ({
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
          keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: false,
          has_attachments: false,
        }));

        setTasks(transformedTasks);
        setDepositIdeas([]);

      } else {
        // First, get deposit idea IDs that are associated with this specific domain
        const { data: domainJoinData, error: domainJoinError } = await supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id')
          .eq('parent_type', 'depositIdea')
          .eq('domain_id', domainId);

        if (domainJoinError) throw domainJoinError;

        const domainDepositIdeaIds = domainJoinData?.map(dj => dj.parent_id) || [];

        if (domainDepositIdeaIds.length === 0) {
          setDepositIdeas([]);
          setTasks([]);
          return;
        }

        // Now fetch only the deposit ideas that have this domain
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .in('id', domainDepositIdeaIds)
          .eq('archived', false)
          .eq('is_active', true)
          .is('activated_task_id', null);

        if (depositIdeasError) throw depositIdeasError;

        // Check if aborted
        if (controller.signal.aborted) {
          return;
        }

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

        // Check if aborted before processing
        if (controller.signal.aborted) {
          return;
        }

        const transformedDepositIdeas = (depositIdeasData || []).map(di => ({
          ...di,
          roles: rolesData?.filter(r => r.parent_id === di.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === di.id).map(d => d.domain).filter(Boolean) || [],
          keyRelationships: krData?.filter(kr => kr.parent_id === di.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === di.id),
          has_attachments: false,
        }));

        setDepositIdeas(transformedDepositIdeas);
        setTasks([]);
      }

    } catch (error) {
      // Don't show errors if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      console.error(`Error fetching domain ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [activeView]);


  // Reset to main Wellness Bank view when tab is pressed
  const resetToMain = useCallback(() => {
    setSelectedDomain(null);
    setActiveMainTab('domains');
    setActiveView('deposits');
    setTasks([]);
    setDepositIdeas([]);
    setLoading(false);
    setTaskFormVisible(false);
    setTaskDetailVisible(false);
    setDepositIdeaDetailVisible(false);
    setSelectedTask(null);
    setSelectedDepositIdea(null);
    setEditingTask(null);
    setDomainAuthenticScore(0);
    setPeriodScore(undefined);
    setJournalDateRange('week');
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    scoreAbortControllerRef.current?.abort();
    scoreAbortControllerRef.current = null;
  }, []);

  useEffect(() => {
    registerResetHandler('wellness', resetToMain);

    const loadUserId = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };

    loadUserId();
    fetchDomains();

    // Listen for task creation events from other components
    const handleTaskEvent = () => {
      console.log('[WellnessBank] Received task event, refreshing data...');
      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
    };

    eventBus.on(EVENTS.TASK_CREATED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_UPDATED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_DELETED, handleTaskEvent);

    return () => {
      unregisterResetHandler('wellness');
      eventBus.off(EVENTS.TASK_CREATED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_UPDATED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_DELETED, handleTaskEvent);
    };
  }, [fetchDomains, registerResetHandler, unregisterResetHandler, resetToMain, selectedDomain, activeView]);

  const calculatePeriodScore = useCallback(async (dateRange: 'week' | 'month' | 'all', domainId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = await calculateAuthenticScoreForPeriod(
        supabase,
        user.id,
        dateRange,
        { type: 'domain', id: domainId }
      );
      setPeriodScore(score);
    } catch (error) {
      console.error('Error calculating period score:', error);
      setPeriodScore(undefined);
    }
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      if (activeView === 'deposits' || activeView === 'ideas') {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
      // Calculate domain-specific score
      fetchAuthenticScoreLocal(true, selectedDomain.id);
    } else {
      // Calculate total score when no domain is selected
      fetchAuthenticScoreLocal(false);
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (scoreAbortControllerRef.current) {
        scoreAbortControllerRef.current.abort();
      }
    };
  }, [selectedDomain, activeView, fetchDomainTasks, fetchAuthenticScoreLocal]);

  useEffect(() => {
    // Calculate period score when journal view is active and domain is selected
    if (activeView === 'journal' && selectedDomain) {
      calculatePeriodScore(journalDateRange, selectedDomain.id);
    } else {
      setPeriodScore(undefined);
    }
  }, [activeView, selectedDomain?.id, journalDateRange, calculatePeriodScore]);

  // Fetch domain statistics when viewing main wellness bank and period changes
  useEffect(() => {
    const fetchDomainStatistics = async () => {
      if (activeMainTab === 'domains' && !selectedDomain && domains.length > 0) {
        setLoadingStatistics(true);
        try {
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const stats: Record<string, DomainStatistics> = {};

          for (const domain of domains) {
            const domainStats = await getDomainStatistics(
              supabase,
              user.id,
              domain.id,
              domainStatsPeriod
            );
            stats[domain.id] = domainStats;
          }

          setDomainStatistics(stats);
        } catch (error) {
          console.error('Error fetching domain statistics:', error);
        } finally {
          setLoadingStatistics(false);
        }
      }
    };

    fetchDomainStatistics();
  }, [activeMainTab, domains.length, domainStatsPeriod, selectedDomain]);

  const handleViewChange = useCallback((view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
    setActiveView(view);
    if (selectedDomain && (view === 'deposits' || view === 'ideas')) {
      fetchDomainTasks(selectedDomain.id, view);
    }
  }, [selectedDomain, fetchDomainTasks]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
      // Refresh score after task completion
      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [selectedDomain, activeView, fetchDomainTasks, fetchAuthenticScoreLocal]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'cancelled'
        })
        .eq('id', taskId);

      if (error) throw error;

      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
      // Refresh score after task deletion
      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [selectedDomain, activeView, fetchDomainTasks, fetchAuthenticScoreLocal]);

  const handleDeleteReflection = useCallback(async (reflection: ReflectionWithRelations) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', reflection.id);

      if (error) throw error;

      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to delete reflection.');
    }
  }, [selectedDomain, activeView, fetchDomainTasks, fetchAuthenticScoreLocal]);

  const handleUpdateDepositIdea = useCallback((depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setDepositIdeaDetailVisible(false);
    setTaskFormVisible(true);
  }, []);

  const handleCancelDepositIdea = useCallback(async (depositIdea: any) => {
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

      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [selectedDomain, activeView, fetchDomainTasks]);

  const handleActivateDepositIdea = useCallback(async (depositIdea: any) => {
    try {
      // For now, just open the form to create a task based on the deposit idea
      const editData = {
        ...depositIdea,
        type: 'task', // Convert to task
        title: depositIdea.title,
        selectedRoleIds: depositIdea.roles?.map(r => r.id) || [],
        selectedDomainIds: depositIdea.domains?.map(d => d.id) || [],
        selectedKeyRelationshipIds: depositIdea.keyRelationships?.map(kr => kr.id) || [],
      };
      setEditingTask(editData);
      setTaskFormVisible(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to activate deposit idea.');
    }
  }, []);
  const handleTaskPress = useCallback((task: Task) => {
    setSelectedTask(task);
    setTaskDetailVisible(true);
  }, []);

  const handleDepositIdeaPress = useCallback((depositIdea: any) => {
    setSelectedDepositIdea(depositIdea);
    setDepositIdeaDetailVisible(true);
  }, []);

  const handleUpdateTask = useCallback((task: Task) => {
    setEditingTask(task);
    setTaskDetailVisible(false);
    setTimeout(() => setTaskFormVisible(true), 100);
  }, []);

  const handleDelegateTask = useCallback((task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setTaskDetailVisible(false);
  }, []);

  const handleCancelTask = useCallback(async (task: Task) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id);

      if (error) throw error;
      Alert.alert('Success', 'Task has been cancelled');
      setTaskDetailVisible(false);

      if (selectedDomain) {
        fetchDomainTasks(selectedDomain.id, activeView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [selectedDomain, activeView, fetchDomainTasks]);

  const handleFormSubmitSuccess = useCallback(() => {
    setTaskFormVisible(false);
    setEditingTask(null);
    if (selectedDomain) {
      fetchDomainTasks(selectedDomain.id, activeView);
    }
    refreshGoals();
    // Refresh score after task creation/update
    fetchAuthenticScoreLocal(true);
  }, [selectedDomain, activeView, fetchDomainTasks, refreshGoals, fetchAuthenticScoreLocal]);

  const handleFormClose = useCallback(() => {
    setTaskFormVisible(false);
    setEditingTask(null);
  }, []);

  const handleOpenFollowThrough = (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection', parentId: string, parentType: string) => {
    setFollowThroughPreSelectedType(type);
    setFollowThroughParentId(parentId);
    setFollowThroughParentType(parentType);
    setFollowThroughFormVisible(true);
  };

  const handleFollowThroughFormClose = () => {
    setFollowThroughFormVisible(false);
    setRefreshAssociatedItemsKey(prev => prev + 1);
    if (selectedDomain) {
      fetchDomainTasks(selectedDomain.id, activeView);
    }
    refreshGoals();
    fetchAuthenticScoreLocal(true);
  };

  const handleDomainPress = useCallback((domain: Domain) => {
    setSelectedDomain(domain);
  }, []);

  const handleJournalEntryPress = useCallback(async (entry: any) => {
    if (entry.source_type === 'task') {
      setSelectedTask(entry.source_data);
      setTaskDetailVisible(true);
    } else if (entry.source_type === 'withdrawal') {
      // Open TaskEventForm in withdrawal mode for editing
      const editData = {
        ...entry.source_data,
        type: 'withdrawal'
      };
      setEditingTask(editData);
      setTaskFormVisible(true);
    } else if (entry.source_type === 'depositIdea') {
      // Open TaskEventForm in depositIdea reflection mode for editing
      const editData = {
        ...entry.source_data,
        type: 'reflection',
        reflectionMode: 'depositIdea'
      };
      setEditingTask(editData);
      setTaskFormVisible(true);
    } else if (entry.source_type === 'reflection') {
      // Fetch full reflection data and open ReflectionDetailsModal
      const reflection = await fetchReflectionById(entry.source_id);
      if (reflection) {
        setSelectedReflectionDetail(reflection);
        setReflectionDetailVisible(true);
      }
    }
  }, []);

  const handleJournalDateRangeChange = useCallback((dateRange: 'week' | 'month' | 'all') => {
    setJournalDateRange(dateRange);
    if (selectedDomain) {
      calculatePeriodScore(dateRange, selectedDomain.id);
    }
  }, [selectedDomain, calculatePeriodScore]);

  const getDomainColor = useCallback((domainName: string) => {
    const colors: Record<string, string> = {
      'Community': '#7c3aed',
      'Financial': '#059669',
      'Physical': '#16a34a',
      'Social': '#0078d4',
      'Emotional': '#dc2626',
      'Intellectual': '#0891b2',
      'Recreational': '#ea580c',
      'Spiritual': '#7c3aed',
    };
    return colors[domainName] || '#6b7280';
  }, []);

  // Render custom header
  const renderWellnessBankHeader = () => {
    if (selectedDomain) {
      // Individual domain detail header
      return (
        <View style={[styles.customHeader, { backgroundColor: getDomainColor(selectedDomain.name) }]}>
          <View style={styles.customHeaderTop}>
            <TouchableOpacity
              style={styles.customBackButton}
              onPress={() => setSelectedDomain(null)}
            >
              <Text style={styles.customBackButtonText}>← Wellness Bank</Text>
            </TouchableOpacity>
            <View style={styles.customHeaderCenter}>
              <Text style={styles.customHeaderTitle}>{selectedDomain.name}</Text>
            </View>
            <View style={styles.customHeaderRight}>
              <View style={styles.customScoreContainer}>
                <Text style={styles.customScoreLabel}>Authentic Score</Text>
                <Text style={styles.customScoreValue}>{domainAuthenticScore}</Text>
              </View>
            </View>
          </View>
          <View style={styles.customHeaderBottom}>
            <View style={styles.customToggleGroup}>
              {(['deposits', 'ideas', 'journal', 'analytics'] as const).map((view) => (
                <TouchableOpacity
                  key={view}
                  style={[styles.customToggleButton, activeView === view && styles.customActiveToggle]}
                  onPress={() => handleViewChange(view)}
                >
                  <Text style={[styles.customToggleText, activeView === view && styles.customActiveToggleText]}>
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // Main Wellness Bank header with tabs
    return (
      <View style={[styles.customHeader, { backgroundColor: colors.primary }]}>
        <View style={styles.customHeaderTop}>
          <TouchableOpacity
            style={styles.customMenuButton}
            onPress={() => {
              if (Platform.OS === 'web') {
                setIsWebMenuVisible(true);
              } else if (typeof navigation.openDrawer === 'function') {
                navigation.openDrawer();
              }
            }}
          >
            <Menu size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.customHeaderCenter}>
            <Text style={styles.customHeaderTitle}>Wellness Bank</Text>
          </View>
          <View style={styles.customScoreContainer}>
            <Text style={styles.customScoreLabel}>Authentic Score</Text>
            <Text style={styles.customScoreValue}>{authenticScore}</Text>
          </View>
        </View>
        <View style={styles.customHeaderBottom}>
          <View style={styles.customMainToggleGroup}>
            <TouchableOpacity
              style={[styles.customToggleButton, activeMainTab === 'domains' && styles.customActiveToggle]}
              onPress={() => setActiveMainTab('domains')}
            >
              <Text style={[styles.customToggleText, activeMainTab === 'domains' && [styles.customActiveToggleText, { color: colors.primary }]]}>
                Domains
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.customToggleButton, activeMainTab === 'balance' && styles.customActiveToggle]}
              onPress={() => setActiveMainTab('balance')}
            >
              <Text style={[styles.customToggleText, activeMainTab === 'balance' && [styles.customActiveToggleText, { color: colors.primary }]]}>
                Balance Scores
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Domain Cards Section - Below Header Tabs */}
        {activeMainTab === 'domains' && (
          <View style={styles.domainsCardsSection}>
            {/* Statistics Section with Time Period Selector */}
            {domains.length > 0 && (
              <View style={styles.statisticsSection}>
                {/* Time Period Selector */}
                <View style={styles.periodSelectorContainer}>
                  <View style={styles.periodSelector}>
                    <TouchableOpacity
                      style={[
                        styles.periodButton,
                        domainStatsPeriod === 'week' && styles.periodButtonActive
                      ]}
                      onPress={() => setDomainStatsPeriod('week')}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        domainStatsPeriod === 'week' && styles.periodButtonTextActive
                      ]}>Week</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.periodButton,
                        domainStatsPeriod === 'month' && styles.periodButtonActive
                      ]}
                      onPress={() => setDomainStatsPeriod('month')}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        domainStatsPeriod === 'month' && styles.periodButtonTextActive
                      ]}>Month</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2-Column Statistics Grid */}
                {loadingStatistics ? (
                  <View style={styles.statisticsLoadingContainer}>
                    <Text style={styles.statisticsLoadingText}>Loading statistics...</Text>
                  </View>
                ) : (
                  <View style={styles.statisticsGrid}>
                    {domains.map(domain => {
                      const stats = domainStatistics[domain.id];
                      if (!stats) return null;

                      return (
                        <View key={domain.id} style={styles.statisticsCardWrapper}>
                          <DomainStatisticsCard
                            domain={domain}
                            statistics={stats}
                            period={domainStatsPeriod}
                            color={getDomainColor(domain.name)}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Domain Cards */}
            {domains.length === 0 ? (
              <View style={styles.emptyCardsContainer}>
                <Text style={styles.emptyCardsText}>No domains found</Text>
              </View>
            ) : (
              <View style={styles.domainsGrid}>
                {domains.map(domain => (
                  <TouchableOpacity
                    key={domain.id}
                    style={[
                      styles.domainCard,
                      { borderTopColor: getDomainColor(domain.name) }
                    ]}
                    onPress={() => handleDomainPress(domain)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.domainCardContent}>
                      <Text style={styles.domainName}>{domain.name}</Text>
                      <View style={[styles.domainIcon, { backgroundColor: getDomainColor(domain.name) }]}>
                        <Heart size={20} color="#ffffff" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (selectedDomain) {
      // Domain view
      return (
        <View style={styles.content} pointerEvents="box-none">
          {/* 12-Week Goals Section */}
          {activeView === 'deposits' && twelveWeekGoals.length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.goalsSectionTitle}>12-Week Goals</Text>
              <View style={styles.goalsList}>
                {twelveWeekGoals.map(goal => {
                  const progress = goalProgress[goal.id];
                  if (!progress) return null;

                  return (
                    <GoalProgressCard
                      key={goal.id}
                      goal={goal}
                      progress={progress}
                      onAddTask={() => {
                        setEditingTask({
                          type: 'task',
                          selectedGoalIds: [goal.id],
                          isGoal: true,
                          selectedDomainIds: selectedDomain ? [selectedDomain.id] : [],
                        } as any);
                        setTaskFormVisible(true);
                      }}
                    />
                  );
                })}
              </View>
            </View>
          )}
          <ScrollView style={styles.taskList}>
            {activeView === 'journal' ? (
              <JournalView
                scope={{ type: 'domain', id: selectedDomain.id, name: selectedDomain.name }}
                onEntryPress={handleJournalEntryPress}
                periodScore={periodScore}
                onDateRangeChange={handleJournalDateRangeChange}
              />
            ) : activeView === 'analytics' ? (
              <AnalyticsView
                scope={{ type: 'domain', id: selectedDomain.id, name: selectedDomain.name }}
              />
            ) : loading ? (
              null
            ) : activeView === 'deposits' ? (
              tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No deposits found for this domain</Text>
                </View>
              ) : (
                tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={() => handleCompleteTask(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onPress={handleTaskPress}
                  />
                ))
              )
            ) : activeView === 'ideas' ? (
              depositIdeas.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No ideas found for this domain</Text>
                </View>
              ) : (
                depositIdeas.map(depositIdea => (
                  <DepositIdeaCard
                    key={depositIdea.id}
                    depositIdea={depositIdea}
                    onUpdate={handleUpdateDepositIdea}
                    onCancel={handleCancelDepositIdea}
                    onPress={handleDepositIdeaPress}
                  />
                ))
              )
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Feature coming soon!</Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    // Main Wellness Bank view with tabs
    return (
      <View style={styles.content} pointerEvents="box-none">
        {activeMainTab === 'balance' && (
          <BalanceScoresView getDomainColor={getDomainColor} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderWellnessBankHeader()}
      {renderContent()}

      <DraggableFab onPress={() => {
        if (selectedDomain) {
          setEditingTask({
            type: 'task',
            selectedDomainIds: [selectedDomain.id],
          } as any);
          setTaskFormVisible(true);
        } else {
          setEditingTask(null);
          setTaskFormVisible(true);
        }
      }} size={44}>
        <Plus size={28} color="#ffffff" />
      </DraggableFab>

      {/* Modals */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask?.id ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      <ActionDetailsModal
        visible={taskDetailVisible}
        task={selectedTask}
        onClose={() => setTaskDetailVisible(false)}
        onEdit={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
        onOpenFollowThrough={handleOpenFollowThrough}
        onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
      />

      <DepositIdeaDetailModal
        visible={depositIdeaDetailVisible}
        depositIdea={selectedDepositIdea}
        onClose={() => setDepositIdeaDetailVisible(false)}
        onUpdate={handleUpdateDepositIdea}
        onCancel={handleCancelDepositIdea}
        onOpenFollowThrough={handleOpenFollowThrough}
        onRefreshAssociatedItems={refreshAssociatedItemsKey > 0 ? () => {} : undefined}
      />

      {/* Follow-through TaskEventForm Modal */}
      <Modal visible={followThroughFormVisible} animationType="slide" presentationStyle="fullScreen">
        <TaskEventForm
          mode="create"
          onSubmitSuccess={handleFollowThroughFormClose}
          onClose={() => setFollowThroughFormVisible(false)}
          parentId={followThroughParentId}
          parentType={followThroughParentType as any}
          preSelectedType={followThroughPreSelectedType}
        />
      </Modal>

      <JournalForm
        visible={reflectionFormVisible}
        mode={selectedReflection ? 'edit' : 'create'}
        initialData={selectedReflection || undefined}
        openedFromJournal={true}
        onClose={() => {
          setReflectionFormVisible(false);
          setSelectedReflection(null);
        }}
        onSaveSuccess={() => {
          setReflectionFormVisible(false);
          setSelectedReflection(null);
          if (selectedDomain) {
            fetchDomainTasks(selectedDomain.id);
          }
        }}
      />

      <ReflectionDetailsModal
        visible={reflectionDetailVisible}
        reflection={selectedReflectionDetail}
        onClose={() => {
          setReflectionDetailVisible(false);
          setSelectedReflectionDetail(null);
        }}
        onEdit={(reflection) => {
          setReflectionDetailVisible(false);
          setSelectedReflection(reflection);
          setReflectionFormVisible(true);
        }}
        onDelete={(reflection) => {
          handleDeleteReflection(reflection);
          setReflectionDetailVisible(false);
          setSelectedReflectionDetail(null);
        }}
      />

      <WebNavigationMenu
        visible={isWebMenuVisible}
        onClose={() => setIsWebMenuVisible(false)}
      />
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
  domainsCardsSection: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyCardsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyCardsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  domainsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  domainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    width: '23%',
    minWidth: 70,
  },
  domainCardContent: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    paddingVertical: 10,
  },
  domainIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  domainName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 14,
  },
  taskListContainer: {
    flex: 1,
  },
  taskList: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  goalsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  goalsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    padding: 16,
    paddingBottom: 8,
  },
  goalsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Custom header styles
  customHeader: {
    backgroundColor: '#0078d4',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  customHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  customMenuButton: {
    padding: 4,
  },
  customBackButton: {
    paddingVertical: 4,
  },
  customBackButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  customHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  customHeaderTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  customHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customEditButton: {
    padding: 4,
  },
  customScoreContainer: {
    alignItems: 'flex-end',
  },
  customScoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  customScoreValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  customHeaderBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customMainToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
  },
  customToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
  },
  customToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  customActiveToggle: {
    backgroundColor: '#ffffff',
  },
  customToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  customActiveToggleText: {
    color: '#0078d4',
  },
  // Manage Domains tab styles
  manageContent: {
    flex: 1,
    padding: 16,
  },
  manageHeader: {
    marginBottom: 20,
  },
  manageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  managePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  managePlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  managePlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  statisticsSection: {
    marginBottom: 20,
  },
  periodSelectorContainer: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  periodButtonTextActive: {
    color: '#0078d4',
  },
  statisticsLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  statisticsLoadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statisticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  statisticsCardWrapper: {
    width: '48%',
  },
});