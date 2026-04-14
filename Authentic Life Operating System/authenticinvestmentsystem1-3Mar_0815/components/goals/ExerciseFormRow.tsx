// components/goals/ExerciseFormRow.tsx
import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Trash2, GripVertical } from 'lucide-react-native';

export interface ExerciseFormData {
  name: string;
  muscle_group: string;
  exercise_type: 'reps' | 'timed' | 'distance';
  target_sets: number | null;
  target_reps: number | null;
  target_value: number | null;
  unit: string | null;
  sort_order: number;
}

interface ExerciseFormRowProps {
  index: number;
  exercise: ExerciseFormData;
  onChange: (index: number, updated: ExerciseFormData) => void;
  onDelete: (index: number) => void;
}

const TYPE_OPTIONS: Array<{ value: ExerciseFormData['exercise_type']; label: string }> = [
  { value: 'reps', label: 'Reps' },
  { value: 'timed', label: 'Timed' },
  { value: 'distance', label: 'Distance' },
];

export const ExerciseFormRow = memo(function ExerciseFormRow({
  index,
  exercise,
  onChange,
  onDelete,
}: ExerciseFormRowProps) {
  const update = useCallback(
    (partial: Partial<ExerciseFormData>) => {
      onChange(index, { ...exercise, ...partial });
    },
    [index, exercise, onChange]
  );

  const handleTypeChange = useCallback(
    (type: ExerciseFormData['exercise_type']) => {
      // Reset target fields when type changes
      update({
        exercise_type: type,
        target_sets: type === 'reps' ? exercise.target_sets : null,
        target_reps: type === 'reps' ? exercise.target_reps : null,
        target_value: type !== 'reps' ? exercise.target_value : null,
        unit: type === 'timed' ? 'mins' : type === 'distance' ? 'km' : null,
      });
    },
    [exercise, update]
  );

  return (
    <View style={styles.container}>
      {/* Top row: drag handle + delete */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.dragHandle} activeOpacity={0.5}>
          <GripVertical size={16} color="#9ca3af" />
        </TouchableOpacity>
        <Text style={styles.indexLabel}>Exercise {index + 1}</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(index)}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Exercise name */}
      <TextInput
        style={styles.input}
        value={exercise.name}
        onChangeText={v => update({ name: v })}
        placeholder="e.g. Bench Press"
        placeholderTextColor="#9ca3af"
        maxLength={80}
      />

      {/* Muscle group */}
      <TextInput
        style={styles.input}
        value={exercise.muscle_group}
        onChangeText={v => update({ muscle_group: v })}
        placeholder="e.g. Chest, Biceps"
        placeholderTextColor="#9ca3af"
        maxLength={60}
      />

      {/* Type selector chips */}
      <View style={styles.typeSelector}>
        {TYPE_OPTIONS.map(opt => {
          const active = exercise.exercise_type === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.typeChip,
                active && styles.typeChipActive,
              ]}
              onPress={() => handleTypeChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.typeChipText,
                  active && styles.typeChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Conditional target inputs */}
      {exercise.exercise_type === 'reps' && (
        <View style={styles.targetRow}>
          <View style={styles.targetInputWrapper}>
            <Text style={styles.targetLabel}>SETS</Text>
            <TextInput
              style={styles.targetInput}
              value={exercise.target_sets?.toString() ?? ''}
              onChangeText={v => update({ target_sets: v !== '' ? parseInt(v, 10) || null : null })}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor="#d1d5db"
            />
          </View>
          <Text style={styles.targetSeparator}>×</Text>
          <View style={styles.targetInputWrapper}>
            <Text style={styles.targetLabel}>REPS</Text>
            <TextInput
              style={styles.targetInput}
              value={exercise.target_reps?.toString() ?? ''}
              onChangeText={v => update({ target_reps: v !== '' ? parseInt(v, 10) || null : null })}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor="#d1d5db"
            />
          </View>
        </View>
      )}

      {(exercise.exercise_type === 'timed' || exercise.exercise_type === 'distance') && (
        <View style={styles.targetRow}>
          <View style={styles.targetInputWrapper}>
            <Text style={styles.targetLabel}>TARGET</Text>
            <TextInput
              style={styles.targetInput}
              value={exercise.target_value?.toString() ?? ''}
              onChangeText={v => update({ target_value: v !== '' ? parseFloat(v) || null : null })}
              keyboardType="decimal-pad"
              placeholder={exercise.exercise_type === 'timed' ? '30' : '5'}
              placeholderTextColor="#d1d5db"
            />
          </View>
          <View style={styles.targetInputWrapper}>
            <Text style={styles.targetLabel}>UNIT</Text>
            <TextInput
              style={styles.targetInput}
              value={exercise.unit ?? ''}
              onChangeText={v => update({ unit: v || null })}
              placeholder={exercise.exercise_type === 'timed' ? 'mins' : 'km / miles'}
              placeholderTextColor="#d1d5db"
            />
          </View>
        </View>
      )}
    </View>
  );
});

// Styles match ActionEffortModal conventions:
// - input: borderColor #d1d5db, borderRadius 8, paddingHorizontal 12, paddingVertical 12, fontSize 16
// - chips: borderRadius 20, paddingHorizontal 12, paddingVertical 8, fontSize 14
// - active chip: backgroundColor #6366f1 (indigo, milestone accent)
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragHandle: {
    padding: 4,
  },
  indexLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteButton: {
    padding: 4,
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
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  typeChipTextActive: {
    color: '#ffffff',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetInputWrapper: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  targetInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  targetSeparator: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 14,
  },
});
