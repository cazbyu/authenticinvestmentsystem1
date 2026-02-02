// ============================================================================
// SixCheckStep.tsx - Step 4 of Weekly Alignment (Goals Review)
// ============================================================================
// Design Pattern: Matches Steps 1-3 layout exactly
// - 72x72 container with 56x56 compass icon
// - "My Key Focus Goal" card (styled like "My Top 3 Active Roles")
// - NO back arrows in subheaders - parent handles back navigation
// - Blue color scheme (#4169E1)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { ChevronRight, Check, HelpCircle, Target, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

// Compass Goals icon for Step 4 header (matches Step 1-3 sizing: 56x56 in 72x72 container)
const CompassGoalsIcon = require('@/assets/images/compass-goals.png');

interface SixCheckStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onRegisterBackHandler?: (handler: () => boolean) => void;
  onDataCapture: (data: {
    goalsReviewed: string[];
    laggingGoals: string[];
    onTrackGoals: string[];
    keyFocusGoal?: string;
  }) => void;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  weekly_target?: number;
  total_target?: number;
  start_date?: string;
  end_date?: string;
  completion_reward?: string;
  is_lagging?: boolean;
  weeks_remaining?: number;
  required_weekly_progress?: number;
}

// Flow states for the step
type FlowState = 
  | 'loading'           // Initial data fetch
  | 'main'              // Main hub view
  | 'review-goals'      // List of goals for review
  | 'select-focus';     // Select key focus goal

// Brand color for Goals (blue)
const GOALS_COLOR = '#4169E1';
const GOALS_COLOR_LIGHT = '#4169E115';
const GOALS_COLOR_BORDER = '#4169E140';

// Progress color helpers
function getProgressColor(progress: number, isLagging?: boolean): string {
  if (isLagging) return '#EF4444';
  if (progress >= 75) return '#10B981';
  if (progress >= 50) return '#3B82F6';
  if (progress >= 25) return '#F59E0B';
  return '#6B7280';
}

