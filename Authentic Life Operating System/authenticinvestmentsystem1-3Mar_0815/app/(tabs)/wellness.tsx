import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { toLocalISOString } from '@/lib/dateUtils';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UniversalHeader } from '@/components/UniversalHeader';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { SpeedDialFab } from '@/components/SpeedDialFab';
import { ActivityConfig, ACTIVITY_CONFIGS } from '@/lib/activityConfig';
import { Task } from '@/components/tasks/TaskCard';
const ActionDetailsModal = lazy(() => import('@/components/tasks/ActionDetailsModal').then(m => ({ default: m.ActionDetailsModal })));
import { DepositIdeaDetailModal } from '@/components/depositIdeas/DepositIdeaDetailModal';
const TaskEventForm = lazy(() => import('@/components/tasks/TaskEventForm'));
import JournalForm from '@/components/reflections/JournalForm';
import { ReflectionDetailsModal } from '@/components/reflections/ReflectionDetailsModal';
import { ReflectionWithRelations, fetchReflectionById } from '@/lib/reflectionUtils';
import { getSupabaseClient } from '@/lib/supabase';
import { Plus, Heart, CreditCard as Edit, UserX, Ban, Menu, CreditCard as Edit2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { calculateAuthenticScore as calculateAuthenticScoreUtil, calculateAuthenticScoreForDomain } from '@/lib/taskUtils';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTabReset } from '@/contexts/TabResetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { WebNavigationMenu } from '@/components/WebNavigationMenu';
import { ZoneToolshed, SurfaceKey } from '@/components/wellness/ZoneToolshed';
import { WellnessHubPage } from '@/components/wellness/WellnessHubPage';
import { ZoneIdentityHeader } from '@/components/wellness/ZoneIdentityHeader';
import { ZoneVisionCallout } from '@/components/wellness/ZoneVisionCallout';
import { ZoneStatsRow } from '@/components/wellness/ZoneStatsRow';
import { ZoneMySpaceSection } from '@/components/wellness/ZoneMySpaceSection';
import { GoalDetailView } from '@/components/goals/GoalDetailView';
import { WELLNESS_ZONE_COPY } from '@/constants/wellnessZoneCopy';
import {
  getLastActivityPerDomain,
  getDepositCountsPerDomain,
  getToolCountsPerDomain,
} from '@/lib/roleStatistics';
import { fetchZoneGoals, fetchZoneGoalsProgress } from '@/lib/zoneDataService';
import { getDomainColor } from '@/constants/wellnessColors';

type DrawerNavigation = DrawerNavigationProp<any>;

interface Domain {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export default function Wellness() {
  const navigation = useNavigation<DrawerNavigation>();
  const { authenticScore, refreshScoreForDomain } = useAuthenticScore();
  const { registerResetHandler, unregisterResetHandler } = useTabReset();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  const [isWebMenuVisible, setIsWebMenuVisible] = useState(false);
const [settingsSidebarVisible, setSettingsSidebarVisible] = useState(false);
  
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
  // B27: Goal detail screen-replacement state. When non-null, the
  // ternary in the return swaps page contents for <GoalDetailView>
  // (mirrors goals.tsx pattern). Wellness function-component itself
  // doesn't unmount, so all other state survives the swap.
  const [selectedGoalForDetail, setSelectedGoalForDetail] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [domainAuthenticScore, setDomainAuthenticScore] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scoreAbortControllerRef = useRef<AbortController | null>(null);

  // Follow-through TaskEventForm state
  const [followThroughFormVisible, setFollowThroughFormVisible] = useState(false);
  const [followThroughPreSelectedType, setFollowThroughPreSelectedType] = useState<'task' | 'event' | 'rose' | 'thorn' | 'depositIdea' | 'reflection'>('task');
  const [followThroughParentId, setFollowThroughParentId] = useState<string>('');
  const [followThroughParentType, setFollowThroughParentType] = useState<string>('');
  const [refreshAssociatedItemsKey, setRefreshAssociatedItemsKey] = useState(0);

  // Wellness Hub zone activity + tool counts
  const [lastDepositByDomain, setLastDepositByDomain] = useState<Map<string, string | null>>(new Map());
  const [toolCountByDomain, setToolCountByDomain] = useState<Map<string, number>>(new Map());
  const [depositCountsByDomain, setDepositCountsByDomain] = useState<Map<string, number>>(new Map());

