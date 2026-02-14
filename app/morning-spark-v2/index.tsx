import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
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
import { DelegationStep } from '@/components/morning-spark-v2/DelegationStep';
import ContractCloseStep from '@/components/morning-spark-v2/ContractCloseStep';
import { DelegateModal } from '@/components/morning-spark/DelegateModal';
import { RescheduleModal } from '@/components/morning-spark/RescheduleModal';

// Service layer
import {
  FuelLevel,
  FuelWhyReason,
  AspirationContent,
  NorthStarCore,
  BrainDumpTriageItem,
  GroupedContractItems,
  DelegationItem,
  saveFuelLevel,
  getNorthStarCore,
  getAspirationContent,
  getBrainDumpAndFollowUps,
  getWeeklyContractForToday,
  adjustContractItem,
  completeContractItem,
  delegateContractItem,
  getDelegations,
  commitMorningSparkV2,
  checkTodaysSpark,
} from '@/lib/morningSparkV2Service';

const STEPS = [
  { key: 'energy', label: 'Energy Check', icon: '\u26A1', color: '#F57F17' },
  { key: 'triage', label: 'Brain Dump Triage', icon: '\uD83E\uDDE0', color: '#8B5CF6' },
  { key: 'remember', label: 'Remember', icon: '\u2728', color: '#D4A843' },
  { key: 'contract', label: 'Contract', icon: '\uD83D\uDCCB', color: '#3B82F6' },
  { key: 'delegate', label: 'Delegate', icon: '\uD83D\uDC65', color: '#16A34A' },
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

  // Step B: Brain Dump Triage
  const [triageItems, setTriageItems] = useState<BrainDumpTriageItem[]>([]);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageAllDone, setTriageAllDone] = useState(false);

  // Step C: Remember
  const [aspiration, setAspiration] = useState<AspirationContent | null>(null);
  const [northStar, setNorthStar] = useState<NorthStarCore | null>(null);
  const [aspirationLoading, setAspirationLoading] = useState(false);

  // Step D: Contract
  const [contractItems, setContractItems] = useState<GroupedContractItems>({
    roles: [],
    wellness: [],
    goals: [],
    unassigned: [],
  });
  const [contractLoading, setContractLoading] = useState(false);

  // Step E: Delegation
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

  // Step F: Close — snapshot of contract at time of entering contract step
  // This preserves the full list even after Do It / Delete / Reschedule actions drain contractItems
  const [contractSnapshot, setContractSnapshot] = useState<GroupedContractItems>({
    roles: [],
    wellness: [],
    goals: [],
    unassigned: [],
  });
  const [committing, setCommitting] = useState(false);

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

  // Snapshot-derived values for the Close step (doesn't drain as user acts on items)
  const snapshotGoalTasks = contractSnapshot.goals.flatMap((g) => g.tasks);
  const allSnapshotItems = [
    ...contractSnapshot.roles,
    ...contractSnapshot.wellness,
    ...snapshotGoalTasks,
    ...contractSnapshot.unassigned,
  ];
  const snapshotItemCount = allSnapshotItems.length;
  const snapshotTargetScore = allSnapshotItems
    .filter((item) => !item.completed_at)
    .reduce((sum, item) => sum + item.points, 0);

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

        // Delete action
        await adjustContractItem(taskId, action, newDate);
        // Refresh contract items
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
        // Refresh contract items to reflect the reschedule
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error rescheduling task:', e);
        throw e;
      }
    },
    [userId],
  );

  // ---- Complete task handler (Do It / commit) ----

  const handleCompleteContract = useCallback(
    async (taskId: string) => {
      try {
        await completeContractItem(taskId);
        // Refresh contract items so the completed task gets hidden
        const grouped = await getWeeklyContractForToday(userId);
        setContractItems(grouped);
      } catch (e) {
        console.error('Error completing contract item:', e);
        throw e;
      }
    },
    [userId],
  );

  // ---- Edit task handler ----

  const handleEditContract = useCallback((_taskId: string) => {
    // TODO: Open ActionDetailsModal or TaskEventForm for this task
    Alert.alert('Coming Soon', 'Task editing will be available soon.');
  }, []);

  // ---- Add new placeholder ----

  const handleAddNew = useCallback(() => {
    // TODO: Open TaskEventForm modal
    Alert.alert('Coming Soon', 'Add new task functionality will be available soon.');
  }, []);

  // ---- Commit handler ----

  const handleCommit = useCallback(async () => {
    if (!sparkId) return;
    setCommitting(true);
    try {
      await commitMorningSparkV2(sparkId, userId, targetScore);
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
  }, [sparkId, userId, targetScore, router]);

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
        const newSparkId = await saveFuelLevel(sparkId, userId, fuelLevel, fuelWhy);
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
        })
        .catch(() => setTriageLoading(false));
    }
    if (nextStep === 2) {
      setAspirationLoading(true);
      Promise.all([
        getNorthStarCore(userId),
        getAspirationContent(userId),
      ])
        .then(([northStarData, content]) => {
          setNorthStar(northStarData);
          setAspiration(content);
          setAspirationLoading(false);
        })
        .catch(() => setAspirationLoading(false));
    }
    if (nextStep === 3) {
      setContractLoading(true);
      getWeeklyContractForToday(userId)
        .then((grouped) => {
          setContractItems(grouped);
          // Capture snapshot for the Close step — this won't be drained by Do It / Delete actions
          setContractSnapshot(grouped);
          setContractLoading(false);
        })
        .catch(() => setContractLoading(false));
    }
    if (nextStep === 4) {
      setDelegationLoading(true);
      getDelegations(userId)
        .then((items) => {
          setDelegations(items);
          setDelegationLoading(false);
        })
        .catch(() => setDelegationLoading(false));
    }

    setCurrentStep(nextStep);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentStep, fuelLevel, fuelWhy, sparkId, userId]);

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
            onFuelLevelChange={setFuelLevel}
            onFuelWhyChange={setFuelWhy}
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
            />
          )
        )}
        {currentStep === 2 && (
          <RememberStep aspiration={aspiration} northStar={northStar} loading={aspirationLoading} />
        )}
        {currentStep === 3 && (
          <ContractReviewStep
            grouped={contractItems}
            loading={contractLoading}
            onAdjust={handleAdjustContract}
            onComplete={handleCompleteContract}
            onEdit={handleEditContract}
            onAddNew={handleAddNew}
            targetScore={targetScore}
          />
        )}
        {currentStep === 4 && (
          <DelegationStep delegations={delegations} loading={delegationLoading} />
        )}
        {currentStep === 5 && (
          <ContractCloseStep
            aspiration={aspiration}
            grouped={contractSnapshot}
            delegations={delegations}
            targetScore={snapshotTargetScore}
            contractItemCount={snapshotItemCount}
            onCommit={handleCommit}
            committing={committing}
          />
        )}
      </View>

      {/* Bottom navigation bar for steps 0-4 (step 5 has its own commit button) */}
      {currentStep < 5 && (
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
