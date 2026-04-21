import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X } from 'lucide-react-native';

import { getSupabaseClient } from '@/lib/supabase';
import { TrackerInstance } from './TrackerCard';

/**
 * SetGoalModal — Minimalist Executive design system
 * Edit custom_goal_value (and custom_goal_value_max for target_range)
 * on a tracker instance. Writes to 0008-ap-tracker-instances.
 */

export interface SetGoalModalProps {
  visible: boolean;
  onClose: () => void;
  instance: TrackerInstance & { session_id: string | null };
  onSaved: () => void;
  accentColor?: string;
}

const DEFAULT_ACCENT = '#16a34a';

function splitDuration(
  seconds: number | null | undefined,
): { minutes: string; secs: string } {
  if (seconds === null || seconds === undefined) return { minutes: '', secs: '' };
  const s = Math.max(0, Math.round(seconds));
  return {
    minutes: String(Math.floor(s / 60)),
    secs: String(s % 60),
  };
}

export function SetGoalModal({
  visible,
  onClose,
  instance,
  onSaved,
  accentColor = DEFAULT_ACCENT,
}: SetGoalModalProps) {
  const isDuration = instance.measurement_type === 'duration';
  const isRange = instance.goal_direction === 'target_range';

  const [valueText, setValueText] = useState('');
  const [valueMaxText, setValueMaxText] = useState('');
  const [minutes, setMinutes] = useState('');
  const [secs, setSecs] = useState('');
  const [minutesMax, setMinutesMax] = useState('');
  const [secsMax, setSecsMax] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (isDuration) {
      const { minutes: m, secs: s } = splitDuration(instance.goal_value);
      setMinutes(m);
      setSecs(s);
      if (isRange) {
        const { minutes: mMax, secs: sMax } = splitDuration(instance.goal_value_max);
        setMinutesMax(mMax);
        setSecsMax(sMax);
      }
    } else {
      setValueText(
        instance.goal_value !== null && instance.goal_value !== undefined
          ? String(instance.goal_value)
          : '',
      );
      if (isRange) {
        setValueMaxText(
          instance.goal_value_max !== null && instance.goal_value_max !== undefined
            ? String(instance.goal_value_max)
            : '',
        );
      }
    }
  }, [visible, instance, isDuration, isRange]);

  const handleSave = useCallback(async () => {
    let goalValue: number | null = null;
    let goalValueMax: number | null = null;

    if (isDuration) {
      const m = Number(minutes || 0);
      const s = Number(secs || 0);
      if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) {
        Alert.alert('Invalid value', 'Minutes and seconds must be non-negative.');
        return;
      }
      goalValue = m * 60 + s;
      if (goalValue <= 0) {
        Alert.alert('Invalid value', 'Goal must be greater than zero.');
        return;
      }
      if (isRange) {
        const mMax = Number(minutesMax || 0);
        const sMax = Number(secsMax || 0);
        if (!Number.isFinite(mMax) || !Number.isFinite(sMax) || mMax < 0 || sMax < 0) {
          Alert.alert('Invalid value', 'Max minutes and seconds must be non-negative.');
          return;
        }
        goalValueMax = mMax * 60 + sMax;
        if (goalValueMax <= goalValue) {
          Alert.alert('Invalid range', 'Max must be greater than min.');
          return;
        }
      }
    } else {
      const v = Number(valueText);
      if (!Number.isFinite(v) || v <= 0) {
        Alert.alert('Invalid value', 'Goal must be a positive number.');
        return;
      }
      goalValue = v;
      if (isRange) {
        const vMax = Number(valueMaxText);
        if (!Number.isFinite(vMax) || vMax <= 0) {
          Alert.alert('Invalid value', 'Max must be a positive number.');
          return;
        }
        if (vMax <= v) {
          Alert.alert('Invalid range', 'Max must be greater than min.');
          return;
        }
        goalValueMax = vMax;
      }
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const payload: Record<string, number | null> = {
        custom_goal_value: goalValue,
      };
      if (isRange) payload.custom_goal_value_max = goalValueMax;

      const { error } = await supabase
        .from('0008-ap-tracker-instances')
        .update(payload)
        .eq('id', instance.instance_id);
      if (error) throw error;

      onSaved();
      onClose();
    } catch (err) {
      console.error('SetGoalModal save error:', err);
      Alert.alert('Error', 'Could not save goal. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    isDuration,
    isRange,
    minutes,
    secs,
    minutesMax,
    secsMax,
    valueText,
    valueMaxText,
    instance.instance_id,
    onSaved,
    onClose,
  ]);

  const unitSuffix = instance.unit_label ?? '';

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit goal</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.trackerName}>{instance.display_name}</Text>
          {instance.goal_helper_text ? (
            <Text style={styles.helper}>{instance.goal_helper_text}</Text>
          ) : null}

          {isDuration ? (
            <>
              <Text style={styles.fieldLabel}>
                {isRange ? 'Minimum duration' : 'Goal duration'}
              </Text>
              <View style={styles.durationRow}>
                <View style={styles.durationField}>
                  <TextInput
                    style={styles.input}
                    value={minutes}
                    onChangeText={setMinutes}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.durationLabel}>min</Text>
                </View>
                <View style={styles.durationField}>
                  <TextInput
                    style={styles.input}
                    value={secs}
                    onChangeText={setSecs}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                  />
                  <Text style={styles.durationLabel}>sec</Text>
                </View>
              </View>
              {isRange && (
                <>
                  <Text style={styles.fieldLabel}>Maximum duration</Text>
                  <View style={styles.durationRow}>
                    <View style={styles.durationField}>
                      <TextInput
                        style={styles.input}
                        value={minutesMax}
                        onChangeText={setMinutesMax}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9ca3af"
                      />
                      <Text style={styles.durationLabel}>min</Text>
                    </View>
                    <View style={styles.durationField}>
                      <TextInput
                        style={styles.input}
                        value={secsMax}
                        onChangeText={setSecsMax}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9ca3af"
                      />
                      <Text style={styles.durationLabel}>sec</Text>
                    </View>
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>
                {isRange ? 'Minimum value' : 'Goal value'}
              </Text>
              <View style={styles.valueRow}>
                <TextInput
                  style={[styles.input, styles.valueInput]}
                  value={valueText}
                  onChangeText={setValueText}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                />
                {unitSuffix ? (
                  <Text style={styles.unitSuffix}>{unitSuffix}</Text>
                ) : null}
              </View>
              {isRange && (
                <>
                  <Text style={styles.fieldLabel}>Maximum value</Text>
                  <View style={styles.valueRow}>
                    <TextInput
                      style={[styles.input, styles.valueInput]}
                      value={valueMaxText}
                      onChangeText={setValueMaxText}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                    />
                    {unitSuffix ? (
                      <Text style={styles.unitSuffix}>{unitSuffix}</Text>
                    ) : null}
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={[styles.footerBtn, styles.footerBtnSecondary]}
            disabled={saving}
          >
            <Text style={styles.footerBtnSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.footerBtn,
              { backgroundColor: accentColor, opacity: saving ? 0.6 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.footerBtnPrimaryText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  body: { flex: 1, padding: 16, gap: 12 },
  trackerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e3a5f',
  },
  helper: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#6b7280',
    marginTop: 8,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueInput: { flex: 1 },
  unitSuffix: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnSecondary: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  footerBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  footerBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
