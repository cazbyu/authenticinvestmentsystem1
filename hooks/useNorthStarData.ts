import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface NorthStarCore {
  id: string;
  mission_statement: string | null;
  '5yr_vision': string | null;
  life_motto: string | null;
  core_values: string[];
}

interface Goal1Year {
  id: string;
  title: string;
  description: string | null;
  status: string;
  year_target_date: string | null;
  priority: number;
  created_at: string;
  updated_at: string | null;
}

interface PowerQuote {
  id: string;
  quote_text: string;
  attribution: string | null;
  source_type: 'self' | 'coach' | 'system';
  is_pinned: boolean;
  times_shown: number;
  created_at: string;
}

interface PowerQuestion {
  id: string;
  question_text: string;
  question_context: string | null;
  source_type: 'self' | 'coach' | 'system';
  is_pinned: boolean;
  times_shown: number;
  created_at: string;
}

interface NorthStarDataState {
  core: NorthStarCore | null;
  goals1Year: Goal1Year[];
  activeGoals: Goal1Year[];
  completedGoals: Goal1Year[];
  powerQuotes: PowerQuote[];
  powerQuestions: PowerQuestion[];
  isLoading: boolean;
  error: string | null;
}

export function useNorthStarData() {
  const [state, setState] = useState<NorthStarDataState>({
    core: null,
    goals1Year: [],
    activeGoals: [],
    completedGoals: [],
    powerQuotes: [],
    powerQuestions: [],
    isLoading: true,
    error: null,
  });

  const fetchAllData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false, error: 'Not authenticated' }));
        return;
      }

      // Fetch all data in parallel
      const [coreResult, goalsResult, quotesResult, questionsResult] = await Promise.all([
        // Core NorthStar data
        supabase
          .from('0008-ap-north-star')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        
        // 1-Year Goals
        supabase
          .from('0008-ap-goals-1y')
          .select('*')
          .eq('user_id', user.id)
          .is('archived_at', null)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false }),
        
        // Power Quotes (mission domain)
        supabase
          .from('0008-ap-user-power-quotes')
          .select('*')
          .eq('user_id', user.id)
          .eq('domain', 'mission')
          .eq('is_active', true)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        
        // Power Questions (mission domain)
        supabase
          .from('0008-ap-user-power-questions')
          .select('*')
          .eq('user_id', user.id)
          .eq('domain', 'mission')
          .eq('is_active', true)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      // Check for errors
      if (coreResult.error) console.error('Core fetch error:', coreResult.error);
      if (goalsResult.error) console.error('Goals fetch error:', goalsResult.error);
      if (quotesResult.error) console.error('Quotes fetch error:', quotesResult.error);
      if (questionsResult.error) console.error('Questions fetch error:', questionsResult.error);

      const goals = goalsResult.data || [];
      const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'in_progress');
      const completedGoals = goals.filter(g => g.status === 'completed');

      setState({
        core: coreResult.data,
        goals1Year: goals,
        activeGoals,
        completedGoals,
        powerQuotes: quotesResult.data || [],
        powerQuestions: questionsResult.data || [],
        isLoading: false,
        error: null,
      });

    } catch (err) {
      console.error('Error fetching NorthStar data:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load data',
      }));
    }
  }, []);

  // Save core NorthStar data
  const saveCore = useCallback(async (updates: Partial<NorthStarCore>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('0008-ap-north-star')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({ ...prev, core: data }));
      return { data };
    } catch (err) {
      console.error('Error saving core:', err);
      return { error: err };
    }
  }, []);

  // Create 1-year goal
  const createGoal1Year = useCallback(async (goal: Partial<Goal1Year>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Not authenticated' };

      const { data, error } = await supabase
        .from('0008-ap-goals-1y')
        .insert({
          user_id: user.id,
          title: goal.title,
          description: goal.description,
          year_target_date: goal.year_target_date,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh data
      await fetchAllData();
      return { data };
    } catch (err) {
      console.error('Error creating 1-year goal:', err);
      return { error: err };
    }
  }, [fetchAllData]);

  // Update goal status
  const updateGoalStatus = useCallback(async (goalId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('0008-ap-goals-1y')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', goalId);

      if (error) throw error;

      await fetchAllData();
      return { success: true };
    } catch (err) {
      console.error('Error updating goal status:', err);
      return { error: err };
    }
  }, [fetchAllData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    ...state,
    refreshData: fetchAllData,
    saveCore,
    createGoal1Year,
    updateGoalStatus,
  };
}