export function SixCheckStep({
  userId,
  colors,
  onNext,
  onBack,
  onRegisterBackHandler,
  onDataCapture,
}: SixCheckStepProps) {
  // Flow state
  const [flowState, setFlowState] = useState<FlowState>('loading');
  
  // Data state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedFocusId, setSelectedFocusId] = useState<string | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for back handler (prevents stale closures)
  const flowStateRef = useRef<FlowState>(flowState);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  // Back handler for parent component
  useEffect(() => {
    if (onRegisterBackHandler) {
      onRegisterBackHandler(() => {
        const currentFlowState = flowStateRef.current;
        
        if (currentFlowState === 'main') {
          // At root - let parent handle exit
          return false;
        } else if (currentFlowState === 'review-goals') {
          setFlowState('main');
          return true;
        } else if (currentFlowState === 'select-focus') {
          setFlowState('main');
          return true;
        }
        return false;
      });
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const supabase = getSupabaseClient();

      // Load active 12-week goals
      const { data, error } = await supabase
        .from('0008-ap-goals-12wk')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('archived', false)
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Process goals to determine if lagging
      const today = new Date();
      const processedGoals = (data || []).map(goal => {
        const startDate = goal.start_date ? new Date(goal.start_date) : today;
        const endDate = goal.end_date ? new Date(goal.end_date) : new Date(startDate.getTime() + 12 * 7 * 24 * 60 * 60 * 1000);
        
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, totalDays - daysElapsed);
        const weeksRemaining = Math.ceil(daysRemaining / 7);

        // Calculate expected progress
        const expectedProgress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;
        const actualProgress = goal.progress || 0;
        
        // Goal is lagging if actual progress is more than 10% behind expected
        const isLagging = actualProgress < (expectedProgress - 10);

        // Calculate required weekly progress to catch up
        const remainingProgress = 100 - actualProgress;
        const requiredWeeklyProgress = weeksRemaining > 0 ? remainingProgress / weeksRemaining : remainingProgress;

        return {
          ...goal,
          is_lagging: isLagging,
          weeks_remaining: weeksRemaining,
          required_weekly_progress: Math.round(requiredWeeklyProgress * 10) / 10,
        };
      });

      setGoals(processedGoals);
      setFlowState('main');

    } catch (error) {
      console.error('Error loading goals:', error);
      setFlowState('main');
    } finally {
      setLoading(false);
    }
  }

  // Slide transition helper
  function slideToState(newState: FlowState) {
    Animated.timing(slideAnim, {
      toValue: -1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setFlowState(newState);
      slideAnim.setValue(1);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }

  function handleSelectFocus(goalId: string) {
    setSelectedFocusId(prev => prev === goalId ? null : goalId);
  }

  function handleContinue() {
    const laggingGoals = goals.filter(g => g.is_lagging).map(g => g.id);
    const onTrackGoals = goals.filter(g => !g.is_lagging).map(g => g.id);

    onDataCapture({
      goalsReviewed: goals.map(g => g.id),
      laggingGoals,
      onTrackGoals,
      keyFocusGoal: selectedFocusId || undefined,
    });
    
    onNext();
  }

  function getStatusBadge(goal: Goal) {
    if (goal.is_lagging) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#EF444420' }]}>
          <AlertTriangle size={12} color="#EF4444" />
          <Text style={[styles.statusBadgeText, { color: '#EF4444' }]}>Behind</Text>
        </View>
      );
    }
    if ((goal.progress || 0) >= 75) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#10B98120' }]}>
          <TrendingUp size={12} color="#10B981" />
          <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>On Track</Text>
        </View>
      );
    }
    return null;
  }

  // Get selected focus goal
  const focusGoal = goals.find(g => g.id === selectedFocusId);
  const laggingCount = goals.filter(g => g.is_lagging).length;
  const onTrackCount = goals.filter(g => !g.is_lagging).length;

  // ===== RENDER: LOADING STATE =====
  if (flowState === 'loading' || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GOALS_COLOR} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your goals...
        </Text>
      </View>
    );
  }

  // ===== RENDER: SELECT FOCUS STATE =====
  if (flowState === 'select-focus') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Standard format, NO back arrow */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Select Key Focus</Text>
              </View>
            </View>
          </View>

          {/* Instructions */}
          <View style={[styles.instructionCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <Text style={[styles.instructionText, { color: colors.text }]}>
              🎯 Choose one goal to be your KEY FOCUS this week
            </Text>
            <Text style={[styles.instructionHint, { color: colors.textSecondary }]}>
              This helps you prioritize your energy and attention.
            </Text>
          </View>

          {/* Goals List */}
          {goals.map(goal => {
            const isSelected = selectedFocusId === goal.id;
            const progressColor = getProgressColor(goal.progress || 0, goal.is_lagging);

            return (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.selectGoalCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: isSelected ? GOALS_COLOR : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  }
                ]}
                onPress={() => handleSelectFocus(goal.id)}
                activeOpacity={0.7}
              >
                <View style={styles.selectGoalLeft}>
                  <View style={[
                    styles.selectGoalCheck,
                    { 
                      backgroundColor: isSelected ? GOALS_COLOR : 'transparent',
                      borderColor: isSelected ? GOALS_COLOR : colors.border,
                    }
                  ]}>
                    {isSelected && <Check size={14} color="#FFFFFF" />}
                  </View>
                  <View style={styles.selectGoalInfo}>
                    <Text style={[styles.selectGoalTitle, { color: colors.text }]} numberOfLines={2}>
                      {goal.title}
                    </Text>
                    <View style={styles.selectGoalProgress}>
                      <View style={[styles.progressBarSmall, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.progressBarFillSmall,
                            { backgroundColor: progressColor, width: `${Math.min(100, goal.progress || 0)}%` }
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressTextSmall, { color: progressColor }]}>
                        {goal.progress || 0}%
                      </Text>
                    </View>
                  </View>
                </View>
                {getStatusBadge(goal)}
              </TouchableOpacity>
            );
          })}

          {/* Done Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Done</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: REVIEW GOALS STATE =====
  if (flowState === 'review-goals') {
    return (
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-300, 0, 300] }) }] }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header - Standard format, NO back arrow */}
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
                <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Review Your Goals</Text>
              </View>
            </View>
          </View>

          {/* Review Card */}
          <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
            <View style={styles.identityHeader}>
              <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
                <Target size={12} color="#FFFFFF" />
              </View>
              <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>YOUR 12-WEEK GOALS</Text>
            </View>
            
            <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
              Review your progress and identify goals that need attention
            </Text>
          </View>

          {/* Goals List */}
          {goals.map(goal => {
            const progressColor = getProgressColor(goal.progress || 0, goal.is_lagging);

            return (
              <View
                key={goal.id}
                style={[
                  styles.reviewGoalCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: goal.is_lagging ? '#EF4444' : colors.border,
                    borderLeftColor: progressColor,
                    borderLeftWidth: 4,
                  }
                ]}
              >
                <View style={styles.reviewGoalHeader}>
                  <Text style={[styles.reviewGoalTitle, { color: colors.text }]} numberOfLines={2}>
                    {goal.title}
                  </Text>
                  {getStatusBadge(goal)}
                </View>

                {/* Progress Bar */}
                <View style={styles.reviewGoalProgressSection}>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: progressColor, width: `${Math.min(100, goal.progress || 0)}%` }
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: progressColor }]}>
                    {goal.progress || 0}%
                  </Text>
                </View>

                {/* Weeks Remaining */}
                <Text style={[styles.weeksText, { color: colors.textSecondary }]}>
                  {goal.weeks_remaining} week{goal.weeks_remaining !== 1 ? 's' : ''} remaining
                  {goal.is_lagging && goal.required_weekly_progress && (
                    <Text style={{ color: '#EF4444' }}>
                      {' '}• Need {goal.required_weekly_progress}%/week
                    </Text>
                  )}
                </Text>

                {/* Reward if exists */}
                {goal.completion_reward && (
                  <View style={[styles.rewardBox, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B40' }]}>
                    <Text style={[styles.rewardLabel, { color: '#F59E0B' }]}>🏆 Reward</Text>
                    <Text style={[styles.rewardText, { color: colors.text }]} numberOfLines={1}>
                      {goal.completion_reward}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Lagging Alert */}
          {laggingCount > 0 && (
            <View style={[styles.alertCard, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
              <AlertTriangle size={20} color="#EF4444" />
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
                  {laggingCount} Goal{laggingCount > 1 ? 's' : ''} Behind Schedule
                </Text>
                <Text style={[styles.alertText, { color: colors.textSecondary }]}>
                  Consider dedicating focused time this week to catch up.
                </Text>
              </View>
            </View>
          )}

          {/* Done Reviewing Button */}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: GOALS_COLOR }]}
            onPress={() => slideToState('main')}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: GOALS_COLOR }]}>Done Reviewing</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    );
  }

  // ===== RENDER: MAIN STATE (Hub View) =====
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header - Matching Step 1-3 style exactly */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.compassContainer, { backgroundColor: GOALS_COLOR_LIGHT }]}>
            <Image source={CompassGoalsIcon} style={styles.compassIcon} resizeMode="contain" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.stepLabel, { color: GOALS_COLOR }]}>Step 4</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Six Check: Goals</Text>
          </View>
          <TouchableOpacity
            style={styles.tooltipButton}
            onPress={() => setShowTooltip(!showTooltip)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HelpCircle size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showTooltip && (
          <View style={[styles.tooltipContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              Review your 12-week goal progress and select one goal as your KEY FOCUS for this week.
              This helps you channel your energy toward what matters most.
            </Text>
          </View>
        )}
      </View>

      {/* Summary Card - Styled like My Top 3 cards */}
      <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
            <Target size={12} color="#FFFFFF" />
          </View>
          <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>GOALS SUMMARY</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#10B981' }]}>{onTrackCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>On Track</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: '#EF4444' }]}>{laggingCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Need Attention</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNumber, { color: colors.text }]}>{goals.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Active</Text>
          </View>
        </View>
      </View>

      {/* Key Focus Card */}
      <View style={[styles.identityCard, { backgroundColor: GOALS_COLOR_LIGHT, borderColor: GOALS_COLOR_BORDER }]}>
        <View style={styles.identityHeader}>
          <View style={[styles.identityIconContainer, { backgroundColor: GOALS_COLOR }]}>
            <Text style={styles.identityIconEmoji}>🎯</Text>
          </View>
          <Text style={[styles.identityLabel, { color: GOALS_COLOR }]}>KEY FOCUS THIS WEEK</Text>
          <TouchableOpacity onPress={() => goals.length > 0 && slideToState('select-focus')}>
            <Text style={[styles.editLink, { color: GOALS_COLOR }]}>
              {focusGoal ? 'Change' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {focusGoal ? (
          <View style={styles.focusGoalDisplay}>
            <Text style={[styles.focusGoalTitle, { color: colors.text }]} numberOfLines={2}>
              {focusGoal.title}
            </Text>
            <View style={styles.focusGoalProgress}>
              <View style={[styles.progressBarSmall, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressBarFillSmall,
                    { 
                      backgroundColor: getProgressColor(focusGoal.progress || 0, focusGoal.is_lagging), 
                      width: `${Math.min(100, focusGoal.progress || 0)}%` 
                    }
                  ]}
                />
              </View>
              <Text style={[styles.progressTextSmall, { color: getProgressColor(focusGoal.progress || 0, focusGoal.is_lagging) }]}>
                {focusGoal.progress || 0}%
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.identitySubtext, { color: colors.textSecondary }]}>
            {goals.length > 0 
              ? 'No focus selected. Tap "Select" to choose your key focus.'
              : 'No active goals. Create goals in the Goals section.'}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsSection}>
        {/* Review Your Goals Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            { 
              backgroundColor: colors.surface, 
              borderColor: goals.length > 0 ? GOALS_COLOR : colors.border,
              borderWidth: goals.length > 0 ? 2 : 1,
              opacity: goals.length > 0 ? 1 : 0.5,
            }
          ]}
          onPress={() => goals.length > 0 && slideToState('review-goals')}
          disabled={goals.length === 0}
          activeOpacity={0.7}
        >
          <View style={styles.actionButtonContent}>
            <View style={[styles.actionButtonIcon, { backgroundColor: GOALS_COLOR }]}>
              <Target size={16} color="#FFFFFF" />
            </View>
            <View style={styles.actionButtonTextWrap}>
              <Text style={[styles.actionButtonText, { color: goals.length > 0 ? GOALS_COLOR : colors.text }]}>
                Review Your Goals
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors.textSecondary }]}>
                Check progress and identify priorities
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={goals.length > 0 ? GOALS_COLOR : colors.textSecondary} />
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: GOALS_COLOR }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue to Deployment</Text>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {goals.length === 0 && (
        <Text style={[styles.warningText, { color: '#F59E0B' }]}>
          You don't have any active 12-week goals. Consider creating some in the Goals section.
        </Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
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
  },
  
  // Header - Matching Step 1-3 exactly (72x72 container, 56x56 icon)
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  compassContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassIcon: {
    width: 56,
    height: 56,
  },
  headerTextContainer: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  tooltipButton: {
    padding: 8,
  },
  tooltipContent: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Identity Card - Styled like My Core Identity / My Top 3 cards
  identityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  identityIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityIconEmoji: {
    fontSize: 12,
  },
  identityLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  identitySubtext: {
    fontSize: 14,
    lineHeight: 20,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Summary Row
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
  },

  // Focus Goal Display
  focusGoalDisplay: {
    gap: 8,
  },
  focusGoalTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  focusGoalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Action Buttons Section
  actionButtonsSection: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  actionButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonTextWrap: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  // Instruction Card
  instructionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  instructionHint: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },

  // Select Goal Cards
  selectGoalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  selectGoalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  selectGoalCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectGoalInfo: {
    flex: 1,
  },
  selectGoalTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  selectGoalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Review Goal Cards
  reviewGoalCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  reviewGoalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  reviewGoalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  reviewGoalProgressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },

  // Progress Bar Styles
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    width: 45,
    textAlign: 'right',
  },
  progressBarSmall: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFillSmall: {
    height: '100%',
    borderRadius: 3,
  },
  progressTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Weeks Text
  weeksText: {
    fontSize: 13,
    marginBottom: 8,
  },

  // Reward Box
  rewardBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  rewardLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  rewardText: {
    fontSize: 13,
  },

  // Alert Card
  alertCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default SixCheckStep;