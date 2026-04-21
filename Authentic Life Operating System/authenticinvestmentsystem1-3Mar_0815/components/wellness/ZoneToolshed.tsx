import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/dateUtils';
import { TrackerCard, TrackerInstance } from './TrackerCard';
import { AddTrackerModal } from './AddTrackerModal';
import { TrackerDetailView } from './TrackerDetailView';

/**
 * ZoneToolshed — Minimalist Executive design system
 * Zone tracker grid: active instances + recency pips +
 * today's values + Add tile + activation/logging modals.
 */

export interface ZoneToolshedProps {
  domainId: string;
  zoneName: string;
  accentColor?: string;
}

const WELLNESS_ACCENT = '#16a34a';

interface TrackerInstanceRow extends TrackerInstance {
  session_id: string | null;
  user_id: string;
  library_id: string;
  domain_id: string | null;
}

interface InactiveTrackerRow {
  instance_id: string;
  library_id: string;
  name: string;
}

interface StepLogRow {
  exercise_id: string;
  value_number: number | null;
  value_text: string | null;
  value_boolean: boolean | null;
  value_lat: number | null;
  value_lng: number | null;
}

function pickTodayValue(
  log: StepLogRow,
  measurementType: string,
): number | string | boolean | null {
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

export function ZoneToolshed({
  domainId,
  zoneName,
  accentColor = WELLNESS_ACCENT,
}: ZoneToolshedProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [instances, setInstances] = useState<TrackerInstanceRow[]>([]);
  const [activityMap, setActivityMap] = useState<Map<string, string | null>>(new Map());
  const [todayValueMap, setTodayValueMap] = useState<
    Map<string, number | string | boolean | null>
  >(new Map());
  const [stepIdMap, setStepIdMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  const [showAddTracker, setShowAddTracker] = useState(false);
  const [activeDetailView, setActiveDetailView] = useState<{
    instance: TrackerInstanceRow;
    stepId: string;
  } | null>(null);

  const [manageMode, setManageMode] = useState(false);
  const [inactiveRows, setInactiveRows] = useState<InactiveTrackerRow[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  const loadInstancesAndSteps = useCallback(async (): Promise<TrackerInstanceRow[]> => {
    if (!userId) return [];
    try {
      const supabase = getSupabaseClient();

      const { data: instanceRows, error: instanceErr } = await supabase
        .from('v_tracker_instances')
        .select('*')
        .eq('user_id', userId)
        .eq('domain_id', domainId);
      if (instanceErr) throw instanceErr;

      const typed = (instanceRows ?? []) as TrackerInstanceRow[];
      setInstances(typed);

      const sessionIds = typed
        .map(i => i.session_id)
        .filter((v): v is string => !!v);
      if (sessionIds.length > 0) {
        const { data: stepRows, error: stepErr } = await supabase
          .from('0008-ap-gl-session-steps')
          .select('id, milestone_id')
          .in('milestone_id', sessionIds);
        if (stepErr) throw stepErr;

        const map = new Map<string, string>();
        for (const row of stepRows ?? []) {
          if (row.milestone_id && row.id) {
            map.set(row.milestone_id, row.id);
          }
        }
        setStepIdMap(map);
      } else {
        setStepIdMap(new Map());
      }
      return typed;
    } catch (err) {
      console.error('ZoneToolshed instances fetch error:', err);
      return [];
    }
  }, [userId, domainId]);

  const loadActivity = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('v_tracker_activity')
        .select('instance_id, last_log_date')
        .eq('user_id', userId)
        .eq('domain_id', domainId);
      if (error) throw error;
      const map = new Map<string, string | null>();
      for (const row of data ?? []) {
        if (row.instance_id) {
          map.set(row.instance_id, row.last_log_date ?? null);
        }
      }
      setActivityMap(map);
    } catch (err) {
      console.error('ZoneToolshed activity fetch error:', err);
    }
  }, [userId, domainId]);

  const loadTodayValues = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const today = formatLocalDate(new Date());
      const { data, error } = await supabase
        .from('0008-ap-gl-step-log')
        .select('exercise_id, value_number, value_text, value_boolean, value_lat, value_lng')
        .eq('user_id', userId)
        .eq('log_date', today);
      if (error) throw error;

      const stepToInstance = new Map<string, TrackerInstanceRow>();
      for (const instance of instances) {
        if (!instance.session_id) continue;
        const stepId = stepIdMap.get(instance.session_id);
        if (stepId) stepToInstance.set(stepId, instance);
      }

      const map = new Map<string, number | string | boolean | null>();
      for (const log of (data ?? []) as StepLogRow[]) {
        const instance = stepToInstance.get(log.exercise_id);
        if (!instance) continue;
        map.set(instance.instance_id, pickTodayValue(log, instance.measurement_type));
      }
      setTodayValueMap(map);
    } catch (err) {
      console.error('ZoneToolshed today-values fetch error:', err);
    }
  }, [userId, instances, stepIdMap]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadInstancesAndSteps();
      if (cancelled) return;
      await loadActivity();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, loadInstancesAndSteps, loadActivity]);

  useEffect(() => {
    if (!userId || instances.length === 0 || stepIdMap.size === 0) return;
    loadTodayValues();
  }, [userId, instances, stepIdMap, loadTodayValues]);

  const handleCardPress = useCallback(
    (instance: TrackerInstanceRow) => {
      if (instance.is_compound) {
        Alert.alert('Coming soon', 'Compound tracker logging is coming soon.');
        return;
      }
      const stepId = instance.session_id ? stepIdMap.get(instance.session_id) : null;
      if (!stepId) {
        Alert.alert('Error', 'Could not find tracker step. Please refresh.');
        return;
      }
      setActiveDetailView({ instance, stepId });
    },
    [stepIdMap],
  );

  const handleActivated = useCallback(async () => {
    await loadInstancesAndSteps();
    await loadActivity();
  }, [loadInstancesAndSteps, loadActivity]);

  const handleLogSaved = useCallback(async () => {
    const fresh = await loadInstancesAndSteps();
    setActiveDetailView(prev => {
      if (!prev) return prev;
      const updated = fresh.find(i => i.instance_id === prev.instance.instance_id);
      return updated ? { ...prev, instance: updated } : prev;
    });
    await loadActivity();
    await loadTodayValues();
  }, [loadInstancesAndSteps, loadActivity, loadTodayValues]);

  const loadInactiveInstances = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data: rows, error } = await supabase
        .from('0008-ap-tracker-instances')
        .select('id, library_id, activated_at')
        .eq('user_id', userId)
        .eq('domain_id', domainId)
        .eq('is_active', false)
        .order('activated_at', { ascending: false });
      if (error) throw error;

      const libIds = Array.from(
        new Set((rows ?? []).map(r => r.library_id).filter(Boolean)),
      ) as string[];
      const nameById = new Map<string, string>();
      if (libIds.length > 0) {
        const { data: libs, error: libErr } = await supabase
          .from('0008-ap-tracker-library')
          .select('id, name')
          .in('id', libIds);
        if (libErr) throw libErr;
        for (const l of libs ?? []) nameById.set(l.id as string, l.name as string);
      }

      setInactiveRows(
        (rows ?? []).map(r => ({
          instance_id: r.id as string,
          library_id: r.library_id as string,
          name: nameById.get(r.library_id as string) ?? '(Unnamed)',
        })),
      );
    } catch (err) {
      console.error('ZoneToolshed inactive instances fetch error:', err);
    }
  }, [userId, domainId]);

  useEffect(() => {
    if (manageMode) loadInactiveInstances();
  }, [manageMode, loadInactiveInstances]);

  const handleDeactivateTile = useCallback(async (instance: TrackerInstanceRow) => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(
      `Remove ${instance.display_name} from your Toolshed? Your logs will be preserved.`,
    );
    if (!ok) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tracker-instances')
        .update({ is_active: false })
        .eq('id', instance.instance_id);
      if (error) throw error;
      await loadInstancesAndSteps();
      await loadActivity();
      await loadInactiveInstances();
    } catch (err) {
      console.error('ZoneToolshed deactivate error:', err);
    }
  }, [loadInstancesAndSteps, loadActivity, loadInactiveInstances]);

  const handleReactivate = useCallback(async (row: InactiveTrackerRow) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('0008-ap-tracker-instances')
        .update({ is_active: true })
        .eq('id', row.instance_id);
      if (error) throw error;
      await loadInstancesAndSteps();
      await loadActivity();
      await loadInactiveInstances();
    } catch (err) {
      console.error('ZoneToolshed reactivate error:', err);
    }
  }, [loadInstancesAndSteps, loadActivity, loadInactiveInstances]);

  if (loading && instances.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {manageMode
            ? `${zoneName.toUpperCase()} TOOLSHED · MANAGE`
            : `${zoneName.toUpperCase()} TOOLSHED`}
        </Text>
        {manageMode ? (
          <Pressable
            onPress={() => setManageMode(false)}
            style={[styles.doneButton, { backgroundColor: accentColor }]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setManageMode(true)} hitSlop={6}>
            <Text style={[styles.manageLink, { color: accentColor }]}>
              Manage tools
            </Text>
          </Pressable>
        )}
      </View>

      {manageMode && (
        <View style={[styles.banner, { borderLeftColor: accentColor }]}>
          <Text style={styles.bannerText}>
            Deactivate tools you're not using. Your history stays safe — you can add them back anytime.
          </Text>
        </View>
      )}

      <View style={styles.grid}>
        {instances.map(instance => {
          const lastLog = activityMap.get(instance.instance_id) ?? null;
          const todayVal = todayValueMap.get(instance.instance_id);
          return (
            <TrackerCard
              key={instance.instance_id}
              instance={instance}
              todayValue={todayVal}
              lastLogDate={lastLog}
              onPress={
                manageMode ? () => {} : () => handleCardPress(instance)
              }
              accentColor={accentColor}
              overlay={
                manageMode ? (
                  <Pressable
                    onPress={() => handleDeactivateTile(instance)}
                    style={styles.manageBadge}
                    hitSlop={6}
                  >
                    <Text style={styles.manageBadgeText}>×</Text>
                  </Pressable>
                ) : null
              }
            />
          );
        })}
        {!manageMode && (
          <Pressable
            onPress={() => setShowAddTracker(true)}
            style={styles.addTile}
          >
            <Text style={styles.addTileText}>+ Add a tracker</Text>
          </Pressable>
        )}
      </View>

      {manageMode && inactiveRows.length > 0 && (
        <View style={styles.inactiveSection}>
          <Text style={styles.inactiveSectionHeader}>INACTIVE</Text>
          {inactiveRows.map(row => (
            <View key={row.instance_id} style={styles.inactiveRow}>
              <Text style={styles.inactiveRowName}>{row.name}</Text>
              <Pressable onPress={() => handleReactivate(row)} hitSlop={6}>
                <Text style={[styles.reactivateLink, { color: accentColor }]}>
                  + Reactivate
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <AddTrackerModal
        visible={showAddTracker}
        onClose={() => setShowAddTracker(false)}
        domainId={domainId}
        userId={userId ?? ''}
        onActivated={handleActivated}
        accentColor={accentColor}
      />

      {activeDetailView && userId && (
        <TrackerDetailView
          visible={!!activeDetailView}
          onClose={() => setActiveDetailView(null)}
          instance={activeDetailView.instance}
          stepId={activeDetailView.stepId}
          userId={userId}
          defaultDomainId={domainId}
          onLogSaved={handleLogSaved}
          accentColor={accentColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  addTile: {
    width: '31.5%',
    height: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  addTileText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  manageLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  doneButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  banner: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderLeftWidth: 3,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  manageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  manageBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  inactiveSection: {
    marginTop: 24,
    gap: 8,
  },
  inactiveSectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    opacity: 0.55,
  },
  inactiveRowName: {
    fontSize: 13,
    color: '#1f2937',
    flex: 1,
  },
  reactivateLink: {
    fontSize: 13,
    fontWeight: '500',
  },
});
