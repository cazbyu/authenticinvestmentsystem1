import { supabase } from './supabase';

export async function fetchPendingFollowUps(userId: string): Promise<FollowUpItem[]> {
  const { data, error } = await supabase
    .from('0008-ap-universal-follow-up-join')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('follow_up_date', { ascending: true });

  if (error) {
    console.error('Error fetching follow-ups:', error);
    return [];
  }
  return data || [];
}

export async function fetchPendingReflectionFollowUps(userId: string): Promise<FollowUpItem[]> {
  const { data, error } = await supabase
    .from('0008-ap-universal-follow-up-join')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('parent_type', 'reflection')
    .order('follow_up_date', { ascending: true });

  if (error) {
    console.error('Error fetching reflection follow-ups:', error);
    return [];
  }
  return data || [];
}

export async function markFollowUpDone(followUpId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('0008-ap-universal-follow-up-join')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
    })
    .eq('id', followUpId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking follow-up done:', error);
    return false;
  }
  return true;
}
