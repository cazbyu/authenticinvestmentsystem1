import { useState, useEffect, useRef, startTransition } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const SESSION_CACHE_TTL = 5000;

interface AuthCache {
  session: Session | null;
  timestamp: number;
}

let globalCache: AuthCache | null = null;

export function useOptimizedAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    mounted.current = true;

    const fetchSession = async () => {
      try {
        const now = Date.now();

        if (globalCache && now - globalCache.timestamp < SESSION_CACHE_TTL) {
          startTransition(() => {
            setSession(globalCache!.session);
            setLoading(false);
          });
          return;
        }

        const supabase = getSupabaseClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error fetching session:', error);
        }

        globalCache = { session, timestamp: now };

        if (mounted.current) {
          startTransition(() => {
            setSession(session);
            setLoading(false);
          });
        }

        setTimeout(() => {
          if (!mounted.current) return;

          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (mounted.current) {
              startTransition(() => {
                setSession(newSession);
                globalCache = { session: newSession, timestamp: Date.now() };
              });
            }
          });

          subscriptionRef.current = subscription;
        }, 100);

      } catch (error) {
        console.error('Unexpected error:', error);
        if (mounted.current) {
          setLoading(false);
        }
      }
    };

    fetchSession();

    return () => {
      mounted.current = false;
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  return { session, loading };
}
