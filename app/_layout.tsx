import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthenticScoreProvider } from '@/contexts/AuthenticScoreContext';
import { TabResetProvider } from '@/contexts/TabResetContext';
import { MorningSparkProvider } from '@/contexts/MorningSparkContext';
import { HeaderColorProvider } from '@/contexts/HeaderColorContext';
import React from 'react';

console.log('[App] _layout.tsx (fallback) loaded');

export default function RootLayout() {
  console.log('[App] RootLayout rendering (fallback)');
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthenticScoreProvider>
        <TabResetProvider>
          <HeaderColorProvider>
            <MorningSparkProvider>
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
            </MorningSparkProvider>
          </HeaderColorProvider>
        </TabResetProvider>
      </AuthenticScoreProvider>
    </ThemeProvider>
  );
}
