import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';

// Compass header
import { CompassDirectionHeader } from '@/components/compass/CompassDirectionHeader';

// Evening review service
import {
  ReconciliationTask,
  RoleWithKRs,
  DomainItem,
  getTodaysCommittedTasks,
  reconcileTask,
  saveBrainDump,
  routeBrainDumpItem,
  saveEveningReviewSession,
  getAllRolesWithKRs,
  getAllDomains,
} from '@/lib/eveningReviewService';

// Task reconciliation card with dresser drawers
import TaskReconciliationCard from '@/components/evening-review/TaskReconciliationCard';

const STEPS = [
  { key: 'south_reconcile', label: 'Close the Loop', icon: '\u2705', color: '#4169E1' },
  { key: 'south_score', label: 'Day Score', icon: '\uD83D\uDCCA', color: '#4169E1' },
  { key: 'south_braindump', label: 'Brain Dump', icon: '\uD83E\uDDE0', color: '#4169E1' },
  { key: 'west_summary', label: 'Today\'s Summary', icon: '\uD83D\uDCCB', color: '#9370DB' },
  { key: 'complete', label: 'Complete', icon: '\u2728', color: '#D4A843' },
];

export default function EveningReviewCompassScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Core state
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [startedAt] = useState<string>(new Date().toISOString());

  // Step 0: Task Reconciliation
  const [reconciliationTasks, setReconciliationTasks] = useState<ReconciliationTask[]>([]);
  const [reconciledTasks, setReconciledTasks] = useState<Map<string, 'done' | 'alter' | 'release'>>(new Map());
  const [doneCount, setDoneCount] = useState(0);
  const [releaseCount, setReleaseCount] = useState(0);

  // Step 2: Brain Dump
  const [brainDumpText, setBrainDumpText] = useState('');
  const [brainDumpCaptured, setBrainDumpCaptured] = useState(false);
  const [brainDumpMode, setBrainDumpMode] = useState<'input' | 'organize' | 'saved'>('input');
  const [brainDumpFragments, setBrainDumpFragments] = useState<string[]>([]);
  const [currentFragmentIndex, setCurrentFragmentIndex] = useState(0);
  const [brainDumpProcessed, setBrainDumpProcessed] = useState(false);

  // Step 3: Summary data
  const [summaryRoles, setSummaryRoles] = useState<Array<{ name: string; count: number }>>([]);
  const [summaryDomains, setSummaryDomains] = useState<Array<{ name: string; count: number }>>([]);

  // Shared data for dresser drawers
  const [allRoles, setAllRoles] = useState<RoleWithKRs[]>([]);
  const [allDomains, setAllDomains] = useState<DomainItem[]>([]);

  // Derived
  const totalTasks = reconciliationTasks.length;
  const allReconciled = totalTasks > 0 && reconciledTasks.size === totalTasks;
  const dayScore = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

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

      // Pre-load reconciliation tasks + roles/domains for dresser drawers
      const [tasks, roles, domains] = await Promise.all([
        getTodaysCommittedTasks(user.id),
        getAllRolesWithKRs(user.id),
        getAllDomains(user.id),
      ]);
      setReconciliationTasks(tasks);
      setAllRoles(roles);
      setAllDomains(domains);

      // Pre-fill "Done" for already-completed tasks
      const prefilled = new Map<string, 'done' | 'alter' | 'release'>();
      let prefilledDone = 0;
      for (const t of tasks) {
        if (t.status === 'completed') {
          prefilled.set(t.id, 'done');
          prefilledDone++;
        }
      }
      if (prefilled.size > 0) {
        setReconciledTasks(prefilled);
        setDoneCount(prefilledDone);
      }
    } catch (error) {
      console.error('[EveningReview] Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  // ---- Reconciliation handlers defined in renderReconcileStep ----

  // ---- Brain Dump handlers ----

  const handleCaptureBrainDump = useCallback(() => {
    if (!brainDumpText.trim()) return;
    setBrainDumpCaptured(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [brainDumpText]);

  const handleSaveForMorning = useCallback(async () => {
    await saveBrainDump(userId, brainDumpText);
    setBrainDumpMode('saved');
    setBrainDumpProcessed(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [userId, brainDumpText]);

  const handleOrganizeNow = useCallback(() => {
    const fragments = brainDumpText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setBrainDumpFragments(fragments);
    setCurrentFragmentIndex(0);
    setBrainDumpMode('organize');
  }, [brainDumpText]);

  const handleRouteFragment = useCallback(
    async (route: 'rose' | 'thorn' | 'idea' | 'task') => {
      const fragment = brainDumpFragments[currentFragmentIndex];
      if (!fragment) return;

      await routeBrainDumpItem(userId, fragment, route);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (currentFragmentIndex < brainDumpFragments.length - 1) {
        setCurrentFragmentIndex((i) => i + 1);
      } else {
        // All fragments routed
        setBrainDumpMode('saved');
        setBrainDumpProcessed(true);
      }
    },
    [userId, brainDumpFragments, currentFragmentIndex],
  );

  // ---- Role Pulse handlers ----

  // ---- Complete handler ----

  const handleComplete = useCallback(async () => {
    try {
      await saveEveningReviewSession(userId, {
        day_score: dayScore,
        tasks_committed: totalTasks,
        tasks_completed: doneCount,
        brain_dump_raw: brainDumpText.trim() || null,
        brain_dump_processed: brainDumpProcessed,
        fuel_level: null,
        fuel_why: null,
        fuel_3_why: null,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        role_pulse: [],
        carry_forward_count: 0 /* carryCount removed */,
        release_count: releaseCount,
      });
    } catch (error) {
      console.error('[EveningReview] Error saving session:', error);
    }
  }, [
    userId,
    dayScore,
    totalTasks,
    doneCount,
    brainDumpText,
    brainDumpProcessed,
    startedAt,
    0 /* carryCount removed */,
    releaseCount,
  ]);

  // ---- Step navigation ----

  const goToNextStep = useCallback(async () => {
    if (currentStep >= STEPS.length - 1) return;

    const nextStep = currentStep + 1;

    // Load data for next step
    if (nextStep === 3) {
      // Build summary from reconciliation tasks
      const roleCountMap = new Map<string, number>();
      const domainCountMap = new Map<string, number>();
      for (const task of reconciliationTasks) {
        const action = reconciledTasks.get(task.id);
        if (action === 'done') {
          for (const r of task.roles) {
            roleCountMap.set(r.label, (roleCountMap.get(r.label) || 0) + 1);
          }
          for (const d of task.domains) {
            domainCountMap.set(d.label, (domainCountMap.get(d.label) || 0) + 1);
          }
        }
      }
      setSummaryRoles(Array.from(roleCountMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
      setSummaryDomains(Array.from(domainCountMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    }

    if (nextStep === 5) {
      // Complete step — save session
      handleComplete();
    }

    setCurrentStep(nextStep);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [currentStep, userId, handleComplete]);

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
            Preparing your evening review...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepData = STEPS[currentStep];

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

  const handleToggleDone = useCallback(
    async (taskId: string) => {
      const wasDone = reconciledTasks.get(taskId) === 'done';
      const newAction = wasDone ? undefined : 'done';

      if (!wasDone) {
        const success = await reconcileTask(taskId, 'done');
        if (!success) return;
        setDoneCount((c) => c + 1);
      } else {
        // Undo — revert task to pending
        const supabase = getSupabaseClient();
        await supabase.from('0008-ap-tasks').update({ status: 'pending', completed_at: null }).eq('id', taskId);
        setDoneCount((c) => Math.max(0, c - 1));
      }

      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setReconciledTasks((prev) => {
        const next = new Map(prev);
        if (newAction) {
          next.set(taskId, newAction);
        } else {
          next.delete(taskId);
        }
        return next;
      });
    },
    [reconciledTasks],
  );

  const renderReconcileStep = () => (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <CompassDirectionHeader
        direction="south"
        label="Close the Loop"
        powerQuestion={'"What am I doing to get there?"'}
      />

      {reconciliationTasks.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            No committed tasks for today. You're all clear!
          </Text>
        </View>
      ) : (
        <View style={styles.taskListContainer}>
          <Text style={[styles.sectionSubtitle, { color: colors.text, fontSize: 16, marginBottom: 4 }]}>
            Confirm what you completed today.
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
            {doneCount} of {totalTasks} done
          </Text>

          {reconciliationTasks.map((task) => (
            <TaskReconciliationCard
              key={task.id}
              task={task}
              userId={userId}
              isDone={reconciledTasks.get(task.id) === 'done'}
              onToggleDone={handleToggleDone}
              allRoles={allRoles}
              allDomains={allDomains}
            />
          ))}

        </View>
      )}
    </ScrollView>
  );

  const renderScoreStep = () => {
    let scoreLabel = '';
    if (totalTasks === 0) {
      scoreLabel = 'No tasks today';
    } else if (dayScore >= 85) {
      scoreLabel = 'On target';
    } else if (dayScore >= 50) {
      scoreLabel = 'Mixed day';
    } else {
      scoreLabel = `${doneCount} of ${totalTasks} tasks completed`;
    }

    const scoreColor =
      totalTasks === 0
        ? colors.textSecondary
        : dayScore >= 85
          ? '#4CAF50'
          : dayScore >= 50
            ? '#FF9800'
            : '#E53935';

    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentCentered}>
        <CompassDirectionHeader
          direction="south"
          label="Day Score"
          powerQuestion={'"What am I doing to get there?"'}
        />

        <View style={styles.scoreContainer}>
          <Text style={[styles.scorePercentage, { color: scoreColor }]}>
            {totalTasks === 0 ? '--' : `${dayScore}%`}
          </Text>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
            {scoreLabel}
          </Text>

          {totalTasks > 0 && (
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreBreakdownRow}>
                <Text style={[styles.scoreBreakdownLabel, { color: colors.textSecondary }]}>
                  Completed
                </Text>
                <Text style={[styles.scoreBreakdownValue, { color: '#4CAF50' }]}>
                  {doneCount}
                </Text>
              </View>
              <View style={styles.scoreBreakdownRow}>
                <Text style={[styles.scoreBreakdownLabel, { color: colors.textSecondary }]}>
                  Carried forward
                </Text>
                <Text style={[styles.scoreBreakdownValue, { color: '#FF9800' }]}>
                  {0 /* carryCount removed */}
                </Text>
              </View>
              <View style={styles.scoreBreakdownRow}>
                <Text style={[styles.scoreBreakdownLabel, { color: colors.textSecondary }]}>
                  Released
                </Text>
                <Text style={[styles.scoreBreakdownValue, { color: '#E53935' }]}>
                  {releaseCount}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.tapToContinue, { color: colors.textSecondary }]}>
          Tap Next to continue
        </Text>
      </ScrollView>
    );
  };

  const renderBrainDumpStep = () => (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <CompassDirectionHeader
        direction="south"
        label="Brain Dump"
        powerQuestion={'"What am I doing to get there?"'}
      />

      {brainDumpMode === 'input' && !brainDumpCaptured && (
        <View style={styles.brainDumpContainer}>
          <Text style={[styles.brainDumpQuestion, { color: colors.text }]}>
            Is there anything your tomorrow needs to know? Anything on your mind you want to capture?
          </Text>

          <Text style={[styles.brainDumpSubPrompt, { color: colors.textSecondary }]}>
            Were there any Roses 🌹 (wins, gratitude) or Thorns 🌵 (challenges, frustrations) from today?
          </Text>

          <TextInput
            style={[
              styles.brainDumpInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            multiline
            placeholder="Write your thoughts here..."
            placeholderTextColor={colors.textSecondary}
            value={brainDumpText}
            onChangeText={setBrainDumpText}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.captureButton,
              {
                backgroundColor: brainDumpText.trim() ? '#4169E1' : colors.border,
              },
            ]}
            onPress={handleCaptureBrainDump}
            disabled={!brainDumpText.trim()}
          >
            <Text style={[styles.captureButtonText, { color: '#FFF' }]}>Capture</Text>
          </TouchableOpacity>
        </View>
      )}

      {brainDumpMode === 'input' && brainDumpCaptured && (
        <View style={styles.brainDumpContainer}>
          <Text style={[styles.brainDumpCapturedLabel, { color: colors.text }]}>
            Captured! What would you like to do with it?
          </Text>

          <View style={styles.brainDumpChoiceRow}>
            <TouchableOpacity
              style={[styles.brainDumpChoiceButton, { backgroundColor: '#9370DB' }]}
              onPress={handleOrganizeNow}
            >
              <Text style={styles.brainDumpChoiceText}>Organize now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.brainDumpChoiceButton, { backgroundColor: '#4169E1' }]}
              onPress={handleSaveForMorning}
            >
              <Text style={styles.brainDumpChoiceText}>Save for morning</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {brainDumpMode === 'organize' && currentFragmentIndex < brainDumpFragments.length && (
        <View style={styles.brainDumpContainer}>
          <Text style={[styles.organizeProgress, { color: colors.textSecondary }]}>
            Item {currentFragmentIndex + 1} of {brainDumpFragments.length}
          </Text>

          <View
            style={[
              styles.fragmentCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.fragmentText, { color: colors.text }]}>
              {brainDumpFragments[currentFragmentIndex]}
            </Text>
          </View>

          <View style={styles.routeButtonsGrid}>
            <TouchableOpacity
              style={[styles.routeButton, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}
              onPress={() => handleRouteFragment('rose')}
            >
              <Text style={styles.routeButtonEmoji}>{'\uD83C\uDF39'}</Text>
              <Text style={[styles.routeButtonLabel, { color: '#2E7D32' }]}>Rose</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeButton, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}
              onPress={() => handleRouteFragment('thorn')}
            >
              <Text style={styles.routeButtonEmoji}>{'\uD83C\uDF35'}</Text>
              <Text style={[styles.routeButtonLabel, { color: '#E65100' }]}>Thorn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeButton, { backgroundColor: '#FFF8E1', borderColor: '#FFC107' }]}
              onPress={() => handleRouteFragment('idea')}
            >
              <Text style={styles.routeButtonEmoji}>{'\uD83D\uDCA1'}</Text>
              <Text style={[styles.routeButtonLabel, { color: '#F57F17' }]}>Idea</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeButton, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}
              onPress={() => handleRouteFragment('task')}
            >
              <Text style={styles.routeButtonEmoji}>{'\u2713'}</Text>
              <Text style={[styles.routeButtonLabel, { color: '#1565C0' }]}>Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {brainDumpMode === 'saved' && (
        <View style={styles.brainDumpContainer}>
          <Text style={[styles.brainDumpSavedText, { color: colors.text }]}>
            {brainDumpProcessed
              ? 'All items organized and routed!'
              : 'Brain dump saved. It will appear in your morning triage.'}
          </Text>
          <Text style={[styles.tapToContinue, { color: colors.textSecondary }]}>
            Tap Next to continue
          </Text>
        </View>
      )}

      {!brainDumpText.trim() && !brainDumpCaptured && brainDumpMode === 'input' && (
        <Text style={[styles.skipHint, { color: colors.textSecondary }]}>
          Nothing on your mind? Tap Next to skip.
        </Text>
      )}
    </ScrollView>
  );

  const renderSummaryStep = () => (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <CompassDirectionHeader
        direction="west"
        label="Today's Summary"
        powerQuestion={'"Who did I show up as today?"'}
      />

      <Text style={[styles.sectionSubtitle, { color: colors.text, marginHorizontal: 16, marginBottom: 12, fontSize: 16 }]}>
        Here's where you invested today.
      </Text>

      {/* Roles summary */}
      {summaryRoles.length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>ROLES</Text>
          {summaryRoles.map((r) => (
            <View key={r.name} style={[styles.summaryRow, { borderColor: colors.border }]}>
              <View style={{ backgroundColor: '#fce7f3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 13, color: '#9333ea', fontWeight: '600' }}>{r.name}</Text>
              </View>
              <Text style={[styles.summaryCount, { color: colors.text }]}>
                {r.count} {r.count === 1 ? 'task' : 'tasks'} completed
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Wellness zones summary */}
      {summaryDomains.length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>WELLNESS ZONES</Text>
          {summaryDomains.map((d) => (
            <View key={d.name} style={[styles.summaryRow, { borderColor: colors.border }]}>
              <View style={{ backgroundColor: '#fed7aa', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 13, color: '#c2410c', fontWeight: '600' }}>{d.name}</Text>
              </View>
              <Text style={[styles.summaryCount, { color: colors.text }]}>
                {d.count} {d.count === 1 ? 'task' : 'tasks'} completed
              </Text>
            </View>
          ))}
        </View>
      )}

      {summaryRoles.length === 0 && summaryDomains.length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            No tasks were marked as done today.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderCompleteStep = () => {
    const scoreColor =
      totalTasks === 0
        ? colors.textSecondary
        : dayScore >= 85
          ? '#4CAF50'
          : dayScore >= 50
            ? '#FF9800'
            : '#E53935';

    const firstLine = brainDumpText.trim()
      ? brainDumpText.trim().split('\n')[0]
      : null;

    return (
      <View style={styles.completeContainer}>
        <Text style={[styles.completeTitle, { color: colors.text }]}>Day complete.</Text>

        {totalTasks > 0 && (
          <Text style={[styles.completeScore, { color: scoreColor }]}>{dayScore}%</Text>
        )}

        {firstLine && (
          <View
            style={[
              styles.completeBrainDumpPreview,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.completeBrainDumpLabel, { color: colors.textSecondary }]}>
              Brain dump preview
            </Text>
            <Text
              style={[styles.completeBrainDumpText, { color: colors.text }]}
              numberOfLines={1}
            >
              {firstLine}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: '#D4A843' }]}
          onPress={() => router.replace('/(tabs)/dashboard')}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Evening Review</Text>
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
        {currentStep === 0 && renderReconcileStep()}
        {currentStep === 1 && renderScoreStep()}
        {currentStep === 2 && renderBrainDumpStep()}
        {currentStep === 3 && renderSummaryStep()}
        {currentStep === 4 && renderCompleteStep()}
      </View>

      {/* Bottom navigation bar for steps 0-4 (step 5 Complete has its own Done button) */}
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

  // Scroll containers
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  scrollContentCentered: {
    paddingBottom: 24,
    alignItems: 'center',
  },

  // Task Reconciliation
  taskListContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  taskCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyStateContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
  },

  // Day Score
  scoreContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  scorePercentage: {
    fontSize: 72,
    fontWeight: '800',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 24,
  },
  scoreBreakdown: {
    width: '100%',
    maxWidth: 280,
    gap: 8,
  },
  scoreBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreBreakdownLabel: {
    fontSize: 14,
  },
  scoreBreakdownValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  tapToContinue: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },

  // Brain Dump
  brainDumpContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  brainDumpQuestion: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  brainDumpSubPrompt: {
    fontSize: 14,
    fontStyle: 'italic' as const,
    lineHeight: 20,
    marginTop: -8,
  },
  brainDumpInput: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
  },
  captureButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  brainDumpCapturedLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  brainDumpChoiceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  brainDumpChoiceButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  brainDumpChoiceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  organizeProgress: {
    fontSize: 13,
    textAlign: 'center',
  },
  fragmentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    minHeight: 80,
    justifyContent: 'center',
  },
  fragmentText: {
    fontSize: 16,
    lineHeight: 22,
  },
  routeButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  routeButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  routeButtonEmoji: {
    fontSize: 18,
  },
  routeButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  brainDumpSavedText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  skipHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },

  // Summary
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryCount: {
    fontSize: 14,
  },

  // Role Pulse (legacy)
  roleListContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  roleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roleSlotBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  roleTaskCount: {
    fontSize: 12,
  },
  pulseButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pulseButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  pulseButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Complete
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  completeScore: {
    fontSize: 56,
    fontWeight: '800',
  },
  completeBrainDumpPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    width: '100%',
    maxWidth: 320,
  },
  completeBrainDumpLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  completeBrainDumpText: {
    fontSize: 14,
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
});
