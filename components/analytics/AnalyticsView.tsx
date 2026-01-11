import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { TrendingUp, TrendingDown, Minus, Target, Calendar, Users, Zap, Award, Flower, AlertTriangle, Lightbulb, BookOpen } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { eventBus } from '@/lib/eventBus';

interface AnalyticsEntry {
  id: string;
  date: string;
  type: 'deposit' | 'withdrawal' | 'reflection' | 'depositIdea';
  amount: number;
  is_urgent?: boolean;
  is_important?: boolean;
  reflection_type?: string;
  daily_rose?: string;
  daily_thorn?: string;
  roles?: Array<{id: string; label: string}>;
  domains?: Array<{id: string; name: string}>;
  keyRelationships?: Array<{id: string; name: string}>;
  source_data?: any;
}

interface AnalyticsMetrics {
  netBalance: number;
  consistency: number;
  quality: number;
  relationshipDistribution: number | null;
  compositeScore: number;
  totalDeposits: number;
  totalWithdrawals: number;
  weeklyStreak: number;
  quadrantBreakdown: {
    q1: number; // Important & Urgent
    q2: number; // Important, Not Urgent
    q3: number; // Urgent, Not Important
    q4: number; // Neither
  };
  krDistribution: Array<{name: string; percentage: number; count: number}>;
  totalReflections?: number;
  rosesCount?: number;
  thornsCount?: number;
  depositIdeasCount?: number;
  reflectionConsistency?: number;
}

interface AnalyticsViewProps {
  scope: {
    type: 'user' | 'role' | 'key_relationship' | 'domain';
    id?: string;
    name?: string;
  };
}

