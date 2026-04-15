// components/goals/MilestoneExercisePanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { X, Plus, Trash2, Dumbbell, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getExercisesForMilestone,
  getExerciseLogsForDate,
  saveExerciseLogs,
  MilestoneExercise,
  DayExerciseLog,
  ExerciseSet,
} from '@/services/milestoneService';

interface MilestoneExercisePanelProps {
  milestoneId: string;
  taskId: string;
  milestoneName: string;
  selectedDate: string;
  selectedDayLabel: string;
  completionRule: { type: string; required?: number; of?: number };
  onClose: () => void;
  onSaved: (completed: boolean) => void;
}

// Local state for one exercise's editable sets
interface ExerciseEditState {
  exercise: MilestoneExercise;
  expanded: boolean;
  sets: EditableSet[];
}

interface EditableSet {
  set_number: number;
  reps: string;   // string for TextInput binding
  weight: string;  // string for TextInput binding
  notes: string;
}

export default function MilestoneExercisePanel({
  milestoneId,
  taskId,
  milestoneName,
  selectedDate,
  selectedDayLabel,
  completionRule,
  onClose,
  onSaved,
}: MilestoneExercisePanelProps) {
  const [exercises, setExercises] = useState<MilestoneExercise[]>([]);
  const [editStates, setEditStates] = useState<ExerciseEditState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  // Load exercises and any existing logs for this date
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [exList, existingLogs] = await Promise.all([
          getExercisesForMilestone(milestoneId),
          getExerciseLogsForDate(milestoneId, selectedDate),
        ]);

        if (cancelled) return;
        setExercises(exList);

        // Build edit states — pre-populate from existing logs if present
        const states: ExerciseEditState[] = exList.map(ex => {
          const existingLog = existingLogs.find(l => l.exercise_id === ex.exercise_id);
          const sets: EditableSet[] = existingLog
            ? existingLog.sets.map(s => ({
                set_number: s.set_number,
                reps: s.reps_completed?.toString() ?? '',
                weight: s.value?.toString() ?? '',
                notes: s.notes ?? '',
              }))
            : (ex.target_sets && ex.target_sets > 0)
              ? Array.from({ length: ex.target_sets }, (_, i) => ({
                  set_number: i + 1,
                  reps: ex.target_reps?.toString() ?? '',
                  weight: ex.target_value?.toString() ?? '',
                  notes: '',
                }))
              : [];

          return {
            exercise: ex,
            expanded: sets.length > 0 || (existingLog != null),
            sets,
          };
        });

        setEditStates(states);
        states.forEach(s => console.log('[MilestoneExercisePanel] exercise:', s.exercise.exercise_name, 'target_sets:', s.exercise.target_sets));
      } catch (err) {
        console.error('[MilestoneExercisePanel] Load error:', err);
        Alert.alert('Error', 'Failed to load exercises.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [milestoneId, selectedDate]);

  const toggleExercise = useCallback((exerciseId: string) => {
    setEditStates(prev => prev.map(es => {
      if (es.exercise.exercise_id !== exerciseId) return es;

      if (!es.expanded && es.sets.length === 0) {
        // Expand and add Set 1
        return {
          ...es,
          expanded: true,
          sets: [{ set_number: 1, reps: '', weight: '', notes: '' }],
        };
      }
      return { ...es, expanded: !es.expanded };
    }));
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setEditStates(prev => prev.map(es => {
      if (es.exercise.exercise_id !== exerciseId) return es;
      const nextNum = es.sets.length > 0
        ? Math.max(...es.sets.map(s => s.set_number)) + 1
        : 1;
      return {
        ...es,
        sets: [...es.sets, { set_number: nextNum, reps: '', weight: '', notes: '' }],
      };
    }));
  }, []);

  const removeSet = useCallback((exerciseId: string, setNumber: number) => {
    setEditStates(prev => prev.map(es => {
      if (es.exercise.exercise_id !== exerciseId) return es;
      const newSets = es.sets
        .filter(s => s.set_number !== setNumber)
        .map((s, i) => ({ ...s, set_number: i + 1 })); // renumber
      return { ...es, sets: newSets };
    }));
  }, []);

  const updateSet = useCallback((
    exerciseId: string,
    setNumber: number,
    field: 'reps' | 'weight' | 'notes',
    value: string
  ) => {
    setEditStates(prev => prev.map(es => {
      if (es.exercise.exercise_id !== exerciseId) return es;
      return {
        ...es,
        sets: es.sets.map(s =>
          s.set_number === setNumber ? { ...s, [field]: value } : s
        ),
      };
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Convert edit states to DayExerciseLog[]
      const logs: DayExerciseLog[] = editStates
        .filter(es => es.sets.length > 0)
        .map(es => ({
          exercise_id: es.exercise.exercise_id,
          sets: es.sets
            .filter(s => s.reps !== '' || s.weight !== '') // skip completely empty sets
            .map(s => ({
              set_number: s.set_number,
              reps_completed: s.reps !== '' ? parseInt(s.reps, 10) || null : null,
              value: s.weight !== '' ? parseFloat(s.weight) || null : null,
              unit: es.exercise.unit ?? null,
              notes: s.notes || null,
            } as ExerciseSet)),
        }))
        .filter(log => log.sets.length > 0); // only exercises with actual data

      const { completed } = await saveExerciseLogs(
        userId,
        milestoneId,
        taskId,
        selectedDate,
        logs,
        completionRule,
        exercises.length,
      );

      onSaved(completed);
    } catch (err) {
      console.error('[MilestoneExercisePanel] Save error:', err);
      Alert.alert('Error', 'Failed to save exercise logs.');
    } finally {
      setSaving(false);
    }
  }, [editStates, userId, milestoneId, taskId, selectedDate, completionRule, exercises.length, onSaved]);

  const exercisesWithData = editStates.filter(
    es => es.sets.some(s => s.reps !== '' || s.weight !== '')
  ).length;

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleSection}>
            <View style={styles.headerTitleRow}>
              <Dumbbell size={16} color="#6366f1" />
              <Text style={styles.headerTitle} numberOfLines={1}>{milestoneName}</Text>
            </View>
            <Text style={styles.headerDate}>{selectedDayLabel} — {selectedDate}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#6b7280" />
            <Text style={styles.loadingText}>Loading exercises...</Text>
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Dumbbell size={32} color="#d1d5db" />
            <Text style={styles.emptyText}>No exercises added to this session yet.</Text>
            <Text style={styles.emptySubtext}>No exercises have been added to this session.</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Summary badge */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {exercisesWithData} of {exercises.length} exercises logged
              </Text>
            </View>

            {/* Exercise list */}
            {editStates.map(es => (
              <View key={es.exercise.exercise_id} style={styles.exerciseCard}>
                {/* Exercise header — tap to expand/collapse */}
                <TouchableOpacity
                  style={styles.exerciseHeader}
                  onPress={() => toggleExercise(es.exercise.exercise_id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{es.exercise.exercise_name}</Text>
                    {es.exercise.muscle_group && (
                      <Text style={styles.muscleGroup}>{es.exercise.muscle_group}</Text>
                    )}
                  </View>
                  {es.exercise.target_sets && es.exercise.target_reps && (
                    <Text style={styles.targetLabel}>
                      {es.exercise.target_sets}×{es.exercise.target_reps}
                    </Text>
                  )}
                  {es.expanded ? (
                    <ChevronUp size={16} color="#9ca3af" />
                  ) : (
                    <ChevronDown size={16} color="#9ca3af" />
                  )}
                </TouchableOpacity>

                {/* Sets — shown when expanded (only for exercises with target_sets) */}
                {es.expanded && (es.exercise.target_sets ?? 0) > 0 && (
                  <View style={styles.setsContainer}>
                    {es.sets.map(set => (
                      <View key={set.set_number} style={styles.setRow}>
                        <Text style={styles.setLabel}>Set {set.set_number}</Text>
                        <View style={styles.inputGroup}>
                          <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>WEIGHT</Text>
                            <TextInput
                              style={styles.input}
                              value={set.weight}
                              onChangeText={v => updateSet(es.exercise.exercise_id, set.set_number, 'weight', v)}
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor="#d1d5db"
                            />
                          </View>
                          <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>REPS</Text>
                            <TextInput
                              style={styles.input}
                              value={set.reps}
                              onChangeText={v => updateSet(es.exercise.exercise_id, set.set_number, 'reps', v)}
                              keyboardType="number-pad"
                              placeholder="—"
                              placeholderTextColor="#d1d5db"
                            />
                          </View>
                        </View>
                        <View style={styles.setRowActions}>
                          <TouchableOpacity
                            style={styles.setCheckIndicator}
                            activeOpacity={0.7}
                            onPress={() => {
                              const hasData = set.reps !== '' || set.weight !== '';
                              if (hasData) {
                                updateSet(es.exercise.exercise_id, set.set_number, 'reps', '');
                                updateSet(es.exercise.exercise_id, set.set_number, 'weight', '');
                              } else {
                                updateSet(es.exercise.exercise_id, set.set_number, 'reps',
                                  es.exercise.target_reps?.toString() ?? '1');
                              }
                            }}
                          >
                            {(set.reps !== '' || set.weight !== '') ? (
                              <View style={styles.checkboxFilled}>
                                <Check size={12} color="#ffffff" />
                              </View>
                            ) : (
                              <View style={styles.checkboxEmpty} />
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.removeSetButton}
                            onPress={() => removeSet(es.exercise.exercise_id, set.set_number)}
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={styles.addSetButton}
                      onPress={() => addSet(es.exercise.exercise_id)}
                    >
                      <Plus size={14} color="#6366f1" />
                      <Text style={styles.addSetText}>Add Set</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* No-sets exercise — single completion row */}
                {es.expanded && !(es.exercise.target_sets ?? 0) && (
                  <View style={styles.setsContainer}>
                    <TouchableOpacity
                      style={styles.noSetsRow}
                      onPress={() => {
                        const hasData = es.sets.length > 0 && (es.sets[0].reps !== '' || es.sets[0].weight !== '');
                        if (hasData) {
                          setEditStates(prev => prev.map(s =>
                            s.exercise.exercise_id === es.exercise.exercise_id
                              ? { ...s, sets: [] }
                              : s
                          ));
                        } else {
                          setEditStates(prev => prev.map(s =>
                            s.exercise.exercise_id === es.exercise.exercise_id
                              ? { ...s, sets: [{ set_number: 1, reps: '1', weight: '', notes: '' }] }
                              : s
                          ));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.noSetsLabel}>Mark complete</Text>
                      <View style={es.sets.length > 0 && (es.sets[0]?.reps !== '' || es.sets[0]?.weight !== '') ? styles.checkboxFilled : styles.checkboxEmpty}>
                        {es.sets.length > 0 && (es.sets[0]?.reps !== '' || es.sets[0]?.weight !== '') && (
                          <Check size={12} color="#ffffff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {/* Bottom spacer for keyboard */}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Done button — always visible */}
        {!loading && exercises.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.doneButton, saving && styles.doneButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.doneButtonText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  headerDate: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  exerciseCheckbox: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  muscleGroup: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  setsContainer: {
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    width: 40,
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  setRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setCheckIndicator: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeSetButton: {
    padding: 6,
  },
  noSetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  noSetsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  doneButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
