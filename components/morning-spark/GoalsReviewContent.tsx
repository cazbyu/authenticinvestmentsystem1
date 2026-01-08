import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useMorningSpark } from '@/contexts/MorningSparkContext';

interface GoalsReviewContentProps {
  showSkipButton?: boolean;
  onSkip?: () => void;
  onContinue?: () => void;
  inline?: boolean; // true when used in collapsed section
}

export function GoalsReviewContent({ 
  showSkipButton = true,
  onSkip,
  onContinue,
  inline = false 
}: GoalsReviewContentProps) {
  const { fuelLevel, goalsInFocus, setGoalsInFocus } = useMorningSpark();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState({
    twelveWeek: [],
    oneYear: [],
    custom: []
  });
  const [expandedSections, setExpandedSections] = useState({
    twelveWeek: !inline, // Expanded by default unless inline
    oneYear: false,
    custom: false
  });

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch all three types of active goals
      const [twelveWk, oneYear, custom] = await Promise.all([
        // 12-Week Goals
        supabase
          .from('0008-ap-goals-12wk')
          .select('*, user_timeline:0008-ap-user-global-timelines(cycle_number, start_date, end_date)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .eq('archived', false)
          .order('created_at', { ascending: false }),
        
        // 1-Year Goals
        supabase
          .from('0008-ap-goals-1y')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('archived_at', null)
          .order('priority', { ascending: true }),
        
        // Custom Goals
        supabase
          .from('0008-ap-goals-custom')
          .select('*, timeline:0008-ap-custom-timelines(title, start_date, end_date)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .eq('archived', false)
          .order('created_at', { ascending: false })
      ]);

      setGoals({
        twelveWeek: twelveWk.data || [],
        oneYear: oneYear.data || [],
        custom: custom.data || []
      });

      // Auto-select all goals as "in focus" by default
      const allGoals = [
        ...(twelveWk.data || []),
        ...(oneYear.data || []),
        ...(custom.data || [])
      ];
      setGoalsInFocus(allGoals);

    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleGoalInFocus(goal: any) {
    setGoalsInFocus(prev => {
      const isSelected = prev.some(g => g.id === goal.id);
      if (isSelected) {
        return prev.filter(g => g.id !== goal.id);
      } else {
        return [...prev, goal];
      }
    });
  }

  function isGoalInFocus(goalId: string) {
    return goalsInFocus.some(g => g.id === goalId);
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }

  const totalGoals = goals.twelveWeek.length + goals.oneYear.length + goals.custom.length;
  const hasGoals = totalGoals > 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your goals...</Text>
      </View>
    );
  }

  if (!hasGoals) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>No active goals yet</Text>
        <Text style={styles.emptyMessage}>
          {inline 
            ? "Create goals in the Goal Bank to see them here."
            : "Let's focus on today's tasks for now."
          }
        </Text>
        {!inline && showSkipButton && (
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={onSkip}
          >
            <Text style={styles.skipButtonText}>Continue →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Prompt text changes by fuel level
  const getPromptText = () => {
    if (fuelLevel === 3) {
      return "Eyes on the horizon. Which goals are you moving forward today?";
    } else if (fuelLevel === 2) {
      return "Quick check - any goals you want to keep in mind today?";
    } else {
      return "You have active goals. Want to keep them in mind today?";
    }
  };

  return (
    <View style={inline ? styles.inlineContainer : styles.screenContainer}>
      {!inline && (
        <Text style={styles.prompt}>{getPromptText()}</Text>
      )}

      {/* 12-Week Goals Section */}
      {goals.twelveWeek.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('twelveWeek')}
          >
            <Text style={styles.sectionIcon}>🎯</Text>
            <Text style={styles.sectionTitle}>12-Week Goals</Text>
            {goals.twelveWeek[0]?.user_timeline && (
              <Text style={styles.sectionSubtitle}>
                (Cycle {goals.twelveWeek[0].user_timeline.cycle_number})
              </Text>
            )}
            <Text style={styles.expandIcon}>
              {expandedSections.twelveWeek ? '▼' : '▸'}
            </Text>
          </TouchableOpacity>

          {expandedSections.twelveWeek && (
            <View style={styles.sectionContent}>
              {goals.twelveWeek.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isSelected={isGoalInFocus(goal.id)}
                  onToggle={() => toggleGoalInFocus(goal)}
                  type="12week"
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* 1-Year Goals Section */}
      {goals.oneYear.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('oneYear')}
          >
            <Text style={styles.sectionIcon}>🌟</Text>
            <Text style={styles.sectionTitle}>1-Year Targets</Text>
            <Text style={styles.expandIcon}>
              {expandedSections.oneYear ? '▼' : '▸'}
            </Text>
          </TouchableOpacity>

          {expandedSections.oneYear && (
            <View style={styles.sectionContent}>
              {goals.oneYear.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isSelected={isGoalInFocus(goal.id)}
                  onToggle={() => toggleGoalInFocus(goal)}
                  type="1year"
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Custom Goals Section */}
      {goals.custom.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('custom')}
          >
            <Text style={styles.sectionIcon}>📌</Text>
            <Text style={styles.sectionTitle}>Custom Goals</Text>
            <Text style={styles.expandIcon}>
              {expandedSections.custom ? '▼' : '▸'}
            </Text>
          </TouchableOpacity>

          {expandedSections.custom && (
            <View style={styles.sectionContent}>
              {goals.custom.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isSelected={isGoalInFocus(goal.id)}
                  onToggle={() => toggleGoalInFocus(goal)}
                  type="custom"
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {goalsInFocus.length} {goalsInFocus.length === 1 ? 'goal' : 'goals'} in focus
        </Text>
      </View>

      {/* Navigation Buttons (only for dedicated screen) */}
      {!inline && (
        <View style={styles.navigation}>
          {showSkipButton && (
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={onSkip}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={onContinue}
          >
            <Text style={styles.continueButtonText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Goal Card Component
function GoalCard({ goal, isSelected, onToggle, type }) {
  const [expanded, setExpanded] = useState(false);

  function calculateWeekNumber(startDate: string) {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = now.getTime() - start.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.min(diffWeeks + 1, 12);
  }

  return (
    <View style={styles.goalCard}>
      <TouchableOpacity 
        style={styles.goalHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.goalTitleRow}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          {type === '1year' && goal.priority && goal.priority < 100 && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>HIGH</Text>
            </View>
          )}
        </View>

        {/* Progress bar for 12-week and custom */}
        {(type === '12week' || type === 'custom') && goal.progress !== null && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${goal.progress}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{goal.progress}%</Text>
          </View>
        )}

        {/* Week indicator for 12-week goals */}
        {type === '12week' && goal.user_timeline?.start_date && (
          <Text style={styles.weekIndicator}>
            Week {calculateWeekNumber(goal.user_timeline.start_date)} of 12
          </Text>
        )}

        {/* Target date for 1-year goals */}
        {type === '1year' && goal.year_target_date && (
          <Text style={styles.targetDate}>
            Target: {new Date(goal.year_target_date).toLocaleDateString()}
          </Text>
        )}

        {/* Timeline for custom goals */}
        {type === 'custom' && goal.timeline && (
          <Text style={styles.timelineName}>
            {goal.timeline.title}
          </Text>
        )}
      </TouchableOpacity>

      {/* Description (expandable) */}
      {expanded && goal.description && (
        <Text style={styles.goalDescription}>{goal.description}</Text>
      )}

      {/* Keep in Mind Toggle */}
      <TouchableOpacity 
        style={styles.toggleRow}
        onPress={onToggle}
      >
        <View style={[
          styles.checkbox,
          isSelected && styles.checkboxSelected
        ]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.toggleLabel}>Keep in Mind</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  // Component container styles
  screenContainer: {
    flex: 1,
    padding: 20,
  },
  inlineContainer: {
    padding: 16,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  
  // Empty state
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Prompt
  prompt: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    lineHeight: 22,
  },
  
  // Section accordion
  section: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  expandIcon: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  sectionContent: {
    padding: 12,
  },
  
  // Goal card
  goalCard: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  goalHeader: {
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  priorityBadge: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  
  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 35,
    textAlign: 'right',
  },
  
  // Meta info
  weekIndicator: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  targetDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timelineName: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333',
  },
  
  // Summary
  summary: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  
  // Navigation
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  continueButton: {
    flex: 2,
    padding: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
};