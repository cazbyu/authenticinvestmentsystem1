import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * VisionBlock — Minimalist Executive design system
 * Editable vision/mission-style statement with a hub-accent border.
 * Tap to edit inline; saves on blur.
 */

export interface VisionBlockProps {
  label: string;
  value: string | null;
  onSave: (text: string) => void;
  accentColor: string;
  placeholder?: string;
}

export function VisionBlock({
  label,
  value,
  onSave,
  accentColor,
  placeholder,
}: VisionBlockProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const handleBlur = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '').trim()) {
      onSave(trimmed);
    }
  };

  const effectivePlaceholder =
    placeholder ?? `Tap to add your ${label.toLowerCase()}`;
  const hasValue = value != null && value.trim().length > 0;

  return (
    <View
      style={[
        styles.container,
        { borderColor: accentColor, borderWidth: editing ? 1.5 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: accentColor }]}>{label}</Text>
      {editing ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={handleBlur}
          multiline
          style={styles.input}
          placeholder={effectivePlaceholder}
          placeholderTextColor="#9ca3af"
        />
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.displayWrap}>
          {hasValue ? (
            <Text style={styles.value}>{value}</Text>
          ) : (
            <Text style={styles.placeholder}>{effectivePlaceholder}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  displayWrap: {
    minHeight: 28,
    justifyContent: 'center',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  placeholder: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  input: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    minHeight: 28,
    padding: 0,
  },
});
