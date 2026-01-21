import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Target, Calendar, TrendingUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

export interface UnifiedGoal {
  id: string;
  title: string;
  description?: string;
  goal_type: '1y' | '12week' | 'custom';
  status: string;
  progress?: number;

  timeline_id?: string;
  timeline_name?: string;
  timeline_source?: 'global' | 'custom';
  start_date?: string;
  end_date?: string;
  current_week?: number;
  total_weeks?: number;

  parent_goal_id?: string;
  parent_goal_title?: string;
  child_goal_count?: number;

  year_target_date?: string;

  roles?: Array<{ id: string; label: string; color?: string }>;
  domains?: Array<{ id: string; name: string }>;
}

interface MyGoalsViewProps {
  onGoalPress: (goal: UnifiedGoal) => void;
  refreshTrigger?: number;
}

export function MyGoalsView({ onGoalPress, refreshTrigger }: MyGoalsViewProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [annualGoals, setAnnualGoals] = useState<UnifiedGoal[]>([]);
  const [cycleGoals, setCycleGoals] = useState<UnifiedGoal[]>([]);
  const [customGoals, setCustomGoals] = useState<UnifiedGoal[]>([]);
  const [activeTimelineName, setActiveTimelineName] = useState<string>('');
  const [currentCycleWeek, setCurrentCycleWeek] = useState<number>(0);
  const [currentWeekDates, setCurrentWeekDates] = useState<string>('');

  const getCurrentWeekDates = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return `Week of ${formatDate(monday)} - ${formatDate(sunday)}`;
  };

  const fetchAllGoals = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      const [oneYearResult, twelveWeekResult, customResult, timelineResult] = await Promise.all([
        supabase
          .from('0008-ap-goals-1y')
          .select(`
            *,
            roles:0008-ap-universal-roles-join(role:0008-ap-roles(id, label, color)),
            domains:0008-ap-universal-domains-join(domain:0008-ap-domains(id, name))
          `)
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .neq('status', 'archived')
          .order('year_target_date', { ascending: true }),

        supabase
          .from('0008-ap-goals-12wk')
          .select(`
            *,
            timeline:0008-ap-user-global-timelines(
              id,
              title,
              start_date,
              end_date,
              status,
              global_cycle:0008-ap-global-cycles(id, title, cycle_label)
            ),
            roles:0008-ap-universal-roles-join(role:0008-ap-roles(id, label, color)),
            domains:0008-ap-universal-domains-join(domain:0008-ap-domains(id, name)),
            parent_goals:0008-ap-universal-goals-join!twelve_wk_goal_id(
              one_yr_goal:0008-ap-goals-1y(id, title)
            )
          `)
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .neq('archived', true)
          .order('created_at', { ascending: false }),

        supabase
          .from('0008-ap-goals-custom')
          .select(`
            *,
            timeline:0008-ap-custom-timelines(id, title, start_date, end_date),
            roles:0008-ap-universal-roles-join(role:0008-ap-roles(id, label, color)),
            domains:0008-ap-universal-domains-join(domain:0008-ap-domains(id, name))
          `)
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .neq('archived', true)
          .order('created_at', { ascending: false }),

        supabase
          .from('0008-ap-user-global-timelines')
          .select('id, title, start_date, end_date, global_cycle:0008-ap-global-cycles(title, cycle_label)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single(),
      ]);

      const annual: UnifiedGoal[] = (oneYearResult.data || []).map((goal: any) => {
        const childCount = twelveWeekResult.data?.filter((g: any) =>
          g.parent_goals?.some((pg: any) => pg.one_yr_goal?.id === goal.id)
        ).length || 0;

        return {
          id: goal.id,
          title: goal.title,
          description: goal.description,
          goal_type: '1y' as const,
          status: goal.status,
          year_target_date: goal.year_target_date,
          child_goal_count: childCount,
          roles: goal.roles?.map((r: any) => r.role).filter(Boolean) || [],
          domains: goal.domains?.map((d: any) => d.domain).filter(Boolean) || [],
        };
      }).filter((goal: UnifiedGoal) => {
        if (!goal.year_target_date) return true;
        const targetYear = new Date(goal.year_target_date).getFullYear();
        return targetYear === currentYear || targetYear === nextYear;
      });

      let activeTimeline = timelineResult.data as any;
      let timelineName = '';
      let cycleWeek = 0;

      if (activeTimeline) {
        timelineName = activeTimeline.global_cycle?.title || activeTimeline.title || 'Current Cycle';

        if (activeTimeline.start_date) {
          const startDate = new Date(activeTimeline.start_date as string);
          const today = new Date();
          const diffTime = today.getTime() - startDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          cycleWeek = Math.floor(diffDays / 7) + 1;
        }
      }

      const cycle: UnifiedGoal[] = (twelveWeekResult.data || [])
        .filter((goal: any) => goal.timeline && goal.timeline.status === 'active')
        .map((goal: any) => {
          const parentGoal = goal.parent_goals?.[0]?.one_yr_goal;

          return {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            goal_type: '12week' as const,
            status: goal.status,
            progress: goal.progress || 0,
            timeline_id: goal.user_global_timeline_id,
            timeline_name: goal.timeline?.global_cycle?.title || goal.timeline?.title,
            timeline_source: 'global' as const,
            start_date: goal.start_date,
            end_date: goal.end_date,
            parent_goal_id: parentGoal?.id,
            parent_goal_title: parentGoal?.title,
            roles: goal.roles?.map((r: any) => r.role).filter(Boolean) || [],
            domains: goal.domains?.map((d: any) => d.domain).filter(Boolean) || [],
          };
        });

      const custom: UnifiedGoal[] = (customResult.data || []).map((goal: any) => {
        let weekInfo = { current: 0, total: 0 };
        if (goal.timeline?.start_date && goal.timeline?.end_date) {
          const start = new Date(goal.timeline.start_date);
          const end = new Date(goal.timeline.end_date);
          const today = new Date();
          const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const elapsedDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          weekInfo = {
            total: Math.ceil(totalDays / 7),
            current: Math.min(Math.floor(elapsedDays / 7) + 1, Math.ceil(totalDays / 7)),
          };
        }

        return {
          id: goal.id,
          title: goal.title,
          description: goal.description,
          goal_type: 'custom' as const,
          status: goal.status,
          progress: goal.progress || 0,
          timeline_id: goal.custom_timeline_id,
          timeline_name: goal.timeline?.title,
          timeline_source: 'custom' as const,
          start_date: goal.start_date,
          end_date: goal.end_date,
          current_week: weekInfo.current,
          total_weeks: weekInfo.total,
          roles: goal.roles?.map((r: any) => r.role).filter(Boolean) || [],
          domains: goal.domains?.map((d: any) => d.domain).filter(Boolean) || [],
        };
      });

      setAnnualGoals(annual);
      setCycleGoals(cycle);
      setCustomGoals(custom);
      setActiveTimelineName(timelineName);
      setCurrentCycleWeek(cycleWeek);
      setCurrentWeekDates(getCurrentWeekDates());
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllGoals();
  }, [fetchAllGoals, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllGoals();
  };

  const renderGoalCard = (goal: UnifiedGoal) => {
    const cardStyle = [
      styles.goalCard,
      { backgroundColor: colors.surface, borderColor: colors.border },
    ];

    return (
      <TouchableOpacity
        key={goal.id}
        style={cardStyle}
        onPress={() => onGoalPress(goal)}
        activeOpacity={0.7}
      >
        <View style={styles.goalCardHeader}>
          <Text style={[styles.goalTitle, { color: colors.text }]} numberOfLines={2}>
            {goal.title}
          </Text>
          {goal.goal_type === '12week' && goal.progress !== undefined && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>{Math.round(goal.progress)}%</Text>
            </View>
          )}
        </View>

        {goal.description && (
          <Text style={[styles.goalDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {goal.description}
          </Text>
        )}

        <View style={styles.goalMeta}>
          {goal.goal_type === '1y' && goal.year_target_date && (
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {new Date(goal.year_target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}

          {goal.goal_type === '1y' && goal.child_goal_count !== undefined && goal.child_goal_count > 0 && (
            <View style={styles.metaItem}>
              <Target size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {goal.child_goal_count} supporting goal{goal.child_goal_count !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {goal.parent_goal_title && (
            <View style={styles.metaItem}>
              <TrendingUp size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {goal.parent_goal_title}
              </Text>
            </View>
          )}

          {goal.goal_type === 'custom' && goal.current_week && goal.total_weeks && (
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Week {goal.current_week} of {goal.total_weeks}
              </Text>
            </View>
          )}
        </View>

        {goal.roles && goal.roles.length > 0 && (
          <View style={styles.tagsContainer}>
            {goal.roles.slice(0, 3).map((role) => (
              <View
                key={role.id}
                style={[styles.tag, { backgroundColor: role.color || colors.primary + '20' }]}
              >
                <Text style={[styles.tagText, { color: role.color || colors.primary }]}>
                  {role.label}
                </Text>
              </View>
            ))}
            {goal.roles.length > 3 && (
              <Text style={[styles.moreText, { color: colors.textSecondary }]}>
                +{goal.roles.length - 3}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, subtitle: string | null, goals: UnifiedGoal[]) => {
    if (goals.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {goals.map(renderGoalCard)}
      </View>
    );
  };

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

  const hasAnyGoals = annualGoals.length > 0 || cycleGoals.length > 0 || customGoals.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={[styles.weekHeader, { backgroundColor: colors.surface }]}>
        <Text style={[styles.weekText, { color: colors.text }]}>{currentWeekDates}</Text>
      </View>

      {!hasAnyGoals && (
        <View style={styles.emptyState}>
          <Target size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Goals</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
            Tap the + button below to create your first goal
          </Text>
        </View>
      )}

      {renderSection(
        `${new Date().getFullYear()} ANNUAL GOALS`,
        null,
        annualGoals
      )}

      {renderSection(
        'THIS CYCLE',
        activeTimelineName && currentCycleWeek > 0
          ? `${activeTimelineName} • Week ${currentCycleWeek} of 12`
          : activeTimelineName || null,
        cycleGoals
      )}

      {renderSection(
        'CUSTOM TIMELINES',
        null,
        customGoals
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  weekHeader: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  weekText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  goalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  progressBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  goalDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  goalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreText: {
    fontSize: 12,
    alignSelf: 'center',
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
});
