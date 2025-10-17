import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Platform } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { calculateTaskPoints } from '@/lib/taskUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

const BalanceWheelChart = lazy(() => import('./BalanceWheelChart').then(module => ({ default: module.BalanceWheelChart })));
const BalanceBarChart = lazy(() => import('./BalanceBarChart').then(module => ({ default: module.BalanceBarChart })));

interface Domain {
  id: string;
  name: string;
}

interface DomainScore {
  domain: string;
  score: number;
  color: string;
  rawScore?: number;
}

interface BalanceScoresViewProps {
  getDomainColor: (domainName: string) => string;
}

export function BalanceScoresView({ getDomainColor }: BalanceScoresViewProps) {
  const [activeChartView, setActiveChartView] = useState<'wheel' | 'bar'>('wheel');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [calculationMode, setCalculationMode] = useState<'count' | 'score'>('count');
  const [domainScores, setDomainScores] = useState<DomainScore[]>([]);
  const [maxScore, setMaxScore] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hasData, setHasData] = useState<boolean>(false);

  const fetchDomains = useCallback(async () => {
    try {
      console.log('[BalanceScores] Fetching domains...');
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-domains')
        .select('*')
        .order('name');

      if (error) throw error;
      console.log('[BalanceScores] Domains fetched:', data?.length || 0);
      setDomains(data || []);
    } catch (error) {
      console.error('[BalanceScores] Error fetching domains:', error);
    }
  }, []);

  const getDateFilter = useCallback((): string | '' => {
    if (timeRange === 'all') return '';
    const now = new Date();
    const days = timeRange === 'week' ? 7 : 30;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return since.toISOString().split('T')[0];
  }, [timeRange]);

  const groupByParentId = useCallback(<T extends { parent_id: string }>(rows: T[] | null | undefined) => {
    const map = new Map<string, T[]>();
    (rows ?? []).forEach((r) => {
      const arr = map.get(r.parent_id) ?? [];
      arr.push(r);
      map.set(r.parent_id, arr);
    });
    return map;
  }, []);

  const calculateDomainScore = useCallback(async (domainId: string, domainName: string): Promise<{ taskCount: number; authenticScore: number }> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log(`[BalanceScores] No user found for domain ${domainName}`);
        return { taskCount: 0, authenticScore: 0 };
      }

      const dateFilter = getDateFilter();
      console.log(`[BalanceScores] Calculating score for ${domainName}, dateFilter: ${dateFilter || 'all'}`);

      let tasksQuery = supabase
        .from('0008-ap-tasks')
        .select('id, title, type, status, completed_at, due_date, start_date, end_date, start_time, end_time, is_all_day, is_authentic_deposit, is_urgent, is_important, is_twelve_week_goal, recurrence_rule, user_global_timeline_id, custom_timeline_id, parent_task_id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      if (dateFilter) {
        tasksQuery = tasksQuery.gte('completed_at', dateFilter);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;

      console.log(`[BalanceScores] Found ${tasksData?.length || 0} completed tasks for user`);

      if (!tasksData || tasksData.length === 0) {
        return { taskCount: 0, authenticScore: 0 };
      }

      const taskIds = tasksData.map((t: any) => t.id);

      const [
        rolesRes,
        domainsRes,
        goalsRes,
      ] = await Promise.all([
        supabase
          .from('0008-ap-universal-roles-join')
          .select('parent_id, role_id, role:0008-ap-roles(id,label)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-domains-join')
          .select('parent_id, domain_id, domain:0008-ap-domains(id,name)')
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
        supabase
          .from('0008-ap-universal-goals-join')
          .select(`
            parent_id,
            goal_type,
            twelve_wk_goal_id,
            custom_goal_id,
            tw:0008-ap-goals-12wk(id,title,status),
            cg:0008-ap-goals-custom(id,title,status)
          `)
          .in('parent_id', taskIds)
          .eq('parent_type', 'task'),
      ]);

      const taskRoles = rolesRes.data ?? [];
      const taskDomains = domainsRes.data ?? [];
      const taskGoals = goalsRes.data ?? [];

      const allowedTaskIds = new Set(
        taskDomains
          .filter((d: any) => d.domain?.id === domainId || d.domain_id === domainId)
          .map((d: any) => d.parent_id)
      );

      console.log(`[BalanceScores] ${domainName}: ${allowedTaskIds.size} tasks linked to this domain`);

      if (allowedTaskIds.size === 0) {
        return { taskCount: 0, authenticScore: 0 };
      }

      const rolesByTask = groupByParentId(taskRoles as any);
      const domainsByTask = groupByParentId(taskDomains as any);
      const goalsByTask = groupByParentId(taskGoals as any);

      let taskCount = 0;
      let totalPoints = 0;

      for (const t of tasksData) {
        if (!allowedTaskIds.has(t.id)) continue;

        taskCount++;

        const roles = (rolesByTask.get(t.id) ?? []).map((r: any) => r.role).filter(Boolean);
        const domains = (domainsByTask.get(t.id) ?? []).map((d: any) => d.domain).filter(Boolean);
        const goals = (goalsByTask.get(t.id) ?? []).map((g: any) => {
          if (g.goal_type === 'twelve_wk_goal' && g.tw) {
            const goal = g.tw;
            if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
              return null;
            }
            return { ...goal, goal_type: '12week' };
          } else if (g.goal_type === 'custom_goal' && g.cg) {
            const goal = g.cg;
            if (!goal || goal.status === 'archived' || goal.status === 'cancelled') {
              return null;
            }
            return { ...goal, goal_type: 'custom' };
          }
          return null;
        }).filter(Boolean);

        const points = calculateTaskPoints(t, roles, domains, goals);
        totalPoints += points;
      }

      console.log(`[BalanceScores] ${domainName}: taskCount=${taskCount}, authenticScore=${totalPoints}`);
      return { taskCount, authenticScore: totalPoints };
    } catch (error) {
      console.error(`[BalanceScores] Error calculating domain score for ${domainName}:`, error);
      return { taskCount: 0, authenticScore: 0 };
    }
  }, [getDateFilter, groupByParentId]);

  const getMaxScore = useCallback((scores: number[]): number => {
    const max = Math.max(...scores);
    return max > 0 ? max : 100;
  }, []);

  const fetchDomainScores = useCallback(async () => {
    if (domains.length === 0) {
      console.log('[BalanceScores] No domains to calculate scores for');
      return;
    }

    console.log(`[BalanceScores] Starting score calculation for ${domains.length} domains`);
    setLoading(true);
    try {
      const scorePromises = domains.map(async (domain) => {
        const { taskCount, authenticScore } = await calculateDomainScore(domain.id, domain.name);
        const rawScore = calculationMode === 'count' ? taskCount : authenticScore;
        return { domain: domain.name, rawScore, color: getDomainColor(domain.name) };
      });

      const results = await Promise.all(scorePromises);
      const rawScores = results.map(r => r.rawScore);
      console.log('[BalanceScores] Raw scores by domain:', results.map((r, i) => ({
        domain: r.domain,
        rawScore: r.rawScore
      })));

      const totalRawScore = rawScores.reduce((sum, score) => sum + score, 0);
      const actuallyHasData = totalRawScore > 0;
      console.log('[BalanceScores] Setting hasData to:', actuallyHasData);
      setHasData(actuallyHasData);

      const maxScore = getMaxScore(rawScores);
      console.log('[BalanceScores] Max score for scaling:', maxScore);

      const finalScores: DomainScore[] = results.map((r, i) => ({
        domain: r.domain,
        score: rawScores[i],
        rawScore: rawScores[i],
        color: r.color,
      }));

      console.log('[BalanceScores] Platform:', Platform.OS);
      console.log('[BalanceScores] Final scores being set:', finalScores);
      console.log('[BalanceScores] Scores have data:', finalScores.length > 0 && finalScores.some(s => s.score > 0));
      setMaxScore(maxScore);
      setDomainScores(finalScores);
    } catch (error) {
      console.error('[BalanceScores] Error fetching domain scores:', error);
    } finally {
      setLoading(false);
    }
  }, [domains, calculationMode, calculateDomainScore, getMaxScore, getDomainColor]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (domains.length > 0) {
      fetchDomainScores();
    }
  }, [domains, timeRange, calculationMode, fetchDomainScores]);

  // Listen for task completion events to refresh balance scores
  useEffect(() => {
    const handleTaskUpdate = () => {
      console.log('[BalanceScores] Task completed/updated, refreshing scores...');
      if (domains.length > 0) {
        fetchDomainScores();
      }
    };

    eventBus.on(EVENTS.TASK_COMPLETED, handleTaskUpdate);
    eventBus.on(EVENTS.TASK_UPDATED, handleTaskUpdate);

    return () => {
      eventBus.off(EVENTS.TASK_COMPLETED, handleTaskUpdate);
      eventBus.off(EVENTS.TASK_UPDATED, handleTaskUpdate);
    };
  }, [domains, fetchDomainScores]);

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.chartToggleGroup}>
          <TouchableOpacity
            style={[styles.chartToggleButton, activeChartView === 'wheel' && styles.activeChartToggle]}
            onPress={() => setActiveChartView('wheel')}
          >
            <Text style={[styles.chartToggleText, activeChartView === 'wheel' && styles.activeChartToggleText]}>
              Wheel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chartToggleButton, activeChartView === 'bar' && styles.activeChartToggle]}
            onPress={() => setActiveChartView('bar')}
          >
            <Text style={[styles.chartToggleText, activeChartView === 'bar' && styles.activeChartToggleText]}>
              Bar Graph
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timeRangeGroup}>
          {(['week', 'month', 'all'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.timeRangeButton, timeRange === range && styles.activeTimeRange]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[styles.timeRangeText, timeRange === range && styles.activeTimeRangeText]}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.modeToggleContainer}>
        <Text style={styles.modeToggleLabel}>Task Count</Text>
        <Switch
          value={calculationMode === 'score'}
          onValueChange={(value) => setCalculationMode(value ? 'score' : 'count')}
          trackColor={{ false: '#d1d5db', true: '#0078d4' }}
          thumbColor="#ffffff"
        />
        <Text style={styles.modeToggleLabel}>Authentic Score</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0078d4" />
            <Text style={styles.loadingText}>Calculating balance scores...</Text>
          </View>
        ) : domains.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Wellness Domains</Text>
            <Text style={styles.emptyText}>
              No wellness domains are configured. Please contact support to set up your wellness domains.
            </Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              {timeRange === 'week'
                ? 'No completed tasks found in the past week. Try selecting "Month" or "All" to see your balance scores.'
                : timeRange === 'month'
                ? 'No completed tasks found in the past month. Try selecting "All" to see your balance scores.'
                : 'Complete tasks in different wellness domains to see your balance scores.'}
            </Text>
          </View>
        ) : activeChartView === 'wheel' ? (
          <Suspense fallback={
            <View style={styles.chartLoadingContainer}>
              <ActivityIndicator size="large" color="#0078d4" />
              <Text style={styles.chartLoadingText}>Loading chart...</Text>
            </View>
          }>
            <ChartErrorBoundary>
              <BalanceWheelChart data={domainScores} maxScore={maxScore} unit={calculationMode === 'count' ? 'tasks' : 'points'} />
            </ChartErrorBoundary>
          </Suspense>
        ) : (
          <Suspense fallback={
            <View style={styles.chartLoadingContainer}>
              <ActivityIndicator size="large" color="#0078d4" />
              <Text style={styles.chartLoadingText}>Loading chart...</Text>
            </View>
          }>
            <ChartErrorBoundary>
              <BalanceBarChart data={domainScores} maxScore={maxScore} unit={calculationMode === 'count' ? 'tasks' : 'points'} />
            </ChartErrorBoundary>
          </Suspense>
        )}

        {!loading && domainScores.length > 0 && (
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Domain Scores</Text>
            {domainScores.map((domain) => (
              <View key={domain.domain} style={styles.legendItem}>
                <View style={[styles.legendColorBox, { backgroundColor: domain.color }]} />
                <Text style={styles.legendDomain}>{domain.domain}</Text>
                <Text style={styles.legendScore}>
                  {Math.round(domain.score)} {calculationMode === 'count' ? 'tasks' : 'pts'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  chartToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeChartToggle: {
    backgroundColor: '#0078d4',
  },
  chartToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeChartToggleText: {
    color: '#ffffff',
  },
  timeRangeGroup: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeTimeRange: {
    backgroundColor: '#0078d4',
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTimeRangeText: {
    color: '#ffffff',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  modeToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  legend: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  legendColorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  legendDomain: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  legendScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  chartLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
});
