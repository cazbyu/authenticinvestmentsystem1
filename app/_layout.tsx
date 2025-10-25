import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { SideMenu } from '@/components/SideMenu';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthenticScoreProvider } from '@/contexts/AuthenticScoreContext';
import { TabResetProvider } from '@/contexts/TabResetContext';
import React from 'react';

console.log('[App] _layout.tsx loaded');

export default function RootLayout() {
  console.log('[App] RootLayout rendering');
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthenticScoreProvider>
        <TabResetProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer
              drawerContent={() => <SideMenu />}
              screenOptions={{
                headerShown: false,
                drawerStyle: {
                  width: 280,
                },
              }}
            >
              <Drawer.Screen name="index" />
              <Drawer.Screen name="landing" />
              <Drawer.Screen name="login" />
              <Drawer.Screen name="(tabs)" />
              <Drawer.Screen name="calendar" />
              <Drawer.Screen name="followup" />
              <Drawer.Screen name="reflections" />
              <Drawer.Screen name="settings" />
              <Drawer.Screen name="coach" />
              <Drawer.Screen name="terms" />
              <Drawer.Screen name="privacy" />
              <Drawer.Screen name="about" />
              <Drawer.Screen name="contact" />
              <Drawer.Screen name="suggestions" />
              <Drawer.Screen name="auth/callback" />
              <Drawer.Screen name="+not-found" />
            </Drawer>
            <StatusBar style="auto" />
          </GestureHandlerRootView>
        </TabResetProvider>
      </AuthenticScoreProvider>
    </ThemeProvider>
  );
}
