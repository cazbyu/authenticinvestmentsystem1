import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Flag, ChevronRight, Target, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';

interface SixCheckStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
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

export function SixCheckStep({
  userId,
  colors,
  onNext,
  onBack,
  onDataCapture,
}: SixCheckStepProps) {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

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
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectFocus(goalId: string) {
    setSelectedFocus(prev => prev === goalId ? null : goalId);
  }

  function handleNext() {
    const laggingGoals = goals.filter(g => g.is_lagging).map(g => g.id);
    const onTrackGoals = goals.filter(g => !g.is_lagging).map(g => g.id);

    onDataCapture({
      goalsReviewed: goals.map(g => g.id),
      laggingGoals,
      onTrackGoals,
      keyFocusGoal: selectedFocus || undefined,
    });
    
    onNext();
  }

  function getProgressColor(progress: number, isLagging?: boolean): string {
    if (isLagging) return '#EF4444';
    if (progress >= 75) return '#10B981';
    if (progress >= 50) return '#3B82F6';
    if (progress >= 25) return '#F59E0B';
    return '#6B7280';
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
    if (goal.progress >= 75) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#10B98120' }]}>
          <TrendingUp size={12} color="#10B981" />
          <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>On Track</Text>
        </View>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your goals...
        </Text>
      </View>
    );
  }

  const laggingCount = goals.filter(g => g.is_lagging).length;
  const onTrackCount = goals.filter(g => !g.is_lagging).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={[styles.iconCircle, { backgroundColor: '#4169E120' }]}>
          <Flag size={40} color="#4169E1" />
        </View>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Six Check: Goals
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Review your 12-week goal progress
        </Text>
      </View>

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

      {/* Instruction */}
      {goals.length > 0 && (
        <View style={[styles.instructionCard, { backgroundColor: '#4169E110', borderColor: '#4169E140' }]}>
          <Text style={[styles.instructionText, { color: colors.text }]}>
            🎯 Review each goal and optionally select one as your KEY FOCUS for this week.
          </Text>
        </View>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Target size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No Active 12-Week Goals
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            You don't have any active 12-week goals. Consider setting some in the Goals section to give your weeks direction.
          </Text>
        </View>
      ) : (
        <View style={styles.goalsContainer}>
          {goals.map(goal => {
            const isExpanded = expandedGoal === goal.id;
            const isFocused = selectedFocus === goal.id;

            return (
              <View key={goal.id} style={styles.goalWrapper}>
                <TouchableOpacity
                  style={[
                    styles.goalCard,
                    { 
                      backgroundColor: colors.surface, 
                      borderColor: isFocused ? '#4169E1' : goal.is_lagging ? '#EF4444' : colors.border,
                      borderWidth: isFocused ? 2 : 1,
                    },
                  ]}
                  onPress={() => setExpandedGoal(isExpanded ? null : goal.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.goalHeader}>
                    <View style={styles.goalTitleRow}>
                      <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={2}>
                        {goal.title}
                      </Text>
                      {getStatusBadge(goal)}
                    </View>
                    
                    {isFocused && (
                      <View style={[styles.focusBadge, { backgroundColor: '#4169E1' }]}>
                        <Text style={styles.focusBadgeText}>KEY FOCUS</Text>
                      </View>
                    )}
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            backgroundColor: getProgressColor(goal.progress, goal.is_lagging),
                            width: `${Math.min(100, goal.progress || 0)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { color: getProgressColor(goal.progress, goal.is_lagging) }]}>
                      {goal.progress || 0}%
                    </Text>
                  </View>

                  {/* Weeks Remaining */}
                  {goal.weeks_remaining !== undefined && (
                    <Text style={[styles.weeksText, { color: colors.textSecondary }]}>
                      {goal.weeks_remaining} week{goal.weeks_remaining !== 1 ? 's' : ''} remaining
                      {goal.is_lagging && goal.required_weekly_progress && (
                        <Text style={{ color: '#EF4444' }}>
                          {' '}• Need {goal.required_weekly_progress}%/week
                        </Text>
                      )}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Expanded Actions */}
                {isExpanded && (
                  <View style={styles.expandedActions}>
                    {goal.description && (
                      <Text style={[styles.goalDescription, { color: colors.textSecondary }]}>
                        {goal.description}
                      </Text>
                    )}

                    {goal.completion_reward && (
                      <View style={[styles.rewardBox, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B40' }]}>
                        <Text style={[styles.rewardLabel, { color: '#F59E0B' }]}>🏆 Reward</Text>
                        <Text style={[styles.rewardText, { color: colors.text }]}>
                          {goal.completion_reward}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.focusButton,
                        { 
                          backgroundColor: isFocused ? '#4169E1' : colors.background,
                          borderColor: '#4169E1',
                        },
                      ]}
                      onPress={() => handleSelectFocus(goal.id)}
                    >
                      <Target size={18} color={isFocused ? '#FFFFFF' : '#4169E1'} />
                      <Text style={[styles.focusButtonText, { color: isFocused ? '#FFFFFF' : '#4169E1' }]}>
                        {isFocused ? 'Selected as Key Focus' : 'Set as Key Focus'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Lagging Goals Alert */}
      {laggingCount > 0 && (
        <View style={[styles.alertCard, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
          <AlertTriangle size={20} color="#EF4444" />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: '#EF4444' }]}>
              {laggingCount} Goal{laggingCount > 1 ? 's' : ''} Behind Schedule
            </Text>
            <Text style={[styles.alertText, { color: colors.textSecondary }]}>
              Consider dedicating focused time this week to catch up, or re-evaluate if these goals still serve you.
            </Text>
          </View>
        </View>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: '#4169E1' }]}
        onPress={handleNext}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
        <ChevronRight size={20} color="#FFFFFF" />
      </TouchableOpacity>

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
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 12,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
  },
  instructionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  goalsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  goalWrapper: {
    marginBottom: 4,
  },
  goalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  goalHeader: {
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
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
  focusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  focusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
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
  weeksText: {
    fontSize: 13,
  },
  expandedActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  goalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  rewardBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  rewardLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardText: {
    fontSize: 14,
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 8,
  },
  focusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SixCheckStep;