  // Speed Dial activity config state
  const [selectedActivityConfig, setSelectedActivityConfig] = useState<ActivityConfig | null>(null);

  // Goals for selected domain (both 12wk and custom, fetched via zone service)
  const [goals, setGoals] = useState<any[]>([]);
  const [goalProgress, setGoalProgress] = useState<Record<string, any>>({});
  const goalsAbortControllerRef = useRef<AbortController | null>(null);

  // 1+6c: cross-section open-panel coordination. Only one of these
  // is non-null at a time — coordinator callbacks below enforce that
  // invariant. Lifted from the section components when the old tabs
  // were removed.
  const [openMySpaceTile, setOpenMySpaceTile] =
    useState<'upcoming' | 'overdue' | 'idea' | null>(null);
  const [openToolshedSurface, setOpenToolshedSurface] =
    useState<SurfaceKey | null>(null);

  const fetchGoalsForDomain = useCallback(async (domainId: string) => {
    // Cancel any in-flight goal fetch
    if (goalsAbortControllerRef.current) {
      goalsAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    goalsAbortControllerRef.current = controller;

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (controller.signal.aborted) return;

      const zoneGoals = await fetchZoneGoals(supabase, domainId, user.id, controller.signal);
      if (controller.signal.aborted) return;

      const progress = await fetchZoneGoalsProgress(supabase, zoneGoals, controller.signal);
      if (controller.signal.aborted) return;

      setGoals(zoneGoals);
      setGoalProgress(progress);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Error fetching zone goals:', error);
    }
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      fetchGoalsForDomain(selectedDomain.id);
    } else {
      setGoals([]);
      setGoalProgress({});
    }
    return () => {
      if (goalsAbortControllerRef.current) {
        goalsAbortControllerRef.current.abort();
      }
    };
  }, [selectedDomain?.id, fetchGoalsForDomain]);

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

  // Reset to main Wellness Bank view when tab is pressed
  const resetToMain = useCallback(() => {
    setSelectedDomain(null);
    setGoals([]);
    setGoalProgress({});
    setTaskFormVisible(false);
    setTaskDetailVisible(false);
    setDepositIdeaDetailVisible(false);
    setSelectedTask(null);
    setSelectedDepositIdea(null);
    setEditingTask(null);
    setSelectedActivityConfig(null);
    setDomainAuthenticScore(0);
    setOpenMySpaceTile(null);
    setOpenToolshedSurface(null);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    scoreAbortControllerRef.current?.abort();
    scoreAbortControllerRef.current = null;
    goalsAbortControllerRef.current?.abort();
    goalsAbortControllerRef.current = null;
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
        fetchGoalsForDomain(selectedDomain.id);
      }
    };

    eventBus.on(EVENTS.TASK_CREATED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_UPDATED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_DELETED, handleTaskEvent);
    eventBus.on(EVENTS.TASK_COMPLETED, handleTaskEvent);

