import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface NorthStarVisitState {
  lastVisitedAt: Date | null;
  shouldPulse: boolean;
  isLoading: boolean;
}

export function useNorthStarVisit() {
  const [state, setState] = useState<NorthStarVisitState>({
    lastVisitedAt: null,
    shouldPulse: false,
    isLoading: true,
  });

  // Fetch last visit time
  const fetchLastVisit = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-north-star-visits')
        .select('visited_at')
        .eq('user_id', user.id)
        .order('visited_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching NorthStar visit:', error);
        return;
      }

      const lastVisited = data?.visited_at ? new Date(data.visited_at) : null;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      setState({
        lastVisitedAt: lastVisited,
        shouldPulse: !lastVisited || lastVisited < twentyFourHoursAgo,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error in fetchLastVisit:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Record a new visit
  const recordVisit = useCallback(async (
    visitType: 'full_page' | 'mission_card' | 'compass_tap' = 'full_page'
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('0008-ap-north-star-visits')
        .insert({
          user_id: user.id,
          visit_type: visitType,
          visited_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error recording NorthStar visit:', error);
        return;
      }

      // Update local state immediately
      setState({
        lastVisitedAt: new Date(),
        shouldPulse: false,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error in recordVisit:', err);
    }
  }, []);

  useEffect(() => {
    fetchLastVisit();
  }, [fetchLastVisit]);

  return {
    ...state,
    recordVisit,
    refreshVisitStatus: fetchLastVisit,
  };
}