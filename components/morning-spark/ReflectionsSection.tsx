import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ReflectionsSectionProps {
  colors: any;
  commitReflection: boolean;
  setCommitReflection: (value: boolean) => void;
  commitRose: boolean;
  setCommitRose: (value: boolean) => void;
  commitThorn: boolean;
  setCommitThorn: (value: boolean) => void;
}

export function ReflectionsSection({
  colors,
  commitReflection,
  setCommitReflection,
  commitRose,
  setCommitRose,
  commitThorn,
  setCommitThorn,
}: ReflectionsSectionProps) {
  
  const handleToggle = (currentValue: boolean, setter: (value: boolean) => void) => {
    setter(!currentValue);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.text }]}>
        ✨ Spice up your day with reflections
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        Reflections are a great way to capture ideas, emotions and inspirations that help you improve. Would you like to commit to capturing your thoughts today?
      </Text>

      {/* Add a Reflection */}
      <TouchableOpacity
        style={[
          styles.checkboxRow,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
        onPress={() => handleToggle(commitReflection, setCommitReflection)}
      >
        <View style={[
          styles.checkbox,
          { borderColor: colors.border },
          commitReflection && { backgroundColor: colors.primary, borderColor: colors.primary }
        ]}>
          {commitReflection && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          Add a Reflection (+1 point)
        </Text>
      </TouchableOpacity>

      {/* Add a Rose */}
      <TouchableOpacity
        style={[
          styles.checkboxRow,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
        onPress={() => handleToggle(commitRose, setCommitRose)}
      >
        <View style={[
          styles.checkbox,
          { borderColor: colors.border },
          commitRose && { backgroundColor: colors.primary, borderColor: colors.primary }
        ]}>
          {commitRose && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          Add a Rose (+2 points for first of day)
        </Text>
      </TouchableOpacity>

      {/* Add a Thorn */}
      <TouchableOpacity
        style={[
          styles.checkboxRow,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
        onPress={() => handleToggle(commitThorn, setCommitThorn)}
      >
        <View style={[
          styles.checkbox,
          { borderColor: colors.border },
          commitThorn && { backgroundColor: colors.primary, borderColor: colors.primary }
        ]}>
          {commitThorn && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          Add a Thorn (+1 point)
        </Text>
      </TouchableOpacity>

      {/* Note about max points */}
      <Text style={[styles.maxPointsNote, { color: colors.textSecondary }]}>
        Max 10 points from reflections (Reflection, Rose, Thorn combined)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  maxPointsNote: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
});