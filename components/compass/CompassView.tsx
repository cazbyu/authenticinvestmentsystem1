import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { AspirationalQuote } from './AspirationalQuote';
import { LifeCompass } from './LifeCompass';
import { useTheme } from '@/contexts/ThemeContext';

export function CompassView() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <AspirationalQuote />
      <View style={styles.compassWrapper}>
        <LifeCompass size={320} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  compassWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
});
