import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, CheckCircle2, Compass, X, ClipboardList } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString } from '@/lib/dateUtils';
import { recordNorthStarVisit } from '@/lib/northStarVisits';
import { useWeekPlan } from '@/hooks/useWeekPlan';

// Step Components
import { TouchYourStarStep } from '@/components/weekly-alignment/TouchYourStarStep';
import { WingCheckRolesStep } from '@/components/weekly-alignment/WingCheckRolesStep';
import { WingCheckWellnessStep } from '@/components/weekly-alignment/WingCheckWellnessStep';
import { SixCheckStep } from '@/components/weekly-alignment/SixCheckStep';
import { TacticalDeploymentStep } from '@/components/weekly-alignment/TacticalDeploymentStep';
// Note: StepIndicatorCompact removed - using inline clickable version

// Types
interface WeeklyAlignmentData {
  // Step 1: Touch Your Star
  missionReflection?: string;
  visionAcknowledged?: boolean;
  valuesAcknowledged?: boolean;
  
  // Step 2: Wing Check Roles
  rolesReviewed?: string[];
  roleHealthFlags?: Record<string, 'thriving' | 'stable' | 'needs_attention'>;
  
  // Step 3: Wing Check Wellness
  wellnessReviewed?: boolean;
  zonesChecked?: string[];
  flaggedWellnessZones?: string[];
  
  // Step 4: Six Check Goals
  goalsReviewed?: string[];
  laggingGoals?: string[];
  onTrackGoals?: string[];
  keyFocusGoal?: string;
  
  // Step 5: Tactical Deployment
  committedTasks?: string[];
  committedEvents?: string[];
  delegatedTasks?: string[];
  personalCommitment?: string;
}

const STEPS = [
  { key: 'star', label: 'Touch Your Star', icon: '⭐', color: '#ed1c24' },
  { key: 'roles', label: 'Wing Check: Roles', icon: '👥', color: '#9370DB' },
  { key: 'wellness', label: 'Wing Check: Wellness', icon: '🌿', color: '#39b54a' },
  { key: 'goals', label: 'Six Check: Goals', icon: '🎯', color: '#4169E1' },
  { key: 'tactical', label: 'Tactical Deployment', icon: '🧭', color: '#FFD700' },
];

