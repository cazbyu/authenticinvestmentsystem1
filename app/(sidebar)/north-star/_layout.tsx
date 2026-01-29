import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { UniversalHeader } from '@/components/UniversalHeader';
import { useState } from 'react';
import SettingsDrawer from '@/components/SettingsDrawer';

export default function NorthStarLayout() {
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Universal Header - red background with profile, north star, score */}
      <View style={styles.headerContainer}>
        <UniversalHeader onOpenSettings={() => setSettingsVisible(true)} />
      </View>

      {/* Page Content */}
      <Stack
        screenOptions={{
          headerShown: false, // Hide default header, we're using UniversalHeader
          contentStyle: { backgroundColor: '#fff' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="spark-library" />
      </Stack>

      {/* Settings Drawer */}
      <SettingsDrawer 
        visible={settingsVisible} 
        onClose={() => setSettingsVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#B91C1C', // Red background for status bar area
  },
  headerContainer: {
    backgroundColor: '#B91C1C',
  },
});