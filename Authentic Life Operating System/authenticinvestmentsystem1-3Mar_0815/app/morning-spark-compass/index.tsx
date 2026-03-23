import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@/lib/morningSparkCompassService';

const STEPS = [
  { key: 'opening', label: 'Opening', icon: '\uD83E\uDDED', color: GOLD },
  { key: 'south_fuel', label: 'Fuel Check', icon: '\u26A1', color: '#F57F17' },
  { key: 'south_handoff', label: 'Brain Dump Handoff', icon: '\uD83D\uDCCB', color: '#4169E1' },
  { key: 'south_commit', label: "Today's Commitments", icon: '\u2705', color: '#4169E1' },
  { key: 'south_goal', label: 'Goal Pulse', icon: '\uD83C\uDFAF', color: '#4169E1' },
  { key: 'west', label: 'Role Focus', icon: '\uD83D\uDC65', color: '#9370DB' },
  { key: 'east', label: 'Wellness Pulse', icon: '\uD83C\uDF3F', color: '#39b54a' },
  { key: 'north', label: 'Mission Touch', icon: '\u2B50', color: '#ed1c24' },
  { key: 'sendoff', label: 'Send-off', icon: '\uD83D\uDE80', color: GOLD },
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

  // Step 5: Role Focus
  const [roleFocus, setRoleFocus] = useState<RoleFocusData[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // Step 6: Wellness Pulse
  const [wellnessGaps, setWellnessGaps] = useState<WellnessGapData[]>([]);
  const [wellnessLoading, setWellnessLoading] = useState(false);

  // Step 7: Mission Touch
  const [missionTouch, setMissionTouch] = useState<MissionTouchData | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const missionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ---- Mission auto-advance (step 7) ----

  useEffect(() => {
    if (currentStep === 7 && !missionLoading) {
      missionTimerRef.current = setTimeout(() => {
        setCurrentStep(8);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }, 3000);
    }
    return () => {
      if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
    };
  }, [currentStep, missionLoading]);

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
          if (newProcessedCount >= brainDumpData.items.length) {
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
          Alert.alert('Quick check', "What's driving this energy? Tap an option to continue.");
          return;
        }
        const newSparkId = await saveFuelLevel(sparkId, userId, fuelLevel, fuelWhy, fuel3Why);
        setSparkId(newSparkId);
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
          if (!data || data.items.length === 0) {
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
      // Goal Pulse
      setGoalPulseLoading(true);
      getGoalPulse(userId)
        .then((data) => {
          setGoalPulse(data);
          setGoalPulseLoading(false);
        })
        .catch(() => setGoalPulseLoading(false));
    }

    if (nextStep === 5) {
      // Role Focus
      setRoleLoading(true);
      getRoleFocus(userId)
        .then((data) => {
          setRoleFocus(data);
          setRoleLoading(false);
        })
        .catch(() => setRoleLoading(false));
    }

    if (nextStep === 6) {
      // Wellness Pulse
      setWellnessLoading(true);
      getWellnessGaps(userId)
        .then((data) => {
          setWellnessGaps(data);
          setWellnessLoading(false);
          // If no gaps, auto-advance
          if (data.length === 0) {
            setTimeout(() => {
              setCurrentStep(7);
              // Load mission data
              setMissionLoading(true);
              getMissionTouch(userId)
                .then((mData) => {
                  setMissionTouch(mData);
                  setMissionLoading(false);
                })
                .catch(() => setMissionLoading(false));
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }, 500);
          }
        })
        .catch(() => setWellnessLoading(false));
    }

    if (nextStep === 7) {
      // Mission Touch
      setMissionLoading(true);
      getMissionTouch(userId)
        .then((data) => {
          setMissionTouch(data);
          setMissionLoading(false);
        })
        .catch(() => setMissionLoading(false));
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
    try {
      await saveMorningSparkSession(userId, {
        fuel_level: fuelLevel || 2,
        fuel_reason: fuelLevel === 1 ? fuelWhy : fuelLevel === 3 ? fuel3Why : null,
        screen_context: selectedRole || null,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      console.error('Error saving morning spark session:', error);
      Alert.alert('Error', 'Failed to save session. Please try again.');
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
    brainDumpData != null && brainDumpItemsProcessed.size >= brainDumpData.items.length;

  // ---- Step dots ----

  const renderStepDots = () => (
    <View style={styles.stepDotsContainer}>
      {STEPS.map((step, index) => (
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
      ))}
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
          <EnergyCheckStep
            fuelLevel={fuelLevel}
            fuelWhy={fuelWhy}
            fuel3Why={fuel3Why}
            onFuelLevelChange={setFuelLevel}
            onFuelWhyChange={setFuelWhy}
            onFuel3WhyChange={setFuel3Why}
          />
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
              brainDumpData.items.map((item) => {
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
                {tasks.map((task) => {
                  const isSelected = selectedTaskIds.has(task.id);
                  return (
                    <TouchableOpacity
                      key={task.id}
                      style={[
                        styles.taskCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: isSelected ? '#4169E1' : colors.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleToggleTask(task.id)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && { backgroundColor: '#4169E1', borderColor: '#4169E1' },
                          !isSelected && { borderColor: colors.border },
                        ]}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.taskTextContainer}>
                        <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
                        {task.due_date && (
                          <Text style={[styles.taskDueDate, { color: colors.textSecondary }]}>
                            Due: {task.due_date}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    {
                      backgroundColor: selectedTaskIds.size > 0 ? '#4169E1' : colors.border,
                    },
                  ]}
                  disabled={selectedTaskIds.size === 0}
                  onPress={async () => {
                    await commitTodaysTasks(Array.from(selectedTaskIds));
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
                Loading goal data...
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

            {!goalPulse ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No active 12-week goal
                </Text>
                <TouchableOpacity
                  style={[styles.continueButton, { backgroundColor: STEPS[4].color }]}
                  onPress={goToNextStep}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.goalContainer}>
                <Text style={[styles.goalTitle, { color: colors.text }]}>{goalPulse.title}</Text>

                <View style={styles.goalStats}>
                  <View style={styles.goalStatItem}>
                    <Text style={[styles.goalStatValue, { color: '#4169E1' }]}>
                      {goalPulse.execution_rate}%
                    </Text>
                    <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                      Execution Rate
                    </Text>
                  </View>
                  {goalPulse.weeks_remaining !== null && (
                    <View style={styles.goalStatItem}>
                      <Text style={[styles.goalStatValue, { color: '#4169E1' }]}>
                        {goalPulse.weeks_remaining}
                      </Text>
                      <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                        Weeks Left
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.trackButtons}>
                  <TouchableOpacity
                    style={[
                      styles.trackButton,
                      {
                        backgroundColor:
                          goalTrackSelection === 'on_track' ? '#39b54a' : colors.surface,
                        borderColor:
                          goalTrackSelection === 'on_track' ? '#39b54a' : colors.border,
                      },
                    ]}
                    onPress={() => setGoalTrackSelection('on_track')}
                  >
                    <Text
                      style={[
                        styles.trackButtonText,
                        {
                          color:
                            goalTrackSelection === 'on_track' ? '#FFF' : colors.text,
                        },
                      ]}
                    >
                      On track
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.trackButton,
                      {
                        backgroundColor:
                          goalTrackSelection === 'needs_attention' ? '#E53935' : colors.surface,
                        borderColor:
                          goalTrackSelection === 'needs_attention' ? '#E53935' : colors.border,
                      },
                    ]}
                    onPress={() => setGoalTrackSelection('needs_attention')}
                  >
                    <Text
                      style={[
                        styles.trackButtonText,
                        {
                          color:
                            goalTrackSelection === 'needs_attention' ? '#FFF' : colors.text,
                        },
                      ]}
                    >
                      Needs attention
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
                {roleFocus.map((role) => {
                  const isSelected = selectedRole === role.role_name;
                  return (
                    <TouchableOpacity
                      key={role.role_id}
                      style={[
                        styles.roleCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: isSelected ? '#9370DB' : colors.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => setSelectedRole(role.role_name)}
                    >
                      <Text style={[styles.roleName, { color: colors.text }]}>
                        {role.role_name}
                      </Text>
                      {role.role_mission && (
                        <Text
                          style={[
                            styles.roleMission,
                            { color: colors.textSecondary, fontStyle: 'italic' },
                          ]}
                        >
                          {role.role_mission}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    {
                      backgroundColor: selectedRole ? '#9370DB' : colors.border,
                    },
                  ]}
                  disabled={!selectedRole}
                  onPress={goToNextStep}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        );

      // ======== STEP 6: Wellness Pulse ========
      case 6:
        if (wellnessLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Checking wellness...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="east"
              label="Wellness"
              powerQuestion={'"Who do I want to become?"'}
            />

            {wellnessGaps.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  All wellness zones are active this week!
                </Text>
              </View>
            ) : (
              <View style={styles.wellnessContainer}>
                <Text style={[styles.wellnessGapText, { color: colors.text }]}>
                  {wellnessGaps[0].zone_name} hasn't had attention this week.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: STEPS[6].color }]}
              onPress={goToNextStep}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      // ======== STEP 7: Mission Touch ========
      case 7:
        if (missionLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading mission...
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <CompassDirectionHeader
              direction="north"
              label="Mission"
              powerQuestion={'"Why am I here?"'}
            />

            <View style={styles.missionContainer}>
              <Text style={[styles.missionText, { color: colors.text }]}>
                {missionTouch?.mission_statement || 'Your mission is still forming.'}
              </Text>

              {missionTouch?.one_thing && (
                <Text style={[styles.missionOneThing, { color: colors.textSecondary }]}>
                  This week's ONE thing: {missionTouch.one_thing}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: STEPS[7].color }]}
              onPress={() => {
                if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
                setCurrentStep(8);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              }}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      // ======== STEP 8: Send-off ========
      case 8:
        return (
          <View style={styles.centeredContent}>
            {weeklyOneThing && (
              <Text style={[styles.sendoffOneThing, { color: colors.textSecondary }]}>
                This week: {weeklyOneThing}
              </Text>
            )}
            <Text style={[styles.sendoffText, { color: colors.text }]}>Go make it count.</Text>
            <TouchableOpacity
              style={[styles.sendoffButton, { backgroundColor: '#D4A843' }]}
              onPress={handleSendoff}
            >
              <Text style={styles.sendoffButtonText}>Let's go</Text>
            </TouchableOpacity>
          </View>
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

      {/* Bottom navigation bar — hidden on opening (auto-advance) and sendoff (has own button) */}
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
              { backgroundColor: currentStepData.color },
            ]}
            onPress={goToNextStep}
          >
            <Text style={[styles.navButtonText, { color: '#FFFFFF' }]}>Next</Text>
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
  roleMission: {
    fontSize: 14,
    marginTop: 4,
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
