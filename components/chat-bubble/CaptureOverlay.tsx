/**
 * CaptureOverlay - Editable bottom sheet for AI-suggested captures
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CAPTURE_TYPES, RITUAL_CAPTURE_TYPES, WELLNESS_ICONS } from '@/constants/chatBubble';
import type { CaptureData } from '@/types/chatBubble';
import type { CaptureType, RitualType } from '@/constants/chatBubble';

interface CaptureOverlayProps {
  visible: boolean;
  captureType: CaptureType;
  initialData: CaptureData;
  ritualType: RitualType;
  onSave: (captureType: CaptureType, data: CaptureData) => void;
  onCancel: () => void;
}

export function CaptureOverlay({
  visible,
  captureType: initialType,
  initialData,
  ritualType,
  onSave,
  onCancel,
}: CaptureOverlayProps) {
  const [captureType, setCaptureType] = useState<CaptureType>(initialType);
  const [title, setTitle] = useState(initialData.title || '');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [role, setRole] = useState(initialData.role || '');
  const [wellness, setWellness] = useState<string[]>(initialData.wellness || []);
  const [date, setDate] = useState(initialData.date || '');
  const [time, setTime] = useState(initialData.time || '');
  const [expandedTypes, setExpandedTypes] = useState(false);

  const meta = CAPTURE_TYPES[captureType];
  const allowedTypes = RITUAL_CAPTURE_TYPES[ritualType] || [];

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(captureType, {
      title: title.trim(),
      notes: notes.trim() || undefined,
      role: role.trim() || undefined,
      wellness: wellness.length ? wellness : undefined,
      date: date || undefined,
      time: time || undefined,
    });
  };

  if (!visible) return null;

  const rows = captureType === 'brain_dump' || captureType === 'reflection' ? 4 : 2;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { borderTopColor: meta.color }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: `${meta.color}30` }]}>
            <Text style={styles.headerIcon}>{meta.icon}</Text>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: meta.color }]}>
                {meta.label}
              </Text>
              <Text style={styles.headerDesc}>{meta.desc}</Text>
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Type changer */}
            {allowedTypes.length > 1 && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.typeRow}
                  onPress={() => setExpandedTypes(!expandedTypes)}
                >
                  <Text style={styles.sectionLabel}>Type</Text>
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
                {expandedTypes && (
                  <View style={styles.typeChips}>
                    {allowedTypes.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeChip,
                          t === captureType && {
                            backgroundColor: CAPTURE_TYPES[t].color,
                          },
                        ]}
                        onPress={() => {
                          setCaptureType(t);
                          setExpandedTypes(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            t === captureType && { color: '#fff' },
                          ]}
                        >
                          {CAPTURE_TYPES[t].icon} {CAPTURE_TYPES[t].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Main text */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {CAPTURE_TYPES[captureType].labelField}
              </Text>
              <TextInput
                style={styles.mainInput}
                value={title}
                onChangeText={setTitle}
                placeholder={CAPTURE_TYPES[captureType].placeholder}
                multiline
                numberOfLines={rows}
                autoFocus
              />
            </View>

            {/* Date/Time for Task and Event */}
            {(captureType === 'task' || captureType === 'event') && (
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.sectionLabel}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                {captureType === 'event' && (
                  <View style={styles.half}>
                    <Text style={styles.sectionLabel}>Time</Text>
                    <TextInput
                      style={styles.input}
                      value={time}
                      onChangeText={setTime}
                      placeholder="e.g. 2:00 PM"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Role */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Role</Text>
              <TextInput
                style={styles.input}
                value={role}
                onChangeText={setRole}
                placeholder="e.g. Father, Business Owner"
              />
            </View>

            {/* Wellness zones */}
            {wellness.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Wellness</Text>
                <View style={styles.chipRow}>
                  {wellness.map((w) => (
                    <View key={w} style={styles.wellnessChip}>
                      <Text style={styles.wellnessChipText}>
                        {WELLNESS_ICONS[w] || '•'} {w}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional..."
                multiline
              />
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: meta.color }]}
              onPress={handleSave}
              disabled={!title.trim()}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 4,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerIcon: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  body: {
    maxHeight: 400,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeLink: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '600',
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  typeChipText: {
    fontSize: 14,
    color: '#374151',
  },
  mainInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wellnessChip: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  wellnessChipText: {
    fontSize: 14,
    color: '#065f46',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
