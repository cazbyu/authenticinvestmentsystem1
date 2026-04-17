// components/goals/CreateMilestoneModal.tsx
// ────────────────────────────────────────────────────────────────
// DEPRECATED 2026-04-17 — Scheduled for removal in Phase B4.
//
// This component is a legacy surface from before the unified
// "Add Action" flow was designed. In the Phase B4 design, session
// creation happens inline within the standard action-creation form,
// not as a separate modal. The "Add Session" button that opens this
// modal is currently hidden/disabled in production.
//
// Do not extend this component. Do not rename it. Its naming
// mismatch with the Phase B session rename (B1/B2) is intentional
// technical debt documented during B2.5.
// ────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Timeline, TwelveWeekGoal } from '@/hooks/useGoals';
import { getSupabaseClient } from '@/lib/supabase';
import { createMilestone, addExerciseToMilestone } from '@/services/milestoneService';
import { ExerciseFormRow, ExerciseFormData } from './ExerciseFormRow';

interface CreateMilestoneModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (milestoneId: string) => void;
  goal: TwelveWeekGoal;
  timeline: Timeline;
  currentWeekNumber: number;
}

const TOTAL_WEEKS = 12;

const CreateMilestoneModal: React.FC<CreateMilestoneModalProps> = ({
  visible,
  onClose,
  onCreated,
  goal,
  timeline,
  currentWeekNumber,
}) => {
  // ── Form state ──
  const [sessionName, setSessionName] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<string>('3days');
  const [selectedCustomDays, setSelectedCustomDays] = useState<number[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>(() => {
    // Default: currentWeekNumber through 12
    const weeks: number[] = [];
    for (let w = currentWeekNumber; w <= TOTAL_WEEKS; w++) weeks.push(w);
    return weeks;
  });
  const [completionRule, setCompletionRule] = useState<'all' | 'threshold'>('all');
  const [completionThreshold, setCompletionThreshold] = useState<number>(1);
  const [exercises, setExercises] = useState<ExerciseFormData[]>([]);
  const [saving, setSaving] = useState(false);
  const [exercisesExpanded, setExercisesExpanded] = useState(true);

  // ── Reset form when modal opens ──
  const resetForm = useCallback(() => {
    setSessionName('');
    setRecurrenceType('3days');
    setSelectedCustomDays([]);
    const weeks: number[] = [];
    for (let w = currentWeekNumber; w <= TOTAL_WEEKS; w++) weeks.push(w);
    setSelectedWeeks(weeks);
    setCompletionRule('all');
    setCompletionThreshold(1);
    setExercises([]);
    setSaving(false);
    setExercisesExpanded(true);
  }, [currentWeekNumber]);

  // ── Recurrence logic — copied exactly from ActionEffortModal ──
  const getTargetDays = () => {
    if (recurrenceType === 'custom') {
      return selectedCustomDays.length;
    }
    return recurrenceType === 'daily' ? 7 : parseInt(recurrenceType.replace('days', '').replace('day', ''));
  };

  const generateRecurrenceRule = () => {
    // ONLY use BYDAY when user explicitly selects "Custom" and picks specific days
    if (recurrenceType === 'custom' && selectedCustomDays.length > 0) {
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const byDays = selectedCustomDays.map(dayIndex => dayNames[dayIndex]).join(',');
      return `RRULE:FREQ=WEEKLY;BYDAY=${byDays}`;
    }

    // For "daily" (7 days), use FREQ=DAILY
    if (recurrenceType === 'daily') {
      return 'RRULE:FREQ=DAILY';
    }

    // For preset frequencies (1-6 days), use FREQ=WEEKLY WITHOUT BYDAY
    // The target_days in week_plan table controls the count
    return 'RRULE:FREQ=WEEKLY';
  };

  const getRecurrenceLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case '6days': return '6 days';
      case '5days': return '5 days';
      case '4days': return '4 days';
      case '3days': return '3 days';
      case '2days': return '2 days';
      case '1day': return '1 day';
      case 'custom': return 'Custom';
      default: return 'Custom';
    }
  };

  // ── Handlers ──
  const handleRecurrenceSelect = (type: string) => {
    setRecurrenceType(type);
    if (type !== 'custom') {
      setSelectedCustomDays([]);
    }
  };

  const handleCustomDayToggle = (dayIndex: number) => {
    setSelectedCustomDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleWeekToggle = (weekNumber: number) => {
    setSelectedWeeks(prev =>
      prev.includes(weekNumber)
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber]
    );
  };

  const handleSelectAllWeeks = () => {
    const allWeeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
    if (selectedWeeks.length === TOTAL_WEEKS) {
      setSelectedWeeks([]);
    } else {
      setSelectedWeeks(allWeeks);
    }
  };

  // ── Exercise handlers ──
  const handleAddExercise = () => {
    setExercises(prev => [
      ...prev,
      {
        name: '',
        muscle_group: '',
        exercise_type: 'reps',
        target_sets: null,
        target_reps: null,
        target_value: null,
        unit: null,
        sort_order: prev.length,
      },
    ]);
  };

  const handleExerciseChange = useCallback((index: number, updated: ExerciseFormData) => {
    setExercises(prev => prev.map((ex, i) => (i === index ? updated : ex)));
  }, []);

  const handleExerciseDelete = useCallback((index: number) => {
    setExercises(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((ex, i) => ({ ...ex, sort_order: i }))
    );
  }, []);

  // ── Save ──
  const handleSave = async () => {
    if (!sessionName.trim() || saving) return;
    if (selectedWeeks.length === 0) {
      Alert.alert('Missing Weeks', 'Select at least one week.');
      return;
    }
    if (recurrenceType === 'custom' && selectedCustomDays.length === 0) {
      Alert.alert('Missing Days', 'Select at least one day for custom frequency.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const recurrenceRule = generateRecurrenceRule();
      const targetDays = getTargetDays();
      const completionRuleJson = completionRule === 'all'
        ? { type: 'all' }
        : { type: 'threshold', required: completionThreshold, of: exercises.length };

      const milestoneId = await createMilestone({
        userId: user.id,
        goalId: goal.id,
        name: sessionName.trim(),
        milestoneType: 'workout_session',
        completionRule: completionRuleJson,
        recurrenceRule,
        targetDays,
        timelineId: timeline.id,
        timelineType: timeline.source === 'global' ? 'global' : 'custom',
        weekNumberStart: Math.min(...selectedWeeks),
      });

      // Add exercises in sequence
      for (const ex of exercises) {
        if (ex.name.trim()) {
          await addExerciseToMilestone(user.id, milestoneId, {
            name: ex.name.trim(),
            muscle_group: ex.muscle_group || null,
            exercise_type: ex.exercise_type,
            target_sets: ex.target_sets,
            target_reps: ex.target_reps,
            target_value: ex.target_value,
            unit: ex.unit,
            sort_order: ex.sort_order,
          });
        }
      }

      resetForm();
      onCreated(milestoneId);
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Could not create session. Please try again.');
      console.error('[CreateMilestoneModal] createMilestone error:', err);
    } finally {
      setSaving(false);
    }
  };

  const maxThreshold = Math.max(exercises.length, 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={resetForm}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Session</Text>
          <TouchableOpacity
            style={[
              styles.headerSaveButton,
              (!sessionName.trim() || saving) && styles.headerSaveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!sessionName.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.headerSaveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            {/* Linked to Goal */}
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>LINKED TO GOAL</Text>
              <View style={styles.goalInfo}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
              </View>
            </View>

            {/* Session Name */}
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>SESSION NAME *</Text>
              <TextInput
                style={styles.input}
                value={sessionName}
                onChangeText={setSessionName}
                placeholder="e.g. Upper A Workout, Push Day, Lower Body"
                placeholderTextColor="#9ca3af"
                maxLength={80}
              />
            </View>

            {/* Frequency */}
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>FREQUENCY *</Text>
              <View style={styles.frequencySelector}>
                {['daily', '6days', '5days', '4days', '3days', '2days', '1day', 'custom'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.frequencyButton, recurrenceType === type && styles.frequencyButtonSelected]}
                    onPress={() => handleRecurrenceSelect(type)}
                  >
                    <Text style={[styles.frequencyButtonText, recurrenceType === type && styles.frequencyButtonTextSelected]}>
                      {getRecurrenceLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Days */}
            {recurrenceType === 'custom' && (
              <View style={styles.field}>
                <Text style={styles.sectionLabel}>SELECT DAYS *</Text>
                <View style={styles.customDaysSelector}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.customDayButton,
                        selectedCustomDays.includes(index) && styles.customDayButtonSelected,
                      ]}
                      onPress={() => handleCustomDayToggle(index)}
                    >
                      <Text style={[
                        styles.customDayButtonText,
                        selectedCustomDays.includes(index) && styles.customDayButtonTextSelected,
                      ]}>
                        {dayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Weeks */}
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>WEEKS *</Text>
              <View style={styles.weekSelector}>
                <TouchableOpacity
                  style={[
                    styles.weekButton,
                    selectedWeeks.length === TOTAL_WEEKS && styles.weekButtonSelected,
                  ]}
                  onPress={handleSelectAllWeeks}
                >
                  <Text style={[
                    styles.weekButtonText,
                    selectedWeeks.length === TOTAL_WEEKS && styles.weekButtonTextSelected,
                  ]}>
                    Select All
                  </Text>
                </TouchableOpacity>

                {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(weekNum => (
                  <TouchableOpacity
                    key={weekNum}
                    style={[
                      styles.weekButton,
                      selectedWeeks.includes(weekNum) && styles.weekButtonSelected,
                    ]}
                    onPress={() => handleWeekToggle(weekNum)}
                  >
                    <Text style={[
                      styles.weekButtonText,
                      selectedWeeks.includes(weekNum) && styles.weekButtonTextSelected,
                    ]}>
                      Wk {weekNum}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Completion Rule */}
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>COUNTS AS DONE WHEN</Text>
              <View style={styles.completionRuleRow}>
                <TouchableOpacity
                  style={[
                    styles.completionChip,
                    completionRule === 'all' && styles.completionChipActive,
                  ]}
                  onPress={() => setCompletionRule('all')}
                >
                  <Text style={[
                    styles.completionChipText,
                    completionRule === 'all' && styles.completionChipTextActive,
                  ]}>
                    All exercises
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.completionChip,
                    completionRule === 'threshold' && styles.completionChipActive,
                  ]}
                  onPress={() => setCompletionRule('threshold')}
                >
                  <Text style={[
                    styles.completionChipText,
                    completionRule === 'threshold' && styles.completionChipTextActive,
                  ]}>
                    Any N of {exercises.length || '\u2014'}
                  </Text>
                </TouchableOpacity>
              </View>

              {completionRule === 'threshold' && (
                <View style={styles.thresholdStepper}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setCompletionThreshold(prev => Math.max(1, prev - 1))}
                    disabled={completionThreshold <= 1}
                  >
                    <Text style={[
                      styles.stepperButtonText,
                      completionThreshold <= 1 && styles.stepperButtonTextDisabled,
                    ]}>
                      {'\u2212'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{completionThreshold}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setCompletionThreshold(prev => Math.min(maxThreshold, prev + 1))}
                    disabled={completionThreshold >= maxThreshold}
                  >
                    <Text style={[
                      styles.stepperButtonText,
                      completionThreshold >= maxThreshold && styles.stepperButtonTextDisabled,
                    ]}>
                      +
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperLabel}>
                    of {exercises.length || '\u2014'} exercises
                  </Text>
                </View>
              )}
            </View>

            {/* Exercises */}
            <View style={styles.field}>
              <TouchableOpacity
                style={styles.exerciseSectionHeader}
                onPress={() => setExercisesExpanded(prev => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionLabel}>EXERCISES</Text>
                <View style={styles.exerciseSectionRight}>
                  {exercises.length > 0 && (
                    <View style={styles.exerciseCountBadge}>
                      <Text style={styles.exerciseCountBadgeText}>{exercises.length}</Text>
                    </View>
                  )}
                  {exercisesExpanded ? (
                    <ChevronUp size={16} color="#6b7280" />
                  ) : (
                    <ChevronDown size={16} color="#6b7280" />
                  )}
                </View>
              </TouchableOpacity>

              {exercisesExpanded && (
                <View style={styles.exercisesList}>
                  {exercises.length === 0 && (
                    <Text style={styles.exercisesHint}>
                      Add at least one exercise to this session.
                    </Text>
                  )}

                  {exercises.map((ex, i) => (
                    <ExerciseFormRow
                      key={i}
                      index={i}
                      exercise={ex}
                      onChange={handleExerciseChange}
                      onDelete={handleExerciseDelete}
                    />
                  ))}

                  <TouchableOpacity
                    style={styles.addExerciseButton}
                    onPress={handleAddExercise}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color="#6366f1" />
                    <Text style={styles.addExerciseText}>Add Exercise</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Bottom spacer for keyboard */}
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!sessionName.trim() || selectedWeeks.length === 0 || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!sessionName.trim() || selectedWeeks.length === 0 || (recurrenceType === 'custom' && selectedCustomDays.length === 0) || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Session</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CreateMilestoneModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  headerSaveButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerSaveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  headerSaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  goalInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  frequencySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  frequencyButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  frequencyButtonTextSelected: {
    color: '#ffffff',
  },
  customDaysSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customDayButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  customDayButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  customDayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  customDayButtonTextSelected: {
    color: '#ffffff',
  },
  weekSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weekButtonSelected: {
    backgroundColor: '#1f2937',
    borderColor: '#1f2937',
  },
  weekButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  weekButtonTextSelected: {
    color: '#ffffff',
  },
  completionRuleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  completionChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  completionChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  completionChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  completionChipTextActive: {
    color: '#ffffff',
  },
  thresholdStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  stepperButtonTextDisabled: {
    color: '#d1d5db',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    minWidth: 30,
    textAlign: 'center',
  },
  stepperLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  exerciseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseCountBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  exerciseCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  exercisesList: {
    gap: 10,
  },
  exercisesHint: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
