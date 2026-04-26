import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Compass } from 'lucide-react-native';

/**
 * ZoneNorthStarPlaceholder — Minimalist Executive design system
 * Non-functional tappable chip below the cream zone-vision callout.
 * Reserves visual real estate for the future deeper-questions feature.
 */

export interface ZoneNorthStarPlaceholderProps {
  zoneName: string;
}

export function ZoneNorthStarPlaceholder({
  zoneName,
}: ZoneNorthStarPlaceholderProps) {
  const handlePress = () => {
    Alert.alert(
      'Coming soon',
      `This space is coming soon. We're designing the deeper questions experience for each ${zoneName} zone.`
    );
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <Compass size={18} color="#9ca3af" />
      <View style={styles.textBlock}>
        <Text style={styles.title}>North Star Questions for this Zone</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
      <ChevronRight size={16} color="#9ca3af" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6b7280',
    marginTop: 2,
  },
});
