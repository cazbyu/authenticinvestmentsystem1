import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ArrowLeft, Target, Plus } from 'lucide-react-native';
import { UnifiedGoal } from './MyGoalsView';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { TaskCard, Task } from '@/components/tasks/TaskCard';
import { handleActionCompletion, handleActionUncompletion } from '@/lib/completionHandler';
import { formatLocalDate, toLocalISOString } from '@/lib/dateUtils';

interface GoalDetailViewProps {
  goal: UnifiedGoal;
  onClose: () => void;
  onGoalUpdated: () => void;
  onAddAction?: () => void;
  authenticScore: number;
}

type TabType = 'act' | 'ideas' | 'journal' | 'analytics';

interface RecurringAction extends Task {
  weekly_completion_count?: number;
  weekly_target?: number;
}

export function GoalDetailView({
  goal,
  onClose,
  onGoalUpdated,
  onAddAction,
  authenticScore,
}: GoalDetailViewProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('act');
  const [loading, setLoading] = useState(true);
  const [recurringActions, setRecurringActions] = useState<RecurringAction[]>([]);
  const [oneTimeActions, setOneTimeActions] = useState<Task[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (activeTab === 'act') {
      fetchActions();
    }
  }, [goal.id, activeTab, refreshTrigger]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const goalJoinColumn = goal.goal_type === '1y'
        ? 'one_yr_goal_id'
        : goal.goal_type === '12week'
        ? 'twelve_wk_goal_id'
        : 'custom_goal_id';

      const { data: goalJoins, error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .select('task_id')
        .eq(goalJoinColumn, goal.id)
        .not('task_id', 'is', null);

      if (joinError) throw joinError;

      const taskIds = goalJoins?.map(j => j.task_id).filter(Boolean) || [];

      if (taskIds.length === 0) {
        setRecurringActions([]);
        setOneTimeActions([]);
        setLoading(false);
        return;
      }

      const { data: tasks, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('*')
        .in('id', taskIds)
        .eq('user_id', user.id)
        .neq('is_deleted', true)
        .order('title');

      if (tasksError) throw tasksError;

      const recurring: RecurringAction[] = [];
      const oneTime: Task[] = [];

      for (const task of tasks || []) {
        if (task.recurrence_rule) {
          const { data: weekCompletion } = await supabase.rpc(
            'get_weekly_completion_count_with_target',
            {
              p_task_id: task.id,
              p_week_start: getWeekStart(),
            }
          );

          recurring.push({
            ...task,
            weekly_completion_count: weekCompletion?.[0]?.completion_count || 0,
            weekly_target: weekCompletion?.[0]?.weekly_target || 0,
          });
        } else if (task.status === 'completed') {
          oneTime.push(task);
        }
      }

      setRecurringActions(recurring);
      setOneTimeActions(oneTime);
    } catch (error) {
      console.error('Error fetching goal actions:', error);
      Alert.alert('Error', 'Failed to load actions for this goal');
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return toLocalISOString(monday);
  };

  const handleToggleCompletion = async (
    taskId: string,
    dateString: string,
    currentlyCompleted: boolean
  ) => {
    try {
      if (currentlyCompleted) {
        await handleActionUncompletion(taskId, dateString);
      } else {
        await handleActionCompletion(taskId, dateString);
      }
      setRefreshTrigger(prev => prev + 1);
      onGoalUpdated();
    } catch (error) {
      console.error('Error toggling completion:', error);
      Alert.alert('Error', 'Failed to update completion status');
    }
  };

  const getTimelineBadge = () => {
    if (goal.goal_type === '1y') {
      return goal.year_target_date
        ? `${new Date(goal.year_target_date).getFullYear()} Annual Goal`
        : 'Annual Goal';
    }

    if (goal.goal_type === '12week' && goal.timeline_name) {
      const weekInfo = goal.current_week ? ` • Week ${goal.current_week} of 12` : '';
      return `${goal.timeline_name}${weekInfo}`;
    }

    if (goal.goal_type === 'custom' && goal.timeline_name) {
      const weekInfo =
        goal.current_week && goal.total_weeks
          ? ` • Week ${goal.current_week} of ${goal.total_weeks}`
          : '';
      return `${goal.timeline_name}${weekInfo}`;
    }

    return 'Goal Timeline';
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <ArrowLeft size={24} color="#ffffff" />
          <Text style={styles.backText}>Goal Bank</Text>
        </TouchableOpacity>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Authentic Score</Text>
          <Text style={styles.scoreValue}>{authenticScore}</Text>
        </View>
      </View>

      <View style={styles.headerTitle}>
        <Target size={28} color="#ffffff" style={styles.titleIcon} />
        <Text style={styles.title} numberOfLines={2}>
          {goal.title}
        </Text>
      </View>

      <View style={styles.headerBottom}>
        <View style={styles.toggleGroup}>
          {(['act', 'ideas', 'journal', 'analytics'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.toggleButton, activeTab === tab && styles.activeToggle]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.toggleText,
                  activeTab === tab && styles.activeToggleText,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderGoalBanner = () => (
    <View style={[styles.goalBanner, { backgroundColor: colors.surface }]}>
      <View style={styles.bannerTop}>
        <View style={[styles.timelineBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.timelineBadgeText, { color: colors.primary }]}>
            {getTimelineBadge()}
          </Text>
        </View>
        {goal.progress !== undefined && (
          <Text style={[styles.progressPercentage, { color: colors.text }]}>
            {Math.round(goal.progress)}%
          </Text>
        )}
      </View>

      {goal.progress !== undefined && (
        <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: colors.primary, width: `${goal.progress}%` },
            ]}
          />
        </View>
      )}

      {goal.parent_goal_title && (
        <TouchableOpacity style={styles.parentGoalLink} activeOpacity={0.7}>
          <Text style={[styles.parentGoalLinkText, { color: colors.textSecondary }]}>
            → supports <Text style={{ fontWeight: '600' }}>{goal.parent_goal_title}</Text>
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderActTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading actions...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {recurringActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              RECURRING ACTIONS
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Leading Indicators
            </Text>
            {recurringActions.map(action => (
              <View key={action.id} style={styles.actionCard}>
                <TaskCard
                  task={action}
                  onToggleDay={handleToggleCompletion}
                  onPress={() => {}}
                  showWeekBubbles={true}
                />
                {action.weekly_completion_count !== undefined && (
                  <Text style={[styles.weeklyProgress, { color: colors.textSecondary }]}>
                    {action.weekly_completion_count}/{action.weekly_target || 0} this week
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {oneTimeActions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              ONE-TIME ACTIONS
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Boosts
            </Text>
            {oneTimeActions.map(action => (
              <View
                key={action.id}
                style={[styles.oneTimeCard, { backgroundColor: colors.surface }]}
              >
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
                <View style={styles.oneTimeContent}>
                  <Text style={[styles.oneTimeTitle, { color: colors.text }]}>
                    {action.title}
                  </Text>
                  {action.completed_at && (
                    <Text style={[styles.oneTimeDate, { color: colors.textSecondary }]}>
                      Completed: {formatLocalDate(action.completed_at)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {recurringActions.length === 0 && oneTimeActions.length === 0 && (
          <View style={styles.emptyState}>
            <Target size={64} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Actions Yet</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Add actions to track progress toward this goal
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={onAddAction}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Action</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderIdeasTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.placeholderContainer}>
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>
          Ideas for {goal.title}
        </Text>
        <Text style={[styles.placeholderMessage, { color: colors.textSecondary }]}>
          This section will show deposit ideas linked to this goal.
        </Text>
        <TouchableOpacity
          style={[styles.placeholderButton, { backgroundColor: colors.primary }]}
          onPress={() => Alert.alert('Coming Soon', 'Ideas feature will be implemented next')}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.placeholderButtonText}>Add Idea</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderJournalTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.placeholderContainer}>
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>
          Journal for {goal.title}
        </Text>
        <Text style={[styles.placeholderMessage, { color: colors.textSecondary }]}>
          This section will show journal entries and reflections linked to this goal.
        </Text>
        <TouchableOpacity
          style={[styles.placeholderButton, { backgroundColor: colors.primary }]}
          onPress={() => Alert.alert('Coming Soon', 'Journal feature will be implemented next')}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.placeholderButtonText}>Add Entry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.placeholderContainer}>
        <Text style={[styles.placeholderTitle, { color: colors.text }]}>
          Analytics - {goal.title}
        </Text>
        <Text style={[styles.placeholderMessage, { color: colors.textSecondary }]}>
          This section will show analytics including:
          {'\n'}• Goal Score
          {'\n'}• Weekly completion chart
          {'\n'}• Consistency metrics
          {'\n'}• Progress over time
        </Text>
        <View style={styles.timeRangeSelector}>
          <TouchableOpacity style={[styles.timeRangeButton, { borderColor: colors.border }]}>
            <Text style={[styles.timeRangeText, { color: colors.text }]}>4W</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.timeRangeButton, { borderColor: colors.border }]}>
            <Text style={[styles.timeRangeText, { color: colors.text }]}>12W</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.timeRangeButton, { borderColor: colors.border }]}>
            <Text style={[styles.timeRangeText, { color: colors.text }]}>All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'act':
        return renderActTab();
      case 'ideas':
        return renderIdeasTab();
      case 'journal':
        return renderJournalTab();
      case 'analytics':
        return renderAnalyticsTab();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderGoalBanner()}
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  titleIcon: {
    marginTop: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  headerBottom: {
    marginTop: 8,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0078d4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  goalBanner: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timelineBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  parentGoalLink: {
    paddingVertical: 4,
  },
  parentGoalLinkText: {
    fontSize: 14,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  actionCard: {
    marginBottom: 16,
  },
  weeklyProgress: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 16,
  },
  oneTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  oneTimeContent: {
    flex: 1,
  },
  oneTimeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  oneTimeDate: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  placeholderMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  placeholderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  placeholderButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
