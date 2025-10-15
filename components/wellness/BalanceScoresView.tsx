import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { BalanceWheelChart } from './BalanceWheelChart';
import { BalanceBarChart } from './BalanceBarChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { calculateTaskPoints } from '@/lib/taskUtils';

interface Domain {
  id: string;
  name: string;
}

interface DomainScore {
  domain: string;
  score: number;
  color: string;
}

interface BalanceScoresViewProps {
  getDomainColor: (domainName: string) => string;
}

export function BalanceScoresView({ getDomainColor }: BalanceScoresViewProps) {
  const [activeChartView, setActiveChartView] = useState<'wheel' | 'bar'>('wheel');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [calculationMode, setCalculationMode] = useState<'count' | 'score'>('count');
  const [domainScores, setDomainScores] = useState<DomainScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hasData, setHasData] = useState<boolean>(false);

  const fetchDomains = useCallback(async () => {
    try {
      console.log('[BalanceScores] Fetching domains...');
      setDomainsLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-domains')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      console.log('[BalanceScores] Domains fetched:', data?.length || 0);
      setDomains(data || []);
    } catch (error) {
      console.error('[BalanceScores] Error fetching domains:', error);
      setDomains([]);
    } finally {
      setDomainsLoading(false);
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

  const normalizeScores = useCallback((scores: number[]): number[] => {
    console.log('[BalanceScores] Normalizing scores:', { scores, calculationMode });

    // Check if all scores are actually zero
    const allZero = scores.every(s => s === 0);
    if (allZero) {
      console.log('[BalanceScores] All raw scores are zero, returning zeros');
      return scores.map(() => 0);
    }

    const maxScore = Math.max(...scores);
    console.log('[BalanceScores] Max score:', maxScore);

    // In score mode, if scores are already reasonable (0-100), keep them
    // In count mode, normalize to 0-100 scale
    const normalized = scores.map(score => {
      if (score === 0) return 0;

      if (calculationMode === 'score') {
        // For authentic score mode
        if (maxScore <= 100) {
          // Scores already in 0-100 range, keep as-is
          return Math.round(score);
        } else {
          // Scale down to 0-100
          return Math.round((score / maxScore) * 100);
        }
      } else {
        // For count mode, normalize to 0-100
        return Math.round((score / maxScore) * 100);
      }
    });

    console.log('[BalanceScores] Normalized result:', normalized);
    console.log('[BalanceScores] Any non-zero after normalization:', normalized.some(n => n > 0));
    return normalized;
  }, [calculationMode]);

  const fetchDomainScores = useCallback(async () => {
    if (domains.length === 0) {
      console.log('[BalanceScores] No domains to calculate scores for');
      setDomainScores([]);
      setHasData(false);
      return;
    }

    console.log(`[BalanceScores] Starting score calculation for ${domains.length} domains`);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('[BalanceScores] No authenticated user found when calculating scores');
        setDomainScores([]);
        setHasData(false);
        return;
      }

      const dateFilter = getDateFilter();
      console.log(`[BalanceScores] Fetching completed tasks with date filter: ${dateFilter || 'all'}`);

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

      if (!tasksData || tasksData.length === 0) {
        console.log('[BalanceScores] No completed tasks found for selected range');
        const zeroScores = domains.map(domain => ({
          domain: domain.name,
          score: 0,
          color: getDomainColor(domain.name),
        }));
        setDomainScores(zeroScores);
        setHasData(false);
        return;
      }

      const taskIds = tasksData.map((task: any) => task.id);

      const [rolesRes, domainsRes, goalsRes] = await Promise.all([
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

      if (rolesRes.error) throw rolesRes.error;
      if (domainsRes.error) throw domainsRes.error;
      if (goalsRes.error) throw goalsRes.error;

      const rolesByTask = groupByParentId(rolesRes.data as any);
      const domainsByTask = groupByParentId(domainsRes.data as any);
      const goalsByTask = groupByParentId(goalsRes.data as any);

      const scoreAccumulator = new Map<string, { taskCount: number; authenticScore: number }>();
      domains.forEach((domain) => {
        scoreAccumulator.set(domain.id, { taskCount: 0, authenticScore: 0 });
      });

      for (const task of tasksData) {
        const taskDomainEntries = domainsByTask.get(task.id) ?? [];
        if (taskDomainEntries.length === 0) {
          continue;
        }

        const taskRoles = (rolesByTask.get(task.id) ?? []).map((r: any) => r.role).filter(Boolean);
        const taskGoals = (goalsByTask.get(task.id) ?? [])
          .map((g: any) => {
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
          })
          .filter(Boolean);

        const taskDomains = taskDomainEntries
          .map((d: any) => {
            if (d.domain) return d.domain;
            const fallback = domains.find((domain) => domain.id === d.domain_id);
            if (!fallback) return null;
            return { id: fallback.id, name: fallback.name };
          })
          .filter(Boolean);

        const points = calculateTaskPoints(task, taskRoles, taskDomains as any, taskGoals);

        for (const domainEntry of taskDomainEntries) {
          const domainId = domainEntry.domain_id ?? domainEntry.domain?.id;
          if (!domainId) continue;

          const current = scoreAccumulator.get(domainId);
          if (!current) continue;

          current.taskCount += 1;
          current.authenticScore += points;
        }
      }

      const rawScores = domains.map((domain) => {
        const domainScores = scoreAccumulator.get(domain.id);
        if (!domainScores) return 0;
        return calculationMode === 'count' ? domainScores.taskCount : domainScores.authenticScore;
      });

      console.log('[BalanceScores] Raw scores by domain:', domains.map((domain, index) => ({
        domain: domain.name,
        rawScore: rawScores[index],
      })));

      const normalizedScores = normalizeScores(rawScores);

      console.log('[BalanceScores] Normalized scores by domain:', domains.map((domain, index) => ({
        domain: domain.name,
        normalizedScore: normalizedScores[index],
      })));

      const actuallyHasData = rawScores.some((score) => score > 0);
      console.log('[BalanceScores] Setting hasData to:', actuallyHasData);
      setHasData(actuallyHasData);

      const finalScores: DomainScore[] = domains.map((domain, index) => ({
        domain: domain.name,
        score: normalizedScores[index],
        color: getDomainColor(domain.name),
      }));

      console.log('[BalanceScores] Final scores being set:', finalScores);
      setDomainScores(finalScores);
    } catch (error) {
      console.error('[BalanceScores] Error fetching domain scores:', error);
      setDomainScores([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [domains, calculationMode, getDateFilter, groupByParentId, getDomainColor, normalizeScores]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (domains.length > 0) {
      fetchDomainScores();
    }
  }, [domains, timeRange, calculationMode, fetchDomainScores]);

  const isLoading = loading || domainsLoading;

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
        {isLoading ? (
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
          <ChartErrorBoundary>
            <BalanceWheelChart data={domainScores} />
          </ChartErrorBoundary>
        ) : (
          <ChartErrorBoundary>
            <BalanceBarChart data={domainScores} />
          </ChartErrorBoundary>
        )}

        {!isLoading && domainScores.length > 0 && (
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Domain Scores</Text>
            {domainScores.map((domain) => (
              <View key={domain.domain} style={styles.legendItem}>
                <View style={[styles.legendColorBox, { backgroundColor: domain.color }]} />
                <Text style={styles.legendDomain}>{domain.domain}</Text>
                <Text style={styles.legendScore}>{Math.round(domain.score)}</Text>
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
});
