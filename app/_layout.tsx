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
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="landing" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="calendar" />
                <Stack.Screen name="followup" />
                <Stack.Screen name="reflections" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="coach" />
                <Stack.Screen name="terms" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="about" />
                <Stack.Screen name="contact" />
                <Stack.Screen name="suggestions" />
                <Stack.Screen name="auth/callback" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </MorningSparkProvider>
          </HeaderColorProvider>
        </TabResetProvider>
      </AuthenticScoreProvider>
    </ThemeProvider>
  );
}