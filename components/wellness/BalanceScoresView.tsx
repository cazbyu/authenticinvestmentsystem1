import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { BalanceWheelChart } from './BalanceWheelChart';
import { BalanceBarChart } from './BalanceBarChart';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { calculateAuthenticScoreForDomain } from '@/lib/taskUtils';

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
  const [domains, setDomains] = useState<Domain[]>([]);

  const fetchDomains = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-domains')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
    }
  }, []);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const startDate = new Date();

    if (timeRange === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate.setFullYear(2000);
    }

    return { startDate: startDate.toISOString(), endDate: now.toISOString() };
  }, [timeRange]);

  const calculateTaskCountScore = useCallback(async (domainId: string, domainName: string): Promise<number> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { startDate, endDate } = getDateRange();

      const { data: tasks, error: tasksError } = await supabase
        .from('0008-ap-tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .gte('completed_at', startDate)
        .lte('completed_at', endDate);

      if (tasksError) throw tasksError;

      if (!tasks || tasks.length === 0) return 0;

      const taskIds = tasks.map(t => t.id);

      const { data: domainJoins, error: joinsError } = await supabase
        .from('0008-ap-universal-domains-join')
        .select('parent_id')
        .in('parent_id', taskIds)
        .eq('parent_type', 'task')
        .eq('domain_id', domainId);

      if (joinsError) throw joinsError;

      const taskCount = domainJoins?.length || 0;
      return taskCount;
    } catch (error) {
      console.error(`Error calculating task count for ${domainName}:`, error);
      return 0;
    }
  }, [getDateRange]);

  const calculateAuthenticScore = useCallback(async (domainId: string, domainName: string): Promise<number> => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const score = await calculateAuthenticScoreForDomain(
        supabase,
        user.id,
        timeRange,
        { type: 'domain', id: domainId }
      );

      return score;
    } catch (error) {
      console.error(`Error calculating authentic score for ${domainName}:`, error);
      return 0;
    }
  }, [timeRange]);

  const normalizeScores = useCallback((scores: number[]): number[] => {
    if (calculationMode === 'score') {
      return scores;
    }

    const maxScore = Math.max(...scores, 1);

    if (maxScore === 0) return scores.map(() => 0);

    return scores.map(score => Math.round((score / maxScore) * 100));
  }, [calculationMode]);

  const fetchDomainScores = useCallback(async () => {
    if (domains.length === 0) return;

    setLoading(true);
    try {
      const scorePromises = domains.map(async (domain) => {
        const rawScore = calculationMode === 'count'
          ? await calculateTaskCountScore(domain.id, domain.name)
          : await calculateAuthenticScore(domain.id, domain.name);
        return { domain: domain.name, rawScore, color: getDomainColor(domain.name) };
      });

      const results = await Promise.all(scorePromises);
      const rawScores = results.map(r => r.rawScore);
      const normalizedScores = normalizeScores(rawScores);

      const finalScores: DomainScore[] = results.map((r, i) => ({
        domain: r.domain,
        score: normalizedScores[i],
        color: r.color,
      }));

      setDomainScores(finalScores);
    } catch (error) {
      console.error('Error fetching domain scores:', error);
    } finally {
      setLoading(false);
    }
  }, [domains, calculationMode, timeRange, calculateTaskCountScore, calculateAuthenticScore, normalizeScores, getDomainColor]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (domains.length > 0) {
      fetchDomainScores();
    }
  }, [domains, timeRange, calculationMode, fetchDomainScores]);

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
        ) : domainScores.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              Complete tasks in different wellness domains to see your balance scores.
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

        {!loading && domainScores.length > 0 && (
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
