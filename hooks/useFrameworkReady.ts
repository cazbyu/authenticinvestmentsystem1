import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { syncUserTimezone } from '@/lib/timezoneUtils';

declare global {
  interface Window {
    frameworkReady?: () => void;
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

    syncTimezone();
  });
}
