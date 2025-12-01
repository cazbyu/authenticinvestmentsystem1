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

const TAB_ROUTES = ['/(tabs)'];

export function ConditionalProviders({ children }: ConditionalProvidersProps) {
  const pathname = usePathname();

  const needsAuthProvider = useMemo(() => {
    return AUTHENTICATED_ROUTES.some(route => pathname?.startsWith(route));
  }, [pathname]);

  const needsTabProvider = useMemo(() => {
    return TAB_ROUTES.some(route => pathname?.startsWith(route));
  }, [pathname]);

  if (needsAuthProvider) {
    if (needsTabProvider) {
      return (
        <AuthenticScoreProvider>
          <TabResetProvider>
            {children}
          </TabResetProvider>
        </AuthenticScoreProvider>
      );
    }
    return (
      <AuthenticScoreProvider>
        {children}
      </AuthenticScoreProvider>
    );
  }

  return <>{children}</>;
}
