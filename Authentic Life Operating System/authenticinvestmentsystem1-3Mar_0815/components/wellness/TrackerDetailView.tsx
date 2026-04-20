import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Plus } from 'lucide-react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';
import { formatTrackerValue, TrackerInstance } from './TrackerCard';
import { LogEntryForm } from './LogEntryForm';
import { TrendLineChart } from './TrendLineChart';

/**
 * TrackerDetailView — Minimalist Executive design system
 * Full-page detail view for a single tracker instance.
 * Shows: + Log New Entry CTA, time-window selector, trend chart
 * (numeric types only), stats strip, recent entries list.
 */

export interface TrackerDetailViewProps {
  visible: boolean;
  onClose: () => void;
  instance: TrackerInstance & { session_id: string | null };
  stepId: string;
  userId: string;
  defaultDomainId: string | null;
  onLogSaved?: () => void;
  accentColor?: string;
}

const WELLNESS_ACCENT = '#16a34a';

type TimeWindow = '7d' | '30d' | '90d' | 'all';

interface StepLogRow {
  id: string;
  log_date: string;
  value_number: number | null;
  value_text: string | null;
  value_boolean: boolean | null;
  value_lat: number | null;
  value_lng: number | null;
  notes: string | null;
  created_at: string;
}

const NUMERIC_TYPES = new Set([
  'number',
  'hours',
  'duration',
  'currency',
  'percentage',
  'rating',
  'distance',
]);

function computeCutoffISO(window: TimeWindow): string | null {
  if (window === 'all') return null;
  const days = window === '7d' ? 7 : window === '30d' ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return formatLocalDate(cutoff);
}

function pickLogValue(log: StepLogRow, measurementType: string): number | string | boolean | null {
  switch (measurementType) {
    case 'boolean':
      return log.value_boolean;
    case 'text':
    case 'time_of_day':
      return log.value_text;
    case 'coordinates':
      return log.value_lat ?? null;
    default:
      return log.value_number;
  }
}

