import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface CompassFocus {
  hasFocus: boolean;
  focusDomain: 'mission' | 'roles' | 'wellness' | 'goals' | null;
  focusSlot: string | null;
  focusNote: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  coachId: string | null;
}

export function useCompassFocus() {
  const { user } = useAuth();
  const [focus, setFocus] = useState<CompassFocus>({
    hasFocus: false,
    focusDomain: null,
    focusSlot: null,
    focusNote: null,
    effectiveFrom: null,
    effectiveUntil: null,
    coachId: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchCoachFocus = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const { data, error: fetchError } = await supabase
          .from('0008-ap-coach-client-meta')
          .select(`
            coach_id,
            compass_focus_domain,
            compass_focus_slot,
            compass_focus_note,
            compass_focus_effective_from,
            compass_focus_effective_until
          `)
          .eq('client_id', user.id)
          .not('compass_focus_domain', 'is', null)
          .lte('compass_focus_effective_from', today)
          .or(`compass_focus_effective_until.is.null,compass_focus_effective_until.gte.${today}`)
          .limit(1)
          .single();

        if (fetchError) {
          // No coach relationship or no focus set - this is normal, not an error
          if (fetchError.code === 'PGRST116') {
            setFocus({
              hasFocus: false,
              focusDomain: null,
              focusSlot: null,
              focusNote: null,
              effectiveFrom: null,
              effectiveUntil: null,
              coachId: null,
            });
          } else {
            throw fetchError;
          }
        } else if (data) {
          setFocus({
            hasFocus: true,
            focusDomain: data.compass_focus_domain,
            focusSlot: data.compass_focus_slot,
            focusNote: data.compass_focus_note,
            effectiveFrom: data.compass_focus_effective_from,
            effectiveUntil: data.compass_focus_effective_until,
            coachId: data.coach_id,
          });
        }
      } catch (err) {
        console.error('Error fetching coach focus:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch coach focus');
      } finally {
        setLoading(false);
      }
    };

    fetchCoachFocus();
  }, [user?.id]);

  return { ...focus, loading, error };
}