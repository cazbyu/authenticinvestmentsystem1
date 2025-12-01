import React from 'react';
import { AuthenticScoreProvider } from './AuthenticScoreContext';
import { TabResetProvider } from './TabResetContext';

interface ConditionalProvidersProps {
  children: React.ReactNode;
}

export function ConditionalProviders({ children }: ConditionalProvidersProps) {
  return (
    <TabResetProvider>
      <AuthenticScoreProvider>
        {children}
      </AuthenticScoreProvider>
    </TabResetProvider>
  );
}
