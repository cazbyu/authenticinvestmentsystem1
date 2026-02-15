import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

// Step components
import EnergyCheckStep from '@/components/morning-spark-v2/EnergyCheckStep';
import BrainDumpTriageStep from '@/components/morning-spark-v2/BrainDumpTriageStep';
import { RememberStep } from '@/components/morning-spark-v2/RememberStep';
import ContractReviewStep from '@/components/morning-spark-v2/ContractReviewStep';
import ContractCloseStep from '@/components/morning-spark-v2/ContractCloseStep';
import { DelegateModal } from '@/components/morning-spark/DelegateModal';
import { RescheduleModal } from '@/components/morning-spark/RescheduleModal';
import TaskEventForm from '@/components/tasks/TaskEventForm';
import { ActionDetailsModal } from '@/components/tasks/ActionDetailsModal';
import { Task } from '@/components/tasks/TaskCard';
import { getActivityConfig } from '@/lib/activityConfig';
import type { ActivityConfig } from '@/lib/activityConfig';

// Alignment Coach
import { getMorningGuidance, getCoachGuidance, buildFullState } from '@/lib/alignmentCoachService';
import type { CoachTone } from '@/types/alignmentCoach';

// Service layer
import {
  FuelLevel,
  FuelWhyReason,
  Fuel3WhyReason,
  AspirationContent,
  NorthStarCore,
  BrainDumpTriageItem,
  GroupedContractItems,
  WeeklyContractItem,
  DelegationItem,
  SparkQuestion,
  saveFuelLevel,
  getNorthStarCore,
  getAspirationContent,
  getBrainDumpAndFollowUps,
  getWeeklyContractForToday,
  adjustContractItem,
  delegateContractItem,
  getDelegations,
  commitMorningSparkV2,
  checkTodaysSpark,
  getSparkQuestion,
  saveSparkQuestionResponse,
} from '@/lib/morningSparkV2Service';

const STEPS = [
  { key: 'energy', label: 'Energy Check', icon: '\u26A1', color: '#F57F17' },
  { key: 'triage', label: 'Brain Dump Triage', icon: '\uD83E\uDDE0', color: '#8B5CF6' },
  { key: 'remember', label: 'Remember', icon: '\u2728', color: '#D4A843' },
  { key: 'contract', label: 'Contract', icon: '\uD83D\uDCCB', color: '#3B82F6' },
  { key: 'close', label: 'Close', icon: '\u270D\uFE0F', color: '#D97706' },
];

