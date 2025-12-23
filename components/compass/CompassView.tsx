import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AspirationalQuote } from './AspirationalQuote';
import { LifeCompass } from './LifeCompass';
import { useTheme } from '@/contexts/ThemeContext';

export function CompassView() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AspirationalQuote />
      <View style={styles.compassWrapper}>
        <LifeCompass size={320} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 600,
  },
  compassWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
    minHeight: 400,
  },
});
