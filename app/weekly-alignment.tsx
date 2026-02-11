import React, { useState, useEffect, useCallback } from 'react';
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
import { ChevronLeft, ChevronRight, CheckCircle2, Compass, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getSupabaseClient } from '@/lib/supabase';
import { toLocalISOString, getWeekStart, getWeekEnd, formatLocalDate } from '@/lib/dateUtils';
import { recordNorthStarVisit } from '@/lib/northStarVisits';
import type { WeekPlanItem } from '@/types/weekPlan';

// Step Components
import { TouchYourStarStep } from '@/components/weekly-alignment/TouchYourStarStep';
import { WingCheckRolesStep } from '@/components/weekly-alignment/WingCheckRolesStep';
import { WingCheckWellnessStep } from '@/components/weekly-alignment/WingCheckWellnessStep';
import { SixCheckStep } from '@/components/weekly-alignment/SixCheckStep';
import { TacticalDeploymentStep } from '@/components/weekly-alignment/TacticalDeploymentStep';
import { WeekPlanBadge } from '@/components/weekly-alignment/WeekPlanBadge';
import { TourGuideBubble } from '@/components/weekly-alignment/TourGuideBubble';
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

  // Alignment Escort state
  const [guidedModeEnabled, setGuidedModeEnabled] = useState(true);
  const [weekPlanItems, setWeekPlanItems] = useState<WeekPlanItem[]>([]);

  // Tour Guide floating bubble state (lifted from steps for overlay display)
  const [tourGuideMessage, setTourGuideMessage] = useState<string | null>(null);
  const [tourGuideLoading, setTourGuideLoading] = useState(false);
  
  // Week dates state
  const [weekStartDate, setWeekStartDate] = useState<string>('');
  const [weekEndDate, setWeekEndDate] = useState<string>('');

  // Week Plan accumulator callbacks
  const addWeekPlanItem = useCallback((item: Omit<WeekPlanItem, 'id' | 'created_at'>) => {
    const newItem: WeekPlanItem = {
      ...item,
      id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    };
    setWeekPlanItems(prev => [...prev, newItem]);
  }, []);

  const removeWeekPlanItem = useCallback((id: string) => {
    setWeekPlanItems(prev => prev.filter(item => item.id !== id));
  }, []);

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

      // Load user preferences (guided mode and week start day)
      const { data: userData } = await supabase
        .from('0008-ap-users')
        .select('week_start_day')
        .eq('id', user.id)
        .maybeSingle();
      
      const weekStartDay = (userData?.week_start_day === 'monday' ? 'monday' : 'sunday') as 'sunday' | 'monday';

      const { data: prefs } = await supabase
        .from('0008-ap-user-preferences')
        .select('alignment_guide_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prefs !== null && prefs.alignment_guide_enabled !== undefined) {
        setGuidedModeEnabled(prefs.alignment_guide_enabled);
      }

      // Calculate week dates using user's week start preference
      const today = new Date();
      const startOfWeek = getWeekStart(today, weekStartDay);
      const endOfWeek = getWeekEnd(today, weekStartDay);
      const weekStart = formatLocalDate(startOfWeek);
      const weekEnd = formatLocalDate(endOfWeek);
      
      setWeekStartDate(weekStart);
      setWeekEndDate(weekEnd);

      // Check if there's already a weekly alignment for this week
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
      setTourGuideMessage(null); // Clear for new step

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
      setTourGuideMessage(null); // Clear for new step

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
      setTourGuideMessage(null); // Clear for new step
      
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
      
      // Use week dates from state (already calculated with user preference)
      const weekStart = weekStartDate;
      const weekEnd = weekEndDate;

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

      if (existingAlignment) {
        await supabase
          .from('0008-ap-weekly-alignments')
          .update(alignmentRecord)
          .eq('id', existingAlignment.id);
      } else {
        await supabase
          .from('0008-ap-weekly-alignments')
          .insert(alignmentRecord);
      }

      // Track week plan items created during ritual in 0008-ap-ritual-items
      if (weekPlanItems.length > 0) {
        try {
          const ritualItems = weekPlanItems.map(item => ({
            user_id: userId,
            ritual_type: 'weekly_alignment',
            item_type: item.type,
            title: item.title,
            source_step: item.source_step,
            source_context: item.source_context,
            aligned_to: item.aligned_to || null,
            week_start_date: weekStart,
            created_at: item.created_at,
          }));

          await supabase
            .from('0008-ap-ritual-items')
            .insert(ritualItems);
        } catch (ritualError) {
          // Non-critical - log but don't block completion
          console.error('Error saving ritual items:', ritualError);
        }
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
        // Use weekStartDate from state
        const weekStart = weekStartDate;
        
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
        setWeekPlanItems([]);
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
            {weekPlanItems.length > 0
              ? `Your week is aligned. ${weekPlanItems.length} action${weekPlanItems.length !== 1 ? 's' : ''}, all connected to your purpose. Go make it happen.`
              : "You're aligned and ready to conquer this week."
            }
          </Text>

          <View style={[styles.completionCard, { backgroundColor: colors.surface, borderColor: '#10B981' }]}>
            <Text style={[styles.completionKeystoneLabel, { color: colors.textSecondary }]}>
              Your Commitment:
            </Text>
            <Text style={[styles.completionKeystone, { color: colors.text }]}>
              {weekPlanItems.length > 0
                ? `${weekPlanItems.length} aligned actions, all connected to your purpose`
                : `${(alignmentData.committedTasks?.length || 0) + (alignmentData.committedEvents?.length || 0)} items committed this week`
              }
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
            {currentStep >= 1 && guidedModeEnabled && (
              <WeekPlanBadge
                count={weekPlanItems.length}
                color={currentStepData.color}
              />
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
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
            onTourGuideMessage={(msg, loading) => {
              setTourGuideMessage(msg);
              setTourGuideLoading(loading);
            }}
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
            weekPlanItems={weekPlanItems}
            onAddWeekPlanItem={addWeekPlanItem}
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
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
            weekPlanItems={weekPlanItems}
            onAddWeekPlanItem={addWeekPlanItem}
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
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
            weekPlanItems={weekPlanItems}
            onAddWeekPlanItem={addWeekPlanItem}
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
          />
        )}

        {currentStep === 4 && (
          <TacticalDeploymentStep
            userId={userId}
            colors={colors}
            onComplete={handleComplete}
            onBack={goToPreviousStep}
            onRegisterBackHandler={(handler) => setStepBackHandler(() => handler)}
            capturedData={{
              missionReflection: alignmentData.missionReflection,
              roleHealthFlags: alignmentData.roleHealthFlags,
              flaggedWellnessZones: alignmentData.flaggedWellnessZones,
              laggingGoals: alignmentData.laggingGoals,
              keyFocusGoal: alignmentData.keyFocusGoal,
            }}
            guidedModeEnabled={guidedModeEnabled}
            weekPlanItems={weekPlanItems}
            onAddWeekPlanItem={addWeekPlanItem}
            onRemoveWeekPlanItem={removeWeekPlanItem}
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
          />
        )}
      </View>

      {/* Tour Guide floating bubble overlay */}
      {guidedModeEnabled && (
        <TourGuideBubble
          message={tourGuideMessage}
          isLoading={tourGuideLoading}
        />
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