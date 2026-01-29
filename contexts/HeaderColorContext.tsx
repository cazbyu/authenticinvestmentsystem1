import React, { createContext, useContext, useState, useCallback } from 'react';

// Cardinal/Tab colors from ColorRing.tsx
export const TAB_COLORS = {
  'north-star': '#ed1c24',    // Red - North/Mission
  'north': '#ed1c24',         // Alias
  'wellness': '#39b54a',      // Green - East/Wellness
  'goals': '#0066b3',         // Blue - South/Goals
  'roles': '#752e87',         // Purple - West/Roles
  'dashboard': '#d4a500',     // Darker Gold - Center/Dashboard (was #ffd400)
  'default': '#0078d4',       // Default blue (fallback)
} as const;

type TabName = keyof typeof TAB_COLORS;

interface HeaderColorContextType {
  headerColor: string;
  setActiveTab: (tab: string) => void;
  activeTab: string;
}

const HeaderColorContext = createContext<HeaderColorContextType | undefined>(undefined);

export function HeaderColorProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTabState] = useState<string>('dashboard');
  const [headerColor, setHeaderColor] = useState<string>(TAB_COLORS.dashboard);

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    
    // Normalize tab name (remove leading slashes, handle variations)
    const normalizedTab = tab.replace(/^\/+/, '').toLowerCase();
    
    // Find matching color
    const color = TAB_COLORS[normalizedTab as TabName] || TAB_COLORS.default;
    setHeaderColor(color);
  }, []);

  return (
    <HeaderColorContext.Provider value={{ headerColor, setActiveTab, activeTab }}>
      {children}
    </HeaderColorContext.Provider>
  );
}

export function useHeaderColor() {
  const context = useContext(HeaderColorContext);
  if (context === undefined) {
    throw new Error('useHeaderColor must be used within a HeaderColorProvider');
  }
  return context;
}