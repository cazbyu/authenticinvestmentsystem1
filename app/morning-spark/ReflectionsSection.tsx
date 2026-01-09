import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

interface ReflectionsSectionProps {
  colors: any;
  commitReflection: boolean;
  setCommitReflection: (value: boolean) => void;
  commitRose: boolean;
  setCommitRose: (value: boolean) => void;
  commitThorn: boolean;
  setCommitThorn: (value: boolean) => void;
  commitEveningReview: boolean;
  setCommitEveningReview: (value: boolean) => void;
}

export function ReflectionsSection({
  colors,
  commitReflection,
  setCommitReflection,
  commitRose,
  setCommitRose,
  commitThorn,
  setCommitThorn,
  commitEveningReview,
  setCommitEveningReview,
}: ReflectionsSectionProps) {
  const [showReflections, setShowReflections] = useState(false);

  return (
    <View style={[styles.optionalCommitments, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.collapsibleHeaderInline}
        onPress={() => setShowReflections(!showReflections)}
      >
        <View style={styles.collapsibleTitleRow}>
          <Text style={[styles.optionalTitle, { color: colors.text }]}>
            ✨ Spice up your day with reflections
          </Text>
        </View>
        <Text style={[styles.collapsibleIcon, { color: colors.textSecondary }]}>
          {showReflections ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {showReflections && (
        <>
          <Text style={[styles.optionalSubtitle, { color: colors.textSecondary }]}>
            Reflections are a great way to capture ideas, emotions and inspirations that help you improve. Would you like to commit to capturing your thoughts today?
          </Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setCommitReflection(!commitReflection)}
          >
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: commitReflection ? colors.primary : 'transparent' }]}>
              {commitReflection && <Check size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              Add a Reflection (+1 point)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setCommitRose(!commitRose)}
          >
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: commitRose ? colors.primary : 'transparent' }]}>
              {commitRose && <Check size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              Add a Rose (+2 points for first of day)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setCommitThorn(!commitThorn)}
          >
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: commitThorn ? colors.primary : 'transparent' }]}>
              {commitThorn && <Check size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              Add a Thorn (+1 point)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setCommitEveningReview(!commitEveningReview)}
          >
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: commitEveningReview ? colors.primary : 'transparent' }]}>
              {commitEveningReview && <Check size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              Evening Review ritual (+10 points)
            </Text>
          </TouchableOpacity>

          <Text style={[styles.optionalNote, { color: colors.textSecondary }]}>
            Max 10 points from reflections (Reflection, Rose, Thorn combined)
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  optionalCommitments: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  collapsibleHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  collapsibleIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 15,
    flex: 1,
  },
  optionalNote: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});