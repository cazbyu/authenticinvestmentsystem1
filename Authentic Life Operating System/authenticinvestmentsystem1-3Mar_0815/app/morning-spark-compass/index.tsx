import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, X, Compass } from 'lucide-react-native';
import { LifeCompass } from '@/components/compass/LifeCompass';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';

// Step components
import EnergyCheckStep from '@/components/morning-spark-v2/EnergyCheckStep';

// Compass direction header
import { CompassDirectionHeader } from '@/components/compass/CompassDirectionHeader';

// TaskEventForm for pre-filled capture routing
const TaskEventForm = lazy(() => import('@/components/tasks/TaskEventForm'));

// Service layers
import {
  FuelLevel,
  FuelWhyReason,
  Fuel3WhyReason,
  saveFuelLevel,
} from '@/lib/morningSparkV2Service';

import {
  UnprocessedBrainDump,
  CommitmentTask,
  GoalPulseData,
  GoalPulseItem,
  GoalActionForToday,
  getAllGoalPulse,
  RoleFocusData,
  WellnessGapData,
  MissionTouchData,
  getUnprocessedBrainDump,
  processBrainDumpItem,
  markBrainDumpProcessed,
  getTodaysTasksForCommitment,
  getWeeklyOneThing,
  commitTodaysTasks,
  getGoalPulse,
  getRoleFocus,
  getWellnessGaps,
  getMissionTouch,
  saveMorningSparkSession,
  FinalReviewData,
  FinalReviewEvent,
  FinalReviewTask,
  getFinalReviewData,
  removeFromTodayCommitments,
  ParsedCaptureItem,
  CaptureAnalysisResult,
  TaskEventFormPrefill,
  analyzeCapture,
  buildFormPrefill,
  quickSaveCapture,
  getUserDomains,
} from '@/lib/morningSparkCompassService';

const STEPS = [
  { key: 'opening', label: 'Opening', icon: '\uD83E\uDDED', color: '#D4A843' },
  { key: 'south_fuel', label: 'Fuel Check', icon: '\u26A1', color: '#F57F17' },
  { key: 'south_handoff', label: 'Brain Dump Handoff', icon: '\uD83D\uDCCB', color: '#4169E1' },
  { key: 'south_commit', label: "Today's Commitments", icon: '\u2705', color: '#4169E1' },
  { key: 'south_goal', label: 'Goal Pulse', icon: '\uD83C\uDFAF', color: '#4169E1' },
  { key: 'west_east', label: 'Roles & Wellness', icon: '\uD83D\uDC65', color: '#9370DB' },
  { key: 'final_plan', label: "Today's Plan", icon: '\uD83D\uDE80', color: '#4169E1' },
  { key: 'north', label: 'North Star', icon: '\u2B50', color: '#ed1c24' },
];

