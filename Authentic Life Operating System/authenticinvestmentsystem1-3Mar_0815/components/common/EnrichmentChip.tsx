import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle } from 'react-native';

interface EnrichmentChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  subtitle?: string;
}

/**
 * Minimalist Executive enrichment chip used in ADD CONTEXT rows
 * across TaskEventForm and CommitmentEnrichmentModal.
 */
export function EnrichmentChip({ label, selected, onPress, icon, subtitle }: EnrichmentChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, selected ? styles.labelSelected : styles.labelUnselected]}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export const chipWrapStyle: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
};

// Shared palette for callers that need to tint icons to match the active/inactive state.
export const ENRICHMENT_CHIP_COLORS = {
  inactive: '#6b7280',
  active: '#1e3a5f',
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  chipUnselected: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderWidth: 1.5,
    borderColor: '#1e3a5f',
    backgroundColor: '#f0f4f9',
  },
  iconWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
  },
  labelUnselected: {
    color: '#6b7280',
    fontWeight: '400',
  },
  labelSelected: {
    color: '#1e3a5f',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 10,
  },
});