export default function MorningSparkV2Screen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Core state
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);

  // Spark state
  const [sparkId, setSparkId] = useState<string | null>(null);

  // Step A: Energy
  const [fuelLevel, setFuelLevel] = useState<FuelLevel | null>(null);
  const [fuelWhy, setFuelWhy] = useState<FuelWhyReason | null>(null);
  const [fuel3Why, setFuel3Why] = useState<Fuel3WhyReason | null>(null);

  // Step B: Brain Dump Triage
  const [triageItems, setTriageItems] = useState<BrainDumpTriageItem[]>([]);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageAllDone, setTriageAllDone] = useState(false);

  // Step C: Remember
  const [aspiration, setAspiration] = useState<AspirationContent | null>(null);
  const [northStar, setNorthStar] = useState<NorthStarCore | null>(null);
  const [aspirationLoading, setAspirationLoading] = useState(false);
  const [sparkQuestion, setSparkQuestion] = useState<SparkQuestion | null>(null);

  // Step D: Contract
  const [contractItems, setContractItems] = useState<GroupedContractItems>({
    events: [],
    roles: [],
    wellness: [],
    goals: [],
    unassigned: [],
  });
  const [contractLoading, setContractLoading] = useState(false);

  // Delegation data (shown in Close step)
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [delegationLoading, setDelegationLoading] = useState(false);

  // Delegate modal
  const [delegateModalVisible, setDelegateModalVisible] = useState(false);
  const [delegateTask, setDelegateTask] = useState<{ id: string; title: string } | null>(null);

  // Reschedule modal
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<{
    id: string; title: string; start_date: string; start_time: string; end_time?: string;
  } | null>(null);

  // Add New task/event modal (uses same TaskEventForm as FAB)
  const [addNewModalVisible, setAddNewModalVisible] = useState(false);
  const [addNewConfig, setAddNewConfig] = useState<ActivityConfig | null>(null);

  // Edit task modal (ActionDetailsModal for editing roles/wellness zones)
  const [editTaskModalVisible, setEditTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Committed task IDs — tracks which items the user clicked "Do It" on
  // "Do It" = "I commit to doing this" (NOT "mark completed")
  const [committedTaskIds, setCommittedTaskIds] = useState<Set<string>>(new Set());

  // Delegated task IDs — tracks which items were delegated (auto-committed with blue state)
  const [delegatedTaskIds, setDelegatedTaskIds] = useState<Set<string>>(new Set());

  const [committing, setCommitting] = useState(false);

  // Alignment Coach state
  const [coachMessage, setCoachMessage] = useState<string | null>(null);
  const [coachTone, setCoachTone] = useState<CoachTone>('welcome');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachIsFallback, setCoachIsFallback] = useState(false);
  // Close-step coach (separate so triage step and close step can have different messages)
  const [closeCoachMessage, setCloseCoachMessage] = useState<string | null>(null);
  const [closeCoachTone, setCloseCoachTone] = useState<CoachTone>('push_forward');
  const [closeCoachLoading, setCloseCoachLoading] = useState(false);
  const [closeCoachIsFallback, setCloseCoachIsFallback] = useState(false);

  // Step 0: Static welcome greeting (no AI call)
  const energyCoachMessage = "Remember \u2014 this tool exists for one reason: to help you live intentionally. It helps you plan your day by focusing on the Big Five Questions, but before we weave through those let\u2019s do a fuel check \u2014 how much fuel do you have in the tank?";
  const energyCoachTone: CoachTone = 'welcome';

  // Step 2: Built dynamically from North Star data when step loads
  const [rememberCoachMessage, setRememberCoachMessage] = useState<string | null>(null);
  const rememberCoachTone: CoachTone = 'reflect';

  // Step 1: Built dynamically from triage items when step loads
  const [triageCoachMessage, setTriageCoachMessage] = useState<string | null>(null);
  const triageCoachTone: CoachTone = 'encourage';

  // Step 3: Static transition message (no AI call)
  const contractCoachMessage = "Review your commitments below. These are grouped by your roles, wellness zones, and goals. Commit to what matters most.";
  const contractCoachTone: CoachTone = 'push_forward';

  // Derived values — goals is now GoalContractGroup[], flatten for counts
  const goalTasks = contractItems.goals.flatMap((g) => g.tasks);
  const allContractItems = [
    ...contractItems.roles,
    ...contractItems.wellness,
    ...goalTasks,
    ...contractItems.unassigned,
  ];

  const contractItemCount = allContractItems.length;

  const targetScore = allContractItems
    .filter((item) => !item.completed_at)
    .reduce((sum, item) => sum + item.points, 0);

  // Committed items for Close step — only items user explicitly clicked "Do It" on
  const committedItems: WeeklyContractItem[] = allContractItems.filter(
    (item) => committedTaskIds.has(item.id)
  );
  const committedTargetScore = committedItems.reduce((sum, item) => sum + item.points, 0);

  // ---- Initial data load ----

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      // Check for existing spark today
      const existingSpark = await checkTodaysSpark(user.id);
      if (existingSpark) {
        setSparkId(existingSpark.id);
        if (existingSpark.fuel_level) {
          setFuelLevel(existingSpark.fuel_level as FuelLevel);
        }
        // If already committed, could redirect — but for v2 we allow re-entry
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  // ---- Triage handlers (items process themselves immediately) ----

  const handleTriageItemProcessed = useCallback((itemId: string) => {
    // Item was processed within the card — no batch needed
  }, []);

  const handleTriageAllProcessed = useCallback(() => {
    setTriageAllDone(true);
  }, []);

  // ---- Quick Question handler (Remember step) ----
  const handleQuestionAnswered = useCallback(
    async (questionId: string, responseText: string, domain: string) => {
      if (!userId) return;
      const success = await saveSparkQuestionResponse(userId, questionId, responseText, domain);
      if (!success) {
        Alert.alert('Error', 'Failed to save your response. Please try again.');
      }
    },
    [userId],
  );

  // ---- Contract adjustment handler ----

  const handleAdjustContract = useCallback(
    async (taskId: string, action: 'delay' | 'delete' | 'delegate', newDate?: string) => {
      try {
        // Find the task for modal context
        const allItems = [
          ...contractItems.roles,
          ...contractItems.wellness,
          ...contractItems.goals.flatMap((g) => g.tasks),
          ...contractItems.unassigned,
        ];
        const task = allItems.find((t) => t.id === taskId);

        if (action === 'delegate') {
          setDelegateTask({ id: taskId, title: task?.title || 'Task' });
          setDelegateModalVisible(true);
          return;
        }

        if (action === 'delay') {
          // Open RescheduleModal so user picks their own date/time
          setRescheduleTask({
            id: taskId,
            title: task?.title || 'Task',
            start_date: task?.due_date || toLocalISOString(new Date()).split('T')[0],
            start_time: task?.start_time || '09:00',
            end_time: task?.end_time || undefined,
          });
          setRescheduleModalVisible(true);
          return;
        }

        // Delete action — cancel the task in DB then remove from local state
        await adjustContractItem(taskId, action, newDate);
        // Remove from committedTaskIds if it was committed
        setCommittedTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        // Refresh contract items so deleted task disappears
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error adjusting contract item:', e);
      }
    },
    [userId, contractItems],
  );

  const handleDelegateTask = useCallback(
    async (taskId: string, delegateId: string, dueDate: string | null, notes: string) => {
      try {
        await delegateContractItem(taskId, userId, delegateId, dueDate, notes);
        // Auto-commit the delegated task
        setCommittedTaskIds((prev) => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });
        // Track as delegated (blue visual state)
        setDelegatedTaskIds((prev) => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });
        // Refresh contract items to reflect delegation
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error delegating task:', e);
        throw e; // Re-throw so DelegateModal can show error state
      }
    },
    [userId],
  );

  // ---- Reschedule handler (from RescheduleModal) ----

  const handleRescheduleTask = useCallback(
    async (taskId: string, newDate: string, newStartTime: string, newEndTime: string | null) => {
      try {
        await adjustContractItem(taskId, 'delay', newDate, newStartTime, newEndTime);
        // Remove from committedTaskIds if it was committed (it's moved to another day)
        setCommittedTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        // Refresh contract items — rescheduled item moves off today
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error rescheduling task:', e);
        throw e;
      }
    },
    [userId],
  );

  // ---- "Do It" handler — commit to doing the task (NOT mark completed) ----

  const handleCommitToTask = useCallback(
    (taskId: string) => {
      console.log('[MorningSpark] User committed to task:', taskId);
      setCommittedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });
    },
    [],
  );

  // ---- Edit task handler ----

  const handleEditContract = useCallback((taskId: string) => {
    // Find the task from contractItems (search all sections)
    const allItems = [
      ...(contractItems?.events || []),
      ...(contractItems?.roles || []),
      ...(contractItems?.wellness || []),
      ...(contractItems?.unassigned || []),
      ...(contractItems?.goals?.flatMap(g => g.tasks) || []),
    ];
    const found = allItems.find(item => item.id === taskId);
    if (found) {
      // Cast WeeklyContractItem to Task shape (compatible core fields)
      setEditingTask(found as unknown as Task);
      setEditTaskModalVisible(true);
    }
  }, [contractItems]);

  // ---- Edit task submit success — refresh contract after role/wellness changes ----

  const handleEditSubmitSuccess = useCallback(async () => {
    setEditTaskModalVisible(false);
    setEditingTask(null);
    // Refresh contract to reflect role/wellness changes
    if (userId) {
      try {
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error refreshing contract after edit:', e);
      }
    }
  }, [userId]);

  // ---- Add new task/event (opens same form as FAB) ----

  const handleAddNew = useCallback(() => {
    // Default to task; the form lets user switch to event
    setAddNewConfig(getActivityConfig('task'));
    setAddNewModalVisible(true);
  }, []);

  // When a new task/event is created from the Add New modal
  const handleAddNewSubmitSuccess = useCallback(async () => {
    setAddNewModalVisible(false);
    setAddNewConfig(null);
    // Refresh contract items to include the newly created task
    if (userId) {
      try {
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error refreshing contract after add:', e);
      }
    }
  }, [userId]);

  // ---- Commit handler ----

  const handleCommit = useCallback(async () => {
    if (!sparkId) return;
    setCommitting(true);
    try {
      // Build points map so the dashboard can show scores without re-computing
      const pointsMap: Record<string, number> = {};
      for (const item of committedItems) {
        pointsMap[item.id] = item.points;
      }
      // Save using the committed items' score, not the full contract score
      await commitMorningSparkV2(sparkId, userId, committedTargetScore, Array.from(committedTaskIds), pointsMap);
      // ContractCloseStep handles the celebration animation
      // After 3 seconds, navigate to dashboard
      setTimeout(() => {
        router.replace('/(tabs)/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error committing spark:', error);
      Alert.alert('Error', 'Failed to sign your contract. Please try again.');
    } finally {
      setCommitting(false);
    }
  }, [sparkId, userId, committedTargetScore, committedTaskIds, committedItems, router]);

  // ---- Step navigation ----

  const goToNextStep = useCallback(async () => {
    if (currentStep >= STEPS.length - 1) return;

    // Process current step before advancing
    try {
      if (currentStep === 0) {
        // Save fuel level
        if (!fuelLevel) {
          Alert.alert(
            'Select your energy level',
            "Please choose how you're feeling before continuing.",
          );
          return;
        }
        if (fuelLevel === 1 && !fuelWhy) {
          Alert.alert('Tell us why', 'Please select a reason for your low energy.');
          return;
        }
        if (fuelLevel === 3 && !fuel3Why) {
          Alert.alert('Quick check', 'What\'s driving this energy? Tap an option to continue.');
          return;
        }
        const newSparkId = await saveFuelLevel(sparkId, userId, fuelLevel, fuelWhy, fuel3Why);
        setSparkId(newSparkId);
      }

      // Step B: triage items are processed immediately in-card, nothing to batch here
    } catch (error) {
      console.error('Error processing step:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      return;
    }

    const nextStep = currentStep + 1;

    // Load data for next step
    if (nextStep === 1) {
      setTriageLoading(true);
      getBrainDumpAndFollowUps(userId)
        .then((items) => {
          setTriageItems(items);
          setTriageLoading(false);

          // Build contextual coach message for triage step
          const hasBrainDumps = items.some((i) => i.source === 'brain_dump');
          const hasFollowUps = items.some((i) => i.source === 'follow_up');
          const intro = 'This step reviews items that you requested for follow up or thoughts that you captured during your Evening Review but didn\u2019t want to organize at the time.';

          if (items.length === 0) {
            setTriageCoachMessage(`${intro} It looks like you don\u2019t currently have anything to triage \u2014 your mind is clear! Let\u2019s move on.`);
          } else if (hasBrainDumps && hasFollowUps) {
            setTriageCoachMessage(`${intro} Below are last night\u2019s thoughts along with items you requested a follow-up reminder on. Take a moment to decide what to do with each one.`);
          } else if (hasFollowUps) {
            setTriageCoachMessage(`${intro} Below are the things you requested a follow-up reminder on. Review each one and decide your next action.`);
          } else {
            setTriageCoachMessage(`${intro} Below are last night\u2019s comments from your Evening Review. Take a moment to decide what to do with each one.`);
          }
        })
        .catch(() => setTriageLoading(false));

      // Fetch morning coach guidance (non-blocking — runs in background, used for close step)
      if (!coachMessage) {
        setCoachLoading(true);
        const fuelReasonStr =
          fuelLevel === 1 ? (fuelWhy || 'unknown')
          : fuelLevel === 3 ? (fuel3Why || 'positive')
          : 'moderate';
        getMorningGuidance(userId, fuelLevel || 2, fuelReasonStr)
          .then((response) => {
            setCoachMessage(response.text);
            setCoachTone(response.tone);
            setCoachIsFallback(response.model === 'fallback');
            setCoachLoading(false);
          })
          .catch(() => {
            setCoachLoading(false);
          });
      }
    }
    if (nextStep === 2) {
      setAspirationLoading(true);
      Promise.all([
        getNorthStarCore(userId),
        getAspirationContent(userId),
        getSparkQuestion(userId),
      ])
        .then(([northStarData, content, question]) => {
          setNorthStar(northStarData);
          setAspiration(content);
          setSparkQuestion(question);

          // Determine how complete the North Star is
          const hasMission = !!northStarData.mission_statement;
          const hasVision = !!northStarData.vision;
          const hasValues = northStarData.core_values && northStarData.core_values.length > 0;
          const hasIdentity = !!northStarData.core_identity;
          const pieceCount = [hasMission, hasVision, hasValues, hasIdentity].filter(Boolean).length;

          // Build coach message for Remember step from North Star data
          const parts: string[] = [];

          // Brevity note: remind users not to linger here
          parts.push('Don\u2019t spend too much time here \u2014 this step is just a quick reminder of who you are and where you\u2019re headed.');

          if (hasIdentity) {
            parts.push(`You previously established your core identity as ${northStarData.core_identity}.`);
          }
          if (hasMission && hasVision) {
            parts.push(`You have stated that you are here to ${northStarData.mission_statement} and that your personal vision is ${northStarData.vision}.`);
          } else if (hasMission) {
            parts.push(`You have stated that you are here to ${northStarData.mission_statement}.`);
          } else if (hasVision) {
            parts.push(`Your personal vision is ${northStarData.vision}.`);
          }

          // If North Star is incomplete, encourage the question + Weekly Alignment
          if (pieceCount < 3) {
            if (question) {
              parts.push('Your North Star is still taking shape \u2014 answer the quick question below to start building it. For deeper reflection, the Weekly Alignment is the best place.');
            } else {
              parts.push('Would you like to reflect on your mission and vision? The Weekly Alignment is the best place for deep thinking on these big questions.');
            }
          }

          parts.push("Let\u2019s now focus on where you want to go today.");
          setRememberCoachMessage(parts.join(' '));

          setAspirationLoading(false);
        })
        .catch(() => setAspirationLoading(false));
    }
    if (nextStep === 3) {
      setContractLoading(true);
      console.log('[MorningSpark] Loading contract for userId:', userId);
      getWeeklyContractForToday(userId)
        .then((grouped) => {
          const total = grouped.events.length + grouped.roles.length + grouped.wellness.length +
            grouped.goals.flatMap(g => g.tasks).length + grouped.unassigned.length;
          console.log('[MorningSpark] Contract loaded:', total, 'items',
            '(events:', grouped.events.length,
            'roles:', grouped.roles.length,
            'wellness:', grouped.wellness.length,
            'goals:', grouped.goals.flatMap(g => g.tasks).length,
            'unassigned:', grouped.unassigned.length, ')');
          setContractItems(grouped);
          setContractLoading(false);
        })
        .catch((err) => {
          console.error('[MorningSpark] Error loading contract:', err);
          setContractLoading(false);
        });
    }
    // When entering Close step (step 4), fetch delegations + coaching summary
    if (nextStep === 4) {
      // Fetch delegations for the close step display
      setDelegationLoading(true);
      getDelegations(userId)
        .then((items) => {
          setDelegations(items);
          setDelegationLoading(false);
        })
        .catch(() => setDelegationLoading(false));

      // Fetch coaching summary for committed items
      setCloseCoachLoading(true);
      buildFullState(userId)
        .then((userState) => {
          return getCoachGuidance({
            mode: 'morning',
            trigger: 'complete',
            userState,
            fuelLevel: fuelLevel || 2,
            fuelReason: fuelLevel === 1 ? (fuelWhy || 'unknown')
              : fuelLevel === 3 ? (fuel3Why || 'positive')
              : 'moderate',
            stepContext: {
              flow_state: 'contract_close',
              context_data: {
                committed_task_count: committedTaskIds.size,
                committed_event_count: committedItems.filter(i => i.type === 'event').length,
              },
            },
          });
        })
        .then((response) => {
          setCloseCoachMessage(response.text);
          setCloseCoachTone(response.tone);
          setCloseCoachIsFallback(response.model === 'fallback');
          setCloseCoachLoading(false);
        })
        .catch(() => {
          setCloseCoachLoading(false);
        });
    }

    setCurrentStep(nextStep);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentStep, fuelLevel, fuelWhy, fuel3Why, sparkId, userId, coachMessage, committedTaskIds, committedItems]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      router.back();
    }
  }, [currentStep, router]);

  // ---- Loading state ----

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Preparing your morning spark...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepData = STEPS[currentStep];

  // Step dots (clickable)
  const renderStepDots = () => (
    <View style={styles.stepDotsContainer}>
      {STEPS.map((step, index) => (
        <TouchableOpacity
          key={step.key}
          onPress={() => {
            // Only allow going to steps that have been visited
            if (index <= currentStep) {
              setCurrentStep(index);
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          }}
          style={styles.stepDotTouchable}
        >
          <View
            style={[
              styles.stepDot,
              index === currentStep
                ? [styles.stepDotActive, { backgroundColor: currentStepData.color }]
                : index < currentStep
                  ? [styles.stepDotCompleted, { backgroundColor: colors.success }]
                  : { backgroundColor: colors.border },
            ]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goToPreviousStep} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Morning Spark</Text>
          {renderStepDots()}
        </View>

        <TouchableOpacity
          onPress={() => {
            if (currentStep < STEPS.length - 1) goToNextStep();
          }}
          style={styles.nextButton}
        >
          <ChevronRight
            size={24}
            color={currentStep < STEPS.length - 1 ? colors.text : colors.border}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Step Content */}
      <View style={styles.stepContent}>
        {currentStep === 0 && (
          <EnergyCheckStep
            fuelLevel={fuelLevel}
            fuelWhy={fuelWhy}
            fuel3Why={fuel3Why}
            onFuelLevelChange={setFuelLevel}
            onFuelWhyChange={setFuelWhy}
            onFuel3WhyChange={setFuel3Why}
            coachMessage={energyCoachMessage}
            coachTone={energyCoachTone}
          />
        )}
        {currentStep === 1 && (
          triageLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading items to triage...
              </Text>
            </View>
          ) : (
            <BrainDumpTriageStep
              items={triageItems}
              userId={userId}
              onItemProcessed={handleTriageItemProcessed}
              onAllProcessed={handleTriageAllProcessed}
              coachMessage={triageCoachMessage}
              coachTone={triageCoachTone}
              coachLoading={false}
              coachIsFallback={false}
            />
          )
        )}
        {currentStep === 2 && (
          <RememberStep
            aspiration={aspiration}
            northStar={northStar}
            loading={aspirationLoading}
            coachMessage={rememberCoachMessage}
            coachTone={rememberCoachTone}
            sparkQuestion={sparkQuestion}
            onQuestionAnswered={handleQuestionAnswered}
          />
        )}
        {currentStep === 3 && (
          <ContractReviewStep
            grouped={contractItems}
            loading={contractLoading}
            onAdjust={handleAdjustContract}
            onCommitToTask={handleCommitToTask}
            committedTaskIds={committedTaskIds}
            delegatedTaskIds={delegatedTaskIds}
            onEdit={handleEditContract}
            onAddNew={handleAddNew}
            targetScore={targetScore}
            coachMessage={contractCoachMessage}
            coachTone={contractCoachTone}
          />
        )}
        {currentStep === 4 && (
          <ContractCloseStep
            aspiration={aspiration}
            committedItems={committedItems}
            delegations={delegations}
            delegatedTaskIds={delegatedTaskIds}
            targetScore={committedTargetScore}
            contractItemCount={committedItems.length}
            onCommit={handleCommit}
            committing={committing}
            coachMessage={closeCoachMessage}
            coachTone={closeCoachTone}
            coachLoading={closeCoachLoading}
            coachIsFallback={closeCoachIsFallback}
          />
        )}
      </View>

      {/* Bottom navigation bar for steps 0-3 (step 4 Close has its own commit button) */}
      {currentStep < 4 && (
        <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.surface }]}
            onPress={goToPreviousStep}
          >
            <Text style={[styles.navButtonText, { color: colors.text }]}>
              {currentStep === 0 ? 'Exit' : 'Back'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              styles.navButtonPrimary,
              { backgroundColor: currentStepData.color },
            ]}
            onPress={goToNextStep}
          >
            <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delegate modal — triggered from contract review step */}
      <DelegateModal
        visible={delegateModalVisible}
        task={delegateTask}
        userId={userId}
        onClose={() => {
          setDelegateModalVisible(false);
          setDelegateTask(null);
        }}
        onDelegate={handleDelegateTask}
      />

      {/* Reschedule modal — triggered when user taps "Reschedule" on a contract card */}
      <RescheduleModal
        visible={rescheduleModalVisible}
        event={rescheduleTask}
        onClose={() => {
          setRescheduleModalVisible(false);
          setRescheduleTask(null);
        }}
        onReschedule={handleRescheduleTask}
      />

      {/* Add New task/event modal — same as FAB */}
      <Modal visible={addNewModalVisible} animationType="slide" presentationStyle="pageSheet">
        <TaskEventForm
          mode="create"
          onSubmitSuccess={handleAddNewSubmitSuccess}
          onClose={() => {
            setAddNewModalVisible(false);
            setAddNewConfig(null);
          }}
          config={addNewConfig || undefined}
        />
      </Modal>

      {/* Edit task modal — triggered from contract review step card tap */}
      <ActionDetailsModal
        visible={editTaskModalVisible}
        task={editingTask}
        onClose={() => {
          setEditTaskModalVisible(false);
          setEditingTask(null);
        }}
        onDelete={(_task) => {
          setEditTaskModalVisible(false);
          setEditingTask(null);
          handleEditSubmitSuccess();
        }}
        onEdit={() => handleEditSubmitSuccess()}
        onRefreshAssociatedItems={() => handleEditSubmitSuccess()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  nextButton: {
    padding: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 8,
    padding: 6,
  },
  stepDotsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepDotTouchable: {
    padding: 4,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 20,
    height: 8,
    borderRadius: 4,
  },
  stepDotCompleted: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  navButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimary: {},
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
