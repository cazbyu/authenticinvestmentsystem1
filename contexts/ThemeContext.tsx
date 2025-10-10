import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/lib/supabase';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  refreshThemeColor: () => Promise<void>;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    success: string;
    warning: string;
    error: string;
  };
}

const DEFAULT_THEME_COLOR = '#0078d4';

const getLightColors = (themeColor: string) => ({
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  primary: themeColor,
  success: '#16a34a',
  warning: '#eab308',
  error: '#dc2626',
});

const getDarkColors = (themeColor: string) => ({
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  border: '#334155',
  primary: themeColor,
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
});

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);

  useEffect(() => {
    loadThemePreference();
    loadUserThemeColor();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const loadUserThemeColor = async () => {
    try {
      const cachedColor = await AsyncStorage.getItem('themeColor');
      if (cachedColor) {
        setThemeColor(cachedColor);
      }

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-users')
        .select('theme_color')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading theme color:', error);
        return;
      }

      if (data?.theme_color) {
        setThemeColor(data.theme_color);
        await AsyncStorage.setItem('themeColor', data.theme_color);
      }
    } catch (error) {
      console.error('Error loading user theme color:', error);
    }
  };

  const refreshThemeColor = async () => {
    await loadUserThemeColor();
  };

  const toggleDarkMode = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('theme', newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const colors = isDarkMode ? getDarkColors(themeColor) : getLightColors(themeColor);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, refreshThemeColor, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}