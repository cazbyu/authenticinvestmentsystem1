import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface CoachNotification {
  unreadQuotes: number;
  unreadQuestions: number;
  total: number;
}

export function useCoachNotifications() {
  const [notifications, setNotifications] = useState<CoachNotification>({
    unreadQuotes: 0,
    unreadQuestions: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to real-time changes
    const supabase = getSupabaseClient();
    const quotesChannel = supabase
      .channel('coach-quotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: '0008-ap-user-power-quotes',
          filter: `source_type=eq.coach`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    const questionsChannel = supabase
      .channel('coach-questions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: '0008-ap-user-power-questions',
          filter: `source_type=eq.coach`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get unread coach quotes (never shown or not shown in last 24 hours)
      const { data: quotes } = await supabase
        .from('0008-ap-user-power-quotes')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_type', 'coach')
        .eq('is_active', true)
        .or('last_shown_at.is.null,last_shown_at.lt.' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Get unread coach questions
      const { data: questions } = await supabase
        .from('0008-ap-user-power-questions')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_type', 'coach')
        .eq('is_active', true)
        .or('last_shown_at.is.null,last_shown_at.lt.' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const unreadQuotes = quotes?.length || 0;
      const unreadQuestions = questions?.length || 0;

      setNotifications({
        unreadQuotes,
        unreadQuestions,
        total: unreadQuotes + unreadQuestions,
      });
    } catch (error) {
      console.error('Error fetching coach notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    // This will be called when user views North Star
    fetchNotifications();
  };

  return {
    notifications,
    loading,
    markAsRead,
  };
}
