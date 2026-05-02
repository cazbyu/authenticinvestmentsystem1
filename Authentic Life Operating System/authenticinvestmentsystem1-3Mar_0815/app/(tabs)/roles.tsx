import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { toLocalISOString } from '@/lib/dateUtils';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Image, Platform, useWindowDimensions, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UniversalHeader } from '@/components/UniversalHeader';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { SpeedDialFab } from '@/components/SpeedDialFab';
import { ActivityConfig, ACTIVITY_CONFIGS } from '@/lib/activityConfig';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { DepositIdeaCard } from '@/components/depositIdeas/DepositIdeaCard';
const ActionDetailsModal = lazy(() => import('@/components/tasks/ActionDetailsModal').then(m => ({ default: m.ActionDetailsModal })));
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
const TaskEventForm = lazy(() => import('@/components/tasks/TaskEventForm'));
import { ManageRolesModal } from '@/components/settings/ManageRolesModal';
import { ManageRolesContent } from '@/components/settings/ManageRolesContent';
import { EditRoleModal } from '@/components/settings/EditRoleModal';
import { EditKRModal } from '@/components/settings/EditKRModal';
import { JournalView } from '@/components/journal/JournalView';
import JournalForm from '@/components/reflections/JournalForm';
import { ReflectionDetailsModal } from '@/components/reflections/ReflectionDetailsModal';
import { ReflectionWithRelations, fetchReflectionById } from '@/lib/reflectionUtils';
import { getSupabaseClient } from '@/lib/supabase';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { Plus, Users, UserX, Ban, Menu, CreditCard as Edit2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { GoalDetailView } from '@/components/goals/GoalDetailView';
import { fetchRoleGoals, fetchZoneGoalsProgress, fetchKRGoals } from '@/lib/zoneDataService';
import { calculateAuthenticScore as calculateScore, calculateAuthenticScoreForRole, calculateAuthenticScoreForKR, calculateAuthenticScoreForPeriod, fetchGoalsForJoinRows } from '@/lib/taskUtils';
import { GoalEffortProgress } from '@/lib/goalEffortScore';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { WebNavigationMenu } from '@/components/WebNavigationMenu';
import { RoleBankHub } from '@/components/roles/RoleBankHub';
import { RoleIdentityHeader } from '@/components/roles/RoleIdentityHeader';
import { RoleStatsRow } from '@/components/roles/RoleStatsRow';
import { RoleMySpaceSection } from '@/components/roles/RoleMySpaceSection';
import { RoleToolshed } from '@/components/roles/RoleToolshed';
import { KRIdentityHeader } from '@/components/keyrelationships/KRIdentityHeader';
import { KRStatsRow } from '@/components/keyrelationships/KRStatsRow';
import { KRMySpaceSection } from '@/components/keyrelationships/KRMySpaceSection';
import { KRToolshed } from '@/components/keyrelationships/KRToolshed';
import { KRTile } from '@/components/common/KRTile';
import { getRoleStatistics, RoleStatistics, getLastActivityPerRole, getLastActivityPerKR } from '@/lib/roleStatistics';
import { useHeaderColor } from '@/contexts/HeaderColorContext';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Role {
  id: string;
  label: string;
  category?: string;
  image_path?: string;
  color?: string;
  icon?: string;
  vision_statement?: string | null;
  power_question_answer?: string | null;
}

interface KeyRelationship {
  id: string;
  name: string | null;
  role_id: string | null;
  user_id: string;
  image_url: string | null;
  image_path: string | null;
  description: string | null;
  vision_statement: string | null;  // R-6-schema NEW
  updated_at: string | null;
}

export default function Roles() {
  const navigation = useNavigation<DrawerNavigation>();
  const { authenticScore, refreshScoreForRole } = useAuthenticScore();
const { headerColor } = useHeaderColor();
  const { registerResetHandler, unregisterResetHandler } = useTabReset();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [selectedKR, setSelectedKR] = useState<KeyRelationship | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchState, setFetchState] = useState<'idle' | 'loading-role' | 'loading-data' | 'complete'>('idle');
  const [krLoading, setKRLoading] = useState(false);

  // Main tab navigation state
  const [activeMainTab, setActiveMainTab] = useState<'roles' | 'keyrelationships' | 'manageRoles'>('roles');

  // Modal states
  const [manageRolesVisible, setManageRolesVisible] = useState(false);
  const [editRoleVisible, setEditRoleVisible] = useState(false);
  const [editKRVisible, setEditKRVisible] = useState(false);
  const [addKRMode, setAddKRMode] = useState(false);
  const [addKRRoleId, setAddKRRoleId] = useState<string | null>(null);
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
  // B27: Goal detail screen-replacement state. Mirrors the wellness.tsx
  // and goals.tsx pattern — when non-null, the page-body ternary swaps
  // contents for <GoalDetailView>.
  const [selectedGoalForDetail, setSelectedGoalForDetail] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingKR, setEditingKR] = useState<KeyRelationship | null>(null);
  const [roleAuthenticScore, setRoleAuthenticScore] = useState(0);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [periodScore, setPeriodScore] = useState<number | undefined>(undefined);
  const [journalDateRange, setJournalDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isWebMenuVisible, setIsWebMenuVisible] = useState(false);
  const [settingsSidebarVisible, setSettingsSidebarVisible] = useState(false);
  const fetchAbortController = useRef<AbortController | null>(null);
  const krScrollRef = useRef<ScrollView>(null);
  const [krScrollOffset, setKrScrollOffset] = useState(0);
  const roleClickTimeout = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgressRef = useRef<boolean>(false);
  const goalsAbortControllerRef = useRef<AbortController | null>(null);
  // R-6-mount: abort controller for KR goals fetch (parallel to goalsAbortControllerRef
  // for role-side). Cancels in-flight fetches on selectedKR change to prevent stale state.
  const krGoalsAbortControllerRef = useRef<AbortController | null>(null);

  // Follow-through TaskEventForm state
  const [followThroughFormVisible, setFollowThroughFormVisible] = useState(false);
  const [followThroughPreSelectedType, setFollowThroughPreSelectedType] = useState<'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection'>('task');
  const [followThroughParentId, setFollowThroughParentId] = useState<string>('');
  const [followThroughParentType, setFollowThroughParentType] = useState<string>('');
  const [refreshAssociatedItemsKey, setRefreshAssociatedItemsKey] = useState(0);

  // Role Bank statistics
  const [roleStatsPeriod, setRoleStatsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [roleStatistics, setRoleStatistics] = useState<Record<string, RoleStatistics>>({});
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [lastActivityMap, setLastActivityMap] = useState<Map<string, string | null>>(new Map());
  const [krLastActivityMap, setKrLastActivityMap] = useState<Map<string, string | null>>(new Map());

  // Speed Dial activity config state
  const [selectedActivityConfig, setSelectedActivityConfig] = useState<ActivityConfig | null>(null);

  // R-5b: goals fed directly to RoleToolshed.goals + RoleGoalsToolshedPanel.
  // Filled by fetchGoalsForRole (line 283) on selectedRole change. The
  // R-5a back-compat alias `roleLinkedTwelveWeekGoals` died with the
  // 12-Week Goals strip in this commit.
  const [goals, setGoals] = useState<any[]>([]);

  // Goal progress state
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalEffortProgress>>({});
  const [loadingGoalProgress, setLoadingGoalProgress] = useState(false);

  // R-5a: Cross-section single-open coordinators. R-5b will wire these
  // through to RoleMySpaceSection (openTile / onTileChange) and
  // RoleToolshed (openSurface / onSurfaceChange). When one section opens
  // a tile/surface, the other clears — same 1+6c lock wellness uses.
  const [openMySpaceTile, setOpenMySpaceTile] = useState<'upcoming' | 'overdue' | 'idea' | null>(null);
  const [openToolshedSurface, setOpenToolshedSurface] = useState<'goals' | 'journal' | 'analytics' | null>(null);

  // R-6-mount: KR detail page state slots. Parallel to role-side openMySpaceTile /
  // openToolshedSurface for cross-section single-open coordination on the KR detail
  // page. handleKRMySpaceTileChange + handleKRToolshedSurfaceChange below cross-clear.
  const [openKRMySpaceTile, setOpenKRMySpaceTile] = useState<'upcoming' | 'overdue' | 'idea' | null>(null);
  const [openKRToolshedSurface, setOpenKRToolshedSurface] = useState<'goals' | 'journal' | 'analytics' | null>(null);

  // R-6-mount: KR-scoped Authentic Score state. Replaces audit Q4's GLOBAL score bug
  // at line ~1279 (KR header was rendering useAuthenticScore.authenticScore — the
  // user-level score — instead of a KR-scoped value). Computed via
  // calculateAuthenticScoreForKR (R-6-lib) in Phase 2 effect; rendered in Phase 3
  // surgical fix.
  const [krAuthenticScore, setKrAuthenticScore] = useState<number | null>(null);

  // R-6-mount: KR goals + progress for KRGoalsToolshedPanel (presentational —
  // parent owns fetch). Filled by Phase 2 effect via fetchKRGoals + fetchZoneGoalsProgress.
  const [krGoals, setKrGoals] = useState<any[]>([]);
  const [krGoalProgress, setKrGoalProgress] = useState<Record<string, GoalEffortProgress>>({});

  // R-6-mount: KR Journal date range state (for KRToolshed Journal surface).
  // Parallel to role-side journalDateRange. Default 'all' per audit (no tile-badge
  // constraint on KR side, so user-friendly default to show all entries).
  const [krJournalDateRange, setKrJournalDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const calculatePeriodScore = useCallback(async (dateRange: 'today' | 'week' | 'month' | 'all', scopeType: 'role' | 'key_relationship', scopeId: string) => {
    // R-5b Edit 0: 'today' is supported by JournalView's period selector but
    // calculateAuthenticScoreForPeriod (taskUtils) only accepts 'week'|'month'|'all'.
    // Skip the score calc rather than crash; UI shows undefined.
    if (dateRange === 'today') {
      setPeriodScore(undefined);
      return;
    }
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

  const handleJournalDateRangeChange = useCallback((dateRange: 'today' | 'week' | 'month' | 'all') => {
    setJournalDateRange(dateRange);
    if (selectedRole) {
      calculatePeriodScore(dateRange, 'role', selectedRole.id);
    } else if (selectedKR) {
      calculatePeriodScore(dateRange, 'key_relationship', selectedKR.id);
    }
  }, [selectedRole, selectedKR, calculatePeriodScore]);

  // R-5a: Cross-section single-open coordinators. When MY SPACE opens a
  // tile, Toolshed clears its open surface, and vice versa. Same 1+6c
  // lock the wellness landing uses (W-0/B30/B31). R-5b will pass these
  // through as openTile / onTileChange (RoleMySpaceSection) and
  // openSurface / onSurfaceChange (RoleToolshed).
  const handleMySpaceTileChange = useCallback(
    (next: 'upcoming' | 'overdue' | 'idea' | null) => {
      if (next !== null) setOpenToolshedSurface(null);
      setOpenMySpaceTile(next);
    },
    [],
  );

  const handleToolshedSurfaceChange = useCallback(
    (next: 'goals' | 'journal' | 'analytics' | null) => {
      if (next !== null) setOpenMySpaceTile(null);
      setOpenToolshedSurface(next);
    },
    [],
  );

  // R-6-mount: KR detail page cross-clear handlers. Parallel to role-side above.
  // When user opens a KR MY SPACE tile, any open KR Toolshed surface closes (and
  // vice versa). NOTE: independent of role-side openMySpaceTile / openToolshedSurface
  // — KR detail is a separate page render, role-side state is left untouched.
  const handleKRMySpaceTileChange = useCallback(
    (next: 'upcoming' | 'overdue' | 'idea' | null) => {
      if (next !== null) setOpenKRToolshedSurface(null);
      setOpenKRMySpaceTile(next);
    },
    [],
  );

  const handleKRToolshedSurfaceChange = useCallback(
    (next: 'goals' | 'journal' | 'analytics' | null) => {
      if (next !== null) setOpenKRMySpaceTile(null);
      setOpenKRToolshedSurface(next);
    },
    [],
  );

  const handleJournalEntryPress = async (entry: any) => {
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
      setSelectedActivityConfig(null);
      setTaskFormVisible(true);
    } else if (entry.source_type === 'depositIdea') {
      // Open TaskEventForm in depositIdea reflection mode for editing
      const editData = {
        ...entry.source_data,
        type: 'reflection',
        reflectionMode: 'depositIdea'
      };
      setEditingTask(editData);
      setSelectedActivityConfig(null);
      setTaskFormVisible(true);
    } else if (entry.source_type === 'reflection') {
      // Fetch full reflection data and open ReflectionDetailsModal
      const reflection = await fetchReflectionById(entry.source_id);
      if (reflection) {
        setSelectedReflectionDetail(reflection);
        setReflectionDetailVisible(true);
      }
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

  // R-5a: fetchGoalsForRole replaces the old useGoals →
  // fetchRoleLinkedGoalIds 2-step chain. Single call to fetchRoleGoals
  // (R-1) returns role-filtered goals; fetchZoneGoalsProgress (scope-
  // agnostic) returns real Effort Scores. Side effect: closes backlog
  // #11 — the old fetchGoalProgressData stamped zero-effort placeholders
  // because calculateGoalProgress queried a dropped column. The new
  // chain returns real values.
  const fetchGoalsForRole = useCallback(async (roleId: string) => {
    if (goalsAbortControllerRef.current) goalsAbortControllerRef.current.abort();
    const controller = new AbortController();
    goalsAbortControllerRef.current = controller;
    try {
      setLoadingGoalProgress(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || controller.signal.aborted) return;
      const roleGoals = await fetchRoleGoals(supabase, roleId, user.id, controller.signal);
      if (controller.signal.aborted) return;
      const progress = await fetchZoneGoalsProgress(supabase, roleGoals, controller.signal);
      if (controller.signal.aborted) return;
      setGoals(roleGoals);
      setGoalProgress(progress);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[roles.tsx] Error fetching role goals:', error);
    } finally {
      if (!controller.signal.aborted) setLoadingGoalProgress(false);
    }
  }, []);

  // R-5a: drive fetchGoalsForRole on selectedRole change. Replaces the
  // old useGoals hook + fetchRoleLinkedGoalIds populate-effect.
  useEffect(() => {
    if (selectedRole) {
      fetchGoalsForRole(selectedRole.id);
    } else {
      setGoals([]);
      setGoalProgress({});
    }
    return () => {
      if (goalsAbortControllerRef.current) goalsAbortControllerRef.current.abort();
    };
  }, [selectedRole?.id, fetchGoalsForRole]);

  // R-6-mount: KR goals + progress fetcher. Parallel to fetchGoalsForRole above
  // but scoped via fetchKRGoals (R-6-lib). fetchZoneGoalsProgress is scope-agnostic
  // and reused as-is. Drives KRGoalsToolshedPanel which is presentational
  // (parent owns the data per audit Q5).
  const fetchKRGoalsAndProgress = useCallback(async (krId: string) => {
    if (krGoalsAbortControllerRef.current) krGoalsAbortControllerRef.current.abort();
    const controller = new AbortController();
    krGoalsAbortControllerRef.current = controller;
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || controller.signal.aborted) return;
      const krGoalsList = await fetchKRGoals(supabase, krId, user.id, controller.signal);
      if (controller.signal.aborted) return;
      const progress = await fetchZoneGoalsProgress(supabase, krGoalsList, controller.signal);
      if (controller.signal.aborted) return;
      setKrGoals(krGoalsList);
      setKrGoalProgress(progress);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[roles.tsx] Error fetching KR goals:', error);
    }
  }, []);

  // R-6-mount: drive fetchKRGoalsAndProgress on selectedKR change. Mirrors the
  // role-side useEffect just above. Clears state when KR is deselected.
  useEffect(() => {
    if (selectedKR) {
      fetchKRGoalsAndProgress(selectedKR.id);
    } else {
      setKrGoals([]);
      setKrGoalProgress({});
    }
    return () => {
      if (krGoalsAbortControllerRef.current) krGoalsAbortControllerRef.current.abort();
    };
  }, [selectedKR?.id, fetchKRGoalsAndProgress]);

  // R-6-mount: KR authentic score effect. Computes via calculateAuthenticScoreForKR
  // (R-6-lib added in lib/taskUtils). Subscribes to task lifecycle events for
  // real-time refresh. Resolves audit Q4's GLOBAL score bug at line ~1279
  // (rendered in Phase 3 surgical fix).
  useEffect(() => {
    if (!selectedKR || !currentUserId) {
      setKrAuthenticScore(null);
      return;
    }

    let cancelled = false;

    const loadScore = async () => {
      try {
        const supabase = getSupabaseClient();
        const score = await calculateAuthenticScoreForKR(supabase, currentUserId, selectedKR.id);
        if (!cancelled) setKrAuthenticScore(score);
      } catch (e) {
        if (!cancelled) {
          console.error('[roles.tsx] KR authentic score load failed', e);
          setKrAuthenticScore(null);
        }
      }
    };

    loadScore();

    // Refresh on task lifecycle events. Matches the subscription set used by
    // KRUpcomingPanel + KROverduePanel (R-6-components-B) — score and panels
    // stay in sync regardless of which event fires. TASK_UPDATED is critical:
    // re-tagging a task TO/FROM this KR's scope, uncompleting a task, or
    // editing a tagged task should all refresh the score.
    const refresh = () => loadScore();
    const events = [
      EVENTS.TASK_CREATED,
      EVENTS.TASK_UPDATED,
      EVENTS.TASK_DELETED,
      EVENTS.TASK_COMPLETED,
      EVENTS.REFRESH_ALL_TASKS,
    ];
    for (const e of events) eventBus.on(e, refresh);

    return () => {
      cancelled = true;
      for (const e of events) eventBus.off(e, refresh);
    };
  }, [selectedKR?.id, currentUserId]);

  // R-5a: fetchGoalProgressData kept as an alias delegating to
  // fetchGoalsForRole so existing call sites (B27 goal-detail handlers,
  // refresh paths) still work. Returns the same Promise contract.
  const fetchGoalProgressData = useCallback(async () => {
    if (!selectedRole) {
      setGoalProgress({});
      return;
    }
    await fetchGoalsForRole(selectedRole.id);
  }, [selectedRole?.id, fetchGoalsForRole]);

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

  const fetchLastActivity = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const map = await getLastActivityPerRole(supabase, user.id);
      setLastActivityMap(map);
    } catch (error) {
      console.error('Error fetching role last-activity map:', error);
    }
  }, []);

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
      const krMap = await getLastActivityPerKR(supabase, user.id);
      setKrLastActivityMap(krMap);
    } catch (error) {
      console.error('Error fetching key relationships:', error);
      setKeyRelationships([]);
    } finally {
      setKRLoading(false);
    }
  }, []);

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
    setJournalDateRange('week');
    setPeriodScore(undefined);
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
    setSelectedActivityConfig(null);
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
    fetchLastActivity();
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
    fetchLastActivity();

    // Listen for task creation events from other components
    const handleTaskEvent = () => {
      console.log('[RoleBank] Received task event, refreshing data...');
      fetchLastActivity();
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
  }, [registerResetHandler, unregisterResetHandler, resetToMain, selectedRole, selectedKR, fetchLastActivity]);

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
          const scorePromise = calculateAuthenticScoreLocal(selectedRole.id);

          await Promise.all([krPromise, scorePromise]);

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
  }, [selectedRole?.id, isLoadingRole]);

  // Fetch all KRs when Key Relationships tab is selected (for the main tab view)
  useEffect(() => {
    if (activeMainTab === 'keyrelationships' && !selectedRole && !selectedKR) {
      fetchAllKeyRelationships();
    }
  }, [activeMainTab, selectedRole, selectedKR]);

  // Fetch role statistics when viewing main role bank and period changes
  useEffect(() => {
    const fetchRoleStatistics = async () => {
      if (activeMainTab === 'roles' && !selectedRole && roles.length > 0) {
        setLoadingStatistics(true);
        try {
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const statsArray = await Promise.all(
            roles.map(role =>
              getRoleStatistics(
                supabase,
                user.id,
                role.id,
                roleStatsPeriod
              ).then(stats => ({ roleId: role.id, stats }))
            )
          );

          const stats: Record<string, RoleStatistics> = {};
          statsArray.forEach(({ roleId, stats: roleStats }) => {
            stats[roleId] = roleStats;
          });

          setRoleStatistics(stats);
        } catch (error) {
          console.error('Error fetching role statistics:', error);
        } finally {
          setLoadingStatistics(false);
        }
      }
    };

    fetchRoleStatistics();
  }, [activeMainTab, roles.length, roleStatsPeriod, selectedRole]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: toLocalISOString(new Date()) })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({
          deleted_at: toLocalISOString(new Date()),
          status: 'cancelled'
        })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleDeleteReflection = async (reflection: ReflectionWithRelations) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', reflection.id);

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to delete reflection.');
    }
  };

  const handleUpdateDepositIdea = async (depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setSelectedActivityConfig(null);
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
          updated_at: toLocalISOString(new Date())
        })
        .eq('id', depositIdea.id);

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
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
    setSelectedActivityConfig(null);
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
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  const handleFormSubmitSuccess = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    setSelectedActivityConfig(null);
    // R-5a: replace removed refreshGoals() with direct goal refetch.
    if (selectedRole) {
      fetchGoalProgressData();
    }
  };

  const handleFormClose = () => {
    setTaskFormVisible(false);
    setEditingTask(null);
    setSelectedActivityConfig(null);
  };

  const handleOpenFollowThrough = (type: 'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection', parentId: string, parentType: string) => {
    setFollowThroughPreSelectedType(type);
    setFollowThroughParentId(parentId);
    setFollowThroughParentType(parentType);
    setFollowThroughFormVisible(true);
  };

  const handleFollowThroughFormClose = () => {
    setFollowThroughFormVisible(false);
    setRefreshAssociatedItemsKey(prev => prev + 1);
    // R-5a: Q4 fix. The previous code called fetchDataForRole /
    // fetchDataForKR which never existed on this page (they live on
    // wellness.tsx — TS bug latent through C-1 audit). Replace with
    // eventBus.emit so any tab-level listeners + the soon-to-be-mounted
    // R-5b sections all refresh. refreshGoals() is replaced with direct
    // fetchGoalProgressData since useGoals was removed in R-5a.
    eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
    if (selectedRole) {
      fetchGoalProgressData();
    }
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

  // B27: goal-detail handlers. Same shape as wellness.tsx (which
  // mirrors goals.tsx). Roles surface re-fetches goal-progress and
  // role-scoped score on update.
  const handleGoalPress = useCallback((goal: any) => {
    setSelectedGoalForDetail(goal);
  }, []);

  const handleCloseGoalDetail = useCallback(() => {
    setSelectedGoalForDetail(null);
  }, []);

  const handleGoalDetailUpdated = useCallback(() => {
    fetchGoalProgressData();
    if (selectedRole) {
      refreshScoreForRole(selectedRole.id, true);
    }
  }, [fetchGoalProgressData, selectedRole, refreshScoreForRole]);

  const handleAddActionFromGoalDetail = useCallback(() => {
    if (!selectedGoalForDetail) return;
    setEditingTask({
      type: 'task',
      selectedGoalIds: [selectedGoalForDetail.id],
      twelveWeekGoalChecked: true,
      countsTowardWeeklyProgress: true,
      selectedRoleIds: selectedRole ? [selectedRole.id] : [],
    } as any);
    setSelectedActivityConfig(null);
    setTaskFormVisible(true);
  }, [selectedGoalForDetail, selectedRole]);

  // R-5a: handler for the goal-card "+" button inside
  // RoleGoalsToolshedPanel. Mirrors the inline onAddAction handler from
  // the legacy 12-Week Goals strip (preserved at the bottom of the
  // 4-tab body) and the goal-detail handler above. R-5b will wire this
  // through as RoleToolshed.onAddGoalTask.
  const handleAddGoalTask = useCallback((goalId: string) => {
    if (!selectedRole) return;
    setEditingTask({
      type: 'task',
      selectedGoalIds: [goalId],
      isGoal: true,
      twelveWeekGoalChecked: true,
      countsTowardWeeklyProgress: true,
      selectedRoleIds: [selectedRole.id],
    } as any);
    setSelectedActivityConfig(null);
    setTaskFormVisible(true);
  }, [selectedRole]);

  // R-6-mount: KR-aware add-goal-task handler. Parallel to role-side above but
  // pre-fills both selectedRoleIds (parent role) AND selectedKeyRelationshipIds
  // (the KR being viewed) so the new task auto-tags to both contexts.
  const handleKRAddGoalTask = useCallback((goalId: string) => {
    if (!selectedKR) return;
    setEditingTask({
      type: 'task',
      selectedGoalIds: [goalId],
      isGoal: true,
      twelveWeekGoalChecked: true,
      countsTowardWeeklyProgress: true,
      selectedRoleIds: selectedRole ? [selectedRole.id] : [],
      selectedKeyRelationshipIds: [selectedKR.id],
    } as any);
    setSelectedActivityConfig(null);
    setTaskFormVisible(true);
  }, [selectedKR, selectedRole]);

  // R-6-mount: KR vision update callback for KRIdentityHeader. Writes to the
  // R-6-schema vision_statement column on 0008-ap-key-relationships. Updates
  // selectedKR locally to reflect the change immediately (avoids waiting for a
  // re-fetch). Mirrors the role-side updateRoleField pattern but with KR scope.
  const handleKRVisionUpdate = useCallback(async (text: string): Promise<void> => {
    if (!selectedKR) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-key-relationships')
        .update({ vision_statement: text, updated_at: toLocalISOString(new Date()) })
        .eq('id', selectedKR.id);
      if (error) throw error;
      // Update local state to reflect the change immediately
      setSelectedKR(prev => prev ? { ...prev, vision_statement: text } : prev);
      // Also update keyRelationships list so nav back shows fresh data
      setKeyRelationships(prev => prev.map(kr =>
        kr.id === selectedKR.id ? { ...kr, vision_statement: text } : kr
      ));
    } catch (e) {
      console.error('[handleKRVisionUpdate] failed', e);
      throw e;
    }
  }, [selectedKR]);

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setEditRoleVisible(true);
  };

  const handleEditKR = (kr: KeyRelationship) => {
    setAddKRMode(false);
    setAddKRRoleId(null);
    setEditingKR(kr);
    setEditKRVisible(true);
  };

  const handleRoleUpdate = () => {
    fetchRoles();
    fetchLastActivity();
    setEditRoleVisible(false);
    setEditingRole(null);
  };

  const handleManageRolesUpdate = () => {
    fetchRoles();
    fetchLastActivity();
  };

  const handleKRUpdate = () => {
    if (selectedRole) {
      fetchKeyRelationships(selectedRole.id);
    }
    if (addKRRoleId) {
      fetchKeyRelationships(addKRRoleId);
    }
    fetchAllKeyRelationships();
    setEditKRVisible(false);
    setEditingKR(null);
    setAddKRMode(false);
    setAddKRRoleId(null);
  };

  const handleAddKR = (roleId: string) => {
    if (!roleId) {
      Alert.alert('Error', 'A valid role must be selected to create a key relationship.');
      return;
    }
    setAddKRMode(true);
    setAddKRRoleId(roleId);
    setEditingKR(null);
    setEditKRVisible(true);
  };

  // Speed Dial FAB handler - creates activity with context-aware role/KR pre-selection
  const handleSpeedDialSelect = useCallback((config: ActivityConfig) => {
    // Build initial data with context-aware pre-selections
    const initialData: any = {};
    
    // Pre-select the current role if viewing a role
    if (selectedRole) {
      initialData.selectedRoleIds = [selectedRole.id];
    }
    
    // Pre-select the current KR if viewing a KR (also include the role)
    if (selectedKR && selectedRole) {
      initialData.selectedRoleIds = [selectedRole.id];
      initialData.selectedKeyRelationshipIds = [selectedKR.id];
    }
    
    setEditingTask(Object.keys(initialData).length > 0 ? initialData : null);
    setSelectedActivityConfig(config);
    setTaskFormVisible(true);
  }, [selectedRole, selectedKR]);

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
      // Manage Roles view header - uses same tabs as main view with Manage active
      return (
        <>
          <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />
          <View style={styles.roleBankSubHeader}>
            <View style={styles.roleBankTabsRow}>
              <TouchableOpacity
                style={[styles.roleBankTab]}
                onPress={() => setActiveMainTab('roles')}
              >
                <Text style={[styles.roleBankTabText]}>
                  Roles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBankTab, styles.roleBankTabKRs]}
                onPress={() => setActiveMainTab('keyrelationships')}
              >
                <Text style={[styles.roleBankTabText]}>
                  KRs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
              style={[styles.roleBankTab, { backgroundColor: headerColor }]}
              onPress={() => {}}
              >
                <Text style={[styles.roleBankTabText, styles.roleBankTabTextActive]}>
                  Manage
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
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
              <Text style={styles.customBackButtonText}>←</Text>
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
                <Text style={styles.customScoreValue}>{krAuthenticScore ?? '–'}</Text>
              </View>
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
              <Text style={styles.customBackButtonText}>←</Text>
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
        </View>
      );
    }

    // Main Role Bank header with UniversalHeader + sub-header tabs
    return (
      <>
        <UniversalHeader onOpenSettings={() => setSettingsSidebarVisible(true)} />
        <View style={styles.roleBankSubHeader}>
          <View style={styles.roleBankTabsRow}>
            <TouchableOpacity
              style={[styles.roleBankTab, activeMainTab === 'roles' && { backgroundColor: headerColor }]}
              onPress={() => setActiveMainTab('roles')}
            >
              <Text style={[styles.roleBankTabText, activeMainTab === 'roles' && styles.roleBankTabTextActive]}>
                Roles
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBankTab, styles.roleBankTabKRs, activeMainTab === 'keyrelationships' && { backgroundColor: headerColor }]}
              onPress={() => setActiveMainTab('keyrelationships')}
            >
              <Text style={[styles.roleBankTabText, activeMainTab === 'keyrelationships' && styles.roleBankTabTextActive]}>
                KRs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
          style={[styles.roleBankTab, activeMainTab === 'manageRoles' && { backgroundColor: headerColor }]}
          onPress={showManageRolesView}
            >
              <Text style={[styles.roleBankTabText]}>
                Manage
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  };

  const renderContent = () => {
    if (activeMainTab === 'manageRoles') {
      // Manage Roles view
      return (
        <View style={styles.content} pointerEvents="box-none">
          <ManageRolesContent
            onUpdate={handleManageRolesUpdate}
          />
        </View>
      );
    }

    if (selectedKR) {
      // Key Relationship view
      return (
        <View style={styles.content} pointerEvents="box-none">

          <ScrollView style={styles.taskList}>
            {/* R-6-mount Phase 4: KR detail components mounted above the legacy
                4-tab body. Phase 5 will remove the legacy ternary block beneath.
                Render order mirrors role-side R-5b mount: IdentityHeader → StatsRow
                → MySpaceSection → Toolshed. Accent color inherits from selectedRole
                per audit Q6 lock (KRs do not own a per-KR color override).
                currentUserId gates the userId-bearing components so we never pass
                undefined down to fetchers. */}
            <KRIdentityHeader
              name={selectedKR.name}
              vision={selectedKR.vision_statement}
              imageUrl={krImageUrls[selectedKR.id] ?? null}
              parentRoleName={selectedRole?.label ?? null}
              accentColor={selectedRole?.color || '#7c3aed'}
              onVisionUpdate={handleKRVisionUpdate}
            />
            {currentUserId && (
              <KRStatsRow
                krId={selectedKR.id}
                userId={currentUserId}
                accentColor={selectedRole?.color || '#7c3aed'}
              />
            )}
            {currentUserId && (
              <KRMySpaceSection
                krId={selectedKR.id}
                userId={currentUserId}
                krName={selectedKR.name}
                accentColor={selectedRole?.color || '#7c3aed'}
                onIdeaUpdate={handleUpdateDepositIdea}
                onIdeaCancel={handleCancelDepositIdea}
                onIdeaPress={handleDepositIdeaPress}
                onTaskComplete={(task) => handleCompleteTask(task.id)}
                onTaskDelete={(task) => handleDeleteTask(task.id)}
                onTaskPress={handleTaskPress}
                openTile={openKRMySpaceTile}
                onTileChange={handleKRMySpaceTileChange}
              />
            )}
            {currentUserId && (
              <KRToolshed
                krId={selectedKR.id}
                userId={currentUserId}
                krName={selectedKR.name}
                accentColor={selectedRole?.color || '#7c3aed'}
                goals={krGoals}
                goalProgress={krGoalProgress}
                onAddGoalTask={handleKRAddGoalTask}
                onJournalEntryPress={handleJournalEntryPress}
                journalDateRange={krJournalDateRange}
                onJournalDateRangeChange={setKrJournalDateRange}
                openSurface={openKRToolshedSurface}
                onSurfaceChange={handleKRToolshedSurfaceChange}
              />
            )}
          </ScrollView>
        </View>
      );
    }

    if (selectedRole) {
      // Role view
      return (
        <View style={styles.content} pointerEvents="box-none">
          <ScrollView contentContainerStyle={styles.detailScroll}>

          {/* R-5b: identity header + stats row replace inline VisionBlocks +
              Power Q + 3-chip stats row. Always-mounted (no activeView gate
              since the 4-tab toggle is gone). New stats are Day Streak /
              30-Day Actions / Active Goals — different metrics from the
              legacy chips, so this is a true replacement, not a port. */}
          <RoleIdentityHeader
            role={{
              id: selectedRole.id,
              label: selectedRole.label,
              color: selectedRole.color || '#7c3aed',
              icon: selectedRole.icon,
              vision_statement: selectedRole.vision_statement ?? null,
              power_question_answer: selectedRole.power_question_answer ?? null,
            }}
            keyRelationshipsCount={
              keyRelationships.filter(kr => kr.role_id === selectedRole.id).length
            }
            onUpdate={fetchRoles}
          />
          {currentUserId && (
            <RoleStatsRow
              roleId={selectedRole.id}
              userId={currentUserId}
            />
          )}
          {/* R-5b: 12-Week Goals strip removed. Replaced by RoleToolshed Goals
              surface (R-4) below; that surface uses the same `goals` +
              `goalProgress` state, plus handleAddGoalTask (line ~1356) for
              the "+" button. Real Effort Score percentages now visible
              (closes #11, side-effect of R-5a's fetchGoalsForRole chain). */}
          {/* R-5b: 4-tab body replaced by MY SPACE (R-3) + Toolshed (R-4).
              Single-open coordination across both via openMySpaceTile /
              openToolshedSurface (R-5a coordinators). */}
          {currentUserId && (
            <RoleMySpaceSection
              roleId={selectedRole.id}
              userId={currentUserId}
              roleName={selectedRole.label}
              accentColor={selectedRole.color || '#7c3aed'}
              onIdeaUpdate={handleUpdateDepositIdea}
              onIdeaCancel={handleCancelDepositIdea}
              onIdeaPress={handleDepositIdeaPress}
              onTaskComplete={(task) => handleCompleteTask(task.id)}
              onTaskDelete={(task) => handleDeleteTask(task.id)}
              onTaskPress={handleTaskPress}
              openTile={openMySpaceTile}
              onTileChange={handleMySpaceTileChange}
            />
          )}
          {currentUserId && (
            <RoleToolshed
              roleId={selectedRole.id}
              userId={currentUserId}
              roleName={selectedRole.label}
              accentColor={selectedRole.color || '#7c3aed'}
              goals={goals}
              goalProgress={goalProgress}
              onAddGoalTask={handleAddGoalTask}
              onGoalPress={handleGoalPress}
              onJournalEntryPress={handleJournalEntryPress}
              journalDateRange={journalDateRange}
              onJournalDateRangeChange={setJournalDateRange}
              openSurface={openToolshedSurface}
              onSurfaceChange={handleToolshedSurfaceChange}
            />
          )}

          {/* Key Relationships — upgraded to KRTile */}
          {selectedRole && (
            <View style={styles.krSection}>
              <View style={styles.krSectionHeader}>
                <Text style={styles.krSectionTitle}>KEY RELATIONSHIPS</Text>
                <View style={styles.krSectionHeaderRight}>
                  <TouchableOpacity
                    style={styles.addKRButton}
                    onPress={() => handleAddKR(selectedRole.id)}
                    disabled={krLoading}
                  >
                    <Plus size={14} color="#0078d4" />
                    <Text style={styles.addKRButtonText}>KR</Text>
                  </TouchableOpacity>
                  <Pressable onPress={() => setActiveMainTab('keyrelationships')}>
                    <Text style={styles.krSeeAll}>See all</Text>
                  </Pressable>
                </View>
              </View>
              {krLoading ? (
                <View style={styles.krLoadingContainer}>
                  <Text style={styles.krLoadingText}>Loading key relationships...</Text>
                </View>
              ) : keyRelationships.filter(kr => kr.role_id === selectedRole.id).length === 0 ? (
                <View style={styles.emptyKRContainer}>
                  <Text style={styles.emptyKRText}>No key relationships yet</Text>
                </View>
              ) : (
                keyRelationships.filter(kr => kr.role_id === selectedRole.id).map(kr => (
                  <KRTile
                    key={kr.id}
                    name={kr.name ?? '(unnamed)'}
                    relationshipType={kr.description || 'Key relationship'}
                    lastInteractionDate={krLastActivityMap.get(kr.id) ?? null}
                    imageUri={krImageUrls[kr.id] ?? null}
                    onPress={() => setSelectedKR(kr)}
                  />
                ))
              )}
            </View>
          )}
          </ScrollView>
        </View>
      );
    }

    // Main Role Bank view with tabs
    return (
      <View style={styles.content} pointerEvents="box-none">
        {activeMainTab === 'roles' && (
          <ScrollView style={styles.rolesList}>
            <RoleBankHub
              roles={roles}
              lastActivityMap={lastActivityMap}
              onRolePress={handleRolePress}
              onAddRolePress={() => setManageRolesVisible(true)}
              accentColor="#7c3aed"
            />
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
                          <Text style={styles.krAddButtonText}>KR</Text>
                        </TouchableOpacity>
                      </View>
                      {roleKRs.length === 0 ? (
                        <View style={styles.krEmptySection}>
                          <Text style={styles.krEmptyText}>No key relationships yet</Text>
                        </View>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.krCircleList}>
                            {roleKRs.map(kr => (
                              <TouchableOpacity
                                key={kr.id}
                                style={styles.krCircleCard}
                                onPress={() => {
                                  setSelectedRole(role);
                                  setSelectedKR(kr);
                                }}
                              >
                                {kr.image_path && krImageUrls[kr.id] ? (
                                  <Image
                                    source={{ uri: krImageUrls[kr.id] || undefined }}
                                    style={styles.krCircleImage}
                                  />
                                ) : (
                                  <View style={styles.krCirclePlaceholder}>
                                    <Users size={24} color="#6b7280" />
                                  </View>
                                )}
                                <Text style={styles.krCircleName} numberOfLines={2}>{kr.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
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
      {selectedGoalForDetail ? (
        <GoalDetailView
          goal={selectedGoalForDetail}
          onClose={handleCloseGoalDetail}
          onGoalUpdated={handleGoalDetailUpdated}
          onAddAction={handleAddActionFromGoalDetail}
          authenticScore={authenticScore}
        />
      ) : (
        <>
          {renderRoleBankHeader()}
          {renderContent()}

          {/* Speed Dial FAB - replaces old DraggableFab */}
          <SpeedDialFab onActivitySelect={handleSpeedDialSelect} />
        </>
      )}

      {/* Modals — outside the ternary so they overlay either
          GoalDetailView or the normal page (mirrors goals.tsx). */}
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
        onClose={() => {
          setEditKRVisible(false);
          setAddKRMode(false);
          setAddKRRoleId(null);
        }}
        onUpdate={handleKRUpdate}
        keyRelationship={editingKR}
        roleName={addKRMode ? roles.find(r => r.id === addKRRoleId)?.label : selectedRole?.label}
        mode={addKRMode ? 'add' : 'edit'}
        addRoleId={addKRRoleId || undefined}
      />

      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
          <TaskEventForm
            mode={editingTask ? "edit" : "create"}
            initialData={editingTask || undefined}
            config={selectedActivityConfig || undefined}
            onSubmitSuccess={handleFormSubmitSuccess}
            onClose={handleFormClose}
          />
        </Suspense>
      </Modal>

      {taskDetailVisible && (
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
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
        </Suspense>
      )}

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
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
          <TaskEventForm
            mode="create"
            onSubmitSuccess={handleFollowThroughFormClose}
            onClose={() => setFollowThroughFormVisible(false)}
            parentId={followThroughParentId}
            parentType={followThroughParentType as any}
            preSelectedType={followThroughPreSelectedType}
          />
        </Suspense>
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
          // R-5c: replaced removed fetchRoleTasks call with eventBus emit
          // for parity with R-5a Q4 fix pattern (handleFollowThroughFormClose).
          eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
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

      {/* Settings Sidebar */}
      <SettingsSidebar
        visible={settingsSidebarVisible}
        onClose={() => setSettingsSidebarVisible(false)}
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
  timePeriodContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  timePeriodSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timePeriodButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  timePeriodButtonActive: {
    backgroundColor: '#0078d4',
  },
  timePeriodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  timePeriodButtonTextActive: {
    color: '#ffffff',
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  taskList: {
    padding: 16,
  },
  detailScroll: {
    paddingBottom: 24,
  },
  keyRelationshipsSection: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    paddingVertical: 12,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  krLoadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  krScrollWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  krScrollArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  krScrollContent: {
    paddingHorizontal: 8,
    gap: 14,
    alignItems: 'center',
  },
  krCircleItem: {
    alignItems: 'center',
    width: 64,
  },
  krCircleImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
  },
  krCircleImgPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  krCircleLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
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
  krCircleList: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 4,
  },
  krCircleCard: {
    alignItems: 'center',
    width: 72,
  },
  krCircleImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  krCirclePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  krCircleName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 14,
  },
  // Role Bank Sub-Header Styles
  roleBankSubHeader: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  roleBankTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
    padding: 3,
    alignSelf: 'flex-start',
  },
  roleBankTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBankTabActive: {
    backgroundColor: '#0078d4',
  },
  roleBankTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleBankTabTextActive: {
    color: '#ffffff',
  },
  krSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  krSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  krSectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  krSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#6b7280',
  },
  krSeeAll: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '500',
  },
});
