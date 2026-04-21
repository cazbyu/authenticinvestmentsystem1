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
 * PhysicalToolshed — Minimalist Executive design system
 * Physical zone tracker grid: active instances + recency pips +
 * today's values + Add tile + activation/logging modals.
 */

export interface PhysicalToolshedProps {
  domainId: string;
  accentColor?: string;
}

const WELLNESS_ACCENT = '#16a34a';

interface PhysicalInstanceRow extends TrackerInstance {
  session_id: string | null;
  user_id: string;
  library_id: string;
  domain_id: string | null;
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

export function PhysicalToolshed({
  domainId,
  accentColor = WELLNESS_ACCENT,
}: PhysicalToolshedProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [instances, setInstances] = useState<PhysicalInstanceRow[]>([]);
  const [activityMap, setActivityMap] = useState<Map<string, string | null>>(new Map());
  const [todayValueMap, setTodayValueMap] = useState<
    Map<string, number | string | boolean | null>
  >(new Map());
  const [stepIdMap, setStepIdMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  const [showAddTracker, setShowAddTracker] = useState(false);
  const [activeDetailView, setActiveDetailView] = useState<{
    instance: PhysicalInstanceRow;
    stepId: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  const loadInstancesAndSteps = useCallback(async (): Promise<PhysicalInstanceRow[]> => {
    if (!userId) return [];
    try {
      const supabase = getSupabaseClient();

      const { data: instanceRows, error: instanceErr } = await supabase
        .from('v_physical_tracker_instances')
        .select('*')
        .eq('user_id', userId);
      if (instanceErr) throw instanceErr;

      const typed = (instanceRows ?? []) as PhysicalInstanceRow[];
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
      console.error('PhysicalToolshed instances fetch error:', err);
      return [];
    }
  }, [userId]);

  const loadActivity = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('v_physical_tracker_activity')
        .select('instance_id, last_log_date')
        .eq('user_id', userId);
      if (error) throw error;
      const map = new Map<string, string | null>();
      for (const row of data ?? []) {
        if (row.instance_id) {
          map.set(row.instance_id, row.last_log_date ?? null);
        }
      }
      setActivityMap(map);
    } catch (err) {
      console.error('PhysicalToolshed activity fetch error:', err);
    }
  }, [userId]);

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

      const stepToInstance = new Map<string, PhysicalInstanceRow>();
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
      console.error('PhysicalToolshed today-values fetch error:', err);
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
    (instance: PhysicalInstanceRow) => {
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

  if (loading && instances.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
              onPress={() => handleCardPress(instance)}
              accentColor={accentColor}
            />
          );
        })}
        <Pressable
          onPress={() => setShowAddTracker(true)}
          style={styles.addTile}
        >
          <Text style={styles.addTileText}>+ Add a tracker</Text>
        </Pressable>
      </View>

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
});
