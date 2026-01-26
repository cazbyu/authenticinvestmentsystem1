import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { ArrowLeft, Target, Plus, Lightbulb, BookOpen, TrendingUp, Paperclip, X } from 'lucide-react-native';
import { UnifiedGoal } from './MyGoalsView';
import ActionEffortModal from './ActionEffortModal';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { GoalProgressCard } from '@/components/goals/GoalProgressCard';
import { handleActionCompletion, handleActionUncompletion } from '@/lib/completionHandler';
import { formatLocalDate, toLocalISOString, parseLocalDate } from '@/lib/dateUtils';
import { fetchGoalActions, RecurringActionResult, OneTimeActionResult } from '@/hooks/fetchGoalActions';
import { useGoals, Timeline } from '@/hooks/useGoals';

interface GoalDetailViewProps {
  goal: UnifiedGoal;
  onClose: () => void;
  onGoalUpdated: () => void;
  onAddAction?: () => void;
  authenticScore: number;
}

type TabType = 'act' | 'ideas' | 'journal' | 'analytics';
type TimeRange = '4W' | '12W' | 'All';

interface DepositIdea {
  id: string;
  idea_text: string;
  created_at: string;
  status: string;
  [key: string]: any;
}

interface JournalNote {
  id: string;
  note_text: string;
  created_at: string;
  attachment_count?: number;
  [key: string]: any;
}

interface AnalyticsData {
  goalScore: number;
  weeklyAverage: number;
  consistency: number;
  totalActions: number;
  weeklyData: Array<{
    weekNumber: number;
    completionPercent: number;
  }>;
}

interface CycleWeek {
  week_number: number;
  start_date: string;
  end_date: string;
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
  const [recurringActions, setRecurringActions] = useState<RecurringActionResult[]>([]);
  const [oneTimeActions, setOneTimeActions] = useState<OneTimeActionResult[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Timeline and weeks state for ActionEffortModal
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [cycleWeeks, setCycleWeeks] = useState<CycleWeek[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // ActionEffortModal state
  const [showActionEffortModal, setShowActionEffortModal] = useState(false);

  // Get createTaskWithWeekPlan from useGoals hook
  const { createTaskWithWeekPlan } = useGoals();

  // Ideas tab state
  const [ideas, setIdeas] = useState<DepositIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [newIdeaText, setNewIdeaText] = useState('');

  // Journal tab state
  const [journalNotes, setJournalNotes] = useState<JournalNote[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [newJournalText, setNewJournalText] = useState('');

  // Analytics tab state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('12W');

  // Calculate current week bounds (Sunday to Saturday)
  const currentWeekData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    const sundayOffset = -dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + sundayOffset);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekNumber = goal.current_week || 1;

    return {
      weekNumber,
      startDate: formatLocalDate(weekStart),
      endDate: formatLocalDate(weekEnd),
    };
  }, [goal.current_week]);

  // Transform recurring actions to the format GoalProgressCard expects
  const transformedWeekActions = useMemo(() => {
    return recurringActions.map(action => ({
      id: action.id,
      title: action.title,
      input_kind: 'count' as const,
      weeklyActual: action.weeklyActual,
      weeklyTarget: action.weeklyTarget,
      logs: (action.completedDates || []).map(dateStr => ({
        id: `log-${action.id}-${dateStr}`,
        task_id: action.id,
        measured_on: dateStr,
        week_number: currentWeekData.weekNumber,
        day_of_week: parseLocalDate(dateStr).getDay(),
        value: 1,
        completed: true,
        created_at: dateStr,
      })),
    }));
  }, [recurringActions, currentWeekData.weekNumber]);

  // Create a progress object for GoalProgressCard
  const goalProgress = useMemo(() => {
    const totalActual = recurringActions.reduce((sum, a) => sum + Math.min(a.weeklyActual, a.weeklyTarget), 0);
    const totalTarget = recurringActions.reduce((sum, a) => sum + a.weeklyTarget, 0);
    const weeklyPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    return {
      currentWeek: currentWeekData.weekNumber,
      daysRemaining: 0,
      weeklyActual: totalActual,
      weeklyTarget: totalTarget,
      overallActual: totalActual,
      overallTarget: totalTarget,
      overallProgress: goal.progress || weeklyPercent,
    };
  }, [recurringActions, currentWeekData.weekNumber, goal.progress]);