export default function WeeklyAlignmentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [alignmentData, setAlignmentData] = useState<WeeklyAlignmentData>({});
  const [existingAlignment, setExistingAlignment] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionAnimation] = useState(new Animated.Value(0));
  const [stepBackHandler, setStepBackHandler] = useState<(() => boolean) | null>(null);
  const [guidedModeEnabled, setGuidedModeEnabled] = useState(true);

  const weekPlan = useWeekPlan();

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        router.back();
        return;
      }

      setUserId(user.id);

      // Check if there's already a weekly alignment for this week
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const weekStart = toLocalISOString(startOfWeek).split('T')[0];

      const { data: existing } = await supabase
        .from('0008-ap-weekly-alignments')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)
        .maybeSingle();

      if (existing) {
        setExistingAlignment(existing);
        // Could show a "continue" or "review" mode
      }

      // Load guided mode setting
      const { data: ritualSettings } = await supabase
        .from('0008-ap-user-ritual-settings')
        .select('guided_mode_enabled')
        .eq('user_id', user.id)
        .eq('ritual_type', 'weekly_alignment')
        .maybeSingle();

      if (ritualSettings) {
        setGuidedModeEnabled(ritualSettings.guided_mode_enabled ?? true);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleStepDataCapture(stepData: Partial<WeeklyAlignmentData>) {
    setAlignmentData(prev => ({
      ...prev,
      ...stepData,
    }));
  }

  function goToNextStep() {
    if (currentStep < STEPS.length - 1) {
      if (currentStep === 0) {
        recordNorthStarVisit('weekly_alignment_step');
      }
      setCurrentStep(prev => prev + 1);
      setStepBackHandler(null);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }

  function goToStep(stepIndex: number) {
    if (stepIndex >= 0 && stepIndex < STEPS.length && stepIndex !== currentStep) {
      if (currentStep === 0 && stepIndex > 0) {
        recordNorthStarVisit('weekly_alignment_step');
      }
      setCurrentStep(stepIndex);
      setStepBackHandler(null);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }

  function handleExit() {
    router.back();
  }

  function goToPreviousStep() {
    // Check if current step has a custom back handler
    // This allows steps with sub-views (like SixCheckStep's annual-goals view) to handle back internally
    if (stepBackHandler) {
      const handled = stepBackHandler();
      if (handled) {
        // Step handled the back internally (e.g., going from sub-view to main view)
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return;
      }
    }

    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setStepBackHandler(null); // Clear handler when changing steps
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      // First step and step didn't handle it - just go back without confirmation
      router.back();
    }
  }

  async function handleComplete(contractData: any) {
    try {
      const supabase = getSupabaseClient();
      
      // Calculate week boundaries
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const weekStart = toLocalISOString(startOfWeek).split('T')[0];
      const weekEnd = toLocalISOString(endOfWeek).split('T')[0];

      const alignmentRecord = {
        user_id: userId,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        committed_tasks: contractData.committed_tasks,
        committed_events: contractData.committed_events,
        delegated_tasks: contractData.delegated_tasks,
        personal_commitment: contractData.personal_commitment,
        signed_at: contractData.signed_at,
        completed_at: new Date().toISOString(),
      };

      let alignmentId = existingAlignment?.id;

      if (existingAlignment) {
        await supabase
          .from('0008-ap-weekly-alignments')
          .update(alignmentRecord)
          .eq('id', existingAlignment.id);
      } else {
        const { data: newAlignment } = await supabase
          .from('0008-ap-weekly-alignments')
          .insert(alignmentRecord)
          .select('id')
          .single();

        if (newAlignment) {
          alignmentId = newAlignment.id;
        }
      }

      // Save week plan items from Alignment Escort
      if (guidedModeEnabled && weekPlan && weekPlan.itemCount > 0 && alignmentId) {
        const weekPlanRecords = weekPlan.items.map((item: any) => ({
          user_id: userId,
          alignment_id: alignmentId,
          item_type: item.type,
          item_id: item.item_id,
          title: item.title,
          source_step: item.source_step,
          source_context: item.source_context,
          aligned_to: item.aligned_to,
          is_committed: item.is_committed || false,
        }));

        await supabase
          .from('0008-ap-week-plan-items')
          .insert(weekPlanRecords);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Show completion animation
      setIsCompleted(true);
      Animated.spring(completionAnimation, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Auto redirect after delay
      setTimeout(() => {
        router.replace('/(tabs)/dashboard');
      }, 3000);

    } catch (error) {
      console.error('Error completing weekly alignment:', error);
      Alert.alert('Error', 'Failed to save your weekly alignment. Please try again.');
    }
  }

  async function handleDevReset() {
    const doReset = async () => {
      try {
        const supabase = getSupabaseClient();
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const weekStart = toLocalISOString(startOfWeek).split('T')[0];
        
        await supabase
          .from('0008-ap-weekly-alignments')
          .delete()
          .eq('user_id', userId)
          .eq('week_start_date', weekStart);
        
        if (Platform.OS === 'web') {
          window.alert('Weekly Alignment reset!');
        } else {
          Alert.alert('Success', 'Weekly Alignment reset!');
        }
        setCurrentStep(0);
        setAlignmentData({});
        setExistingAlignment(null);
      } catch (error) {
        console.error('Reset error:', error);
        if (Platform.OS === 'web') {
          window.alert('Failed to reset. Try again.');
        } else {
          Alert.alert('Error', 'Failed to reset. Try again.');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Reset Weekly Alignment?\n\nThis will delete this week\'s alignment and let you start fresh.')) {
        await doReset();
      }
    } else {
      Alert.alert(
        'Reset Weekly Alignment?',
        'This will delete this week\'s alignment and let you start fresh. (Dev only)',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: doReset },
        ]
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Compass size={48} color={colors.primary} />
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Preparing your weekly alignment...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Completion Screen
  if (isCompleted) {
    const scale = completionAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1],
    });

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.completionContainer}>
          <Animated.View style={[styles.completionIcon, { transform: [{ scale }] }]}>
            <CheckCircle2 size={80} color="#10B981" />
          </Animated.View>
          
          <Text style={[styles.completionTitle, { color: colors.text }]}>
            Weekly Contract Signed! ✨
          </Text>
          
          <Text style={[styles.completionSubtitle, { color: colors.textSecondary }]}>
            You're aligned and ready to conquer this week.
          </Text>

          <View style={[styles.completionCard, { backgroundColor: colors.surface, borderColor: '#10B981' }]}>
            <Text style={[styles.completionKeystoneLabel, { color: colors.textSecondary }]}>
              Your Commitment:
            </Text>
            <Text style={[styles.completionKeystone, { color: colors.text }]}>
              {guidedModeEnabled && weekPlan && weekPlan.itemCount > 0
                ? `${weekPlan.committedCount} of ${weekPlan.itemCount} aligned actions committed`
                : `${(alignmentData.committedTasks?.length || 0) + (alignmentData.committedEvents?.length || 0)} items committed this week`}
            </Text>
          </View>

          <Text style={[styles.redirectText, { color: colors.textSecondary }]}>
            Redirecting to dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepData = STEPS[currentStep];

  // Inline clickable step indicator
  const renderStepDots = () => (
    <View style={styles.stepDotsContainer}>
      {STEPS.map((step, index) => (
        <TouchableOpacity
          key={step.key}
          onPress={() => goToStep(index)}
          style={styles.stepDotTouchable}
          accessible={true}
          accessibilityLabel={`Go to ${step.label}`}
          accessibilityRole="button"
        >
          <View
            style={[
              styles.stepDot,
              index === currentStep 
                ? [styles.stepDotActive, { backgroundColor: currentStepData.color }]
                : { backgroundColor: colors.border },
            ]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={goToPreviousStep}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel={currentStep === 0 ? "Exit" : "Go back"}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Weekly Alignment
            </Text>
            {guidedModeEnabled && weekPlan.itemCount > 0 && currentStep > 0 && (
              <View style={[styles.weekPlanBadge, { backgroundColor: currentStepData.color }]}>
                <ClipboardList size={14} color="#ffffff" />
                <Text style={styles.weekPlanBadgeText}>{weekPlan.itemCount}</Text>
              </View>
            )}
          </View>
          {renderStepDots()}
        </View>

        {/* Forward Arrow */}
        <TouchableOpacity
          onPress={goToNextStep}
          style={styles.nextButton}
          accessible={true}
          accessibilityLabel="Continue to next step"
        >
          <ChevronRight size={24} color={currentStep < STEPS.length - 1 ? colors.text : colors.border} />
        </TouchableOpacity>

        {/* Small X Close Button - Top Right Corner */}
        <TouchableOpacity
          onPress={handleExit}
          style={styles.closeButton}
          accessible={true}
          accessibilityLabel="Exit Weekly Alignment"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Step Content */}
      <View style={styles.stepContent}>
        {currentStep === 0 && (
          <TouchYourStarStep
            userId={userId}
            colors={colors}
            onNext={goToNextStep}
            onDataCapture={(data) => handleStepDataCapture(data)}
            onRegisterBackHandler={(handler) => setStepBackHandler(() => handler)}
            guidedModeEnabled={guidedModeEnabled}
            weekPlan={weekPlan}
          />
        )}

        {currentStep === 1 && (
          <WingCheckRolesStep
            userId={userId}
            colors={colors}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            onDataCapture={(data) => handleStepDataCapture(data)}
            onRegisterBackHandler={(handler) => setStepBackHandler(() => handler)}
            guidedModeEnabled={guidedModeEnabled}
            weekPlan={weekPlan}
          />
        )}

        {currentStep === 2 && (
          <WingCheckWellnessStep
            userId={userId}
            colors={colors}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            onDataCapture={(data) => handleStepDataCapture(data)}
            onRegisterBackHandler={(handler) => setStepBackHandler(() => handler)}
            guidedModeEnabled={guidedModeEnabled}
            weekPlan={weekPlan}
          />
        )}

        {currentStep === 3 && (
          <SixCheckStep
            userId={userId}
            colors={colors}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            onDataCapture={(data) => handleStepDataCapture(data)}
            onRegisterBackHandler={(handler) => setStepBackHandler(() => handler)}
            guidedModeEnabled={guidedModeEnabled}
            weekPlan={weekPlan}
          />
        )}

        {currentStep === 4 && (
          <TacticalDeploymentStep
            userId={userId}
            colors={colors}
            onComplete={handleComplete}
            onBack={goToPreviousStep}
            onRegisterBackHandler={(handler) => setStepBackHandler(() => handler)}
            guidedModeEnabled={guidedModeEnabled}
            weekPlan={weekPlan}
            capturedData={{
              missionReflection: alignmentData.missionReflection,
              roleHealthFlags: alignmentData.roleHealthFlags,
              flaggedWellnessZones: alignmentData.flaggedWellnessZones,
              laggingGoals: alignmentData.laggingGoals,
              keyFocusGoal: alignmentData.keyFocusGoal,
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    position: 'relative',
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  weekPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  weekPlanBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  nextButton: {
    padding: 8,
    width: 44,
    alignItems: 'flex-end',
  },
  closeButton: {
    position: 'absolute',
    top: 2,
    right: 8,
    padding: 4,
  },
  stepDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDotTouchable: {
    padding: 4, // Increase touch target
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 20, // Longer for current step
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  completionIcon: {
    marginBottom: 24,
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  completionCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  completionKeystoneLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  completionKeystone: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  redirectText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});