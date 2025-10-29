import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { DraggableFab } from '@/components/DraggableFab';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { ManageRolesModal } from '@/components/settings/ManageRolesModal';
import { ManageRolesContent } from '@/components/settings/ManageRolesContent';
import { EditRoleModal } from '@/components/settings/EditRoleModal';
import { EditKRModal } from '@/components/settings/EditKRModal';
import { JournalView } from '@/components/journal/JournalView';
import { getSupabaseClient } from '@/lib/supabase';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { Plus, Users, UserX, Ban, Menu, Edit2, Pencil } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { useGoals } from '@/hooks/useGoals';
import { calculateAuthenticScore as calculateScore, calculateAuthenticScoreForRole, calculateGoalProgress, GoalProgressData, calculateAuthenticScoreForPeriod } from '@/lib/taskUtils';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { eventBus, EVENTS } from '@/lib/eventBus';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Role {
  id: string;
  label: string;
  category?: string;
  image_path?: string;
  color?: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  description?: string;
  image_path?: string;
  role_id: string;
}

export default function Roles() {
  const navigation = useNavigation<DrawerNavigation>();
  const { authenticScore, refreshScoreForRole } = useAuthenticScore();
  const { registerResetHandler, unregisterResetHandler } = useTabReset();
  const { colors } = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [selectedKR, setSelectedKR] = useState<KeyRelationship | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [depositIdeas, setDepositIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchState, setFetchState] = useState<'idle' | 'loading-role' | 'loading-data' | 'complete'>('idle');
  const [krLoading, setKRLoading] = useState(false);
  const [activeView, setActiveView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');
  const [krView, setKRView] = useState<'deposits' | 'ideas'>('deposits');
  const [krJournalView, setKRJournalView] = useState<'deposits' | 'ideas' | 'journal' | 'analytics'>('deposits');

  // Main tab navigation state
  const [activeMainTab, setActiveMainTab] = useState<'roles' | 'keyrelationships' | 'manageRoles'>('roles');

  // Modal states
  const [manageRolesVisible, setManageRolesVisible] = useState(false);
  const [editRoleVisible, setEditRoleVisible] = useState(false);
  const [editKRVisible, setEditKRVisible] = useState(false);
  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [depositIdeaDetailVisible, setDepositIdeaDetailVisible] = useState(false);

  // Selected items
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDepositIdea, setSelectedDepositIdea] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingKR, setEditingKR] = useState<KeyRelationship | null>(null);
  const [roleAuthenticScore, setRoleAuthenticScore] = useState(0);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [periodScore, setPeriodScore] = useState<number | undefined>(undefined);
  const [journalDateRange, setJournalDateRange] = useState<'week' | 'month' | 'all'>('week');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fetchAbortController = useRef<AbortController | null>(null);
  const roleClickTimeout = useRef<NodeJS.Timeout | null>(null);
  const previousRoleIdRef = useRef<string | null>(null);
  const fetchInProgressRef = useRef<boolean>(false);

  // Memoize the scope object to prevent unnecessary re-renders
  const goalsScope = useMemo(() => {
    if (!selectedRole) return undefined;
    // Only return new object if role ID actually changed
    if (previousRoleIdRef.current === selectedRole.id) {
      return goalsScope;
    }
    previousRoleIdRef.current = selectedRole.id;
    return { type: 'role' as const, id: selectedRole.id };
  }, [selectedRole?.id]);

  // 12-Week Goals for selected role
  const {
    twelveWeekGoals,
    loading: goalsLoading,
    refreshGoals
  } = useGoals({
    scope: goalsScope
  });

  // Goal progress state
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgressData>>({});
  const [loadingGoalProgress, setLoadingGoalProgress] = useState(false);

  // Memoize scope objects for JournalView and AnalyticsView to prevent unnecessary re-fetches
  const journalScope = useMemo(() => {
    if (!selectedRole) return null;
    return { type: 'role' as const, id: selectedRole.id, name: selectedRole.label };
  }, [selectedRole?.id, selectedRole?.label]);

  const krJournalScope = useMemo(() => {
    if (!selectedKR || !selectedRole) return null;
    return { type: 'key_relationship' as const, id: selectedKR.id, name: selectedKR.name };
  }, [selectedKR?.id, selectedKR?.name, selectedRole?.id]);

  const calculatePeriodScore = useCallback(async (dateRange: 'week' | 'month' | 'all', scopeType: 'role' | 'key_relationship', scopeId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = await calculateAuthenticScoreForPeriod(
        supabase,
        user.id,
        dateRange,
        { type: scopeType, id: scopeId }
      );
      setPeriodScore(score);
    } catch (error) {
      console.error('Error calculating period score:', error);
      setPeriodScore(undefined);
    }
  }, []);

  const handleJournalDateRangeChange = useCallback((dateRange: 'week' | 'month' | 'all') => {
    setJournalDateRange(dateRange);
    if (selectedRole) {
      calculatePeriodScore(dateRange, 'role', selectedRole.id);
    } else if (selectedKR) {
      calculatePeriodScore(dateRange, 'key_relationship', selectedKR.id);
    }
  }, [selectedRole, selectedKR, calculatePeriodScore]);

  const handleJournalEntryPress = (entry: any) => {
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
    }
  };

  const calculateAuthenticScoreLocal = async (roleId?: string) => {
    if (isCalculatingScore) return;

    setIsCalculatingScore(true);
    try {
      let score: number;
      if (roleId) {
        score = await refreshScoreForRole(roleId, true);
      } else {
        score = authenticScore;
      }
      setRoleAuthenticScore(score);
    } catch (error) {
      console.error('Error calculating authentic score:', error);
    } finally {
      setIsCalculatingScore(false);
    }
  };

  const fetchGoalProgressData = useCallback(async () => {
    if (!twelveWeekGoals || twelveWeekGoals.length === 0) {
      setGoalProgress({});
      return;
    }

    setLoadingGoalProgress(true);
    try {
      const supabase = getSupabaseClient();
      const progressData: Record<string, GoalProgressData> = {};

      await Promise.all(
        twelveWeekGoals.map(async (goal) => {
          const progress = await calculateGoalProgress(
            supabase,
            goal.id,
            '12week',
            goal.weekly_target || 3,
            goal.total_target || 36
          );
          progressData[goal.id] = progress;
        })
      );

      setGoalProgress(progressData);
    } catch (error) {
      console.error('Error fetching goal progress:', error);
    } finally {
      setLoadingGoalProgress(false);
    }
  }, [twelveWeekGoals]);

  const fetchRoles = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('label');

      if (error) throw error;
      setRoles(data || []);

      // Calculate score asynchronously without blocking
      setTimeout(() => calculateAuthenticScoreLocal(), 0);
    } catch (error) {
      console.error('Error fetching roles:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const fetchKeyRelationships = useCallback(async (roleId: string) => {
    setKRLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setKeyRelationships([]);
        setKRLoading(false);
        return;
      }

      // CRITICAL: Filter by role_id to ensure KRs are scoped to their role
      // When viewing "Father" role, only children (KRs with Father's role_id) are shown
      // When viewing "Husband" role, only spouse (KRs with Husband's role_id) are shown
      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .select('*')
        .eq('user_id', user.id)
        .eq('role_id', roleId) // This ensures role-specific filtering
        .order('name');

      if (error) throw error;
      setKeyRelationships(data || []);
      setSelectedKR(null);
    } catch (error) {
      console.error('Error fetching key relationships:', error);
      setKeyRelationships([]);
    } finally {
      setKRLoading(false);
    }
  }, []);

  const fetchRoleTasks = useCallback(async (roleId: string, view: 'deposits' | 'ideas') => {
    if (loading) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (view === 'deposits') {
        // First, get task IDs that are associated with this specific role
        const { data: roleJoinData, error: roleJoinError } = await supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id')
          .eq('parent_type', 'task')
          .eq('role_id', roleId);

        if (roleJoinError) throw roleJoinError;

        const roleTaskIds = roleJoinData?.map(rj => rj.parent_id) || [];

        if (roleTaskIds.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          return;
        }

        // Now fetch only the tasks that have this role
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*, custom_timeline_id')
          .eq('user_id', user.id)
          .in('id', roleTaskIds)
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event']);

        if (tasksError) throw tasksError;

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

        if (allTasks.length > 0) {
          const taskIdsForJoins = allTasks.map(t => t.id);

          const [
            { data: rolesDataResult, error: rolesError },
            { data: domainsDataResult, error: domainsError },
            { data: goalsDataResult, error: goalsError },
            { data: notesDataResult, error: notesError },
            { data: delegatesDataResult, error: delegatesError }
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
          if (delegatesError) throw delegatesError;

          rolesData = rolesDataResult || [];
          domainsData = domainsDataResult || [];
          goalsData = goalsDataResult || [];
          notesData = notesDataResult || [];
          delegatesData = delegatesDataResult || [];
        }

        const transformedTasks = allTasks.map(task => ({
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: delegatesData?.some(d => d.parent_id === task.id),
          has_attachments: false,
        }));

        setTasks(transformedTasks);
        setDepositIdeas([]);

      } else {
        // First, get deposit idea IDs that are associated with this specific role
        const { data: roleJoinData, error: roleJoinError } = await supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id')
          .eq('parent_type', 'depositIdea')
          .eq('role_id', roleId);

        if (roleJoinError) throw roleJoinError;

        const roleDepositIdeaIds = roleJoinData?.map(rj => rj.parent_id) || [];

        if (roleDepositIdeaIds.length === 0) {
          setDepositIdeas([]);
          setTasks([]);
          return;
        }

        // Now fetch only the deposit ideas that have this role
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .in('id', roleDepositIdeaIds)
          .eq('archived', false)
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

        setDepositIdeas(transformedDepositIdeas);
        setTasks([]);
      }

    } catch (error) {
      console.error(`Error fetching role ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const fetchKRTasks = useCallback(async (krId: string, view: 'deposits' | 'ideas') => {
    if (loading) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (view === 'deposits') {
        // First, get task IDs that are associated with this specific key relationship
        const { data: krJoinData, error: krJoinError } = await supabase
          .from('0008-ap-universal-key-relationships-join')
          .select('parent_id')
          .eq('parent_type', 'task')
          .eq('key_relationship_id', krId);

        if (krJoinError) throw krJoinError;

        const krTaskIds = krJoinData?.map(krj => krj.parent_id) || [];

        if (krTaskIds.length === 0) {
          setTasks([]);
          setDepositIdeas([]);
          return;
        }

        // Now fetch only the tasks that have this key relationship
        const { data: tasksData, error: tasksError } = await supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .in('id', krTaskIds)
          .is('deleted_at', null)
          .is('parent_task_id', null)
          .not('status', 'in', '(completed,cancelled)')
          .in('type', ['task', 'event']);

        if (tasksError) throw tasksError;

        // Filter out Goal Bank actions by checking for week plans
        let allKRTasks: any[] = [];

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
          allKRTasks = tasksData.filter(task => !goalBankActionIds.has(task.id));
        }

        // Fetch join data only if we have tasks
        let rolesData: any[] = [];
        let domainsData: any[] = [];
        let goalsData: any[] = [];
        let notesData: any[] = [];
        let delegatesData: any[] = [];
        let keyRelationshipsData: any[] = [];

        if (allKRTasks.length > 0) {
          const taskIdsForJoins = allKRTasks.map(t => t.id);

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
            supabase.from('0008-ap-universal-goals-join').select('parent_id, goal:0008-ap-goals-12wk(id, title)').in('parent_id', taskIdsForJoins).eq('parent_type', 'task'),
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

        const transformedTasks = allKRTasks.map(task => ({
          ...task,
          roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
          domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
          goals: goalsData?.filter(g => g.parent_id === task.id).map(g => g.goal).filter(Boolean) || [],
          keyRelationships: keyRelationshipsData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
          has_notes: notesData?.some(n => n.parent_id === task.id),
          has_delegates: delegatesData?.some(d => d.parent_id === task.id),
          has_attachments: false,
        }));

        setTasks(transformedTasks);
        setDepositIdeas([]);

      } else {
        // First, get deposit idea IDs that are associated with this specific key relationship
        const { data: krJoinData, error: krJoinError } = await supabase
          .from('0008-ap-universal-key-relationships-join')
          .select('parent_id')
          .eq('parent_type', 'depositIdea')
          .eq('key_relationship_id', krId);

        if (krJoinError) throw krJoinError;

        const krDepositIdeaIds = krJoinData?.map(krj => krj.parent_id) || [];

        if (krDepositIdeaIds.length === 0) {
          setDepositIdeas([]);
          setTasks([]);
          return;
        }

        // Now fetch only the deposit ideas that have this key relationship
        const { data: depositIdeasData, error: depositIdeasError } = await supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .in('id', krDepositIdeaIds)
          .eq('archived', false)
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

        setDepositIdeas(transformedDepositIdeas);
        setTasks([]);
      }

    } catch (error) {
      console.error(`Error fetching KR ${view}:`, error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const fetchAllKeyRelationships = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setKeyRelationships(data || []);
    } catch (error) {
      console.error('Error fetching all key relationships:', error);
    }
  };


  // Reset to main Role Bank view when tab is pressed
  const resetToMain = useCallback(() => {
    setSelectedRole(null);
    setSelectedKR(null);
    setActiveMainTab('roles');
    setActiveView('deposits');
    setKRView('deposits');
    setKRJournalView('deposits');
    setJournalDateRange('week');
    setPeriodScore(undefined);
    setTasks([]);
    setDepositIdeas([]);
    // Clear KRs to prevent showing stale data from previous views
    setKeyRelationships([]);
    setFetchState('idle');
    setLoading(false);
    setKRLoading(false);
    setIsLoadingRole(false);
    setGoalProgress({});
    setLoadingGoalProgress(false);
    setManageRolesVisible(false);
    setEditRoleVisible(false);
    setEditKRVisible(false);
    setTaskFormVisible(false);
    setTaskDetailVisible(false);
    setDepositIdeaDetailVisible(false);
    setSelectedTask(null);
    setSelectedDepositIdea(null);
    setEditingTask(null);
    setEditingRole(null);
    setEditingKR(null);
    fetchAbortController.current?.abort();
    fetchAbortController.current = null;
    if (roleClickTimeout.current) {
      clearTimeout(roleClickTimeout.current);
      roleClickTimeout.current = null;
    }
    fetchInProgressRef.current = false;
  }, []);

  // Navigate to Manage Roles view
  const showManageRolesView = useCallback(() => {
    setActiveMainTab('manageRoles');
  }, []);

  // Return from Manage Roles view
  const hideManageRolesView = useCallback(() => {
    setActiveMainTab('roles');
    fetchRoles(); // Refresh roles after managing them
  }, []);

  useEffect(() => {
    // Register reset handler for this tab
    registerResetHandler('roles', resetToMain);

    const loadUserId = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };

    loadUserId();
    fetchRoles();

    // Listen for task creation events from other components
    const handleTaskEvent = () => {
      console.log('[RoleBank] Received task event, refreshing data...');
      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
      }
    };

    eventBus.on(EVENTS.TASK_CREATED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_UPDATED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_DELETED, handleTaskEvent);

    return () => {
      unregisterResetHandler('roles');
      if (roleClickTimeout.current) {
        clearTimeout(roleClickTimeout.current);
      }
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
      eventBus.off(EVENTS.TASK_CREATED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_UPDATED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_DELETED, handleTaskEvent);
    };
  }, [registerResetHandler, unregisterResetHandler, resetToMain, selectedRole, selectedKR, activeView, krView]);

  useEffect(() => {
    if (selectedRole && !isLoadingRole && !fetchInProgressRef.current) {
      const controller = new AbortController();
      fetchAbortController.current = controller;

      const fetchRoleData = async () => {
        try {
          fetchInProgressRef.current = true;
          setFetchState('loading-data');

          // Clear KRs first to prevent showing ALL KRs while loading
          setKeyRelationships([]);

          // Fetch in parallel for better performance
          const krPromise = fetchKeyRelationships(selectedRole.id);
          const tasksPromise = fetchRoleTasks(selectedRole.id, activeView);
          const scorePromise = calculateAuthenticScoreLocal(selectedRole.id);

          await Promise.all([krPromise, tasksPromise, scorePromise]);

          if (!controller.signal.aborted) {
            setFetchState('complete');
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Error fetching role data:', error);
            setFetchState('complete');
          }
        } finally {
          if (!controller.signal.aborted) {
            fetchInProgressRef.current = false;
          }
        }
      };

      fetchRoleData();

      return () => {
        controller.abort();
        fetchInProgressRef.current = false;
      };
    } else if (!selectedRole && !isLoadingRole) {
      // When no role is selected, show total authentic score
      calculateAuthenticScoreLocal();
    }
  }, [selectedRole?.id, activeView, isLoadingRole]);

  useEffect(() => {
    if (selectedKR && !isLoadingRole && !fetchInProgressRef.current) {
      const controller = new AbortController();
      fetchAbortController.current = controller;

      const fetchKRData = async () => {
        try {
          fetchInProgressRef.current = true;
          await fetchKRTasks(selectedKR.id, krView);
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Error fetching KR data:', error);
          }
        } finally {
          fetchInProgressRef.current = false;
        }
      };

      fetchKRData();

      return () => {
        controller.abort();
      };
    }
  }, [selectedKR?.id, krView, isLoadingRole]);

  useEffect(() => {
    if (selectedRole && !goalsLoading && twelveWeekGoals.length > 0 && fetchState === 'complete') {
      // Only fetch goal progress after role data is fully loaded
      fetchGoalProgressData();
    }
  }, [selectedRole?.id, goalsLoading, twelveWeekGoals.length, fetchState]);

  useEffect(() => {
    // Calculate period score when journal view is active and role/KR is selected
    if (activeView === 'journal' && selectedRole) {
      calculatePeriodScore(journalDateRange, 'role', selectedRole.id);
    } else if (krJournalView === 'journal' && selectedKR) {
      calculatePeriodScore(journalDateRange, 'key_relationship', selectedKR.id);
    } else {
      setPeriodScore(undefined);
    }
  }, [activeView, krJournalView, selectedRole?.id, selectedKR?.id, journalDateRange, calculatePeriodScore]);

  // Fetch all KRs when Key Relationships tab is selected (for the main tab view)
  useEffect(() => {
    if (activeMainTab === 'keyrelationships' && !selectedRole && !selectedKR) {
      fetchAllKeyRelationships();
    }
  }, [activeMainTab, selectedRole, selectedKR]);

  const handleViewChange = (view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
    setActiveView(view);
    if (selectedRole && (view === 'deposits' || view === 'ideas')) {
      fetchRoleTasks(selectedRole.id, view);
    }
  };

  const handleKRViewChange = (view: 'deposits' | 'ideas') => {
    setKRView(view);
    setKRJournalView(view);
    if (selectedKR) {
      fetchKRTasks(selectedKR.id, view);
    }
  };

  const handleKRJournalViewChange = (view: 'deposits' | 'ideas' | 'journal' | 'analytics') => {
    setKRJournalView(view);
    if (view !== 'journal' && view !== 'analytics' && selectedKR) {
      setKRView(view as 'deposits' | 'ideas');
      fetchKRTasks(selectedKR.id, view as 'deposits' | 'ideas');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleUpdateDepositIdea = async (depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setDepositIdeaDetailVisible(false);
    setTaskFormVisible(true);
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
      
      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleActivateDepositIdea = async (depositIdea: any) => {
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
  };
  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailVisible(true);
  };

  const handleDepositIdeaPress = (depositIdea: any) => {
    setSelectedDepositIdea(depositIdea);
    setDepositIdeaDetailVisible(true);
  };

  const handleUpdateTask = (task: Task) => {
    setEditingTask(task);
    setTaskDetailVisible(false);
    setTimeout(() => setTaskFormVisible(true), 100);
  };

  const handleDelegateTask = (task: Task) => {
    Alert.alert('Delegate', 'Delegation functionality coming soon!');
    setTaskDetailVisible(false);
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
      setTaskDetailVisible(false);
      
      if (selectedRole) {
        fetchRoleTasks(selectedRole.id, activeView);
      }
      if (selectedKR) {
        fetchKRTasks(selectedKR.id, krView);
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    if (selectedRole) {
      fetchRoleTasks(selectedRole.id, activeView);
    }
    if (selectedKR) {
      fetchKRTasks(selectedKR.id, krView);
    }
    refreshGoals();
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
  };

  const handleRolePress = useCallback((role: Role) => {
    // Cancel any pending role selection
    if (roleClickTimeout.current) {
      clearTimeout(roleClickTimeout.current);
    }

    // Abort any in-flight requests
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }

    // Clear KRs immediately to prevent showing wrong KRs during transition
    setKeyRelationships([]);

    // Immediately update selected role without blocking on loading states
    setSelectedRole(role);
    setSelectedKR(null);
    setIsLoadingRole(false);
    setFetchState('loading-data');
    fetchInProgressRef.current = false;
  }, []);

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setEditRoleVisible(true);
  };

  const handleEditKR = (kr: KeyRelationship) => {
    setEditingKR(kr);
    setEditKRVisible(true);
  };

  const handleRoleUpdate = () => {
    fetchRoles();
    setEditRoleVisible(false);
    setEditingRole(null);
  };

  const handleManageRolesUpdate = () => {
    fetchRoles();
  };

  const handleKRUpdate = () => {
    if (selectedRole) {
      fetchKeyRelationships(selectedRole.id);
    }
    fetchAllKeyRelationships();
    setEditKRVisible(false);
    setEditingKR(null);
  };

  const handleAddKR = async (roleId: string) => {
    try {
      // Validate role_id before creating KR
      if (!roleId) {
        Alert.alert('Error', 'A valid role must be selected to create a key relationship.');
        return;
      }

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create new KR with role_id - this permanently links the KR to the role
      const { data, error } = await supabase
        .from('0008-ap-key-relationships')
        .insert({
          name: 'New Key Relationship',
          role_id: roleId, // Critical: KR is permanently linked to this role
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Find and set the selected role
      const role = roles.find(r => r.id === roleId);
      if (role && !selectedRole) {
        setSelectedRole(role);
      }

      // Refresh KRs - will only fetch KRs for this specific roleId
      await fetchKeyRelationships(roleId);
      await fetchAllKeyRelationships();
      setEditingKR(data);
      setEditKRVisible(true);
    } catch (error) {
      console.error('Error creating key relationship:', error);
      Alert.alert('Error', (error as Error).message);
    }
  };

  const getImageUrl = (imagePath?: string, bucket: string = '0008-role-images') => {
    if (!imagePath) return null;
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
      const url = data.publicUrl;
      console.log('[RoleBank] Generated image URL:', { imagePath, bucket, url });
      return url;
    } catch (error) {
      console.error('[RoleBank] Error getting image URL:', error);
      return null;
    }
  };

  // Memoize image URLs to prevent recalculating on every render
  const roleImageUrls = useMemo(() => {
    const urls: Record<string, string | null> = {};
    roles.forEach(role => {
      if (role.image_path) {
        urls[role.id] = getImageUrl(role.image_path);
      }
    });
    return urls;
  }, [roles]);

  const krImageUrls = useMemo(() => {
    const urls: Record<string, string | null> = {};
    keyRelationships.forEach(kr => {
      if (kr.image_path) {
        urls[kr.id] = getImageUrl(kr.image_path, '0008-key-relationship-images');
      }
    });
    return urls;
  }, [keyRelationships]);

  // Render custom header
  const renderRoleBankHeader = () => {
    if (activeMainTab === 'manageRoles') {
      // Manage Roles view header
      return (
        <View style={[styles.customHeader, { backgroundColor: colors.primary }]}>
          <View style={styles.customHeaderTop}>
            <TouchableOpacity
              style={styles.customBackButton}
              onPress={hideManageRolesView}
            >
              <Text style={styles.customBackButtonText}>← Role Bank</Text>
            </TouchableOpacity>
            <View style={styles.customHeaderCenter}>
              <Text style={styles.customHeaderTitle}>Manage Roles</Text>
            </View>
            <View style={styles.customScoreContainer}>
              <Text style={styles.customScoreLabel}>Authentic Score</Text>
              <Text style={styles.customScoreValue}>{authenticScore}</Text>
            </View>
          </View>
        </View>
      );
    }

    if (selectedKR) {
      // Key Relationship detail header
      return (
        <View style={[styles.customHeader, { backgroundColor: selectedRole?.color || '#0078d4' }]}>
          <View style={styles.customHeaderTop}>
            <TouchableOpacity
              style={styles.customBackButton}
              onPress={() => setSelectedKR(null)}
            >
              <Text style={styles.customBackButtonText}>← Back to Role</Text>
            </TouchableOpacity>
            <View style={styles.customHeaderCenter}>
              <Text style={styles.customHeaderTitle}>{selectedKR.name}</Text>
              <Text style={styles.customHeaderSubtitle}>Key Relationship in {selectedRole?.label}</Text>
            </View>
            <View style={styles.customHeaderRight}>
              <TouchableOpacity
                style={styles.customEditButton}
                onPress={() => handleEditKR(selectedKR)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Edit2 size={20} color="#ffffff" />
              </TouchableOpacity>
              <View style={styles.customScoreContainer}>
                <Text style={styles.customScoreLabel}>Authentic Score</Text>
                <Text style={styles.customScoreValue}>{authenticScore}</Text>
              </View>
            </View>
          </View>
          <View style={styles.customHeaderBottom}>
            <View style={styles.customToggleGroup}>
              {(['deposits', 'ideas', 'journal', 'analytics'] as const).map((view) => (
                <TouchableOpacity
                  key={view}
                  style={[styles.customToggleButton, krJournalView === view && styles.customActiveToggle]}
                  onPress={() => handleKRJournalViewChange(view)}
                >
                  <Text style={[styles.customToggleText, krJournalView === view && styles.customActiveToggleText]}>
                    {view.charAt(0).toUpperCase() + view.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    if (selectedRole) {
      // Individual role detail header
      return (
        <View style={[styles.customHeader, { backgroundColor: selectedRole.color || '#0078d4' }]}>
          <View style={styles.customHeaderTop}>
            <TouchableOpacity
              style={styles.customBackButton}
              onPress={() => setSelectedRole(null)}
            >
              <Text style={styles.customBackButtonText}>← Role Bank</Text>
            </TouchableOpacity>
            <View style={styles.customHeaderCenter}>
              <Text style={styles.customHeaderTitle}>{selectedRole.label}</Text>
            </View>
            <View style={styles.customHeaderRight}>
              <TouchableOpacity
                style={styles.customEditButton}
                onPress={() => handleEditRole(selectedRole)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Edit2 size={20} color="#ffffff" />
              </TouchableOpacity>
              <View style={styles.customScoreContainer}>
                <Text style={styles.customScoreLabel}>Authentic Score</Text>
                <Text style={styles.customScoreValue}>{roleAuthenticScore}</Text>
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

    // Main Role Bank header with tabs
    return (
      <View style={[styles.customHeader, { backgroundColor: colors.primary }]}>
        <View style={styles.customHeaderTop}>
          <TouchableOpacity
            style={styles.customMenuButton}
            onPress={() => navigation.openDrawer()}
          >
            <Menu size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.customHeaderCenter}>
            <Text style={styles.customHeaderTitle}>Role Bank</Text>
          </View>
          <View style={styles.customScoreContainer}>
            <Text style={styles.customScoreLabel}>Authentic Score</Text>
            <Text style={styles.customScoreValue}>{authenticScore}</Text>
          </View>
        </View>
        <View style={styles.customHeaderBottom}>
          <View style={styles.customMainTabsContainer}>
            <View style={styles.customMainToggleGroup}>
              <TouchableOpacity
                style={[styles.customToggleButton, activeMainTab === 'roles' && styles.customActiveToggle]}
                onPress={() => setActiveMainTab('roles')}
              >
                <Text style={[styles.customToggleText, activeMainTab === 'roles' && [styles.customActiveToggleText, { color: colors.primary }]]}>
                  Roles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.customToggleButton]}
                onPress={showManageRolesView}
              >
                <Text style={[styles.customToggleText]}>
                  Manage Roles
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.customSingleButton, activeMainTab === 'keyrelationships' && styles.customActiveSingleButton]}
              onPress={() => setActiveMainTab('keyrelationships')}
            >
              <Text style={[styles.customSingleButtonText, activeMainTab === 'keyrelationships' && [styles.customActiveSingleButtonText, { color: colors.primary }]]}>
                Key Relationships
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (activeMainTab === 'manageRoles') {
      // Manage Roles view
      return (
        <View style={styles.content}>
          <ManageRolesContent
            onUpdate={handleManageRolesUpdate}
          />
        </View>
      );
    }

    if (selectedKR) {
      // Key Relationship view
      return (
        <View style={styles.content}>

          <ScrollView style={styles.taskList}>
            {krJournalView === 'journal' ? (
              krJournalScope && (
                <JournalView
                  scope={krJournalScope}
                  onEntryPress={handleJournalEntryPress}
                  periodScore={periodScore}
                  onDateRangeChange={handleJournalDateRangeChange}
                />
              )
            ) : krJournalView === 'analytics' ? (
              krJournalScope && (
                <AnalyticsView
                  scope={krJournalScope}
                />
              )
            ) : (loading && fetchState === 'loading-data') ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : krJournalView === 'deposits' ? (
              tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No deposits found for this key relationship</Text>
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
            ) : krJournalView === 'ideas' ? (
              depositIdeas.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No ideas found for this key relationship</Text>
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

    if (selectedRole) {
      // Role view
      return (
        <View style={styles.content}>

          {/* 12-Week Goals Strip - Only show when data is stable */}
          {activeView === 'deposits' && twelveWeekGoals.length > 0 && fetchState === 'complete' && (
            <View style={styles.goalsStrip}>
              <Text style={styles.goalsStripTitle}>12-Week Goals</Text>
              {loadingGoalProgress ? (
                <View style={styles.goalsStripLoading}>
                  <Text style={styles.goalsStripLoadingText}>Loading goals...</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.goalsStripContent}>
                    {twelveWeekGoals.map(goal => {
                      const progress = goalProgress[goal.id];
                      if (!progress) return null;

                      return (
                        <GoalProgressCard
                          key={`goal-${goal.id}-${selectedRole.id}`}
                          goal={goal}
                          progress={progress}
                          compact={true}
                          onAddAction={() => {
                            setEditingTask({
                              type: 'task',
                              selectedGoalIds: [goal.id],
                              twelveWeekGoalChecked: true,
                              countsTowardWeeklyProgress: true,
                              selectedRoleIds: [selectedRole.id],
                            } as any);
                            setTaskFormVisible(true);
                          }}
                        />
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
          <ScrollView style={styles.taskList}>
            {activeView === 'journal' ? (
              journalScope && (
                <JournalView
                  scope={journalScope}
                  onEntryPress={handleJournalEntryPress}
                  periodScore={periodScore}
                  onDateRangeChange={handleJournalDateRangeChange}
                />
              )
            ) : activeView === 'analytics' ? (
              journalScope && (
                <AnalyticsView
                  scope={journalScope}
                />
              )
            ) : (loading && fetchState === 'loading-data') ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : activeView === 'deposits' ? (
              tasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No deposits found for this role</Text>
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
                  <Text style={styles.emptyText}>No ideas found for this role</Text>
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

          {/* Key Relationships Section - Always visible when a role is selected */}
          <View style={styles.keyRelationshipsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Key Relationships</Text>
              <TouchableOpacity
                style={styles.addKRButton}
                onPress={() => handleAddKR(selectedRole.id)}
                disabled={krLoading}
              >
                <Plus size={16} color="#0078d4" />
                <Text style={styles.addKRButtonText}>Add KR</Text>
              </TouchableOpacity>
            </View>
            {krLoading ? (
              <View style={styles.krLoadingContainer}>
                <Text style={styles.krLoadingText}>Loading key relationships...</Text>
              </View>
            ) : keyRelationships.length === 0 ? (
              <View style={styles.emptyKRContainer}>
                <Text style={styles.emptyKRText}>No key relationships yet</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.keyRelationshipsList}>
                  {keyRelationships.filter(kr => kr.role_id === selectedRole.id).map(kr => (
                    <TouchableOpacity
                      key={kr.id}
                      style={styles.keyRelationshipCard}
                      onPress={() => setSelectedKR(kr)}
                    >
                      {kr.image_path && krImageUrls[kr.id] ? (
                        <Image
                          source={{ uri: krImageUrls[kr.id] || undefined }}
                          style={styles.krImage}
                          onError={(error) => {
                            console.error('[RoleBank] Failed to load KR image:', kr.image_path, error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <View style={styles.krImagePlaceholder}>
                          <Users size={24} color="#6b7280" />
                        </View>
                      )}
                      <Text style={styles.krName} numberOfLines={2}>{kr.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    // Main Role Bank view with tabs
    return (
      <View style={styles.content}>
        {activeMainTab === 'roles' && (
          <ScrollView style={styles.rolesList}>
            {roles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No active roles found</Text>
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => setManageRolesVisible(true)}
                >
                  <Text style={styles.manageButtonText}>Manage Roles</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.rolesGrid}>
                {roles.map(role => (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.roleCard,
                      styles.roleCardHalf,
                      { borderLeftColor: role.color || '#0078d4' }
                    ]}
                    onPress={() => handleRolePress(role)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roleCardContent}>
                      <View style={styles.roleCardMain}>
                        {role.image_path && roleImageUrls[role.id] ? (
                          <Image
                            source={{ uri: roleImageUrls[role.id] || undefined }}
                            style={styles.roleImage}
                            onError={(error) => {
                              console.error('[RoleBank] Failed to load role image:', role.label, role.image_path, error.nativeEvent.error);
                            }}
                          />
                        ) : (
                          <View style={[styles.roleImagePlaceholder, { backgroundColor: role.color || '#0078d4' }]}>
                            <Text style={styles.roleImageText}>
                              {role.label.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={styles.roleInfo}>
                          <Text style={styles.roleName} numberOfLines={2}>{role.label}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.editRoleButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEditRole(role);
                        }}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Pencil size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {activeMainTab === 'keyrelationships' && (
          <ScrollView style={styles.krContent}>
            <View style={styles.krHeader}>
              <Text style={styles.krTitle}>All Key Relationships</Text>
              <Text style={styles.krSubtitle}>Organized by role</Text>
            </View>
            {roles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No roles found. Create roles first to add key relationships.</Text>
              </View>
            ) : (
              <View style={styles.krList}>
                {roles.map(role => {
                  const roleKRs = keyRelationships.filter(kr => kr.role_id === role.id);
                  return (
                    <View key={role.id} style={styles.krRoleSection}>
                      <View style={styles.krRoleHeader}>
                        <View style={[styles.krRoleIndicator, { backgroundColor: role.color || '#0078d4' }]} />
                        <Text style={styles.krRoleName}>{role.label}</Text>
                        <TouchableOpacity
                          style={styles.krAddButton}
                          onPress={() => handleAddKR(role.id)}
                        >
                          <Plus size={16} color="#0078d4" />
                          <Text style={styles.krAddButtonText}>Add KR</Text>
                        </TouchableOpacity>
                      </View>
                      {roleKRs.length === 0 ? (
                        <View style={styles.krEmptySection}>
                          <Text style={styles.krEmptyText}>No key relationships yet</Text>
                        </View>
                      ) : (
                        <View style={styles.krItems}>
                          {roleKRs.map(kr => (
                            <TouchableOpacity
                              key={kr.id}
                              style={styles.krItem}
                              onPress={() => {
                                setSelectedRole(role);
                                setSelectedKR(kr);
                              }}
                            >
                              {kr.image_path && krImageUrls[kr.id] ? (
                                <Image
                                  source={{ uri: krImageUrls[kr.id] || undefined }}
                                  style={styles.krItemImage}
                                />
                              ) : (
                                <View style={styles.krItemImagePlaceholder}>
                                  <Users size={20} color="#6b7280" />
                                </View>
                              )}
                              <View style={styles.krItemInfo}>
                                <Text style={styles.krItemName}>{kr.name}</Text>
                                {kr.description && (
                                  <Text style={styles.krItemDescription} numberOfLines={1}>
                                    {kr.description}
                                  </Text>
                                )}
                              </View>
                              <TouchableOpacity
                                style={styles.krItemEditButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleEditKR(kr);
                                }}
                              >
                                <Pencil size={16} color="#6b7280" />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderRoleBankHeader()}
      {renderContent()}

      <DraggableFab onPress={() => {
        if (selectedRole) {
          setEditingTask({
            type: 'task',
            selectedRoleIds: [selectedRole.id],
          } as any);
        } else if (selectedKR && selectedRole) {
          setEditingTask({
            type: 'task',
            selectedRoleIds: [selectedRole.id],
            selectedKeyRelationshipIds: [selectedKR.id],
          } as any);
        } else {
          setEditingTask(null);
        }
        setTaskFormVisible(true);
      }}>
        <Plus size={24} color="#ffffff" />
      </DraggableFab>

      {/* Modals */}
      <ManageRolesModal
        visible={manageRolesVisible}
        onClose={() => setManageRolesVisible(false)}
        onUpdate={handleManageRolesUpdate}
      />

      <EditRoleModal
        visible={editRoleVisible}
        onClose={() => setEditRoleVisible(false)}
        onUpdate={handleRoleUpdate}
        role={editingRole}
      />

      <EditKRModal
        visible={editKRVisible}
        onClose={() => setEditKRVisible(false)}
        onUpdate={handleKRUpdate}
        keyRelationship={editingKR}
        roleName={selectedRole?.label}
      />

      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode={editingTask ? "edit" : "create"}
          initialData={editingTask || undefined}
          onSubmitSuccess={handleFormSubmitSuccess}
          onClose={handleFormClose}
        />
      </Modal>

      <TaskDetailModal
        visible={taskDetailVisible}
        task={selectedTask}
        onClose={() => setTaskDetailVisible(false)}
        onUpdate={handleUpdateTask}
        onDelegate={handleDelegateTask}
        onCancel={handleCancelTask}
      />

      <DepositIdeaDetailModal
        visible={depositIdeaDetailVisible}
        depositIdea={selectedDepositIdea}
        onClose={() => setDepositIdeaDetailVisible(false)}
        onUpdate={handleUpdateDepositIdea}
        onCancel={handleCancelDepositIdea}
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
  header: {
    backgroundColor: '#0078d4',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 6,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
    alignSelf: 'flex-start',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 80,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  rolesList: {
    flex: 1,
    padding: 16,
  },
  roleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  roleCardMain: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  roleCardHalf: {
    width: '23%',
    minWidth: 70,
    minHeight: 120,
  },
  roleImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  roleImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleImageText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  roleInfo: {
    width: '100%',
    alignItems: 'center',
  },
  roleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  editRoleButton: {
    padding: 8,
    position: 'absolute',
    top: 4,
    right: 4,
  },
  taskList: {
    flex: 1,
    padding: 16,
  },
  keyRelationshipsSection: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  addKRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addKRButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  emptyKRContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyKRText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  krLoadingContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  krLoadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  keyRelationshipsList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  keyRelationshipCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    width: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  krImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
  },
  krImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  krName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 16,
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
  manageButton: {
    backgroundColor: '#0078d4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  goalsStrip: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
  },
  goalsStripTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  goalsStripContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  goalsStripLoading: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  goalsStripLoadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  roleCardDisabled: {
    opacity: 0.5,
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
  customHeaderSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
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
  customMainTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
  customSingleButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  customActiveSingleButton: {
    backgroundColor: '#ffffff',
  },
  customSingleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  customActiveSingleButtonText: {
    color: '#0078d4',
  },
  // Key Relationships tab styles
  krContent: {
    flex: 1,
    padding: 16,
  },
  krHeader: {
    marginBottom: 20,
  },
  krTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  krSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  krList: {
    gap: 20,
  },
  krRoleSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  krRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  krRoleIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  krRoleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  krAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0078d4',
  },
  krAddButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0078d4',
  },
  krEmptySection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  krEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  krItems: {
    gap: 8,
  },
  krItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  krItemImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  krItemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  krItemInfo: {
    flex: 1,
  },
  krItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  krItemDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  krItemEditButton: {
    padding: 8,
  },
});