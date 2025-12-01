import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { syncUserTimezone } from '@/lib/timezoneUtils';

declare global {
  interface Window {
    frameworkReady?: () => void;
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      window.frameworkReady?.();
    }

    const syncTimezone = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await syncUserTimezone(user.id);
        }
      } catch (error) {
        console.error('Error syncing timezone:', error);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          syncTimezone();
        }, { timeout: 5000 });
      } else {
        setTimeout(() => {
          syncTimezone();
        }, 3000);
      }
    } else {
      syncTimezone();
    }
  });
}