function formatShortDate(iso: string): string {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrackerDetailView({
  visible,
  onClose,
  instance,
  stepId,
  userId,
  defaultDomainId,
  onLogSaved,
  accentColor = WELLNESS_ACCENT,
}: TrackerDetailViewProps) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30d');
  const [logs, setLogs] = useState<StepLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLogEntry, setShowLogEntry] = useState(false);

  const isNumeric = NUMERIC_TYPES.has(instance.measurement_type);

  const fetchLogs = useCallback(async () => {
    if (!userId || !stepId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const cutoff = computeCutoffISO(timeWindow);
      let query = supabase
        .from('0008-ap-gl-step-log')
        .select('id, log_date, value_number, value_text, value_boolean, value_lat, value_lng, notes, created_at')
        .eq('user_id', userId)
        .eq('exercise_id', stepId)
        .order('log_date', { ascending: true });
      if (cutoff) query = query.gte('log_date', cutoff);
      const { data, error } = await query;
      if (error) throw error;
      setLogs((data ?? []) as StepLogRow[]);
    } catch (err) {
      console.error('TrackerDetailView fetchLogs error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, stepId, timeWindow]);

  useEffect(() => {
    if (visible) setShowLogEntry(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    fetchLogs();
  }, [visible, fetchLogs]);

  const chartData = useMemo(() => {
    if (!isNumeric) return [];
    const numericLogs = logs.filter(
      l => l.value_number !== null && l.value_number !== undefined,
    );

    if (instance.allow_multiple_logs_per_day) {
      // Cumulative: group by log_date, sum value_number per day
      const byDay = new Map<string, number>();
      for (const l of numericLogs) {
        byDay.set(
          l.log_date,
          (byDay.get(l.log_date) ?? 0) + (l.value_number as number),
        );
      }
      return Array.from(byDay.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Snapshot: one chart point per log
    return numericLogs.map(l => ({
      date: l.log_date,
      value: l.value_number as number,
    }));
  }, [logs, isNumeric, instance.allow_multiple_logs_per_day]);

  const stats = useMemo(() => {
    if (logs.length === 0) return null;
    if (isNumeric) {
      const values = logs
        .map(l => l.value_number)
        .filter((v): v is number => v !== null && v !== undefined);
      if (values.length === 0) return null;

      if (instance.allow_multiple_logs_per_day) {
        // Cumulative: stats over daily totals
        const byDay = new Map<string, number>();
        for (const l of logs) {
          if (l.value_number === null || l.value_number === undefined) continue;
          byDay.set(
            l.log_date,
            (byDay.get(l.log_date) ?? 0) + (l.value_number as number),
          );
        }
        const dailyTotals = Array.from(byDay.values());
        if (dailyTotals.length === 0) return null;
        const sum = dailyTotals.reduce((a, b) => a + b, 0);
        return {
          kind: 'numeric' as const,
          avg: Math.round((sum / dailyTotals.length) * 10) / 10,
          min: Math.min(...dailyTotals),
          max: Math.max(...dailyTotals),
          count: dailyTotals.length,
        };
      }

      // Snapshot: stats over individual logs
      const sum = values.reduce((a, b) => a + b, 0);
      return {
        kind: 'numeric' as const,
        avg: Math.round((sum / values.length) * 10) / 10,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
    if (instance.measurement_type === 'boolean') {
      let yes = 0;
      let no = 0;
      for (const l of logs) {
        if (l.value_boolean === true) yes += 1;
        else if (l.value_boolean === false) no += 1;
      }
      return { kind: 'boolean' as const, yes, no, count: yes + no };
    }
    return { kind: 'count' as const, count: logs.length };
  }, [logs, isNumeric, instance.measurement_type, instance.allow_multiple_logs_per_day]);

  const entriesDesc = useMemo(() => [...logs].reverse(), [logs]);

  const handleLogSaved = useCallback(async () => {
    await fetchLogs();
    onLogSaved?.();
  }, [fetchLogs, onLogSaved]);

  const formatValueForDisplay = (val: number | string | boolean | null) =>
    formatTrackerValue(
      val,
      instance.measurement_type,
      instance.unit_label,
      instance.currency_code,
      instance.goal_value,
    );

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {instance.display_name}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Pressable
            onPress={() => setShowLogEntry(true)}
            style={[styles.logCta, { backgroundColor: accentColor }]}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.logCtaText}>Log New Entry</Text>
          </Pressable>

          <View style={styles.windowRow}>
            {(['7d', '30d', '90d', 'all'] as TimeWindow[]).map(w => {
              const active = timeWindow === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => setTimeWindow(w)}
                  style={[
                    styles.windowPill,
                    active && { borderColor: accentColor, borderWidth: 1.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.windowPillText,
                      active && { color: accentColor, fontWeight: '600' },
                    ]}
                  >
                    {w === '7d' ? '7 days' : w === '30d' ? '30 days' : w === '90d' ? '90 days' : 'All'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={accentColor} />
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No logs yet. Tap + Log New Entry to start.
              </Text>
            </View>
          ) : (
            <>
              {isNumeric ? (
                <TrendLineChart
                  data={chartData}
                  accentColor={accentColor}
                  goalValue={instance.goal_value}
                  goalValueMax={instance.goal_value_max}
                  height={220}
                />
              ) : (
                <View style={styles.noChartWrap}>
                  <Text style={styles.noChartText}>
                    Trend chart not available for this tracker type
                  </Text>
                </View>
              )}

              {stats && (
                <View style={styles.statsRow}>
                  {stats.kind === 'numeric' && (
                    <>
                      <StatTile
                        label="AVG"
                        valueText={formatValueForDisplay(
                          instance.measurement_type === 'rating'
                            ? Number(stats.avg.toFixed(1))
                            : stats.avg,
                        )}
                      />
                      <StatTile label="MIN" valueText={formatValueForDisplay(stats.min)} />
                      <StatTile label="MAX" valueText={formatValueForDisplay(stats.max)} />
                      <StatTile
                        label={instance.allow_multiple_logs_per_day ? 'DAYS' : 'COUNT'}
                        valueText={String(stats.count)}
                      />
                    </>
                  )}
                  {stats.kind === 'boolean' && (
                    <>
                      <StatTile label="YES" valueText={String(stats.yes)} />
                      <StatTile label="NO" valueText={String(stats.no)} />
                      <StatTile label="—" valueText="—" />
                      <StatTile label="TOTAL" valueText={String(stats.count)} />
                    </>
                  )}
                  {stats.kind === 'count' && (
                    <StatTile label="ENTRIES" valueText={String(stats.count)} wide />
                  )}
                </View>
              )}

              <View style={styles.entriesSection}>
                <Text style={styles.entriesHeader}>
                  RECENT ENTRIES ({logs.length})
                </Text>
                <View style={styles.entriesList}>
                  {entriesDesc.map((log, idx) => {
                    const pickedValue = pickLogValue(log, instance.measurement_type);
                    const valueText =
                      pickedValue === null || pickedValue === undefined
                        ? '—'
                        : formatValueForDisplay(pickedValue as any);
                    return (
                      <View key={log.id}>
                        <View style={styles.entryRow}>
                          <Text style={styles.entryDate}>{formatShortDate(log.log_date)}</Text>
                          <Text style={styles.entryValue} numberOfLines={1}>
                            {valueText}
                          </Text>
                          {log.notes ? (
                            <Text style={styles.entryNote} numberOfLines={1}>
                              {log.notes}
                            </Text>
                          ) : (
                            <Text style={styles.entryNote} />
                          )}
                        </View>
                        {idx < entriesDesc.length - 1 && <View style={styles.divider} />}
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.viewOnlyFootnote}>(view only)</Text>
              </View>
            </>
          )}
        </ScrollView>

        <LogEntryForm
          visible={showLogEntry}
          onClose={() => setShowLogEntry(false)}
          instance={instance}
          sessionId={instance.session_id}
          stepId={stepId}
          userId={userId}
          defaultDomainId={defaultDomainId}
          onSaved={handleLogSaved}
        />
      </View>
    </Modal>
  );
}

function StatTile({
  label,
  valueText,
  wide,
}: {
  label: string;
  valueText: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.statTile, wide && { flex: 4 }]}>
      <Text style={styles.statValue} numberOfLines={1}>
        {valueText}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    flex: 1,
    marginRight: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16 },

  logCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  logCtaText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  windowRow: { flexDirection: 'row', gap: 6 },
  windowPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  windowPillText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },

  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  emptyWrap: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#6b7280', fontStyle: 'italic' },
  noChartWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  noChartText: { fontSize: 12, color: '#6b7280', fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', gap: 6 },
  statTile: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1e3a5f' },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#6b7280',
  },

  entriesSection: { gap: 8 },
  entriesHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#6b7280',
  },
  entriesList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  entryDate: { width: 54, fontSize: 12, color: '#6b7280', fontWeight: '500' },
  entryValue: { width: 90, fontSize: 13, fontWeight: '600', color: '#1e3a5f' },
  entryNote: { flex: 1, fontSize: 12, color: '#6b7280' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
  viewOnlyFootnote: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
