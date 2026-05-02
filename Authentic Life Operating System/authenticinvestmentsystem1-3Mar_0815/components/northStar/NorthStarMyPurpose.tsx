// NorthStarMyPurpose.tsx
// NS-1 component — North Star "My Purpose" collapsible section
// Five rows: Mission, 5-Year Vision, Life Motto, Core Values, Power Questions

import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, Plus, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type RowKey = 'mission' | 'vision' | 'values' | 'pq';
type TextRowKey = 'mission' | 'vision';
type EditField = 'mission_statement' | '5yr_vision' | 'life_motto';

const POWER_QUESTIONS = [
  'Who am I?',
  'Why am I here?',
  'Where do I want to go?',
  'What am I doing to get there?',
];

export interface NorthStarMyPurposeProps {
  missionStatement: string | null;
  vision: string | null;
  coreValues: string[] | null;
  accentColor?: string;
  onSaveField: (field: EditField, value: string) => Promise<void>;
  onSaveCoreValues: (values: string[]) => Promise<void>;
  onRefineMission: () => void;
  onRefineVision: () => void;
}

export function NorthStarMyPurpose({
  missionStatement,
  vision,
  coreValues,
  accentColor = '#8b1a1a',
  onSaveField,
  onSaveCoreValues,
  onRefineMission,
  onRefineVision,
}: NorthStarMyPurposeProps) {
  const { colors } = useTheme();

  const [openRow, setOpenRow] = useState<RowKey | null>('mission');
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingValue, setAddingValue] = useState(false);
  const [valueInput, setValueInput] = useState('');

  const values = coreValues ?? [];

  const toggleRow = (row: RowKey) => {
    setOpenRow((prev) => (prev === row ? null : row));
    setEditingField(null);
    setAddingValue(false);
  };

  const beginEdit = (field: EditField, current: string | null) => {
    setEditingField(field);
    setEditValue(current ?? '');
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const trimmed = editValue.trim();
    await onSaveField(editingField, trimmed);
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleAddValue = async () => {
    const trimmed = valueInput.trim();
    if (!trimmed) {
      setAddingValue(false);
      setValueInput('');
      return;
    }
    const next = [...values, trimmed];
    await onSaveCoreValues(next);
    setAddingValue(false);
    setValueInput('');
  };

  const handleDeleteValue = async (idx: number) => {
    const next = values.filter((_, i) => i !== idx);
    await onSaveCoreValues(next);
  };

  const showPowerQAlert = () => {
    const msg = 'Power Q journal coming soon.';
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Power Questions', msg);
    }
  };

  const renderTextRow = (
    rowKey: TextRowKey,
    label: string,
    field: EditField,
    value: string | null,
    placeholder: string,
    onRefine: () => void,
    showRefine: boolean = true,
  ) => {
    const isOpen = openRow === rowKey;
    const isEditing = editingField === field;
    const hasValue = value != null && value.trim().length > 0;

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowHeader}
          onPress={() => toggleRow(rowKey)}
          activeOpacity={0.7}
        >
          <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
          <View
            style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
          >
            <ChevronDown size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.rowBody}>
            {isEditing ? (
              <View style={styles.editWrap}>
                <TextInput
                  autoFocus
                  multiline
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder={placeholder}
                  placeholderTextColor="#9ca3af"
                  style={styles.editInput}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnCancel]}
                    onPress={cancelEdit}
                  >
                    <Text style={styles.editBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editBtn, { backgroundColor: accentColor }]}
                    onPress={saveEdit}
                  >
                    <Text style={styles.editBtnSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Pressable
                style={styles.displayWrap}
                onPress={() => beginEdit(field, value)}
              >
                {hasValue ? (
                  <Text style={styles.displayText}>{value}</Text>
                ) : (
                  <Text style={styles.placeholderText}>{placeholder}</Text>
                )}
              </Pressable>
            )}

            {showRefine && (
              <TouchableOpacity
                style={[styles.refineBtn, { borderColor: accentColor }]}
                onPress={onRefine}
              >
                <Text style={[styles.refineBtnText, { color: accentColor }]}>
                  Refine with DD
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View
        style={[styles.sectionLabelRow, { borderBottomColor: colors.border }]}
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          MY PURPOSE
        </Text>
      </View>

      {/* Row 1 — Mission */}
      {renderTextRow(
        'mission',
        'Mission statement',
        'mission_statement',
        missionStatement,
        "What is your life's mission?",
        onRefineMission,
      )}

      {/* Row 2 — 5-year vision */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {renderTextRow(
        'vision',
        '5-Year Vision',
        '5yr_vision',
        vision,
        'What will your life look like in five years?',
        onRefineVision,
      )}

      {/* Row 3 — Core values */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowHeader}
          onPress={() => toggleRow('values')}
          activeOpacity={0.7}
        >
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Core Values
          </Text>
          <View
            style={{
              transform: [{ rotate: openRow === 'values' ? '180deg' : '0deg' }],
            }}
          >
            <ChevronDown size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {openRow === 'values' && (
          <View style={styles.rowBody}>
            <View style={styles.chipsWrap}>
              {values.map((v, idx) => (
                <View key={`${v}-${idx}`} style={styles.chip}>
                  <Text style={styles.chipText}>{v}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteValue(idx)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={12} color="#78350f" />
                  </TouchableOpacity>
                </View>
              ))}

              {addingValue ? (
                <View style={styles.chipAddInputWrap}>
                  <TextInput
                    autoFocus
                    value={valueInput}
                    onChangeText={setValueInput}
                    onBlur={handleAddValue}
                    placeholder="value"
                    placeholderTextColor="#9ca3af"
                    style={styles.chipAddInput}
                    returnKeyType="done"
                    onSubmitEditing={handleAddValue}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.chipAdd}
                  onPress={() => setAddingValue(true)}
                >
                  <Plus size={12} color="#6b7280" />
                  <Text style={styles.chipAddText}>Add value</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Row 5 — Power questions */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowHeader}
          onPress={() => toggleRow('pq')}
          activeOpacity={0.7}
        >
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Power Questions
          </Text>
          <View
            style={{
              transform: [{ rotate: openRow === 'pq' ? '180deg' : '0deg' }],
            }}
          >
            <ChevronDown size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {openRow === 'pq' && (
          <View style={styles.rowBody}>
            {POWER_QUESTIONS.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.pqRow}
                onPress={showPowerQAlert}
                activeOpacity={0.6}
              >
                <Text
                  style={[styles.pqQuestion, { color: colors.textSecondary }]}
                >
                  {q}
                </Text>
                <Text style={styles.pqPlaceholder}>Tap to answer...</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default NorthStarMyPurpose;

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  sectionLabelRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  row: {
    paddingHorizontal: 16,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowBody: {
    paddingBottom: 14,
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  displayWrap: {
    minHeight: 28,
    paddingVertical: 4,
  },
  displayText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#374151',
    lineHeight: 20,
  },
  placeholderText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#9ca3af',
    lineHeight: 20,
  },
  editWrap: {
    gap: 8,
  },
  editInput: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
    minHeight: 60,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnCancel: {
    backgroundColor: 'transparent',
  },
  editBtnCancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  editBtnSaveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  refineBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refineBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#78350f',
  },
  chipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipAddText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  chipAddInputWrap: {
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minWidth: 100,
  },
  chipAddInput: {
    fontSize: 11,
    color: '#78350f',
    padding: 0,
    minWidth: 80,
  },

  pqRow: {
    paddingVertical: 6,
    gap: 2,
  },
  pqQuestion: {
    fontSize: 12,
    fontWeight: '500',
  },
  pqPlaceholder: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
});
