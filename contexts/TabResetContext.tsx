import React, { createContext, useContext, useRef } from 'react';

interface TabResetContextType {
  registerResetHandler: (tabName: string, handler: () => void) => void;
  unregisterResetHandler: (tabName: string) => void;
  resetTab: (tabName: string) => void;
}

const TabResetContext = createContext<TabResetContextType | undefined>(undefined);

export function TabResetProvider({ children }: { children: React.ReactNode }) {
  const resetHandlers = useRef<Record<string, () => void>>({});

  const registerResetHandler = (tabName: string, handler: () => void) => {
    resetHandlers.current[tabName] = handler;
  };

  const unregisterResetHandler = (tabName: string) => {
    delete resetHandlers.current[tabName];
  };

  const resetTab = (tabName: string) => {
    const handler = resetHandlers.current[tabName];
    if (handler) {
      handler();
    }
  };

  return (
    <TabResetContext.Provider value={{ registerResetHandler, unregisterResetHandler, resetTab }}>
      {children}
    </TabResetContext.Provider>
  );
}

export function useTabReset() {
  const context = useContext(TabResetContext);
  if (!context) {
    throw new Error('useTabReset must be used within a TabResetProvider');
  }
  return context;
}