    return () => {
      unregisterResetHandler('wellness');
      eventBus.off(EVENTS.TASK_CREATED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_UPDATED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_DELETED, handleTaskEvent);
      eventBus.off(EVENTS.TASK_COMPLETED, handleTaskEvent);
    };
  }, [fetchDomains, registerResetHandler, unregisterResetHandler, resetToMain, selectedDomain, fetchGoalsForDomain]);

  useEffect(() => {
    if (selectedDomain) {
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
  }, [selectedDomain, fetchAuthenticScoreLocal]);

  const fetchHubData = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const supabase = getSupabaseClient();
      const [deposits, tools, counts] = await Promise.all([
        getLastActivityPerDomain(supabase, currentUserId),
        getToolCountsPerDomain(supabase, currentUserId),
        getDepositCountsPerDomain(supabase, currentUserId, 7),
      ]);
      setLastDepositByDomain(deposits);
      setToolCountByDomain(tools);
      setDepositCountsByDomain(counts);
    } catch (err) {
      console.error('Error fetching hub activity data:', err);
    }
  }, [currentUserId]);

  // Fetch zone activity (last deposit + tool count) for the hub view,
  // and refetch on cross-page task/reflection/deposit-idea events.
  useEffect(() => {
    if (!currentUserId) return;
    if (domains.length === 0) return;
    if (selectedDomain !== null) return;

    fetchHubData();

    const events = [
      EVENTS.TASK_CREATED,
      EVENTS.TASK_UPDATED,
      EVENTS.TASK_DELETED,
      EVENTS.TASK_COMPLETED,
      EVENTS.REFLECTION_CREATED,
      EVENTS.REFLECTION_UPDATED,
      EVENTS.REFLECTION_DELETED,
      EVENTS.DEPOSIT_IDEA_CREATED,
      EVENTS.DEPOSIT_IDEA_UPDATED,
      EVENTS.REFRESH_ALL_TASKS,
    ];
    for (const evt of events) eventBus.on(evt, fetchHubData);

    return () => {
      for (const evt of events) eventBus.off(evt, fetchHubData);
    };
  }, [currentUserId, domains.length, selectedDomain, fetchHubData]);

  // 1+6c: cross-section coordinators. Setting either slot to a
  // non-null value clears the other so only one panel is open at a
  // time across MY SPACE + Toolshed Surfaces.
  const handleMySpaceTileChange = useCallback(
    (next: 'upcoming' | 'overdue' | 'idea' | null) => {
      if (next !== null) setOpenToolshedSurface(null);
      setOpenMySpaceTile(next);
    },
    [],
  );

  const handleToolshedSurfaceChange = useCallback(
    (next: SurfaceKey | null) => {
      if (next !== null) setOpenMySpaceTile(null);
      setOpenToolshedSurface(next);
    },
    [],
  );

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tasks')
        .update({ status: 'completed', completed_at: toLocalISOString(new Date()) })
        .eq('id', taskId);

      if (error) throw error;

      // Refresh score after task completion
      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [fetchAuthenticScoreLocal]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
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

      // Refresh score after task deletion
      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, [fetchAuthenticScoreLocal]);

  const handleDeleteReflection = useCallback(async (reflection: ReflectionWithRelations) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-reflections')
        .delete()
        .eq('id', reflection.id);

      if (error) throw error;

      fetchAuthenticScoreLocal(true);
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to delete reflection.');
    }
  }, [fetchAuthenticScoreLocal]);

  const handleUpdateDepositIdea = useCallback((depositIdea: any) => {
    const editData = {
      ...depositIdea,
      type: 'depositIdea'
    };
    setEditingTask(editData);
    setSelectedActivityConfig(null);
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
          updated_at: toLocalISOString(new Date())
        })
        .eq('id', depositIdea.id);

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, []);

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
      setSelectedActivityConfig(null);
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
    setSelectedActivityConfig(null);
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
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }, []);

  const handleFormSubmitSuccess = useCallback(() => {
    setTaskFormVisible(false);
    setEditingTask(null);
    setSelectedActivityConfig(null);
    if (selectedDomain) {
      fetchGoalsForDomain(selectedDomain.id);
    }
    // Refresh score after task creation/update
    fetchAuthenticScoreLocal(true);
  }, [selectedDomain, fetchGoalsForDomain, fetchAuthenticScoreLocal]);

  const handleFormClose = useCallback(() => {
    setTaskFormVisible(false);
    setEditingTask(null);
    setSelectedActivityConfig(null);
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
      fetchGoalsForDomain(selectedDomain.id);
    }
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
  }, []);

  // B27: goal-detail handlers. Mirror goals.tsx:1363-1379 verbatim
  // semantics — open via setting state, close via clearing, update
  // via re-fetching goals + score.
  const handleGoalPress = useCallback((goal: any) => {
    setSelectedGoalForDetail(goal);
  }, []);

  const handleCloseGoalDetail = useCallback(() => {
    setSelectedGoalForDetail(null);
  }, []);

  const handleGoalDetailUpdated = useCallback(() => {
    if (selectedDomain) {
      fetchGoalsForDomain(selectedDomain.id);
    }
    fetchAuthenticScoreLocal(true, selectedDomain?.id);
  }, [selectedDomain, fetchGoalsForDomain, fetchAuthenticScoreLocal]);

  const handleAddActionFromGoalDetail = useCallback(() => {
    if (!selectedGoalForDetail) return;
    setEditingTask({
      type: 'task',
      selectedGoalIds: [selectedGoalForDetail.id],
      isGoal: true,
      selectedDomainIds: selectedDomain ? [selectedDomain.id] : [],
    } as any);
    setSelectedActivityConfig(null);
    setTaskFormVisible(true);
  }, [selectedGoalForDetail, selectedDomain]);

  // Speed Dial FAB handler - creates activity with context-aware domain pre-selection
  const handleSpeedDialSelect = useCallback((config: ActivityConfig) => {
    // Build initial data with context-aware pre-selections
    const initialData: any = {};
    
    // Pre-select the current domain if viewing a domain
    if (selectedDomain) {
      initialData.selectedDomainIds = [selectedDomain.id];
    }
    
    setEditingTask(Object.keys(initialData).length > 0 ? initialData : null);
    setSelectedActivityConfig(config);
    setTaskFormVisible(true);
  }, [selectedDomain]);

  // Render custom header
  const renderWellnessBankHeader = () => {
    if (!selectedDomain) {
      return (
        <UniversalHeader
          onOpenSettings={() => setSettingsSidebarVisible(true)}
        />
      );
    }
    // Individual domain detail header
    return (
      <View style={[styles.customHeader, { backgroundColor: getDomainColor(selectedDomain.name) }]}>
        <View style={styles.customHeaderTop}>
          <TouchableOpacity
            style={styles.customBackButton}
            onPress={() => setSelectedDomain(null)}
          >
            <Text style={styles.customBackButtonText}>←</Text>
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
      </View>
    );
  };

  const renderContent = () => {
    if (selectedDomain) {
      // Domain view
      return (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentScrollInner}
          pointerEvents="box-none"
        >
          <View style={styles.physicalLandingTop}>
            <ZoneIdentityHeader
              zoneName={selectedDomain.name}
              tagline={WELLNESS_ZONE_COPY[selectedDomain.name]?.tagline ?? ''}
              iconColor={getDomainColor(selectedDomain.name)}
            />
            {currentUserId && (
              <ZoneVisionCallout
                domainId={selectedDomain.id}
                zoneName={selectedDomain.name}
                userId={currentUserId}
              />
            )}
            {currentUserId && (
              <ZoneStatsRow
                domainId={selectedDomain.id}
                userId={currentUserId}
                activeGoalsCount={goals.length}
              />
            )}
            {currentUserId && (
              <ZoneMySpaceSection
                domainId={selectedDomain.id}
                userId={currentUserId}
                zoneName={selectedDomain.name}
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
            <ZoneToolshed
              domainId={selectedDomain.id}
              zoneName={selectedDomain.name}
              accentColor={getDomainColor(selectedDomain.name)}
              goals={goals}
              goalProgress={goalProgress}
              onAddGoalTask={(goalId) => {
                setEditingTask({
                  type: 'task',
                  selectedGoalIds: [goalId],
                  isGoal: true,
                  selectedDomainIds: selectedDomain ? [selectedDomain.id] : [],
                } as any);
                setSelectedActivityConfig(null);
                setTaskFormVisible(true);
              }}
              onGoalPress={handleGoalPress}
              onJournalEntryPress={handleJournalEntryPress}
              openSurface={openToolshedSurface}
              onSurfaceChange={handleToolshedSurfaceChange}
            />
          </View>
        </ScrollView>
      );
    }

    // Wellness Hub (redesigned in Slice 2a)
    return (
      <WellnessHubPage
        domains={domains}
        onZoneTap={setSelectedDomain}
        lastDepositByDomain={lastDepositByDomain}
        toolCountByDomain={toolCountByDomain}
        countsByDomain={depositCountsByDomain}
      />
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
          {renderWellnessBankHeader()}
          {renderContent()}

          {/* Speed Dial FAB - replaces old DraggableFab */}
          <SpeedDialFab onActivitySelect={handleSpeedDialSelect} />
        </>
      )}

      {/* Modals — outside the ternary so they overlay either the
          GoalDetailView or the normal page contents. Mirrors
          goals.tsx pattern. */}
      <Modal visible={taskFormVisible} animationType="slide" presentationStyle="pageSheet">
        <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
          <TaskEventForm
            mode={editingTask?.id ? "edit" : "create"}
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
  physicalLandingTop: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  timePeriodContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
    paddingHorizontal: 24,
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
  contentScrollInner: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
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
  customMainToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
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
});