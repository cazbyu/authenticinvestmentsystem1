import React, { useMemo } from 'react';
import { usePathname } from 'expo-router';
import { AuthenticScoreProvider } from './AuthenticScoreContext';
import { TabResetProvider } from './TabResetContext';

interface ConditionalProvidersProps {
  children: React.ReactNode;
}

const AUTHENTICATED_ROUTES = [
  '/(tabs)',
  '/calendar',
  '/followup',
  '/reflections',
  '/settings',
  '/coach',
  '/suggestions',
];

export function ConditionalProviders({ children }: ConditionalProvidersProps) {
  const pathname = usePathname();

  const needsAuthProvider = useMemo(() => {
    return AUTHENTICATED_ROUTES.some(route => pathname?.startsWith(route));
  }, [pathname]);

  if (needsAuthProvider) {
    return (
      <TabResetProvider>
        <AuthenticScoreProvider>
          {children}
        </AuthenticScoreProvider>
      </TabResetProvider>
    );
  }

  return (
    <TabResetProvider>
      {children}
    </TabResetProvider>
  );
}
