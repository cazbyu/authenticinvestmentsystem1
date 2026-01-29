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
  user_global_timeline_id?: string;  // ADD THIS
  custom_timeline_id?: string;        // ADD THIS
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
  // Annual goals removed - now only shown in North Star
  const [cycleGoals, setCycleGoals] = useState<UnifiedGoal[]>([]);
  const [customGoals, setCustomGoals] = useState<UnifiedGoal[]>([]);
  const [activeTimelineName, setActiveTimelineName] = useState<string>('');
  const [currentCycleWeek, setCurrentCycleWeek] = useState<number>(0);
 
  const fetchAllGoals = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      const [twelveWeekResult, customResult, timelineResult] = await Promise.all([
        supabase

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
            timeline:0008-ap-custom-timelines(id, title, start_date, end_date)
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

      const twelveWeekGoals = twelveWeekResult.data || [];
      const customGoals = customResult.data || [];

      const allGoalIds = [
        ...twelveWeekGoals.map(g => g.id),
        ...customGoals.map(g => g.id),
      ];

      if (allGoalIds.length === 0) {
        setCycleGoals([]);
        setCustomGoals([]);
        setActiveTimelineName('');
        setCurrentCycleWeek(0);
        return;
      }
      }

      const [
  { data: rolesData },
  { data: domainsData },
] = await Promise.all([
  supabase
    .from('0008-ap-universal-roles-join')
    .select('parent_id, role:0008-ap-roles(id, label, color)')
    .in('parent_id', allGoalIds)
    .in('parent_type', ['one_yr_goal', 'twelve_wk_goal', 'custom_goal']),
  supabase
    .from('0008-ap-universal-domains-join')
    .select('parent_id, domain:0008-ap-domains(id, name)')
    .in('parent_id', allGoalIds)
    .in('parent_type', ['one_yr_goal', 'twelve_wk_goal', 'custom_goal']),
]);

// ✅ CORRECT: Fetch parent goals using parent_goal_id directly from 12-week goals table
const twelveWeekGoalIds = twelveWeekGoals.map(g => g.id);
const goalsWithParentIds = twelveWeekGoals.filter(g => g.parent_goal_id);
const parentGoalIds = [...new Set(goalsWithParentIds.map(g => g.parent_goal_id).filter(Boolean))];

let parentGoalsData: Array<{ id: string; title: string }> = [];
if (parentGoalIds.length > 0) {
  const { data: parentGoals } = await supabase
    .from('0008-ap-goals-1y')
    .select('id, title')
    .in('id', parentGoalIds);
  parentGoalsData = parentGoals || [];
}

      const rolesMap = new Map<string, any[]>();
      (rolesData || []).forEach((item: any) => {
        if (!rolesMap.has(item.parent_id)) {
          rolesMap.set(item.parent_id, []);
        }
        if (item.role) {
          rolesMap.get(item.parent_id)!.push(item.role);
        }
      });

      const domainsMap = new Map<string, any[]>();
      (domainsData || []).forEach((item: any) => {
        if (!domainsMap.has(item.parent_id)) {
          domainsMap.set(item.parent_id, []);
        }
        if (item.domain) {
          domainsMap.get(item.parent_id)!.push(item.domain);
        }
      });

      // ✅ CORRECT: Build parent goals map using parent_goal_id from 12-week goals
const parentGoalsMap = new Map<string, any>();
twelveWeekGoals.forEach((goal: any) => {
  if (goal.parent_goal_id) {
    const parentGoal = parentGoalsData.find(p => p.id === goal.parent_goal_id);
    if (parentGoal) {
      parentGoalsMap.set(goal.id, parentGoal);
    }
  }
});

      let activeTimeline
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

      const cycle: UnifiedGoal[] = twelveWeekGoals
        .filter((goal: any) => goal.timeline && goal.timeline.status === 'active')
        .map((goal: any) => {
          const parentGoal = parentGoalsMap.get(goal.id);

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
  user_global_timeline_id: goal.user_global_timeline_id,  // ADD THIS
  start_date: goal.start_date,
  end_date: goal.end_date,
  parent_goal_id: parentGoal?.id,
  parent_goal_title: parentGoal?.title,
  roles: rolesMap.get(goal.id) || [],
  domains: domainsMap.get(goal.id) || [],
};
        });

      const custom: UnifiedGoal[] = customGoals.map((goal: any) => {
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
  custom_timeline_id: goal.custom_timeline_id,  // ADD THIS
  start_date: goal.timeline?.start_date || goal.start_date,
  end_date: goal.timeline?.end_date || goal.end_date,
  current_week: weekInfo.current,
  total_weeks: weekInfo.total,
  roles: rolesMap.get(goal.id) || [],
  domains: domainsMap.get(goal.id) || [],
};

      });

      setCycleGoals(cycle);
      setCustomGoals(custom);
      setActiveTimelineName(timelineName);
      setCurrentCycleWeek(cycleWeek);
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

  const renderSkeletonCard = (key: string) => (
    <View
      key={key}
      style={[
        styles.goalCard,
        styles.skeletonCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.skeletonLine, styles.skeletonTitle, { backgroundColor: colors.border }]} />
      <View style={[styles.skeletonLine, styles.skeletonDescription, { backgroundColor: colors.border }]} />
      <View style={styles.skeletonMeta}>
        <View style={[styles.skeletonLine, styles.skeletonMetaItem, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonLine, styles.skeletonMetaItem, { backgroundColor: colors.border }]} />
      </View>
    </View>
  );

  const formatGoalDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startYear = start.getFullYear();
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endYear = end.getFullYear();

    if (startYear === endYear) {
      return `(${startMonth} - ${endMonth} ${endYear})`;
    } else {
      return `(${startMonth} ${startYear} - ${endMonth} ${endYear})`;
    }
  };

  const renderGoalCard = (goal: UnifiedGoal) => {
    const isAnnualGoal = goal.goal_type === '1y';
    const cardStyle = [
      styles.goalCard,
      isAnnualGoal && styles.annualGoalCard,
      { backgroundColor: colors.surface, borderColor: colors.border },
    ];

    return (
      <TouchableOpacity
        key={goal.id}
        style={cardStyle}
        onPress={() => onGoalPress(goal)}
        activeOpacity={0.7}
        accessibilityLabel={`${goal.title} goal`}
        accessibilityHint="Tap to view goal details"
        accessibilityRole="button"
      >
        <View style={styles.goalCardHeader}>
  <View style={styles.goalTitleContainer}>
    <Text
      style={[
        styles.goalTitle,
        isAnnualGoal && styles.annualGoalTitle,
        { color: colors.text }
      ]}
      numberOfLines={2}
    >
      {goal.title}
    </Text>
    {goal.goal_type === '1y' && (
      <View style={[styles.goalTypeBadge, { backgroundColor: '#dcfce7' }]}>
        <Text style={[styles.goalTypeBadgeText, { color: '#166534' }]}>Annual Goal</Text>
      </View>
    )}
    {goal.goal_type === '12week' && (
      <View style={[styles.goalTypeBadge, { backgroundColor: '#dbeafe' }]}>
        <Text style={[styles.goalTypeBadgeText, { color: '#1e40af' }]}>12 Week Goal</Text>
      </View>
    )}
    {goal.goal_type === 'custom' && (
      <View style={[styles.goalTypeBadge, { backgroundColor: '#f3e8ff' }]}>
        <Text style={[styles.goalTypeBadgeText, { color: '#7c3aed' }]}>Custom Goal</Text>
      </View>
    )}
  </View>
  {goal.progress !== undefined && (
    <View style={styles.progressBadge}>
      <Text style={styles.progressText}>{Math.round(goal.progress)}%</Text>
    </View>
  )}
</View>

        <View style={styles.goalMeta}>
          {goal.goal_type === '1y' && (() => {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const diffTime = now.getTime() - startOfYear.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const currentWeek = Math.floor(diffDays / 7) + 1;
            const dateRange = goal.start_date && goal.end_date
              ? ` ${formatGoalDateRange(goal.start_date, goal.end_date)}`
              : '';
            return (
              <View style={styles.metaItem}>
                <Calendar size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  Week {currentWeek} of 52{dateRange}
                </Text>
              </View>
            );
          })()}

          {goal.goal_type === '12week' && currentCycleWeek > 0 && (
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Week {currentCycleWeek} of 12{goal.start_date && goal.end_date ? ` ${formatGoalDateRange(goal.start_date, goal.end_date)}` : ''}
              </Text>
            </View>
          )}

          {goal.goal_type === 'custom' && goal.current_week && goal.total_weeks && (
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Week {goal.current_week} of {goal.total_weeks}{goal.start_date && goal.end_date ? ` ${formatGoalDateRange(goal.start_date, goal.end_date)}` : ''}
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
        </View>

      </TouchableOpacity>
    );
  };

  const getAllGoalsSorted = (): UnifiedGoal[] => {
    // Priority: 12-week (1) → Custom (2) → Annual (3)
    const getTypePriority = (goalType: string): number => {
      switch (goalType) {
        case '12week': return 1;
        case 'custom': return 2;
        case '1y': return 3;
        default: return 4;
      }
    };

    const allGoals = [
      ...cycleGoals.map(g => ({
        ...g,
        sortPriority: getTypePriority(g.goal_type),
        sortDate: g.end_date || '2099-12-31'
      })),
      ...customGoals.map(g => ({
        ...g,
        sortPriority: getTypePriority(g.goal_type),
        sortDate: g.end_date || '2099-12-31'
      })),
      ...annualGoals.map(g => ({
        ...g,
        sortPriority: getTypePriority(g.goal_type),
        sortDate: g.year_target_date || '2099-12-31'
      })),
    ];

    return allGoals.sort((a, b) => {
      // First sort by type priority (12-week → Custom → Annual)
      if (a.sortPriority !== b.sortPriority) {
        return a.sortPriority - b.sortPriority;
      }
      // Then by end date (soonest first)
      return new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();
    });
  };

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        <View style={styles.section}>
          <View style={[styles.skeletonLine, styles.skeletonSectionTitle, { backgroundColor: colors.border }]} />
          {renderSkeletonCard('skeleton-1')}
          {renderSkeletonCard('skeleton-2')}
        </View>
        <View style={styles.section}>
          <View style={[styles.skeletonLine, styles.skeletonSectionTitle, { backgroundColor: colors.border }]} />
          {renderSkeletonCard('skeleton-3')}
          {renderSkeletonCard('skeleton-4')}
        </View>
      </ScrollView>
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
      
      {!hasAnyGoals && (
        <View style={styles.emptyState}>
          <Target size={64} color={colors.textSecondary} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Start Your Journey</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
            Create your first goal to begin tracking progress and achieving your ambitions
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Tap the + button below to get started
          </Text>
        </View>
      )}

      {hasAnyGoals && cycleGoals.length === 0 && annualGoals.length > 0 && (
        <View style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.promptTitle, { color: colors.text }]}>Join a 12-Week Cycle</Text>
          <Text style={[styles.promptMessage, { color: colors.textSecondary }]}>
            Join the current 12-week cycle to start breaking down your annual goals into actionable quarterly targets
          </Text>
        </View>
      )}

      {getAllGoalsSorted().map(goal => renderGoalCard(goal))}
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
  annualGoalCard: {
    borderWidth: 2,
    borderLeftWidth: 6,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
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
},

  goalTitleContainer: {
  flex: 1,
  marginRight: 8,
},
goalTypeBadge: {
  alignSelf: 'flex-start',
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 6,
  marginTop: 6,
},
goalTypeBadgeText: {
  fontSize: 11,
  fontWeight: '600',
},
annualGoalTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
    fontStyle: 'italic',
  },
  promptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 24,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  promptMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  skeletonCard: {
    opacity: 0.6,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 4,
  },
  skeletonTitle: {
    width: '70%',
    height: 20,
    marginBottom: 8,
  },
  skeletonDescription: {
    width: '90%',
    marginBottom: 12,
  },
  skeletonMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonMetaItem: {
    width: 80,
    height: 14,
  },
    skeletonSectionTitle: {
    width: 200,
    height: 18,
    marginBottom: 16,
  },
});
