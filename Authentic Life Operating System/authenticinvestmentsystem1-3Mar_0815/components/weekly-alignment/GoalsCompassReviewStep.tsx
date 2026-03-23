// ============================================================================
// GoalsCompassReviewStep.tsx - Goals review step for Weekly Alignment (compass)
// ============================================================================
// Reviews all active goals with execution rate, weeks remaining, and a
// three-tap status indicator (on track / needs attention / pivoting).
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { ChevronRight, ChevronLeft, Target, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react-native';
import { CompassDirectionHeader } from '@/components/compass/CompassDirectionHeader';
import {
  getGoalsForReview,
  GoalReviewItem,
} from '@/lib/weeklyAlignmentCompassService';

interface GoalsCompassReviewStepProps {
  userId: string;
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onDataCapture: (data: Record<string, any>) => void;
  weekStartDate: string;
  weekEndDate: string;
}

type StatusTap = 'on_track' | 'needs_attention' | 'pivoting';

interface GoalReviewState extends GoalReviewItem {
  status_tap?: StatusTap;
  pivot_note?: string;
}

const STATUS_OPTIONS: { value: StatusTap; label: string; color: string; icon: typeof CheckCircle }[] = [
  { value: 'on_track', label: 'On Track', color: '#10B981', icon: CheckCircle },
  { value: 'needs_attention', label: 'Needs Attention', color: '#F59E0B', icon: AlertTriangle },
  { value: 'pivoting', label: 'Pivoting', color: '#EF4444', icon: RefreshCw },
];

export function GoalsCompassReviewStep({
  userId,
  colors,
  onNext,
  onBack,
  onDataCapture,
  weekStartDate,
  weekEndDate,
}: GoalsCompassReviewStepProps) {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<GoalReviewState[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      try {
        setLoading(true);
        setError(null);
        const items = await getGoalsForReview(userId);
        if (!cancelled) {
          setGoals(items.map(g => ({ ...g })));
        }
      } catch (err: any) {
        console.error('Error loading goals for review:', err);
        if (!cancelled) {
          setError('Could not load goals.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGoals();
    return () => { cancelled = true; };
  }, [userId]);

  const setStatusTap = useCallback((goalId: string, status: StatusTap) => {
    setGoals(prev =>
      prev.map(g =>
        g.id === goalId ? { ...g, status_tap: status, pivot_note: status !== 'pivoting' ? '' : g.pivot_note } : g,
      ),
    );
  }, []);

  const setPivotNote = useCallback((goalId: string, note: string) => {
    setGoals(prev =>
      prev.map(g => (g.id === goalId ? { ...g, pivot_note: note } : g)),
    );
  }, []);

  const handleContinue = useCallback(() => {
    const reviewed: GoalReviewItem[] = goals.map(g => ({
      id: g.id,
      title: g.title,
      execution_rate: g.execution_rate,
      weeks_remaining: g.weeks_remaining,
      status_tap: g.status_tap,
      pivot_note: g.pivot_note,
    }));

    onDataCapture({ goals_reviewed: reviewed });
    onNext();
  }, [goals, onDataCapture, onNext]);

  const getExecutionColor = (rate: number): string => {
    if (rate >= 75) return '#10B981';
    if (rate >= 50) return '#3B82F6';
    if (rate >= 25) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors?.primary || '#ed1c24'} />
        <Text style={[styles.loadingText, { color: colors?.textSecondary || '#666' }]}>
          Loading your goals...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CompassDirectionHeader
          direction="north"
          label="Goals"
          powerQuestion={'"Where do I want to go?"'}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors?.error || '#ef4444' }]}>{error}</Text>
          </View>
        )}

        {goals.length === 0 && !error && (
          <View style={styles.emptyContainer}>
            <Target size={40} color={colors?.textSecondary || '#9ca3af'} />
            <Text style={[styles.emptyTitle, { color: colors?.text || '#1a1a1a' }]}>
              No active goals
            </Text>
            <Text style={[styles.emptySubtext, { color: colors?.textSecondary || '#666' }]}>
              You can set up goals in the Goals section of the app.
            </Text>
          </View>
        )}

        {goals.map(goal => (
          <View
            key={goal.id}
            style={[styles.goalCard, { borderColor: colors?.border || '#e5e7eb' }]}
          >
            {/* Goal Header */}
            <View style={styles.goalHeader}>
              <View style={[styles.goalIconCircle, { backgroundColor: '#4169E118' }]}>
                <Target size={18} color="#4169E1" />
              </View>
              <View style={styles.goalTitleContainer}>
                <Text
                  style={[styles.goalTitle, { color: colors?.text || '#1a1a1a' }]}
                  numberOfLines={2}
                >
                  {goal.title}
                </Text>
              </View>
            </View>

            {/* Metrics Row */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors?.textSecondary || '#666' }]}>
                  Execution
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: getExecutionColor(goal.execution_rate) },
                  ]}
                >
                  {goal.execution_rate}%
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors?.textSecondary || '#666' }]}>
                  Weeks Left
                </Text>
                <Text style={[styles.metricValue, { color: colors?.text || '#1a1a1a' }]}>
                  {goal.weeks_remaining !== null ? goal.weeks_remaining : '--'}
                </Text>
              </View>
            </View>

            {/* Execution Bar */}
            <View style={styles.executionBarBg}>
              <View
                style={[
                  styles.executionBarFill,
                  {
                    width: `${Math.min(goal.execution_rate, 100)}%`,
                    backgroundColor: getExecutionColor(goal.execution_rate),
                  },
                ]}
              />
            </View>

            {/* Status Taps */}
            <Text style={[styles.statusPrompt, { color: colors?.textSecondary || '#666' }]}>
              How is this goal tracking?
            </Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map(opt => {
                const isSelected = goal.status_tap === opt.value;
                const IconComp = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusChip,
                      {
                        borderColor: isSelected ? opt.color : colors?.border || '#e5e7eb',
                        backgroundColor: isSelected ? opt.color + '12' : '#fff',
                      },
                    ]}
                    onPress={() => setStatusTap(goal.id, opt.value)}
                    activeOpacity={0.7}
                  >
                    <IconComp size={14} color={isSelected ? opt.color : '#9ca3af'} />
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: isSelected ? opt.color : colors?.textSecondary || '#666' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pivot Note */}
            {goal.status_tap === 'pivoting' && (
              <TextInput
                style={[
                  styles.pivotInput,
                  {
                    color: colors?.text || '#1a1a1a',
                    borderColor: '#EF444440',
                  },
                ]}
                placeholder="What changed?"
                placeholderTextColor={colors?.textSecondary || '#9ca3af'}
                value={goal.pivot_note || ''}
                onChangeText={text => setPivotNote(goal.id, text)}
                multiline
                numberOfLines={2}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.bottomBar, { borderTopColor: colors?.border || '#e5e7eb' }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeft size={20} color={colors?.textSecondary || '#666'} />
          <Text style={[styles.backButtonText, { color: colors?.textSecondary || '#666' }]}>
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors?.primary || '#4169E1' }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <ChevronRight size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  goalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  executionBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f3f4f6',
    marginBottom: 14,
    overflow: 'hidden',
  },
  executionBarFill: {
    height: 6,
    borderRadius: 3,
  },
  statusPrompt: {
    fontSize: 13,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pivotInput: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
