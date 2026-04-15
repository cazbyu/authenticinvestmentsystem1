import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';

// SVG imports
import Abs from '@/assets/muscle-groups/abs.svg';
import Adductors from '@/assets/muscle-groups/adductors.svg';
import Biceps from '@/assets/muscle-groups/biceps.svg';
import Calves from '@/assets/muscle-groups/calves.svg';
import Chest from '@/assets/muscle-groups/chest.svg';
import Forearms from '@/assets/muscle-groups/forearms.svg';
import Glutes from '@/assets/muscle-groups/glutes.svg';
import Hamstrings from '@/assets/muscle-groups/hamstrings.svg';
import Obliques from '@/assets/muscle-groups/obliques.svg';
import Quads from '@/assets/muscle-groups/quads.svg';
import Shins from '@/assets/muscle-groups/shins.svg';
import Shoulders from '@/assets/muscle-groups/shoulders.svg';
import Trapezius from '@/assets/muscle-groups/trapezius.svg';
import Triceps from '@/assets/muscle-groups/triceps.svg';

interface MuscleGroup {
  key: string;
  label: string;
  Icon: React.FC<{ width: number; height: number }>;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  { key: 'chest', label: 'Chest', Icon: Chest },
  { key: 'shoulders', label: 'Shoulders', Icon: Shoulders },
  { key: 'biceps', label: 'Biceps', Icon: Biceps },
  { key: 'triceps', label: 'Triceps', Icon: Triceps },
  { key: 'forearms', label: 'Forearms', Icon: Forearms },
  { key: 'trapezius', label: 'Trapezius', Icon: Trapezius },
  { key: 'abs', label: 'Abs', Icon: Abs },
  { key: 'obliques', label: 'Obliques', Icon: Obliques },
  { key: 'glutes', label: 'Glutes', Icon: Glutes },
  { key: 'quads', label: 'Quads', Icon: Quads },
  { key: 'hamstrings', label: 'Hamstrings', Icon: Hamstrings },
  { key: 'adductors', label: 'Adductors', Icon: Adductors },
  { key: 'calves', label: 'Calves', Icon: Calves },
  { key: 'shins', label: 'Shins', Icon: Shins },
];

interface MuscleGroupPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MuscleGroupPicker({ value, onChange }: MuscleGroupPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        {value.length > 0 ? (
          <View style={styles.triggerContent}>
            {value.map(key => {
              const mg = MUSCLE_GROUPS.find(m => m.key === key);
              if (!mg) return null;
              return <mg.Icon key={key} width={28} height={28} />;
            })}
          </View>
        ) : (
          <Text style={styles.triggerPlaceholder}>Select</Text>
        )}
        <ChevronDown size={14} color="#9ca3af" />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Muscle Group</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <X size={22} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {MUSCLE_GROUPS.map(mg => (
              <TouchableOpacity
                key={mg.key}
                style={[
                  styles.option,
                  value.includes(mg.key) && styles.optionActive,
                ]}
                onPress={() => {
                  const already = value.includes(mg.key);
                  onChange(already
                    ? value.filter(k => k !== mg.key)
                    : [...value, mg.key]
                  );
                }}
                activeOpacity={0.7}
              >
                <mg.Icon width={36} height={36} />
                <Text style={[
                  styles.optionLabel,
                  value.includes(mg.key) && styles.optionLabelActive,
                ]}>
                  {mg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  triggerLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  triggerPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  modal: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  option: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
  },
  optionActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
  },
  optionLabelActive: {
    color: '#6366f1',
  },
});
