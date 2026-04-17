import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { formatLocalDate } from '../lib/dateUtils';

export interface Commitment {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  external_source: string;
  external_event_id: string;
  external_calendar_id: string | null;
  location: string | null;
  description: string | null;
  status: 'pending' | 'done' | 'missed';
  missed_reason: string | null;
  reviewed_at: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

interface UseCommitmentsOptions {
  date?: Date;
}

export function useCommitments({ date }: UseCommitmentsOptions = {}) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const targetDate = date || new Date();
  const dateStr = formatLocalDate(targetDate);

  const fetchCommitments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCommitments([]);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('0008-ap-commitments')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .order('is_all_day', { ascending: false })
        .order('start_time', { ascending: true, nullsFirst: true });

      if (queryError) throw queryError;

      setCommitments((data || []) as Commitment[]);
    } catch (err) {
      console.error('[useCommitments] Error:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  const markDone = useCallback(async (commitmentId: string) => {
    const { error } = await supabase
      .from('0008-ap-commitments')
      .update({
        status: 'done',
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commitmentId);

    if (error) {
      console.error('[useCommitments] Error marking done:', error);
      return false;
    }

    setCommitments(prev =>
      prev.map(c => c.id === commitmentId
        ? { ...c, status: 'done', reviewed_at: new Date().toISOString() }
        : c
      )
    );
    return true;
  }, []);

  const markMissed = useCallback(async (commitmentId: string, reason?: string) => {
    const { error } = await supabase
      .from('0008-ap-commitments')
      .update({
        status: 'missed',
        missed_reason: reason || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commitmentId);

    if (error) {
      console.error('[useCommitments] Error marking missed:', error);
      return false;
    }

    setCommitments(prev =>
      prev.map(c => c.id === commitmentId
        ? { ...c, status: 'missed', missed_reason: reason || null, reviewed_at: new Date().toISOString() }
        : c
      )
    );
    return true;
  }, []);

  return {
    commitments,
    loading,
    error,
    refetch: fetchCommitments,
    markDone,
    markMissed,
  };
}