export default function MorningSparkCompassScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Core state
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [startedAt] = useState<string>(new Date().toISOString());

  // Step 0: Opening (LifeCompass handles its own ceremony animation)

  // Step 1: Brain Dump Handoff
  const [brainDumpData, setBrainDumpData] = useState<UnprocessedBrainDump | null>(null);
  const [brainDumpItemsProcessed, setBrainDumpItemsProcessed] = useState<Set<string>>(new Set());
  const [brainDumpLoading, setBrainDumpLoading] = useState(false);
  const [scheduleDateInputs, setScheduleDateInputs] = useState<Record<string, string>>({});
  const [showScheduleInput, setShowScheduleInput] = useState<Record<string, boolean>>({});

  // Step 2: Fuel Check
  const [fuelLevel, setFuelLevel] = useState<FuelLevel | null>(null);
  const [fuelWhy, setFuelWhy] = useState<FuelWhyReason | null>(null);
  const [fuel3Why, setFuel3Why] = useState<Fuel3WhyReason | null>(null);
  const [sparkId, setSparkId] = useState<string | null>(null);

  // Step 3: Today's Commitments
  const [tasks, setTasks] = useState<CommitmentTask[]>([]);
  const [weeklyOneThing, setWeeklyOneThing] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [commitLoading, setCommitLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Step 4: Goal Pulse
  const [goalPulse, setGoalPulse] = useState<GoalPulseData | null>(null);
  const [goalPulseLoading, setGoalPulseLoading] = useState(false);
  const [goalTrackSelection, setGoalTrackSelection] = useState<string | null>(null);
  const [allGoalPulse, setAllGoalPulse] = useState<GoalPulseItem[]>([]);
  const [committedActionIds, setCommittedActionIds] = useState<Set<string>>(new Set());

  // Step 5: Role Focus
  const [roleFocus, setRoleFocus] = useState<RoleFocusData[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  // Capture flow state
  const [showCaptureInput, setShowCaptureInput] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [captureAnalyzing, setCaptureAnalyzing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedCaptureItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showTaskEventForm, setShowTaskEventForm] = useState(false);
  const [formPrefill, setFormPrefill] = useState<TaskEventFormPrefill | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);

  // Step 6: Wellness Pulse
  const [wellnessGaps, setWellnessGaps] = useState<WellnessGapData[]>([]);
  const [wellnessLoading, setWellnessLoading] = useState(false);

  // Step 7: Mission Touch
  const [missionTouch, setMissionTouch] = useState<MissionTouchData | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const missionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 7: Final Commitment Review
  const [finalReview, setFinalReview] = useState<FinalReviewData | null>(null);
  const [finalReviewLoading, setFinalReviewLoading] = useState(false);
  const [isCommitted, setIsCommitted] = useState(false);
  const [showFinalAddForm, setShowFinalAddForm] = useState(false);
  const [showMissionAnswer, setShowMissionAnswer] = useState(false);
  const [missionAnswerText, setMissionAnswerText] = useState('');

  // ---- Initial data load ----

  useEffect(() => {
    loadInitialData();
    return () => {
      if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
    };
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
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Opening animation is handled by LifeCompass ceremony (onCeremonyComplete → goToNextStep)

  // (Mission auto-advance removed — step 7 is now Final Commitment Review)

  // ---- Brain dump item processing ----

  const handleProcessBrainDumpItem = useCallback(
    async (itemId: string, content: string, action: 'task' | 'schedule' | 'park', dueDate?: string) => {
      if (!userId) return;
      try {
        await processBrainDumpItem(userId, content, action, dueDate);
        setBrainDumpItemsProcessed((prev) => {
          const next = new Set(prev);
          next.add(itemId);
          return next;
        });

        // Check if all items are now processed
        if (brainDumpData) {
          const newProcessedCount = brainDumpItemsProcessed.size + 1;
          if (brainDumpData.items && newProcessedCount >= brainDumpData.items.length) {
            await markBrainDumpProcessed(brainDumpData.sessionId);
          }
        }
      } catch (e) {
        console.error('Error processing brain dump item:', e);
        Alert.alert('Error', 'Failed to process item. Please try again.');
      }
    },
    [userId, brainDumpData, brainDumpItemsProcessed],
  );

  // ---- Task selection for commitments ----

  const handleToggleTask = useCallback(
    (taskId: string) => {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [],
  );

  const handleQuickAddTask = useCallback(async () => {
    const title = quickAddTitle.trim();
    if (!title || !userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-tasks')
        .insert({ title, user_id: userId, status: 'pending', type: 'task' })
        .select('id, title, due_date')
        .single();
      if (error) throw error;
      if (data) {
        setTasks((prev) => [{ ...data, due_date: data.due_date ?? null }, ...prev]);
        setSelectedTaskIds((prev) => new Set(prev).add(data.id));
      }
      setQuickAddTitle('');
      setShowQuickAdd(false);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error('Quick add task failed:', err);
    }
  }, [quickAddTitle, userId]);

  // ---- Step navigation ----

  const goToNextStep = useCallback(async () => {
    if (currentStep >= STEPS.length - 1) return;

    try {
      // Process current step before advancing
      if (currentStep === 1) {
        // Save fuel level if selected (optional — user can skip)
        if (fuelLevel) {
          try {
            const newSparkId = await saveFuelLevel(sparkId, userId, fuelLevel, fuelWhy, fuel3Why);
            setSparkId(newSparkId);
          } catch (fuelErr) {
            console.error('Error saving fuel level:', fuelErr);
          }
        }
      }
    } catch (error) {
      console.error('Error processing step:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      return;
    }

    const nextStep = currentStep + 1;

    // Load data for next step
    if (nextStep === 2) {
      // Brain Dump Handoff — skip entirely if no data
      setBrainDumpLoading(true);
      getUnprocessedBrainDump(userId)
        .then((data) => {
          setBrainDumpData(data);
          setBrainDumpLoading(false);
          if (!data || !data.items || data.items.length === 0) {
            // No brain dump — auto-skip to commitments
            setCurrentStep(3);
            setCommitLoading(true);
            Promise.all([
              getTodaysTasksForCommitment(userId),
              getWeeklyOneThing(userId),
            ])
              .then(([taskData, oneThing]) => {
                setTasks(taskData);
                setWeeklyOneThing(oneThing);
                setCommitLoading(false);
              })
              .catch(() => setCommitLoading(false));
            return;
          }
        })
        .catch(() => setBrainDumpLoading(false));
    }

    if (nextStep === 3) {
      // Today's Commitments
      setCommitLoading(true);
      Promise.all([
        getTodaysTasksForCommitment(userId),
        getWeeklyOneThing(userId),
      ])
        .then(([taskData, oneThing]) => {
          setTasks(taskData);
          setWeeklyOneThing(oneThing);
          setCommitLoading(false);
        })
        .catch(() => setCommitLoading(false));
    }

    if (nextStep === 4) {
      // Goal Pulse — fetch all goals with today's actions
      setGoalPulseLoading(true);
      getAllGoalPulse(userId)
        .then((data) => {
          setAllGoalPulse(data);
          // Keep legacy goalPulse for backward compat
          if (data.length > 0) {
            setGoalPulse({
              id: data[0].goal_id,
              title: data[0].goal_title,
              end_date: null,
              execution_rate: data[0].week_execution_percent,
              weeks_remaining: null,
            });
          }
          setGoalPulseLoading(false);
        })
        .catch(() => setGoalPulseLoading(false));
    }

    if (nextStep === 5) {
      // Roles + Wellness (combined step)
      const taskIdList = [...Array.from(selectedTaskIds), ...Array.from(committedActionIds)];
      setRoleLoading(true);
      setWellnessLoading(true);
      Promise.all([
        getRoleFocus(userId, taskIdList),
        getWellnessGaps(userId, taskIdList),
      ])
        .then(([roleData, wzData]) => {
          setRoleFocus(roleData);
          setWellnessGaps(wzData);
          setRoleLoading(false);
          setWellnessLoading(false);
        })
        .catch((err) => {
          console.error('Error loading roles/wellness:', err);
          setRoleLoading(false);
          setWellnessLoading(false);
        });
    }

    if (nextStep === 6) {
      // Today's Plan (final review) — fetch events + committed tasks
      setFinalReviewLoading(true);
      const goalActionIds = Array.from(committedActionIds);
      Promise.all([
        getFinalReviewData(userId, Array.from(selectedTaskIds), goalActionIds),
        getMissionTouch(userId),
      ])
        .then(([reviewData, missionData]) => {
          setFinalReview(reviewData);
          setMissionTouch(missionData);
          setFinalReviewLoading(false);
        })
        .catch(() => setFinalReviewLoading(false));
    }

    setCurrentStep(nextStep);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentStep, fuelLevel, fuelWhy, fuel3Why, sparkId, userId]);

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

  // ---- Sendoff: save session and go to dashboard ----

  const handleSendoff = useCallback(async () => {
    // Navigate immediately — don't block on save
    router.replace('/(tabs)/dashboard');
    try {
      await saveMorningSparkSession(userId, {
        fuel_level: fuelLevel || 2,
        fuel_reason: fuelLevel === 1 ? fuelWhy : fuelLevel === 3 ? fuel3Why : null,
        screen_context: selectedRole || null,
        started_at: startedAt || new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving morning spark session:', error);
    }
  }, [userId, fuelLevel, fuelWhy, fuel3Why, selectedRole, startedAt, router]);

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

  // ---- Helper: check if all brain dump items are processed ----
  const allBrainDumpProcessed =
    brainDumpData != null && brainDumpData.items != null && brainDumpItemsProcessed.size >= brainDumpData.items.length;

  // ---- Step dots ----

  const renderStepDots = () => (
    <View style={styles.stepDotsContainer}>
      {STEPS.map((step, index) => {
        // Skip the opening compass animation from dots
        if (index === 0) return null;
        return (
        <TouchableOpacity
          key={step.key}
          onPress={() => {
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
        );
      })}
    </View>
  );

  // ---- Render step content ----

  const renderStepContent = () => {
    switch (currentStep) {
      // ======== STEP 0: Opening — LifeCompass ceremony (spindles to South) ========
      case 0:
        return (
          <View style={styles.centeredContent}>
            <LifeCompass
              size={260}
              contextMode="morning_spark"
              onCeremonyComplete={goToNextStep}
            />
          </View>
        );

      // ======== STEP 1: Fuel Check ========
      case 1:
        return (
          <View style={{ flex: 1 }}>
            <EnergyCheckStep
              fuelLevel={fuelLevel}
              fuelWhy={fuelWhy}
              fuel3Why={fuel3Why}
              onFuelLevelChange={setFuelLevel}
              onFuelWhyChange={setFuelWhy}
              onFuel3WhyChange={setFuel3Why}
            />
            {!fuelLevel && (
              <TouchableOpacity
                style={{ position: 'absolute', bottom: 80, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24 }}
                onPress={goToNextStep}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      // ======== STEP 2: Brain Dump Handoff (auto-skipped if empty) ========
      case 2:
        if (brainDumpLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Checking brain dump...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="south"
              label="Brain Dump Handoff"
              powerQuestion={'"What am I doing to get there?"'}
            />

            {allBrainDumpProcessed ? (
              <View style={styles.emptyState}>
                <Text style={[styles.successText, { color: colors.success }]}>
                  All items processed!
                </Text>
                <TouchableOpacity
                  style={[styles.continueButton, { backgroundColor: STEPS[2].color }]}
                  onPress={goToNextStep}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              (brainDumpData.items || []).map((item) => {
                if (brainDumpItemsProcessed.has(item.id)) return null;
                return (
                  <View
                    key={item.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={[styles.cardText, { color: colors.text }]}>{item.content}</Text>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#4169E1' }]}
                        onPress={() => handleProcessBrainDumpItem(item.id, item.content, 'task')}
                      >
                        <Text style={styles.actionButtonText}>Make it a task</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#F57F17' }]}
                        onPress={() => {
                          setShowScheduleInput((prev) => ({
                            ...prev,
                            [item.id]: !prev[item.id],
                          }));
                        }}
                      >
                        <Text style={styles.actionButtonText}>Schedule it</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#666' }]}
                        onPress={() => handleProcessBrainDumpItem(item.id, item.content, 'park')}
                      >
                        <Text style={styles.actionButtonText}>Park it</Text>
                      </TouchableOpacity>
                    </View>
                    {showScheduleInput[item.id] && (
                      <View style={styles.scheduleDateRow}>
                        <TextInput
                          style={[
                            styles.dateInput,
                            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                          ]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textSecondary}
                          value={scheduleDateInputs[item.id] || ''}
                          onChangeText={(text) =>
                            setScheduleDateInputs((prev) => ({ ...prev, [item.id]: text }))
                          }
                        />
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#4169E1' }]}
                          onPress={() => {
                            handleProcessBrainDumpItem(
                              item.id,
                              item.content,
                              'schedule',
                              scheduleDateInputs[item.id],
                            );
                          }}
                        >
                          <Text style={styles.actionButtonText}>Confirm</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        );

      // ======== STEP 3: Today's Commitments ========
      case 3:
        if (commitLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading tasks...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="south"
              label="Today's Commitments"
              powerQuestion={'"What am I doing to get there?"'}
            />

            {weeklyOneThing && (
              <View
                style={[
                  styles.oneThingCard,
                  { backgroundColor: '#FFF8E1', borderColor: '#D4A843' },
                ]}
              >
                <Text style={styles.oneThingLabel}>This week's ONE thing:</Text>
                <Text style={styles.oneThingText}>{weeklyOneThing}</Text>
              </View>
            )}

            {tasks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending tasks found
                </Text>
                <TouchableOpacity
                  style={[styles.continueButton, { backgroundColor: STEPS[3].color }]}
                  onPress={goToNextStep}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.selectionHint, { color: colors.textSecondary, marginBottom: 0 }]}>
                    Select tasks to commit to today{selectedTaskIds.size > 0 ? ` (${selectedTaskIds.size} selected)` : ''}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#4169E1',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => setShowQuickAdd(!showQuickAdd)}
                  >
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600', lineHeight: 24 }}>+</Text>
                  </TouchableOpacity>
                </View>
                {showQuickAdd && (
                  <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                    <TextInput
                      style={[
                        styles.taskCard,
                        {
                          flex: 1,
                          backgroundColor: colors.surface,
                          borderColor: '#4169E1',
                          borderWidth: 2,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          color: colors.text,
                          fontSize: 16,
                          marginBottom: 0,
                        },
                      ]}
                      placeholder="Add a new task..."
                      placeholderTextColor={colors.textSecondary}
                      value={quickAddTitle}
                      onChangeText={setQuickAddTitle}
                      onSubmitEditing={handleQuickAddTask}
                      autoFocus
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: quickAddTitle.trim() ? '#4169E1' : colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 16,
                        justifyContent: 'center',
                      }}
                      disabled={!quickAddTitle.trim()}
                      onPress={handleQuickAddTask}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const sevenDaysAgo = new Date();
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

                  // Filter out past events (only show today's events)
                  const filtered = tasks.filter((t) => {
                    if (t.type === 'event' && t.due_date && t.due_date < todayStr) return false;
                    return true;
                  });

                  // Group tasks
                  const todayEvents = filtered.filter((t) => t.type === 'event' && t.due_date === todayStr);
                  const dueTodayTasks = filtered.filter((t) => t.type !== 'event' && t.due_date === todayStr);
                  const overdueRecent = filtered.filter((t) => t.type !== 'event' && t.due_date && t.due_date < todayStr && t.due_date >= sevenDaysAgoStr);
                  const overdueOld = filtered.filter((t) => t.type !== 'event' && t.due_date && t.due_date < sevenDaysAgoStr);
                  const noDueDate = filtered.filter((t) => t.type !== 'event' && !t.due_date);
                  // Events in the future
                  const futureEvents = filtered.filter((t) => t.type === 'event' && t.due_date && t.due_date > todayStr);

                  const renderTaskCard = (task: CommitmentTask) => {
                    const isSelected = selectedTaskIds.has(task.id);
                    const matrixColor =
                      task.is_urgent && task.is_important ? '#ef4444' :
                      !task.is_urgent && task.is_important ? '#22c55e' :
                      task.is_urgent && !task.is_important ? '#eab308' :
                      '#9ca3af';
                    const roleBadges = task.roles.slice(0, 2);
                    const domainBadges = task.domains.slice(0, 2);
                    const krBadges = task.keyRelationships.slice(0, 2);
                    const hasRelations = task.roles.length > 0 || task.domains.length > 0 || task.keyRelationships.length > 0;

                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={[
                          styles.taskCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: isSelected ? '#4169E1' : matrixColor,
                            borderWidth: isSelected ? 2 : 1,
                            borderLeftWidth: 4,
                            borderLeftColor: matrixColor,
                          },
                        ]}
                        onPress={() => handleToggleTask(task.id)}
                      >
                        <View style={[styles.checkbox, isSelected && { backgroundColor: '#4169E1', borderColor: '#4169E1' }, !isSelected && { borderColor: colors.border }]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={styles.taskTextContainer}>
                          <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
                          {task.due_date && (
                            <Text style={[styles.taskDueDate, { color: colors.textSecondary }]}>
                              {task.type === 'event' ? task.due_date : `Due: ${task.due_date}`}
                            </Text>
                          )}
                          {hasRelations && (
                            <View style={styles.relationBadgeRow}>
                              {roleBadges.map((r) => (
                                <View key={r.id} style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#9333ea' }]} numberOfLines={1}>{r.label}</Text>
                                </View>
                              ))}
                              {task.roles.length > 2 && (
                                <View style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#9333ea' }]}>+{task.roles.length - 2}</Text>
                                </View>
                              )}
                              {domainBadges.map((d) => (
                                <View key={d.id} style={[styles.relationBadge, { backgroundColor: '#fed7aa', borderColor: '#fdba74' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#c2410c' }]} numberOfLines={1}>{d.label}</Text>
                                </View>
                              ))}
                              {task.domains.length > 2 && (
                                <View style={[styles.relationBadge, { backgroundColor: '#fed7aa', borderColor: '#fdba74' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#c2410c' }]}>+{task.domains.length - 2}</Text>
                                </View>
                              )}
                              {krBadges.map((k) => (
                                <View key={k.id} style={[styles.relationBadge, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#1d4ed8' }]} numberOfLines={1}>{k.label}</Text>
                                </View>
                              ))}
                              {task.keyRelationships.length > 2 && (
                                <View style={[styles.relationBadge, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#1d4ed8' }]}>+{task.keyRelationships.length - 2}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  };

                  const renderSection = (title: string, items: CommitmentTask[], defaultOpen: boolean = true) => {
                    if (items.length === 0) return null;
                    return (
                      <View key={title} style={{ marginBottom: 12 }}>
                        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                          {title} ({items.length})
                        </Text>
                        {items.map(renderTaskCard)}
                      </View>
                    );
                  };

                  return (
                    <>
                      {renderSection("Today's Events", todayEvents)}
                      {renderSection('Due Today', dueTodayTasks)}
                      {renderSection('Tasks', noDueDate)}
                      {renderSection('Overdue (this week)', overdueRecent)}
                      {renderSection('Overdue (older)', overdueOld)}
                      {renderSection('Upcoming Events', futureEvents)}
                    </>
                  );
                })()}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    {
                      backgroundColor: selectedTaskIds.size > 0 ? '#4169E1' : colors.border,
                    },
                  ]}
                  disabled={selectedTaskIds.size === 0}
                  onPress={() => {
                    // Don't write to DB here — selections are held in state
                    // and written when user hits "I'm Committed" on the Final Review
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    goToNextStep();
                  }}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        );

      // ======== STEP 4: Goal Pulse ========
      case 4:
        if (goalPulseLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading goals...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="south"
              label="Goal Pulse"
              powerQuestion={'"Where do I want to go?"'}
            />

            {allGoalPulse.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No goals with actions for today
                </Text>
                <TouchableOpacity
                  style={[styles.continueButton, { backgroundColor: STEPS[4].color }]}
                  onPress={goToNextStep}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {allGoalPulse.map((goalItem) => (
                  <View key={goalItem.goal_id} style={{ marginBottom: 20 }}>
                    {/* Goal header with execution scores */}
                    <View style={[styles.goalPulseHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.goalTitle, { color: colors.text }]}>{goalItem.goal_title}</Text>
                      <View style={styles.goalStats}>
                        <View style={styles.goalStatItem}>
                          <Text style={[styles.goalStatValue, { color: '#4169E1' }]}>
                            {goalItem.total_execution_percent}%
                          </Text>
                          <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                            Total Effort
                          </Text>
                        </View>
                        <View style={styles.goalStatItem}>
                          <Text style={[styles.goalStatValue, { color: goalItem.week_execution_percent >= 50 ? '#39b54a' : '#eab308' }]}>
                            {goalItem.week_execution_percent}%
                          </Text>
                          <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                            This Week
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Action cards with commitment checkboxes */}
                    {goalItem.actions_for_today.map((action) => {
                      const isCommitted = committedActionIds.has(action.task_id);
                      const isDoneToday = action.completed_today;
                      const opacity = isDoneToday ? 0.5 : 1;

                      return (
                        <TouchableOpacity
                          key={action.task_id}
                          activeOpacity={0.7}
                          disabled={isDoneToday}
                          onPress={() => {
                            setCommittedActionIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(action.task_id)) {
                                next.delete(action.task_id);
                              } else {
                                next.add(action.task_id);
                              }
                              return next;
                            });
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }}
                          style={[
                            styles.taskCard,
                            {
                              opacity,
                              backgroundColor: colors.surface,
                              borderColor: isCommitted ? '#4169E1' : colors.border,
                              borderWidth: isCommitted ? 2 : 1,
                              borderLeftWidth: 4,
                              borderLeftColor: isDoneToday ? '#39b54a' : action.is_scheduled_today ? '#4169E1' : '#9ca3af',
                            },
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Checkbox */}
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                borderWidth: 2,
                                borderColor: isDoneToday ? '#39b54a' : isCommitted ? '#4169E1' : colors.border,
                                backgroundColor: isDoneToday ? '#39b54a' : isCommitted ? '#4169E1' : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                              }}
                            >
                              {(isCommitted || isDoneToday) && (
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>✓</Text>
                              )}
                            </View>

                            <View style={[styles.taskTextContainer, { flex: 1 }]}>
                              <Text style={[
                                styles.taskTitle,
                                { color: isDoneToday ? colors.textSecondary : colors.text },
                                isDoneToday && { textDecorationLine: 'line-through' },
                              ]}>
                                {action.title}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                <Text style={[styles.taskDueDate, { color: colors.textSecondary }]}>
                                  {action.weekly_actual}/{action.target_days} this week
                                </Text>
                                {isDoneToday ? (
                                  <Text style={{ fontSize: 11, color: '#39b54a', fontWeight: '600' }}>
                                    • Done today
                                  </Text>
                                ) : action.is_scheduled_today ? (
                                  <Text style={{ fontSize: 11, color: '#4169E1', fontWeight: '600' }}>
                                    • Today
                                  </Text>
                                ) : null}
                              </View>
                              {/* Relationship badges */}
                              <View style={styles.relationBadgeRow}>
                                <View style={[styles.relationBadge, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#1d4ed8' }]} numberOfLines={1}>
                                    {goalItem.goal_title}
                                  </Text>
                                </View>
                                {action.roles.slice(0, 2).map((r) => (
                                  <View key={r.id} style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                    <Text style={[styles.relationBadgeText, { color: '#9333ea' }]} numberOfLines={1}>{r.label}</Text>
                                  </View>
                                ))}
                                {action.roles.length > 2 && (
                                  <View style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                    <Text style={[styles.relationBadgeText, { color: '#9333ea' }]}>+{action.roles.length - 2}</Text>
                                  </View>
                                )}
                                {action.domains.slice(0, 2).map((d) => (
                                  <View key={d.id} style={[styles.relationBadge, { backgroundColor: '#fed7aa', borderColor: '#fdba74' }]}>
                                    <Text style={[styles.relationBadgeText, { color: '#c2410c' }]} numberOfLines={1}>{d.name}</Text>
                                  </View>
                                ))}
                                {action.domains.length > 2 && (
                                  <View style={[styles.relationBadge, { backgroundColor: '#fed7aa', borderColor: '#fdba74' }]}>
                                    <Text style={[styles.relationBadgeText, { color: '#c2410c' }]}>+{action.domains.length - 2}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                {/* Commit selected actions summary */}
                {committedActionIds.size > 0 && (
                  <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                    <Text style={[styles.captureQuestion, { color: colors.textSecondary, fontSize: 14 }]}>
                      {committedActionIds.size} action{committedActionIds.size !== 1 ? 's' : ''} committed for today
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        );

      // ======== STEP 5: Role Focus ========
      case 5:
        if (roleLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading roles...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="west"
              label="Role Focus"
              powerQuestion={'"Who do I want to become?"'}
            />

            {roleFocus.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No priority roles configured
                </Text>
                <TouchableOpacity
                  style={[styles.continueButton, { backgroundColor: STEPS[5].color }]}
                  onPress={goToNextStep}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.roleIntroText, { color: colors.text }]}>
                  These are the roles you plan to invest in today.
                </Text>

                {roleFocus.filter((role) => role.pending_task_count > 0).map((role) => (
                  <View
                    key={role.role_id}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: role.needs_attention ? '#eab308' : colors.border,
                        borderWidth: role.needs_attention ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.roleName, { color: colors.text }]}>
                          {role.role_name}
                        </Text>
                        {role.is_priority && (
                          <View style={[styles.relationBadge, { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }]}>
                            <Text style={[styles.relationBadgeText, { color: '#9333ea', fontSize: 10 }]}>
                              Priority
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.roleTaskCount, { color: colors.textSecondary }]}>
                        ({role.pending_task_count} today)
                      </Text>
                    </View>
                    {role.role_mission && (
                      <Text
                        style={[styles.roleMission, { color: colors.textSecondary, fontStyle: 'italic' }]}
                      >
                        {role.role_mission}
                      </Text>
                    )}
                    {role.needs_attention && role.days_since_activity !== null && (
                      <Text style={{ fontSize: 13, color: '#eab308', marginTop: 4 }}>
                        No activity in {role.days_since_activity} days
                      </Text>
                    )}
                    {role.needs_attention && role.days_since_activity === null && (
                      <Text style={{ fontSize: 13, color: '#eab308', marginTop: 4 }}>
                        No activity yet
                      </Text>
                    )}
                  </View>
                ))}

                {/* Wellness Zones section */}
                {!wellnessLoading && wellnessGaps.filter((z) => z.pending_task_count > 0).length > 0 && (
                  <>
                    <View style={{ marginTop: 24 }}>
                      <CompassDirectionHeader
                        direction="east"
                        label="Wellness Focus"
                        powerQuestion={'"Who do I want to become?"'}
                      />
                    </View>
                    <Text style={[styles.roleIntroText, { color: colors.text }]}>
                      These are the wellness zones you are investing in today.
                    </Text>
                    {wellnessGaps.filter((zone) => zone.pending_task_count > 0).map((zone) => (
                      <View
                        key={zone.zone_id}
                        style={[
                          styles.roleCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: zone.needs_attention ? '#eab308' : colors.border,
                            borderWidth: zone.needs_attention ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.roleName, { color: colors.text }]}>{zone.zone_name}</Text>
                            {zone.is_priority && (
                              <View style={[styles.relationBadge, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                                <Text style={[styles.relationBadgeText, { color: '#16a34a', fontSize: 10 }]}>Priority</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.roleTaskCount, { color: colors.textSecondary }]}>
                            ({zone.pending_task_count} today)
                          </Text>
                        </View>
                        {zone.needs_attention && zone.days_since_activity !== null && (
                          <Text style={{ fontSize: 13, color: '#eab308', marginTop: 4 }}>
                            No activity in {zone.days_since_activity} days
                          </Text>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {/* Initial capture prompt — before any analysis */}
                {!showCaptureInput && parsedItems.length === 0 && (
                  <View style={{ marginTop: 24 }}>
                    <Text style={[styles.captureQuestion, { color: colors.text }]}>
                      Is there anything else you want to add or capture?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                      <TouchableOpacity
                        style={[styles.captureOptionButton, { backgroundColor: '#9370DB' }]}
                        onPress={() => setShowCaptureInput(true)}
                      >
                        <Text style={styles.captureOptionButtonText}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => {
                          setSelectedRole(roleFocus[0]?.role_name || null);
                          goToNextStep();
                        }}
                      >
                        <Text style={[styles.captureOptionButtonText, { color: colors.text }]}>Not Right Now</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Capture text input */}
                {showCaptureInput && parsedItems.length === 0 && (
                  <View style={{ marginTop: 16 }}>
                    <TextInput
                      style={[
                        styles.captureInput,
                        { color: colors.text, borderColor: '#9370DB', backgroundColor: colors.surface },
                      ]}
                      placeholder="What's on your mind? You can mention multiple things..."
                      placeholderTextColor={colors.textSecondary}
                      value={captureText}
                      onChangeText={setCaptureText}
                      multiline
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        { backgroundColor: captureText.trim() ? '#9370DB' : colors.border, marginTop: 12 },
                      ]}
                      disabled={!captureText.trim() || captureAnalyzing}
                      onPress={async () => {
                        setCaptureAnalyzing(true);
                        try {
                          const result = await analyzeCapture(userId, captureText.trim(), roleFocus);
                          setParsedItems(result?.items || []);
                          setCurrentItemIndex(0);
                          setShowCaptureInput(false);
                        } catch (err) {
                          console.error('Analysis failed:', err);
                          Alert.alert('Error', 'Could not analyze. Please try again.');
                        } finally {
                          setCaptureAnalyzing(false);
                        }
                      }}
                    >
                      {captureAnalyzing ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Analyze</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Walk through parsed items one at a time */}
                {parsedItems.length > 0 && currentItemIndex < parsedItems.length && (() => {
                  const item = parsedItems[currentItemIndex];
                  const typeLabel = item.suggested_type === 'depositIdea' ? 'Deposit Idea' : item.suggested_type;

                  const handleConfirmItem = async (finalItem: ParsedCaptureItem) => {
                    try {
                      await quickSaveCapture(userId, finalItem);
                      setCapturedCount((c) => c + 1);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }
                      setCurrentItemIndex(currentItemIndex + 1);
                    } catch (err) {
                      console.error('Quick save failed:', err);
                      Alert.alert('Error', 'Could not save. Please try again.');
                    }
                  };

                  const handleEditItem = (finalItem: ParsedCaptureItem) => {
                    const prefill = buildFormPrefill(finalItem);
                    setFormPrefill(prefill);
                    setShowTaskEventForm(true);
                  };

                  const handleChooseAlternative = () => {
                    if (item.alternative_type) {
                      const updated = { ...item, suggested_type: item.alternative_type, needs_clarification: false };
                      const newItems = [...parsedItems];
                      newItems[currentItemIndex] = updated;
                      setParsedItems(newItems);
                      handleConfirmItem(updated);
                    }
                  };

                  return (
                    <View style={[styles.analysisCard, { backgroundColor: colors.surface, borderColor: '#9370DB' }]}>
                      <Text style={[styles.analysisLabel, { color: colors.textSecondary }]}>
                        Item {currentItemIndex + 1} of {parsedItems.length}
                      </Text>

                      {/* Clarification question from DD */}
                      {item.needs_clarification && item.clarification_question ? (
                        <>
                          <Text style={[styles.clarificationQuestion, { color: colors.text }]}>
                            {item.clarification_question}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                            <TouchableOpacity
                              style={[styles.captureOptionButton, { backgroundColor: '#9370DB', flex: 1 }]}
                              onPress={() => {
                                const updated = { ...item, needs_clarification: false };
                                const newItems = [...parsedItems];
                                newItems[currentItemIndex] = updated;
                                setParsedItems(newItems);
                                handleConfirmItem(updated);
                              }}
                            >
                              <Text style={styles.captureOptionButtonText}>
                                Yes, it's a {typeLabel}
                              </Text>
                            </TouchableOpacity>
                            {item.alternative_type && (
                              <TouchableOpacity
                                style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                                onPress={handleChooseAlternative}
                              >
                                <Text style={[styles.captureOptionButtonText, { color: colors.text }]}>
                                  It's a {item.alternative_type === 'depositIdea' ? 'Deposit Idea' : item.alternative_type}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </>
                      ) : (
                        /* No clarification needed — show suggestion and confirm */
                        <>
                          <Text style={[styles.analysisTitle, { color: colors.text }]}>
                            {item.title}
                          </Text>
                          <View style={styles.analysisMeta}>
                            <View style={[styles.analysisTag, { backgroundColor: '#9370DB' }]}>
                              <Text style={styles.analysisTagText}>{typeLabel}</Text>
                            </View>
                            {item.suggested_role_name && (
                              <View style={[styles.analysisTag, { backgroundColor: '#4169E1' }]}>
                                <Text style={styles.analysisTagText}>{item.suggested_role_name}</Text>
                              </View>
                            )}
                            {(item.suggested_domain_names || []).map((name: string, i: number) => (
                              <View key={`d-${i}`} style={[styles.analysisTag, { backgroundColor: '#39b54a' }]}>
                                <Text style={styles.analysisTagText}>{name}</Text>
                              </View>
                            ))}
                            {(item.suggested_key_relationship_names || []).map((name: string, i: number) => (
                              <View key={`kr-${i}`} style={[styles.analysisTag, { backgroundColor: '#60a5fa' }]}>
                                <Text style={styles.analysisTagText}>{name}</Text>
                              </View>
                            ))}
                          </View>
                          <Text style={[styles.analysisReasoning, { color: colors.textSecondary }]}>
                            {item.reasoning}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                            <TouchableOpacity
                              style={[styles.captureOptionButton, { backgroundColor: '#9370DB', flex: 2 }]}
                              onPress={() => handleConfirmItem(item)}
                            >
                              <Text style={styles.captureOptionButtonText}>Looks Right</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: '#4169E1', borderWidth: 1, flex: 1 }]}
                              onPress={() => handleEditItem(item)}
                            >
                              <Text style={[styles.captureOptionButtonText, { color: '#4169E1' }]}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                              onPress={() => setCurrentItemIndex(currentItemIndex + 1)}
                            >
                              <Text style={[styles.captureOptionButtonText, { color: colors.text }]}>Skip</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })()}

                {/* All items processed — summary and continue */}
                {parsedItems.length > 0 && currentItemIndex >= parsedItems.length && (
                  <View style={{ marginTop: 16, alignItems: 'center' }}>
                    <Text style={[styles.successText, { color: '#39b54a' }]}>
                      {capturedCount} {capturedCount === 1 ? 'item' : 'items'} captured!
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                      <TouchableOpacity
                        style={[styles.captureOptionButton, { backgroundColor: '#9370DB' }]}
                        onPress={() => {
                          setCaptureText('');
                          setParsedItems([]);
                          setCurrentItemIndex(0);
                          setShowCaptureInput(true);
                        }}
                      >
                        <Text style={styles.captureOptionButtonText}>Add More</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => {
                          setSelectedRole(roleFocus[0]?.role_name || null);
                          goToNextStep();
                        }}
                      >
                        <Text style={[styles.captureOptionButtonText, { color: colors.text }]}>Continue</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* TaskEventForm Modal — pre-filled from DD analysis */}
                <Modal visible={showTaskEventForm} animationType="slide" presentationStyle="fullScreen">
                  <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
                    <TaskEventForm
                      mode="create"
                      preSelectedType={formPrefill?.type}
                      initialData={formPrefill ? {
                        title: formPrefill.title,
                        type: formPrefill.type,
                        selectedRoleIds: formPrefill.selectedRoleIds,
                        selectedDomainIds: formPrefill.selectedDomainIds,
                        selectedKeyRelationshipIds: formPrefill.selectedKeyRelationshipIds,
                        is_deposit_idea: formPrefill.is_deposit_idea,
                      } : undefined}
                      onClose={() => {
                        setShowTaskEventForm(false);
                        setFormPrefill(null);
                        // Move to next item
                        setCurrentItemIndex(currentItemIndex + 1);
                      }}
                      onSubmitSuccess={() => {
                        setShowTaskEventForm(false);
                        setFormPrefill(null);
                        setCapturedCount((c) => c + 1);
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                        // Move to next item
                        setCurrentItemIndex(currentItemIndex + 1);
                      }}
                    />
                  </Suspense>
                </Modal>
              </>
            )}
          </ScrollView>
        );

      // ======== STEP 6: Today's Plan (Final Review) ========
      case 6:
        if (finalReviewLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Building your day...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="south"
              label="Today's Plan"
              powerQuestion={'"What am I doing to get there?"'}
            />

            {!isCommitted ? (
              <>
                {/* Events section */}
                {(!finalReview?.events || finalReview.events.length === 0) ? (
                  <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>
                    No scheduled events today
                  </Text>
                ) : (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>EVENTS</Text>
                    {finalReview.events.map((evt) => (
                      <View
                        key={evt.id}
                        style={[styles.taskCard, {
                          backgroundColor: colors.surface,
                          borderColor: '#4169E1',
                          borderWidth: 1,
                          borderLeftWidth: 4,
                          borderLeftColor: '#4169E1',
                        }]}
                      >
                        <View style={styles.taskTextContainer}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.taskTitle, { color: colors.text }]}>{evt.title}</Text>
                            <Text style={{ fontSize: 13, color: '#4169E1', fontWeight: '600' }}>
                              {evt.is_all_day ? 'All day' : evt.start_time ? `${evt.start_time}${evt.end_time ? ` - ${evt.end_time}` : ''}` : ''}
                            </Text>
                          </View>
                          {(evt.roles.length > 0 || evt.domains.length > 0) && (
                            <View style={styles.relationBadgeRow}>
                              {evt.roles.slice(0, 2).map((r) => (
                                <View key={r.id} style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#9333ea' }]} numberOfLines={1}>{r.label}</Text>
                                </View>
                              ))}
                              {evt.domains.slice(0, 2).map((d) => (
                                <View key={d.id} style={[styles.relationBadge, { backgroundColor: '#fed7aa', borderColor: '#fdba74' }]}>
                                  <Text style={[styles.relationBadgeText, { color: '#c2410c' }]} numberOfLines={1}>{d.label}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Committed tasks section */}
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>COMMITTED TASKS</Text>
                {(!finalReview?.committedTasks || finalReview.committedTasks.length === 0) ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary, marginHorizontal: 16 }]}>
                    No tasks committed yet
                  </Text>
                ) : (
                  finalReview.committedTasks.map((task) => {
                    // Urgent/important border colors
                    const borderLeftColor = task.is_urgent && task.is_important ? '#E53935'
                      : task.is_urgent ? '#FF9800'
                      : task.is_important ? '#eab308'
                      : colors.border;

                    return (
                      <View
                        key={task.id}
                        style={[styles.taskCard, {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderLeftWidth: 4,
                          borderLeftColor,
                        }]}
                      >
                        <View style={styles.taskTextContainer}>
                          <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
                          <View style={styles.relationBadgeRow}>
                            {task.source === 'goal_action' && task.goal_title && (
                              <View style={[styles.relationBadge, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
                                <Text style={[styles.relationBadgeText, { color: '#1d4ed8' }]} numberOfLines={1}>
                                  {task.goal_title}
                                </Text>
                              </View>
                            )}
                            {task.roles.slice(0, 2).map((r) => (
                              <View key={r.id} style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                <Text style={[styles.relationBadgeText, { color: '#9333ea' }]} numberOfLines={1}>{r.label}</Text>
                              </View>
                            ))}
                            {task.roles.length > 2 && (
                              <View style={[styles.relationBadge, { backgroundColor: '#fce7f3', borderColor: '#f3e8ff' }]}>
                                <Text style={[styles.relationBadgeText, { color: '#9333ea' }]}>+{task.roles.length - 2}</Text>
                              </View>
                            )}
                            {task.domains.slice(0, 2).map((d) => (
                              <View key={d.id} style={[styles.relationBadge, { backgroundColor: '#fed7aa', borderColor: '#fdba74' }]}>
                                <Text style={[styles.relationBadgeText, { color: '#c2410c' }]} numberOfLines={1}>{d.label}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        {/* Remove button */}
                        <TouchableOpacity
                          style={{ padding: 8 }}
                          onPress={async () => {
                            await removeFromTodayCommitments(userId, task.id);
                            setFinalReview((prev) => prev ? {
                              ...prev,
                              committedTasks: prev.committedTasks.filter((t) => t.id !== task.id),
                            } : prev);
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }}
                        >
                          <X size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}

                {/* Action text */}
                <Text style={[styles.commitPrompt, { color: colors.text }]}>
                  These are the actions you are committing to accomplish today — would you like to add any or remove anything?
                </Text>

                {/* Add / I'm Committed buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                    onPress={() => setShowFinalAddForm(true)}
                  >
                    <Text style={[styles.captureOptionButtonText, { color: colors.text }]}>+ Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.captureOptionButton, { backgroundColor: '#4169E1', flex: 2 }]}
                    onPress={async () => {
                      try {
                        // Collect ALL committed task IDs: step 3 selections + goal actions + any final review additions
                        const allTaskIds = [
                          ...Array.from(selectedTaskIds),
                          ...Array.from(committedActionIds),
                          ...(finalReview?.tasks || [])
                            .filter((t) => !selectedTaskIds.has(t.id) && !committedActionIds.has(t.id))
                            .map((t) => t.id),
                        ];
                        console.log('I\'m Committed — writing to DB:', userId, allTaskIds);
                        await commitTodaysTasks(userId, allTaskIds);
                        console.log('Committed successfully');
                        setIsCommitted(true);
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        }
                        goToNextStep();
                      } catch (err) {
                        console.error('Commit error:', err);
                        Alert.alert('Error', 'Failed to save commitments: ' + (err as Error).message);
                      }
                    }}
                  >
                    <Text style={styles.captureOptionButtonText}>I'm Committed</Text>
                  </TouchableOpacity>
                </View>

                {/* Add Task Form Modal */}
                <Modal visible={showFinalAddForm} animationType="slide" presentationStyle="fullScreen">
                  <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}><ActivityIndicator size="large" color="#3b82f6" /></View>}>
                    <TaskEventForm
                      mode="create"
                      onClose={() => setShowFinalAddForm(false)}
                      onSubmitSuccess={async () => {
                        setShowFinalAddForm(false);
                        // Refresh the review data
                        const goalActionIds = Array.from(committedActionIds);
                        const updated = await getFinalReviewData(userId, Array.from(selectedTaskIds), goalActionIds);
                        setFinalReview(updated);
                      }}
                    />
                  </Suspense>
                </Modal>
              </>
            ) : (
              /* Post-commitment: North Star option */
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={[styles.commitConfirmText, { color: colors.text }]}>
                  You're locked in.
                </Text>
                <Text style={[styles.commitConfirmSub, { color: colors.textSecondary }]}>
                  {(finalReview?.committedTasks.length || 0) + (finalReview?.events.length || 0)} items on today's plan
                </Text>

                {missionTouch?.one_thing && (
                  <Text style={[styles.missionOneThing, { color: colors.textSecondary, marginTop: 16 }]}>
                    This week's ONE thing: {missionTouch.one_thing}
                  </Text>
                )}

                <Text style={[styles.northStarQuestion, { color: colors.text }]}>
                  Would you like to spend a moment with your North Star, or get to work?
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.captureOptionButton, { backgroundColor: '#E53935' }]}
                    onPress={() => {
                      setIsCommitted(false);
                      setCurrentStep(7);
                    }}
                  >
                    <Text style={styles.captureOptionButtonText}>Review North Star</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.captureOptionButton, { backgroundColor: '#D4A843' }]}
                    onPress={handleSendoff}
                  >
                    <Text style={styles.captureOptionButtonText}>Let's Go</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        );

      // ======== STEP 7: North Star ========
      case 7:
        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="north"
              label="North Star"
              powerQuestion={'"Who am I? Why am I here?"'}
            />

            {missionTouch?.mission_statement ? (
              <View style={styles.missionContainer}>
                <Text style={[styles.missionText, { color: colors.text }]}>
                  {missionTouch.mission_statement}
                </Text>
                {missionTouch?.one_thing && (
                  <Text style={[styles.missionOneThing, { color: colors.textSecondary }]}>
                    This week's ONE thing: {missionTouch.one_thing}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.missionContainer}>
                <Text style={[styles.ddCoachText, { color: colors.text }]}>
                  I notice you don't yet have a mission statement. Would you like to plant a seed in that area by answering a question?
                </Text>
                <Text style={[styles.ddCoachQuestion, { color: colors.textSecondary }]}>
                  "If you could be remembered for one thing, what would it be?"
                </Text>

                {!showMissionAnswer ? (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                    <TouchableOpacity
                      style={[styles.captureOptionButton, { backgroundColor: '#E53935' }]}
                      onPress={() => setShowMissionAnswer(true)}
                    >
                      <Text style={styles.captureOptionButtonText}>Answer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.captureOptionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                      onPress={() => {
                        saveMorningSparkSession(userId, {
                          fuel_level: fuelLevel || 2,
                          fuel_reason: fuelLevel === 1 ? fuelWhy : fuelLevel === 3 ? fuel3Why : null,
                          screen_context: selectedRole || null,
                          started_at: startedAt || new Date().toISOString(),
                          completed_at: new Date().toISOString(),
                        }).catch((err) => console.error('Session save error:', err));
                        router.replace('/(tabs)/dashboard');
                      }}
                    >
                      <Text style={[styles.captureOptionButtonText, { color: colors.text }]}>Later — getting to work</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: 16, width: '100%' }}>
                    <TextInput
                      style={[
                        styles.captureInput,
                        { color: colors.text, borderColor: '#E53935', backgroundColor: colors.surface, marginHorizontal: 0 },
                      ]}
                      placeholder="Your answer..."
                      placeholderTextColor={colors.textSecondary}
                      value={missionAnswerText}
                      onChangeText={setMissionAnswerText}
                      multiline
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        { backgroundColor: missionAnswerText.trim() ? '#E53935' : colors.border, marginTop: 12 },
                      ]}
                      disabled={!missionAnswerText.trim()}
                      onPress={async () => {
                        // Save as a reflection tagged to North Star
                        try {
                          const supabase = getSupabaseClient();
                          await supabase.from('0008-ap-reflections').insert({
                            user_id: userId,
                            content: `If I could be remembered for one thing: ${missionAnswerText.trim()}`,
                            reflection_type: 'daily',
                            date: new Date().toISOString().split('T')[0],
                          });
                          Alert.alert('Seed planted!', 'Your reflection has been saved. You can develop this into a mission statement in your Weekly Alignment.');
                        } catch (err) {
                          console.error('Save reflection error:', err);
                        }
                        // Complete the morning spark
                        saveMorningSparkSession(userId, {
                          fuel_level: fuelLevel || 2,
                          fuel_reason: fuelLevel === 1 ? fuelWhy : fuelLevel === 3 ? fuel3Why : null,
                          screen_context: selectedRole || null,
                          started_at: startedAt || new Date().toISOString(),
                          completed_at: new Date().toISOString(),
                        }).catch((err) => console.error('Session save error:', err));
                        router.replace('/(tabs)/dashboard');
                      }}
                    >
                      <Text style={styles.confirmButtonText}>Save & Go</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.ddCoachNote, { color: colors.textSecondary, marginTop: 16 }]}>
                  You can explore this further in your Weekly Alignment under North Star.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.sendoffButton, { backgroundColor: '#D4A843', marginHorizontal: 16, marginTop: 24 }]}
              onPress={() => {
                // Save session with error handling and navigate
                saveMorningSparkSession(userId, {
                  fuel_level: fuelLevel || 2,
                  fuel_reason: fuelLevel === 1 ? fuelWhy : fuelLevel === 3 ? fuel3Why : null,
                  screen_context: selectedRole || null,
                  started_at: startedAt || new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                }).catch((err) => console.error('Session save error:', err));
                router.replace('/(tabs)/dashboard');
              }}
            >
              <Text style={styles.sendoffButtonText}>Go make it count</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      default:
        return null;
    }
  };

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
      <View style={styles.stepContent}>{renderStepContent()}</View>

      {/* Bottom navigation bar — hidden on opening (auto-advance) and last step */}
      {currentStep > 0 && currentStep < STEPS.length - 1 && (
        <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.surface }]}
            onPress={goToPreviousStep}
          >
            <Text style={[styles.navButtonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              styles.navButtonPrimary,
              { backgroundColor: currentStep === 6 ? '#4169E1' : currentStepData.color },
            ]}
            onPress={async () => {
              if (currentStep === 6) {
                // Today's Plan — commit and complete
                try {
                  const allIds = [...Array.from(selectedTaskIds), ...Array.from(committedActionIds)];
                  if (allIds.length > 0) {
                    await commitTodaysTasks(userId, allIds);
                  }
                  handleSendoff();
                } catch (err) {
                  console.error('Commit failed:', err);
                  handleSendoff();
                }
              } else {
                goToNextStep();
              }
            }}
          >
            <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>
              {currentStep === 6 ? 'Complete' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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

  // Opening step
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  openingTitle: {
    fontSize: 28,
    fontWeight: '700',
  },

  // Scroll content
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Cards
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Schedule date input
  scheduleDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  successText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  continueButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    marginHorizontal: 16,
    alignSelf: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // One Thing card
  oneThingCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  oneThingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D4A843',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  oneThingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  // Task sections
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },

  // Task selection
  selectionHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  taskTextContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  taskDueDate: {
    fontSize: 12,
    marginTop: 2,
  },
  relationBadgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 4,
  },
  relationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 100,
  },
  relationBadgeText: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  confirmButton: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Goal Pulse
  goalPulseHeader: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  goalContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  goalStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  goalStatItem: {
    alignItems: 'center',
  },
  goalStatValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  goalStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  trackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  trackButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Role Focus
  roleCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
  },
  roleName: {
    fontSize: 17,
    fontWeight: '600',
  },
  roleTaskCount: {
    fontSize: 15,
  },
  roleMission: {
    fontSize: 14,
    marginTop: 4,
  },
  roleIntroText: {
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  captureQuestion: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 16,
  },
  captureOptionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 120,
  },
  captureOptionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  captureInput: {
    marginHorizontal: 16,
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  analysisCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  analysisLabel: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  analysisTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  analysisMeta: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 10,
  },
  analysisTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  analysisTagText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize' as const,
  },
  analysisReasoning: {
    fontSize: 14,
    fontStyle: 'italic' as const,
    lineHeight: 20,
  },
  clarificationQuestion: {
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 12,
    fontWeight: '500',
  },

  // Wellness
  wellnessContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  wellnessGapText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },

  // Mission
  missionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: 'center',
    gap: 16,
  },
  missionText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
  missionOneThing: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  ddCoachText: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
  },
  ddCoachQuestion: {
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  ddCoachNote: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },

  // Final Commitment Review
  noEventsText: {
    fontSize: 15,
    marginHorizontal: 16,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  commitPrompt: {
    fontSize: 15,
    lineHeight: 22,
    marginHorizontal: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  commitConfirmText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  commitConfirmSub: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
  },
  northStarQuestion: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 24,
    paddingHorizontal: 20,
  },

  // Send-off
  sendoffOneThing: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sendoffText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  sendoffButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  sendoffButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