  // Fetch timeline and weeks for the goal
  const fetchTimelineAndWeeks = useCallback(async () => {
  setLoadingTimeline(true);
  setTimelineError(null);

  console.log('[GoalDetailView] fetchTimelineAndWeeks starting for goal:', {
    goal_type: goal.goal_type,
    user_global_timeline_id: goal.user_global_timeline_id,
    custom_timeline_id: goal.custom_timeline_id,
  });

  try {
    const supabase = getSupabaseClient();

    // Determine timeline ID and source based on goal type
    let timelineId: string | null = null;
    let timelineSource: 'global' | 'custom' | null = null;

    if (goal.goal_type === '12week' && goal.user_global_timeline_id) {
      timelineId = goal.user_global_timeline_id;
      timelineSource = 'global';
    } else if (goal.goal_type === 'custom' && goal.custom_timeline_id) {
      timelineId = goal.custom_timeline_id;
      timelineSource = 'custom';
    }

    console.log('[GoalDetailView] Determined timeline:', { timelineId, timelineSource });

    if (!timelineId || !timelineSource) {
      
        // 1-year goals don't have direct timelines, or goal is missing timeline
        if (goal.goal_type === '1y') {
          setTimelineError('Annual goals use 12-week or custom goals for actions.');
        } else {
          setTimelineError('This goal is not assigned to an active timeline.');
        }
        setTimeline(null);
        setCycleWeeks([]);
        return;
      }

      // Fetch timeline details
      let timelineData: any = null;

      if (timelineSource === 'global') {
        const { data, error } = await supabase
          .from('0008-ap-user-global-timelines')
          .select(`
            id,
            title,
            start_date,
            end_date,
            status,
            global_cycle:0008-ap-global-cycles(
              id,
              title,
              cycle_label,
              start_date,
              end_date
            )
          `)
          .eq('id', timelineId)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          setTimelineError('This timeline is no longer active.');
          setTimeline(null);
          setCycleWeeks([]);
          return;
        }

        timelineData = {
          id: data.id,
          source: 'global' as const,
          title: data.global_cycle?.title || data.global_cycle?.cycle_label || data.title || 'Global Timeline',
          start_date: data.global_cycle?.start_date || data.start_date,
          end_date: data.global_cycle?.end_date || data.end_date,
          global_cycle_id: data.global_cycle?.id,
        };
      } else {
        const { data, error } = await supabase
          .from('0008-ap-custom-timelines')
          .select('*')
          .eq('id', timelineId)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          setTimelineError('This timeline is no longer active.');
          setTimeline(null);
          setCycleWeeks([]);
          return;
        }

        timelineData = {
          id: data.id,
          source: 'custom' as const,
          title: data.title,
          start_date: data.start_date,
          end_date: data.end_date,
        };
      }

      setTimeline(timelineData);

      // Fetch weeks from unified view
      const { data: weeksData, error: weeksError } = await supabase
        .from('v_unified_timeline_weeks')
        .select('week_number, week_start, week_end')
        .eq('timeline_id', timelineId)
        .eq('source', timelineSource)
        .order('week_number', { ascending: true });

      if (weeksError) {
        console.error('[GoalDetailView] Error fetching weeks:', weeksError);
        setTimelineError('Failed to load timeline weeks.');
        setCycleWeeks([]);
        return;
      }

      // Normalize week data to match CycleWeek interface
      const normalizedWeeks: CycleWeek[] = (weeksData || []).map(week => ({
        week_number: week.week_number,
        start_date: week.week_start,
        end_date: week.week_end,
      }));

      setCycleWeeks(normalizedWeeks);

      if (normalizedWeeks.length === 0) {
        setTimelineError('No weeks found for this timeline.');
      }

    } catch (error) {
      console.error('[GoalDetailView] Error fetching timeline:', error);
      setTimelineError('Failed to load timeline data.');
      setTimeline(null);
      setCycleWeeks([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, [goal.goal_type, goal.user_global_timeline_id, goal.custom_timeline_id]);

  // Fetch timeline on mount
  useEffect(() => {
    fetchTimelineAndWeeks();
  }, [fetchTimelineAndWeeks]);

  useEffect(() => {
    if (activeTab === 'act') {
      fetchActions();
    } else if (activeTab === 'ideas') {
      fetchIdeas();
    } else if (activeTab === 'journal') {
      fetchJournalNotes();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [goal.id, activeTab, refreshTrigger, timeRange]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const result = await fetchGoalActions(goal.id, goal.goal_type);
      setRecurringActions(result.recurringActions);
      setOneTimeActions(result.oneTimeActions);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching goal actions:', error);
      Alert.alert('Error', 'Failed to load actions for this goal');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCompletion = async (
    actionId: string,
    dateString: string,
    currentlyCompleted: boolean
  ) => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      if (currentlyCompleted) {
        await handleActionUncompletion(supabase, actionId, dateString);
      } else {
        const action = recurringActions.find(a => a.id === actionId);
        
        await handleActionCompletion(
          supabase,
          user.id,
          actionId,
          dateString,
          timeline,
          action?.weeklyTarget
        );
      }
      
      setRefreshTrigger(prev => prev + 1);
      onGoalUpdated();
    } catch (error) {
      console.error('[GoalDetailView] Error toggling completion:', error);
      Alert.alert('Error', 'Failed to update completion status');
    }
  };

  const handleAddActionPress = () => {
    if (timelineError) {
      Alert.alert('Cannot Add Action', timelineError);
      return;
    }

    if (!timeline) {
      Alert.alert('Cannot Add Action', 'Timeline information is not available.');
      return;
    }

    if (cycleWeeks.length === 0) {
      Alert.alert('Cannot Add Action', 'No weeks available for this timeline.');
      return;
    }

    setShowActionEffortModal(true);
  };

  const handleActionEffortModalClose = async () => {
    setShowActionEffortModal(false);
    // Refresh actions after modal closes
    setRefreshTrigger(prev => prev + 1);
    onGoalUpdated();
  };

  // Prepare goal object for ActionEffortModal with proper typing
  const goalForModal = useMemo(() => {
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      goal_type: goal.goal_type as '12week' | 'custom',
      roles: goal.roles || [],
      domains: goal.domains || [],
      keyRelationships: goal.keyRelationships || [],
    };
  }, [goal]);

  const fetchIdeas = async () => {
    setIdeasLoading(true);
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
        .select('parent_id')
        .eq(goalJoinColumn, goal.id)
        .eq('parent_type', 'deposit_idea');

      if (joinError) throw joinError;

      const ideaIds = goalJoins?.map(j => j.parent_id).filter(Boolean) || [];

      if (ideaIds.length === 0) {
        setIdeas([]);
        return;
      }

      const { data: ideasData, error: ideasError } = await supabase
        .from('0008-ap-deposit-ideas')
        .select('*')
        .in('id', ideaIds)
        .neq('status', 'activated')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (ideasError) throw ideasError;

      setIdeas(ideasData || []);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching ideas:', error);
      Alert.alert('Error', 'Failed to load ideas for this goal');
    } finally {
      setIdeasLoading(false);
    }
  };

  const fetchJournalNotes = async () => {
    setJournalLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const parentType = goal.goal_type === '1y' ? 'goal_1y' :
                        goal.goal_type === '12week' ? 'goal_12wk' : 'goal_custom';

      const { data: noteJoins, error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .select('note_id')
        .eq('parent_id', goal.id)
        .eq('parent_type', parentType);

      if (joinError) throw joinError;

      const noteIds = noteJoins?.map(j => j.note_id).filter(Boolean) || [];

      if (noteIds.length === 0) {
        setJournalNotes([]);
        return;
      }

      const { data: notesData, error: notesError } = await supabase
        .from('0008-ap-notes')
        .select('*, note_attachments:0008-ap-note-attachments(count)')
        .in('id', noteIds)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      const notesWithAttachments = (notesData || []).map(note => ({
        ...note,
        attachment_count: note.note_attachments?.[0]?.count || 0,
      }));

      setJournalNotes(notesWithAttachments);
    } catch (error) {
      console.error('[GoalDetailView] Error fetching journal notes:', error);
      Alert.alert('Error', 'Failed to load journal entries for this goal');
    } finally {
      setJournalLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      let startDate: Date;

      if (timeRange === '4W') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - (4 * 7));
      } else if (timeRange === '12W') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - (12 * 7));
      } else {
        startDate = new Date(goal.created_at || today);
      }

      const result = await fetchGoalActions(goal.id, goal.goal_type);
      const goalScore = result.oneTimeActions.reduce((sum, action) => sum + action.pointsEarned, 0);

      const weeklyData: Array<{ weekNumber: number; completionPercent: number }> = [];
      const weekCount = timeRange === '4W' ? 4 : timeRange === '12W' ? 12 : 24;

      for (let i = 0; i < weekCount; i++) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const weekActions = result.recurringActions.filter(action => {
          return action.weeklyTarget > 0;
        });

        const avgCompletion = weekActions.length > 0
          ? weekActions.reduce((sum, a) => sum + (a.weeklyActual / a.weeklyTarget * 100), 0) / weekActions.length
          : 0;

        weeklyData.unshift({
          weekNumber: i + 1,
          completionPercent: Math.min(100, Math.round(avgCompletion)),
        });
      }

      const weeklyAverage = weeklyData.length > 0
        ? Math.round(weeklyData.reduce((sum, w) => sum + w.completionPercent, 0) / weeklyData.length)
        : 0;

      const weeksAt100 = weeklyData.filter(w => w.completionPercent >= 100).length;
      const consistency = weeklyData.length > 0
        ? Math.round((weeksAt100 / weeklyData.length) * 100)
        : 0;

      const totalActions = result.recurringActions.reduce((sum, a) => sum + a.weeklyActual, 0) +
                          result.oneTimeActions.length;

      setAnalyticsData({
        goalScore,
        weeklyAverage,
        consistency,
        totalActions,
        weeklyData: weeklyData.slice(0, 12),
      });
    } catch (error) {
      console.error('[GoalDetailView] Error fetching analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAddIdea = async () => {
    if (!newIdeaText.trim()) {
      Alert.alert('Error', 'Please enter an idea');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ideaData, error: ideaError } = await supabase
        .from('0008-ap-deposit-ideas')
        .insert({
          user_id: user.id,
          idea_text: newIdeaText.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (ideaError) throw ideaError;

      const goalJoinColumn = goal.goal_type === '1y'
        ? 'one_yr_goal_id'
        : goal.goal_type === '12week'
        ? 'twelve_wk_goal_id'
        : 'custom_goal_id';

      const { error: joinError } = await supabase
        .from('0008-ap-universal-goals-join')
        .insert({
          [goalJoinColumn]: goal.id,
          parent_id: ideaData.id,
          parent_type: 'deposit_idea',
        });

      if (joinError) throw joinError;

      setNewIdeaText('');
      setShowAddIdeaModal(false);
      fetchIdeas();
      Alert.alert('Success', 'Idea added to this goal');
    } catch (error) {
      console.error('[GoalDetailView] Error adding idea:', error);
      Alert.alert('Error', 'Failed to add idea');
    }
  };

  const handleAddJournalEntry = async () => {
    if (!newJournalText.trim()) {
      Alert.alert('Error', 'Please enter journal content');
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: noteData, error: noteError } = await supabase
        .from('0008-ap-notes')
        .insert({
          user_id: user.id,
          note_text: newJournalText.trim(),
          note_date: toLocalISOString(new Date()),
        })
        .select()
        .single();

      if (noteError) throw noteError;

      const parentType = goal.goal_type === '1y' ? 'goal_1y' :
                        goal.goal_type === '12week' ? 'goal_12wk' : 'goal_custom';

      const { error: joinError } = await supabase
        .from('0008-ap-universal-notes-join')
        .insert({
          note_id: noteData.id,
          parent_id: goal.id,
          parent_type: parentType,
        });

      if (joinError) throw joinError;

      setNewJournalText('');
      setShowAddJournalModal(false);
      fetchJournalNotes();
      Alert.alert('Success', 'Journal entry added');
    } catch (error) {
      console.error('[GoalDetailView] Error adding journal entry:', error);
      Alert.alert('Error', 'Failed to add journal entry');
    }
  };

  const handleActivateIdea = async (ideaId: string) => {
    Alert.alert(
      'Activate Idea',
      'Convert this idea into an action?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();

              const { error: updateError } = await supabase
                .from('0008-ap-deposit-ideas')
                .update({ status: 'activated' })
                .eq('id', ideaId);

              if (updateError) throw updateError;

              fetchIdeas();
              Alert.alert('Success', 'Idea activated! You can now find it in your actions.');
            } catch (error) {
              console.error('[GoalDetailView] Error activating idea:', error);
              Alert.alert('Error', 'Failed to activate idea');
            }
          },
        },
      ]
    );
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
              Leading Indicators • Tap circles to mark completion
            </Text>
            
            <GoalProgressCard
              goal={{
                ...goal,
                id: goal.id,
                title: goal.title,
                goal_type: goal.goal_type,
                start_date: goal.start_date || currentWeekData.startDate,
                end_date: goal.end_date || currentWeekData.endDate,
                roles: goal.roles || [],
                domains: goal.domains || [],
              }}
              progress={goalProgress}
              expanded={true}
              week={currentWeekData}
              weekActions={transformedWeekActions}
              loadingWeekActions={false}
              onAddAction={handleAddActionPress}
              onToggleCompletion={handleToggleCompletion}
              selectedWeekNumber={currentWeekData.weekNumber}
            />
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
                  <View style={styles.oneTimeMetadata}>
                    {action.completedAt && (
                      <Text style={[styles.oneTimeDate, { color: colors.textSecondary }]}>
                        {formatLocalDate(action.completedAt)}
                      </Text>
                    )}
                    <View style={[styles.pointsBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.pointsText, { color: colors.primary }]}>
                        +{action.pointsEarned} pts
                      </Text>
                    </View>
                  </View>
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
          style={[
            styles.addButton, 
            { backgroundColor: colors.primary },
            (loadingTimeline || !!timelineError) && styles.addButtonDisabled
          ]}
          onPress={handleAddActionPress}
          disabled={loadingTimeline}
        >
          {loadingTimeline ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Plus size={20} color="#ffffff" />
              <Text style={styles.addButtonText}>Add Action</Text>
            </>
          )}
        </TouchableOpacity>

        {timelineError && goal.goal_type !== '1y' && (
          <Text style={styles.timelineErrorText}>{timelineError}</Text>
        )}
      </View>
    );
  };

  const renderIdeasTab = () => {
    if (ideasLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading ideas...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {ideas.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>DEPOSIT IDEAS</Text>
            {ideas.map(idea => (
              <View key={idea.id} style={[styles.ideaCard, { backgroundColor: colors.surface }]}>
                <View style={styles.ideaHeader}>
                  <Lightbulb size={20} color={colors.primary} />
                  <Text style={[styles.ideaDate, { color: colors.textSecondary }]}>
                    {formatLocalDate(idea.created_at)}
                  </Text>
                </View>
                <Text style={[styles.ideaText, { color: colors.text }]}>
                  {idea.idea_text}
                </Text>
                <TouchableOpacity
                  style={[styles.activateButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleActivateIdea(idea.id)}
                >
                  <Text style={styles.activateButtonText}>Activate</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {ideas.length === 0 && (
          <View style={styles.emptyState}>
            <Lightbulb size={64} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Ideas Yet</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Capture ideas that could help you achieve this goal
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddIdeaModal(true)}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Idea</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderJournalTab = () => {
    if (journalLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading journal entries...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {journalNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>JOURNAL ENTRIES</Text>
            {journalNotes.map(note => (
              <View key={note.id} style={[styles.journalCard, { backgroundColor: colors.surface }]}>
                <View style={styles.journalHeader}>
                  <BookOpen size={20} color={colors.primary} />
                  <Text style={[styles.journalDate, { color: colors.textSecondary }]}>
                    {formatLocalDate(note.created_at)}
                  </Text>
                  {note.attachment_count > 0 && (
                    <View style={styles.attachmentBadge}>
                      <Paperclip size={14} color={colors.textSecondary} />
                      <Text style={[styles.attachmentCount, { color: colors.textSecondary }]}>
                        {note.attachment_count}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.journalText, { color: colors.text }]}
                  numberOfLines={4}
                >
                  {note.note_text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {journalNotes.length === 0 && (
          <View style={styles.emptyState}>
            <BookOpen size={64} color={colors.textSecondary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Journal Entries</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Document your thoughts, progress, and reflections for this goal
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddJournalModal(true)}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Entry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderAnalyticsTab = () => {
    if (analyticsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Calculating analytics...
          </Text>
        </View>
      );
    }

    if (!analyticsData) {
      return (
        <View style={styles.emptyState}>
          <TrendingUp size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data Yet</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
            Complete some actions to see analytics
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.timeRangeSelector}>
          {(['4W', '12W', 'All'] as TimeRange[]).map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                { borderColor: colors.border },
                timeRange === range && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  { color: timeRange === range ? '#ffffff' : colors.text },
                ]}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.goalScoreCard, { backgroundColor: colors.surface }]}>
          <TrendingUp size={32} color={colors.primary} />
          <View style={styles.goalScoreContent}>
            <Text style={[styles.goalScoreLabel, { color: colors.textSecondary }]}>
              Goal Score
            </Text>
            <Text style={[styles.goalScoreValue, { color: colors.primary }]}>
              {analyticsData.goalScore}
            </Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Weekly Average
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {analyticsData.weeklyAverage}%
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Consistency
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {analyticsData.consistency}%
            </Text>
          </View>
        </View>

        <View style={[styles.metricCard, styles.fullWidthMetric, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
            Total Actions Completed
          </Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {analyticsData.totalActions}
          </Text>
        </View>

        {analyticsData.weeklyData.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              WEEKLY COMPLETION
            </Text>
            <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.chartBars}>
                {analyticsData.weeklyData.map((week, index) => (
                  <View key={index} style={styles.barWrapper}>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${week.completionPercent}%`,
                            backgroundColor:
                              week.completionPercent >= 100
                                ? '#10b981'
                                : week.completionPercent >= 75
                                ? colors.primary
                                : week.completionPercent >= 50
                                ? '#f59e0b'
                                : '#ef4444',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                      W{week.weekNumber}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    100%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    75-99%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    50-74%
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    &lt;50%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

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

      {/* ActionEffortModal - Full featured modal for adding actions */}
      <ActionEffortModal
        visible={showActionEffortModal}
        onClose={handleActionEffortModalClose}
        goal={goalForModal}
        cycleWeeks={cycleWeeks}
        timeline={timeline}
        createTaskWithWeekPlan={createTaskWithWeekPlan}
        mode="create"
      />

      {/* Add Idea Modal */}
      <Modal
        visible={showAddIdeaModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddIdeaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Idea</Text>
              <TouchableOpacity onPress={() => setShowAddIdeaModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Enter your idea..."
              placeholderTextColor={colors.textSecondary}
              value={newIdeaText}
              onChangeText={setNewIdeaText}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setNewIdeaText('');
                  setShowAddIdeaModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleAddIdea}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Journal Entry Modal */}
      <Modal
        visible={showAddJournalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddJournalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Journal Entry</Text>
              <TouchableOpacity onPress={() => setShowAddJournalModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, styles.journalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Write your thoughts..."
              placeholderTextColor={colors.textSecondary}
              value={newJournalText}
              onChangeText={setNewJournalText}
              multiline
              numberOfLines={8}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setNewJournalText('');
                  setShowAddJournalModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleAddJournalEntry}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 6,
  },
  oneTimeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  oneTimeDate: {
    fontSize: 13,
    flex: 1,
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '700',
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
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timelineErrorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
  ideaCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ideaDate: {
    fontSize: 13,
    flex: 1,
  },
  ideaText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  activateButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  journalCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  journalDate: {
    fontSize: 13,
    flex: 1,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachmentCount: {
    fontSize: 12,
  },
  journalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  goalScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 16,
  },
  goalScoreContent: {
    flex: 1,
  },
  goalScoreLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  goalScoreValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullWidthMetric: {
    marginBottom: 16,
  },
  metricLabel: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  chartContainer: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 200,
    gap: 8,
    marginBottom: 16,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    width: '100%',
    height: 180,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  journalInput: {
    minHeight: 200,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});