export function AnalyticsView({ scope }: AnalyticsViewProps) {
  const [entries, setEntries] = useState<AnalyticsEntry[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'4weeks' | '12weeks' | '26weeks'>('12weeks');
  const [filter, setFilter] = useState<'all' | 'deposits' | 'reflections'>('all');
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousScopeRef = React.useRef<string>('');

  const getDateRangeWeeks = () => {
    switch (dateRange) {
      case '4weeks': return 4;
      case '12weeks': return 12;
      case '26weeks': return 26;
      default: return 12;
    }
  };

  const calculateTaskPoints = (task: any, roles: any[] = [], domains: any[] = []) => {
    const roleCount = roles?.length || 0;
    const domainCount = domains?.length || 0;
    const base = 1;
    const perRole = 1;
    const perDomain = 0.5;
    return base + roleCount * perRole + domainCount * perDomain;
  };

  const getQuadrantWeight = (isUrgent: boolean, isImportant: boolean) => {
    if (isImportant && !isUrgent) return 3; // Q2
    if (isImportant && isUrgent) return 1.5; // Q1
    if (isUrgent && !isImportant) return 1; // Q3
    return 0.5; // Q4
  };

  const fetchAnalyticsData = async () => {
    // Create new AbortController for this fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      const weeksBack = getDateRangeWeeks();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (weeksBack * 7));
      const dateFilter = startDate.toISOString().split('T')[0];

      const analyticsEntries: AnalyticsEntry[] = [];

      // Fetch deposits (completed tasks/events)
      if (filter === 'all' || filter === 'deposits') {
        let tasksQuery = supabase
          .from('0008-ap-tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .not('completed_at', 'is', null)
          .gte('completed_at', dateFilter);

        const { data: tasksData, error: tasksError } = await tasksQuery;
        if (tasksError) throw tasksError;

        if (tasksData && tasksData.length > 0) {
          const taskIds = tasksData.map(t => t.id);

          const [
            { data: rolesData },
            { data: domainsData },
            { data: krData }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', taskIds).eq('parent_type', 'task'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', taskIds).eq('parent_type', 'task')
          ]);

          // Apply scope filtering
          let scopeFilteredTaskIds = taskIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredTaskIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'key_relationship':
                scopeFilteredTaskIds = krData?.filter(kr => kr.key_relationship?.id === scope.id).map(kr => kr.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredTaskIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const scopedTasks = tasksData.filter(task => scopeFilteredTaskIds.includes(task.id));

          for (const task of scopedTasks) {
            const taskWithData = {
              ...task,
              roles: rolesData?.filter(r => r.parent_id === task.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === task.id).map(d => d.domain).filter(Boolean) || [],
              keyRelationships: krData?.filter(kr => kr.parent_id === task.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            };

            const points = calculateTaskPoints(task, taskWithData.roles, taskWithData.domains);
            analyticsEntries.push({
              id: task.id,
              date: task.completed_at?.split('T')[0] || task.due_date,
              type: 'deposit',
              amount: points,
              is_urgent: task.is_urgent,
              is_important: task.is_important,
              roles: taskWithData.roles,
              domains: taskWithData.domains,
              keyRelationships: taskWithData.keyRelationships,
              source_data: taskWithData,
            });
          }
        }
      }

      // Fetch withdrawals (only in 'all' view)
      if (filter === 'all') {
        let withdrawalsQuery = supabase
          .from('0008-ap-withdrawals')
          .select('*')
          .eq('user_id', user.id)
          .gte('withdrawn_at', dateFilter);

        const { data: withdrawalsData, error: withdrawalsError } = await withdrawalsQuery;
        if (withdrawalsError) throw withdrawalsError;

        if (withdrawalsData && withdrawalsData.length > 0) {
          const withdrawalIds = withdrawalsData.map(w => w.id);

          const [
            { data: rolesData },
            { data: domainsData },
            { data: krData }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', withdrawalIds).eq('parent_type', 'withdrawal')
          ]);

          // Apply scope filtering
          let scopeFilteredWithdrawalIds = withdrawalIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredWithdrawalIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'key_relationship':
                scopeFilteredWithdrawalIds = krData?.filter(kr => kr.key_relationship?.id === scope.id).map(kr => kr.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredWithdrawalIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const scopedWithdrawals = withdrawalsData.filter(withdrawal => scopeFilteredWithdrawalIds.includes(withdrawal.id));

          for (const withdrawal of scopedWithdrawals) {
            const withdrawalWithData = {
              ...withdrawal,
              roles: rolesData?.filter(r => r.parent_id === withdrawal.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === withdrawal.id).map(d => d.domain).filter(Boolean) || [],
              keyRelationships: krData?.filter(kr => kr.parent_id === withdrawal.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            };

            analyticsEntries.push({
              id: withdrawal.id,
              date: withdrawal.withdrawn_at,
              type: 'withdrawal',
              amount: parseFloat(withdrawal.amount.toString()),
              roles: withdrawalWithData.roles,
              domains: withdrawalWithData.domains,
              keyRelationships: withdrawalWithData.keyRelationships,
              source_data: withdrawalWithData,
            });
          }
        }
      }

      // Fetch reflections
      if (filter === 'all' || filter === 'reflections') {
        let reflectionsQuery = supabase
          .from('0008-ap-reflections')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false)
          .gte('created_at', dateFilter);

        const { data: reflectionsData, error: reflectionsError } = await reflectionsQuery;
        if (reflectionsError) throw reflectionsError;

        if (reflectionsData && reflectionsData.length > 0) {
          const reflectionIds = reflectionsData.map(r => r.id);

          const [
            { data: rolesData },
            { data: domainsData },
            { data: krData }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', reflectionIds).eq('parent_type', 'reflection'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', reflectionIds).eq('parent_type', 'reflection'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', reflectionIds).eq('parent_type', 'reflection')
          ]);

          // Apply scope filtering
          let scopeFilteredReflectionIds = reflectionIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredReflectionIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'key_relationship':
                scopeFilteredReflectionIds = krData?.filter(kr => kr.key_relationship?.id === scope.id).map(kr => kr.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredReflectionIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const scopedReflections = reflectionsData.filter(reflection => scopeFilteredReflectionIds.includes(reflection.id));

          for (const reflection of scopedReflections) {
            const reflectionWithData = {
              ...reflection,
              roles: rolesData?.filter(r => r.parent_id === reflection.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === reflection.id).map(d => d.domain).filter(Boolean) || [],
              keyRelationships: krData?.filter(kr => kr.parent_id === reflection.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            };

            analyticsEntries.push({
              id: reflection.id,
              date: reflection.created_at.split('T')[0],
              type: 'reflection',
              amount: 0,
              reflection_type: reflection.reflection_type,
              daily_rose: reflection.daily_rose,
              daily_thorn: reflection.daily_thorn,
              roles: reflectionWithData.roles,
              domains: reflectionWithData.domains,
              keyRelationships: reflectionWithData.keyRelationships,
              source_data: reflectionWithData,
            });
          }
        }
      }

      // Fetch deposit ideas
      if (filter === 'all' || filter === 'reflections') {
        let depositIdeasQuery = supabase
          .from('0008-ap-deposit-ideas')
          .select('*')
          .eq('user_id', user.id)
          .eq('archived', false)
          .eq('is_active', true)
          .gte('created_at', dateFilter);

        const { data: depositIdeasData, error: depositIdeasError } = await depositIdeasQuery;
        if (depositIdeasError) throw depositIdeasError;

        if (depositIdeasData && depositIdeasData.length > 0) {
          const depositIdeaIds = depositIdeasData.map(d => d.id);

          const [
            { data: rolesData },
            { data: domainsData },
            { data: krData }
          ] = await Promise.all([
            supabase.from('0008-ap-universal-roles-join').select('parent_id, role:0008-ap-roles(id, label)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-domains-join').select('parent_id, domain:0008-ap-domains(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea'),
            supabase.from('0008-ap-universal-key-relationships-join').select('parent_id, key_relationship:0008-ap-key-relationships(id, name)').in('parent_id', depositIdeaIds).eq('parent_type', 'depositIdea')
          ]);

          // Apply scope filtering
          let scopeFilteredDepositIdeaIds = depositIdeaIds;
          if (scope.type !== 'user' && scope.id) {
            switch (scope.type) {
              case 'role':
                scopeFilteredDepositIdeaIds = rolesData?.filter(r => r.role?.id === scope.id).map(r => r.parent_id) || [];
                break;
              case 'key_relationship':
                scopeFilteredDepositIdeaIds = krData?.filter(kr => kr.key_relationship?.id === scope.id).map(kr => kr.parent_id) || [];
                break;
              case 'domain':
                scopeFilteredDepositIdeaIds = domainsData?.filter(d => d.domain?.id === scope.id).map(d => d.parent_id) || [];
                break;
            }
          }

          const scopedDepositIdeas = depositIdeasData.filter(depositIdea => scopeFilteredDepositIdeaIds.includes(depositIdea.id));

          for (const depositIdea of scopedDepositIdeas) {
            const depositIdeaWithData = {
              ...depositIdea,
              roles: rolesData?.filter(r => r.parent_id === depositIdea.id).map(r => r.role).filter(Boolean) || [],
              domains: domainsData?.filter(d => d.parent_id === depositIdea.id).map(d => d.domain).filter(Boolean) || [],
              keyRelationships: krData?.filter(kr => kr.parent_id === depositIdea.id).map(kr => kr.key_relationship).filter(Boolean) || [],
            };

            const dateToUse = depositIdea.activated_at || depositIdea.created_at;

            analyticsEntries.push({
              id: depositIdea.id,
              date: dateToUse.split('T')[0],
              type: 'depositIdea',
              amount: 0,
              roles: depositIdeaWithData.roles,
              domains: depositIdeaWithData.domains,
              keyRelationships: depositIdeaWithData.keyRelationships,
              source_data: depositIdeaWithData,
            });
          }
        }
      }

      // Check if aborted before final state updates
      if (controller.signal.aborted) {
        return;
      }

      // Sort by date (most recent first)
      analyticsEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(analyticsEntries);

      // Calculate metrics
      calculateMetrics(analyticsEntries, weeksBack);

    } catch (error) {
      // Don't show errors if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      console.error('Error fetching analytics data:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const calculateMetrics = async (entries: AnalyticsEntry[], totalWeeks: number) => {
    const deposits = entries.filter(e => e.type === 'deposit');
    const withdrawals = entries.filter(e => e.type === 'withdrawal');
    const reflections = entries.filter(e => e.type === 'reflection');
    const depositIdeas = entries.filter(e => e.type === 'depositIdea');

    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Reflection-specific metrics
    const totalReflections = reflections.length;
    const rosesCount = reflections.filter(r => r.daily_rose || r.reflection_type === 'rose').length;
    const thornsCount = reflections.filter(r => r.daily_thorn || r.reflection_type === 'thorn').length;
    const depositIdeasCount = depositIdeas.length;

    // Reflection consistency (weeks with at least one reflection)
    const weeklyReflections = new Map<string, number>();
    reflections.forEach(r => {
      const weekStart = getWeekStart(new Date(r.date));
      const weekKey = weekStart.toISOString().split('T')[0];
      weeklyReflections.set(weekKey, (weeklyReflections.get(weekKey) || 0) + 1);
    });
    const reflectionConsistency = totalWeeks === 0 ? 0 : Math.round((weeklyReflections.size / totalWeeks) * 100);
    
    // 1. Net Balance %
    const netBalance = totalDeposits + totalWithdrawals === 0 ? 0 : 
      Math.round((totalDeposits / (totalDeposits + totalWithdrawals)) * 100);

    // 2. Consistency % (weeks with ≥1 deposit)
    const weeklyDeposits = new Map<string, number>();
    deposits.forEach(d => {
      const weekStart = getWeekStart(new Date(d.date));
      const weekKey = weekStart.toISOString().split('T')[0];
      weeklyDeposits.set(weekKey, (weeklyDeposits.get(weekKey) || 0) + 1);
    });
    
    const weeksWithDeposits = weeklyDeposits.size;
    const consistency = Math.round((weeksWithDeposits / totalWeeks) * 100);
    
    // Calculate streak
    const weeklyStreak = calculateWeeklyStreak(deposits);

    // 3. Quality % (Quadrant weights)
    const quadrantCounts = { q1: 0, q2: 0, q3: 0, q4: 0 };
    let totalQualityScore = 0;
    
    deposits.forEach(d => {
      const isUrgent = d.is_urgent || false;
      const isImportant = d.is_important || false;
      const weight = getQuadrantWeight(isUrgent, isImportant);
      totalQualityScore += weight;
      
      if (isImportant && !isUrgent) quadrantCounts.q2++;
      else if (isImportant && isUrgent) quadrantCounts.q1++;
      else if (isUrgent && !isImportant) quadrantCounts.q3++;
      else quadrantCounts.q4++;
    });
    
    const quality = deposits.length === 0 ? 0 : 
      Math.round((totalQualityScore / deposits.length / 3) * 100);

    // Convert counts to percentages
    const quadrantBreakdown = {
      q1: deposits.length === 0 ? 0 : Math.round((quadrantCounts.q1 / deposits.length) * 100),
      q2: deposits.length === 0 ? 0 : Math.round((quadrantCounts.q2 / deposits.length) * 100),
      q3: deposits.length === 0 ? 0 : Math.round((quadrantCounts.q3 / deposits.length) * 100),
      q4: deposits.length === 0 ? 0 : Math.round((quadrantCounts.q4 / deposits.length) * 100),
    };

    // 5. Relationship Distribution % (for roles with multiple KRs)
    let relationshipDistribution: number | null = null;
    let krDistribution: Array<{name: string; percentage: number; count: number}> = [];
    
    if (scope.type === 'role') {
      const krCounts = new Map<string, {name: string; count: number}>();
      deposits.forEach(d => {
        d.keyRelationships?.forEach(kr => {
          const existing = krCounts.get(kr.id) || {name: kr.name, count: 0};
          krCounts.set(kr.id, {name: existing.name, count: existing.count + 1});
        });
      });
      
      if (krCounts.size > 1) {
        const krArray = Array.from(krCounts.values());
        const totalKRDeposits = krArray.reduce((sum, kr) => sum + kr.count, 0);
        
        krDistribution = krArray.map(kr => ({
          name: kr.name,
          count: kr.count,
          percentage: totalKRDeposits === 0 ? 0 : Math.round((kr.count / totalKRDeposits) * 100)
        }));
        
        const maxShare = Math.max(...krDistribution.map(kr => kr.percentage / 100));
        relationshipDistribution = Math.round((1 - maxShare) * 100);
      }
    }

    // 6. Composite Score (weighted average)
    const hasDistribution = relationshipDistribution !== null;
    const weights = hasDistribution
      ? { netBalance: 35, consistency: 25, quality: 30, distribution: 10 }
      : { netBalance: 40, consistency: 30, quality: 30, distribution: 0 };

    const compositeScore = Math.round(
      (netBalance * weights.netBalance +
       consistency * weights.consistency +
       quality * weights.quality +
       (relationshipDistribution || 0) * weights.distribution) / 100
    );

    setMetrics({
      netBalance,
      consistency,
      quality,
      relationshipDistribution,
      compositeScore,
      totalDeposits,
      totalWithdrawals,
      weeklyStreak,
      quadrantBreakdown,
      krDistribution,
      totalReflections,
      rosesCount,
      thornsCount,
      depositIdeasCount,
      reflectionConsistency,
    });
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const calculateWeeklyStreak = (deposits: AnalyticsEntry[]) => {
    const weeklyDeposits = new Map<string, boolean>();
    deposits.forEach(d => {
      const weekStart = getWeekStart(new Date(d.date));
      const weekKey = weekStart.toISOString().split('T')[0];
      weeklyDeposits.set(weekKey, true);
    });

    let streak = 0;
    const currentWeek = getWeekStart(new Date());
    
    for (let i = 0; i < 52; i++) {
      const weekToCheck = new Date(currentWeek);
      weekToCheck.setDate(weekToCheck.getDate() - (i * 7));
      const weekKey = weekToCheck.toISOString().split('T')[0];
      
      if (weeklyDeposits.has(weekKey)) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };




  useEffect(() => {
    // Create a stable scope key for comparison
    const scopeKey = JSON.stringify(scope);

    // Only fetch if scope actually changed
    if (scopeKey === previousScopeRef.current && !filter && !dateRange) {
      return;
    }

    previousScopeRef.current = scopeKey;

    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounce the fetch to prevent rapid consecutive calls
    fetchTimeoutRef.current = setTimeout(() => {
      fetchAnalyticsData();
    }, 300);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [scope, dateRange, filter]);

  useEffect(() => {
    const handleTaskEvent = () => {
      fetchAnalyticsData();
    };

    eventBus.on('TASK_CREATED', handleTaskEvent);
    eventBus.on('TASK_UPDATED', handleTaskEvent);
    eventBus.on('TASK_COMPLETED', handleTaskEvent);

    return () => {
      eventBus.off('TASK_CREATED', handleTaskEvent);
      eventBus.off('TASK_UPDATED', handleTaskEvent);
      eventBus.off('TASK_COMPLETED', handleTaskEvent);
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 85) return '#16a34a'; // Green for 85% and above
    if (score >= 60) return '#eab308'; // Yellow
    return '#dc2626'; // Red
  };

  const getHeaderTitle = () => {
    switch (scope.type) {
      case 'user':
        return 'Overall Analytics';
      case 'role':
        return `Analytics – ${scope.name}`;
      case 'key_relationship':
        return `Analytics – ${scope.name}`;
      case 'domain':
        return `Analytics – ${scope.name}`;
      default:
        return 'Analytics';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available for analytics</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
        
        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          {(['4weeks', '12weeks', '26weeks'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.dateRangeButton,
                dateRange === range && styles.activeDateRangeButton
              ]}
              onPress={() => setDateRange(range)}
            >
              <Text style={[
                styles.dateRangeButtonText,
                dateRange === range && styles.activeDateRangeButtonText
              ]}>
                {range === '4weeks' ? '4W' : range === '12weeks' ? '12W' : '26W'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Filter Controls */}
      <View style={styles.filterContainer}>
        <View style={styles.filterGroup}>
          {(['all', 'deposits', 'reflections'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.activeFilterButton
              ]}
              onPress={() => setFilter(filterOption)}
            >
              <Text style={[
                styles.filterButtonText,
                filter === filterOption && styles.activeFilterButtonText
              ]}>
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {filter === 'reflections' ? (
          <>
            {/* Reflection Summary Card */}
            <View style={styles.compositeScoreCard}>
              <View style={styles.compositeScoreHeader}>
                <BookOpen size={24} color="#8b5cf6" />
                <Text style={styles.compositeScoreTitle}>Reflection Summary</Text>
              </View>
              <Text style={[styles.compositeScoreValue, { color: '#8b5cf6' }]}>
                {metrics.totalReflections || 0}
              </Text>
              <Text style={styles.compositeScoreSubtitle}>Total Reflections</Text>
            </View>

            {/* Reflection Metrics Grid */}
            <View style={styles.metricsGrid}>
              {/* Roses Count */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Flower size={16} color="#16a34a" />
                  <Text style={styles.metricTitle}>Roses</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#16a34a' }]}>
                  {metrics.rosesCount || 0}
                </Text>
                <Text style={styles.metricDescription}>
                  Wins & Gratitude
                </Text>
              </View>

              {/* Thorns Count */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <AlertTriangle size={16} color="#f59e0b" />
                  <Text style={styles.metricTitle}>Thorns</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#f59e0b' }]}>
                  {metrics.thornsCount || 0}
                </Text>
                <Text style={styles.metricDescription}>
                  Challenges
                </Text>
              </View>

              {/* Deposit Ideas Count */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Lightbulb size={16} color="#eab308" />
                  <Text style={styles.metricTitle}>Ideas</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#eab308' }]}>
                  {metrics.depositIdeasCount || 0}
                </Text>
                <Text style={styles.metricDescription}>
                  Deposit Ideas
                </Text>
              </View>

              {/* Reflection Consistency */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Calendar size={16} color={getScoreColor(metrics.reflectionConsistency || 0)} />
                  <Text style={styles.metricTitle}>Consistency</Text>
                </View>
                <Text style={[styles.metricValue, { color: getScoreColor(metrics.reflectionConsistency || 0) }]}>
                  {metrics.reflectionConsistency || 0}%
                </Text>
                <Text style={styles.metricDescription}>
                  Weekly reflection rate
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Investment Score (for deposits/all) */}
            <View style={styles.compositeScoreCard}>
              <View style={styles.compositeScoreHeader}>
                <Award size={24} color={getScoreColor(metrics.compositeScore)} />
                <Text style={styles.compositeScoreTitle}>Investment Score</Text>
              </View>
              <Text style={[styles.compositeScoreValue, { color: getScoreColor(metrics.compositeScore) }]}>
                {metrics.compositeScore}
              </Text>
              <Text style={styles.compositeScoreSubtitle}>out of 100</Text>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
          {/* Net Balance */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Target size={16} color={getScoreColor(metrics.netBalance)} />
              <Text style={styles.metricTitle}>Net Balance</Text>
            </View>
            <Text style={[styles.metricValue, { color: getScoreColor(metrics.netBalance) }]}>
              {metrics.netBalance}%
            </Text>
            <Text style={styles.metricDescription}>
              Deposits vs Withdrawals
            </Text>
          </View>

          {/* Consistency */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Calendar size={16} color={getScoreColor(metrics.consistency)} />
              <Text style={styles.metricTitle}>Consistency</Text>
            </View>
            <Text style={[styles.metricValue, { color: getScoreColor(metrics.consistency) }]}>
              {metrics.consistency}%
            </Text>
            <Text style={styles.metricDescription}>
              {metrics.weeklyStreak} week streak
            </Text>
          </View>


          {/* Quality */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <TrendingUp size={16} color={getScoreColor(metrics.quality)} />
              <Text style={styles.metricTitle}>Quality</Text>
            </View>
            <Text style={[styles.metricValue, { color: getScoreColor(metrics.quality) }]}>
              {metrics.quality}%
            </Text>
            <Text style={styles.metricDescription}>
              Priority mix score
            </Text>
          </View>

          {/* Relationship Distribution (if applicable) */}
          {metrics.relationshipDistribution !== null && (
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Users size={16} color={getScoreColor(metrics.relationshipDistribution)} />
                <Text style={styles.metricTitle}>Distribution</Text>
              </View>
              <Text style={[styles.metricValue, { color: getScoreColor(metrics.relationshipDistribution) }]}>
                {metrics.relationshipDistribution}%
              </Text>
              <Text style={styles.metricDescription}>
                KR balance
              </Text>
            </View>
          )}
            </View>

            {/* Quadrant Breakdown */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Priority Quadrants</Text>
              <View style={styles.quadrantGrid}>
                <View style={styles.quadrantItem}>
                  <Text style={styles.quadrantLabel}>Important & Urgent</Text>
                  <Text style={styles.quadrantValue}>{metrics.quadrantBreakdown.q1}%</Text>
                </View>
                <View style={styles.quadrantItem}>
                  <Text style={styles.quadrantLabel}>Important, Not Urgent</Text>
                  <Text style={[styles.quadrantValue, { color: '#16a34a' }]}>{metrics.quadrantBreakdown.q2}%</Text>
                </View>
                <View style={styles.quadrantItem}>
                  <Text style={styles.quadrantLabel}>Urgent, Not Important</Text>
                  <Text style={styles.quadrantValue}>{metrics.quadrantBreakdown.q3}%</Text>
                </View>
                <View style={styles.quadrantItem}>
                  <Text style={styles.quadrantLabel}>Neither</Text>
                  <Text style={styles.quadrantValue}>{metrics.quadrantBreakdown.q4}%</Text>
                </View>
              </View>
            </View>

            {/* KR Distribution (if applicable) */}
            {metrics.krDistribution.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Key Relationship Distribution</Text>
                <View style={styles.krList}>
                  {metrics.krDistribution.map((kr, index) => (
                    <View key={index} style={styles.krItem}>
                      <Text style={styles.krName}>{kr.name}</Text>
                      <View style={styles.krStats}>
                        <Text style={styles.krCount}>{kr.count}</Text>
                        <Text style={styles.krPercentage}>{kr.percentage}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  dateRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeDateRangeButton: {
    backgroundColor: '#0078d4',
  },
  dateRangeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeDateRangeButtonText: {
    color: '#ffffff',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    alignSelf: 'center',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeFilterButton: {
    backgroundColor: '#0078d4',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeFilterButtonText: {
    color: '#ffffff',
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  compositeScoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compositeScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compositeScoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  compositeScoreValue: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  compositeScoreSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricDescription: {
    fontSize: 12,
    color: '#9ca3af',
  },
  breakdownCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  quadrantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quadrantItem: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
  },
  quadrantLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  quadrantValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  krList: {
    gap: 8,
  },
  krItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
  },
  krName: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  krStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  krCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  krPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0078d4',
  },
  gaugeContainer: {
    alignItems: 'center',
  },
  gauge: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  gaugeSegment: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  gaugeSegmentFilled: {
    backgroundColor: '#0078d4',
  },
  gaugeText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  scopedCountText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});